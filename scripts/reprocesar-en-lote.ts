/**
 * Reproceso de libros de la biblioteca en LOTE (Gemini Batch API: mitad de
 * precio, hasta 24 h). Herramienta de administración; después irá a una
 * interfaz de super admin (decisión del fundador, 2026-10-15).
 *
 * Nunca deja un libro peor: el texto nuevo sólo reemplaza al actual si no le
 * faltan más páginas, no pierde griego ni hebreo, y mejora algo
 * (`compararExtracciones`). Antes de escribir guarda una copia del
 * `structured.md` anterior. No descuenta páginas del saldo del dueño.
 *
 * Uso (el estado vive en scripts/.lotes/<nombre>/):
 *   npx tsx scripts/reprocesar-en-lote.ts preparar <nombre> --ids id1,id2 [--por-tramo 20]
 *   npx tsx scripts/reprocesar-en-lote.ts estado <nombre>
 *   npx tsx scripts/reprocesar-en-lote.ts reintentar <nombre>      # parte en dos los tramos que fallaron
 *   npx tsx scripts/reprocesar-en-lote.ts aplicar <nombre>         # compara y muestra, no escribe
 *   npx tsx scripts/reprocesar-en-lote.ts aplicar <nombre> --escribir   # escribe en PRODUCCIÓN
 *
 * Necesita GEMINI_API_KEY en el entorno y credenciales de Google por defecto.
 */
import admin from 'firebase-admin';
import { GoogleGenAI } from '@google/genai';
import { PDFDocument } from 'pdf-lib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    compararExtracciones, leerRespuestaDeTramo, medirTexto, partirTramo, pedidoDeTramo, planearTramos, tramosQueFaltan, unirPaginas,
    PAGINAS_POR_TRAMO, type Tramo,
} from '../packages/functions/src/library/loteDeExtraccion';
import { camposDeMedicion, capaDeTextoPorPagina } from '../packages/functions/src/library/medirExtraccion';
import { censusOf } from '../packages/functions/src/library/scriptCensus';
import { truncateUtf8 } from '../packages/functions/src/library/truncateUtf8';
import { MODEL_VISION } from '../packages/functions/src/llm/modelCatalog';
import type { GeminiPage } from '../packages/functions/src/library/geminiExtraction';
import { ubicacionEnStorage } from './lib/storage';

const PROJECT_ID = 'dosfilosapp';
const BUCKET = 'dosfilosapp.firebasestorage.app';
const LIMITE_TEXTCONTENT = 900_000;
const VERSION = '6.0-gemini-cola';
const MODELO_VIEJO = new Set(['4.0-gemini-standard', '6.0-gemini-cola', '2.0-gemini']);
/** Precio del lote = la mitad del de línea (USD por millón; 3.8 Flash hasta 2026-12-31). Supuesto: documentado por Google, a confirmar en la factura. */
const PRECIO_LOTE = { entrada: 0.75 / 2, salida: 3.75 / 2 };

interface TramoDelLote extends Tramo { rid: string; ronda: number; indice: number; estado: 'pendiente' | 'ok' | 'fallo' | 'incompleto' | 'reemplazado'; motivo?: string; faltan?: Tramo[] }
interface Estado {
    nombre: string;
    creado: string;
    libros: Array<{ rid: string; titulo: string; uid: string; totalPaginas: number }>;
    rondas: Array<{ job: string; creada: string }>;
    tramos: TramoDelLote[];
    uso: { entrada: number; salida: number };
}

const [, , comando, nombre] = process.argv;
const opcion = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const dir = () => join('scripts', '.lotes', nombre!);
const leerEstado = (): Estado => JSON.parse(readFileSync(join(dir(), 'estado.json'), 'utf8'));
const guardarEstado = (e: Estado) => writeFileSync(join(dir(), 'estado.json'), JSON.stringify(e, null, 1));
const archivoDePaginas = (rid: string) => join(dir(), `${rid}.paginas.json`);

if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function bajar(url: string | undefined): Promise<Buffer | null> {
    const en = ubicacionEnStorage(url);
    if (!en) return null;
    const [b] = await admin.storage().bucket(en.bucket).file(en.ruta).download();
    return b;
}

async function cargarPdf(buf: Buffer): Promise<PDFDocument> {
    try { return await PDFDocument.load(buf); } catch { return PDFDocument.load(buf, { ignoreEncryption: true }); }
}

/** Corta los tramos, los sube a Gemini y crea un lote con ellos. */
async function crearRonda(estado: Estado, tramos: TramoDelLote[]): Promise<void> {
    const pedidos = [];
    const pdfs = new Map<string, PDFDocument>();
    for (const t of tramos) {
        if (!pdfs.has(t.rid)) {
            const doc = await admin.firestore().collection('library_resources').doc(t.rid).get();
            pdfs.set(t.rid, await cargarPdf((await bajar(doc.data()?.storageUrl))!));
        }
        const src = pdfs.get(t.rid)!;
        const dst = await PDFDocument.create();
        for (const p of await dst.copyPages(src, Array.from({ length: t.hasta - t.desde + 1 }, (_, i) => t.desde - 1 + i))) dst.addPage(p);
        const subido = await ai.files.upload({ file: new Blob([await dst.save()], { type: 'application/pdf' }), config: { mimeType: 'application/pdf' } });
        pedidos.push(pedidoDeTramo(subido.uri!));
        process.stdout.write('.');
    }
    const job = await ai.batches.create({ model: MODEL_VISION, src: pedidos, config: { displayName: `reproceso-${estado.nombre}-r${estado.rondas.length + 1}` } });
    estado.rondas.push({ job: job.name!, creada: new Date().toISOString() });
    console.log(`\nlote creado: ${job.name} (${pedidos.length} tramos)`);
}

async function preparar(): Promise<void> {
    const ids = (opcion('--ids') ?? '').split(',').map(s => s.trim()).filter(Boolean);
    if (!nombre || ids.length === 0) throw new Error('Uso: preparar <nombre> --ids id1,id2');
    if (existsSync(dir())) throw new Error(`Ya existe ${dir()}`);
    mkdirSync(dir(), { recursive: true });
    const porTramo = Number(opcion('--por-tramo') ?? PAGINAS_POR_TRAMO);
    const estado: Estado = { nombre, creado: new Date().toISOString(), libros: [], rondas: [], tramos: [], uso: { entrada: 0, salida: 0 } };
    const saltados: string[] = [];
    for (const rid of ids) {
        const doc = await admin.firestore().collection('library_resources').doc(rid).get();
        const d = doc.data();
        if (!d) throw new Error(`No existe ${rid}`);
        // Un PDF que pdf-lib no puede abrir (mal formado) no frena el lote:
        // se salta y se avisa. La extracción en línea tampoco podría cortarlo.
        let total: number;
        try {
            total = (await cargarPdf((await bajar(d.storageUrl))!)).getPageCount();
        } catch (err) {
            saltados.push(`${String(d.title).slice(0, 60)} (${rid}): ${err instanceof Error ? err.message.slice(0, 80) : err}`);
            continue;
        }
        estado.libros.push({ rid, titulo: String(d.title ?? ''), uid: d.userId, totalPaginas: total });
        for (const t of planearTramos(total, porTramo)) estado.tramos.push({ ...t, rid, ronda: 1, indice: -1, estado: 'pendiente' });
        console.log(`${String(d.title).slice(0, 60)}: ${total} páginas`);
    }
    if (saltados.length > 0) console.log(`SALTADOS (el PDF no se pudo abrir):\n  ${saltados.join('\n  ')}`);
    estado.tramos.forEach((t, i) => { t.indice = i; });
    await crearRonda(estado, estado.tramos);
    guardarEstado(estado);
    const paginas = estado.libros.reduce((n, l) => n + l.totalPaginas, 0);
    console.log(`${estado.libros.length} libros, ${paginas} páginas, ${estado.tramos.length} tramos. Ver: estado ${nombre}`);
}

/** Recoge lo que terminó; deja los tramos en ok o fallo. */
async function recoger(estado: Estado): Promise<boolean> {
    let todo = true;
    for (let r = 0; r < estado.rondas.length; r++) {
        const job = await ai.batches.get({ name: estado.rondas[r]!.job });
        const tramos = estado.tramos.filter(t => t.ronda === r + 1);
        console.log(`ronda ${r + 1}: ${job.state} (${tramos.length} tramos)`);
        if (job.state !== 'JOB_STATE_SUCCEEDED') { if (tramos.some(t => t.estado === 'pendiente')) todo = false; continue; }
        const respuestas = job.dest?.inlinedResponses ?? [];
        tramos.forEach((t, i) => {
            if (t.estado !== 'pendiente') return;
            const resp = respuestas[i];
            const cand = resp?.response?.candidates?.[0];
            const leido = leerRespuestaDeTramo({
                text: cand?.content?.parts?.map(p => p.text ?? '').join('') ?? '',
                finishReason: cand?.finishReason ?? null,
                error: resp?.error ?? (resp ? null : 'sin respuesta'),
            }, t);
            const u = resp?.response?.usageMetadata;
            estado.uso.entrada += u?.promptTokenCount ?? 0;
            estado.uso.salida += (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0);
            if (!leido.ok) { t.estado = 'fallo'; t.motivo = leido.motivo; return; }
            const previas: GeminiPage[] = existsSync(archivoDePaginas(t.rid)) ? JSON.parse(readFileSync(archivoDePaginas(t.rid), 'utf8')) : [];
            writeFileSync(archivoDePaginas(t.rid), JSON.stringify([...previas, ...leido.paginas]));
            const faltan = tramosQueFaltan(t, leido.paginas);
            if (faltan.length > 0) {
                t.estado = 'incompleto';
                t.faltan = faltan;
                t.motivo = `devolvió ${leido.paginas.length} de ${t.hasta - t.desde + 1}`;
                return;
            }
            t.estado = 'ok';
        });
    }
    guardarEstado(estado);
    const costo = (estado.uso.entrada * PRECIO_LOTE.entrada + estado.uso.salida * PRECIO_LOTE.salida) / 1e6;
    const fallos = estado.tramos.filter(t => t.estado === 'fallo' || t.estado === 'incompleto');
    console.log(`tramos: ${estado.tramos.filter(t => t.estado === 'ok').length} ok, ${fallos.length} con falla o incompletos, ${estado.tramos.filter(t => t.estado === 'pendiente').length} pendientes. Costo estimado en lote: US$${costo.toFixed(2)}`);
    for (const f of fallos.slice(0, 20)) console.log(`  falla ${f.rid.slice(0, 8)} ${f.desde}-${f.hasta}: ${f.motivo}`);
    return todo;
}

async function reintentar(): Promise<void> {
    const estado = leerEstado();
    await recoger(estado);
    const fallos = estado.tramos.filter(t => t.estado === 'fallo' || t.estado === 'incompleto');
    if (fallos.length === 0) { console.log('No hay tramos que reintentar.'); return; }
    const ronda = estado.rondas.length + 1;
    // Un tramo que falló entero se parte en dos; uno incompleto pide sólo lo que faltó.
    const nuevos: TramoDelLote[] = fallos.flatMap(f => (f.estado === 'incompleto' ? f.faltan ?? [] : partirTramo(f))
        .map(t => ({ ...t, rid: f.rid, ronda, indice: -1, estado: 'pendiente' as const })));
    fallos.forEach(f => { f.estado = 'reemplazado'; f.motivo = `partido en la ronda ${ronda}`; });
    nuevos.forEach((t, i) => { t.indice = estado.tramos.length + i; });
    estado.tramos.push(...nuevos);
    await crearRonda(estado, nuevos);
    guardarEstado(estado);
}

async function aplicar(): Promise<void> {
    const escribir = process.argv.includes('--escribir');
    const estado = leerEstado();
    await recoger(estado);
    for (const libro of estado.libros) {
        const pendientes = estado.tramos.filter(t => t.rid === libro.rid && (t.estado === 'pendiente' || t.estado === 'fallo'));
        const incompletos = estado.tramos.filter(t => t.rid === libro.rid && t.estado === 'incompleto').length;
        if (incompletos > 0) console.log(`  (${libro.titulo.slice(0, 40)}: ${incompletos} tramos incompletos; «reintentar» pide las páginas que faltaron)`);
        if (pendientes.length > 0) { console.log(`- ${libro.titulo.slice(0, 50)}: faltan ${pendientes.length} tramos; se espera`); continue; }
        const ref = admin.firestore().collection('library_resources').doc(libro.rid);
        const d = (await ref.get()).data()!;
        const pdf = (await bajar(d.storageUrl))!;
        const capa = await capaDeTextoPorPagina(pdf, 300_000);
        const nuevo = unirPaginas(existsSync(archivoDePaginas(libro.rid)) ? JSON.parse(readFileSync(archivoDePaginas(libro.rid), 'utf8')) : []);
        const mdActual = d.structuredContentUrl ? (await bajar(d.structuredContentUrl))!.toString('utf8') : '';
        const tcActual = typeof d.textContent === 'string' ? d.textContent : '';
        const medidaActual = medirTexto(mdActual || tcActual, capa, tcActual);
        const medidaNueva = medirTexto(nuevo.markdown, capa, nuevo.texto);
        const mejoraPorModelo = MODELO_VIEJO.has(d.extractionVersion) ? d.extractionModel !== MODEL_VISION : d.extractionVersion !== VERSION;
        // Una sola copia del texto actual: `structured.md` y `textContent` son el
        // mismo libro, y sumarlos contaba dos veces su griego y su hebreo.
        const escritura = (t: string) => (t.match(/[\u0370-\u03FF\u1F00-\u1FFF\u0590-\u05FF]/g) ?? []).length;
        const textoActual = escritura(mdActual) >= escritura(tcActual) ? mdActual : tcActual;
        const cmp = compararExtracciones({ texto: textoActual, medicion: medidaActual }, { texto: nuevo.markdown, medicion: medidaNueva }, mejoraPorModelo);
        console.log(`- ${libro.titulo.slice(0, 50)}: ${cmp.reemplazar ? 'REEMPLAZA' : 'se queda como está'} — ${cmp.motivo}`
            + ` | faltantes ${cmp.actual.faltantes}→${cmp.nueva.faltantes}, hebreo ${cmp.actual.hebreo}→${cmp.nueva.hebreo}, griego ${cmp.actual.griego}→${cmp.nueva.griego}`);
        if (!escribir || !cmp.reemplazar) continue;

        const bucket = admin.storage().bucket();
        const mdPath = `users/${libro.uid}/library/${libro.rid}/structured.md`;
        if (mdActual) {
            await bucket.file(`users/${libro.uid}/library/${libro.rid}/structured.antes-del-lote-${estado.nombre}.md`).save(mdActual, { contentType: 'text/markdown; charset=utf-8' });
        }
        await bucket.file(mdPath).save(nuevo.markdown, { contentType: 'text/markdown; charset=utf-8', metadata: { resourceId: libro.rid, extractionVersion: VERSION } });
        const recortado = truncateUtf8(nuevo.texto, LIMITE_TEXTCONTENT);
        // Dos escrituras: el indexador automático se dispara al PASAR a «ready».
        await ref.update({ textExtractionStatus: 'processing', updatedAt: new Date() });
        await ref.update({
            ...camposDeMedicion(medidaNueva, admin.firestore.FieldValue.delete()),
            textContent: recortado,
            textExtractionStatus: 'ready',
            extractedAt: new Date(),
            pageCount: nuevo.paginas.length,
            characterCount: nuevo.texto.length,
            extractedWithGemini: true,
            extractedWithLlamaParse: false,
            extractionVersion: VERSION,
            extractionModel: MODEL_VISION,
            structuredContentUrl: `gs://${BUCKET}/${mdPath}`,
            needsReindex: true,
            wasTruncated: recortado.length < nuevo.texto.length,
            extractionError: null,
            extractionFailureReason: null,
            extractionWarning: null,
            scriptCensus: censusOf(nuevo.texto),
            reprocesadoEnLote: { lote: estado.nombre, fecha: new Date(), motivo: cmp.motivo },
            updatedAt: new Date(),
        });
        console.log(`  escrito; el índice se rehace solo`);
    }
}

const comandos: Record<string, () => Promise<unknown>> = {
    preparar,
    estado: async () => recoger(leerEstado()),
    reintentar,
    aplicar,
};
if (!comando || !comandos[comando]) {
    console.error('Comandos: preparar | estado | reintentar | aplicar');
    process.exit(1);
}
comandos[comando]!().catch(err => { console.error(err); process.exit(1); });
