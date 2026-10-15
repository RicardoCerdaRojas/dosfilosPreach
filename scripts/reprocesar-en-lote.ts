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
 *   (… --aceptar-incompletos: aplica aunque queden páginas omitidas sin reintentar)
 *
 * Necesita GEMINI_API_KEY en el entorno y credenciales de Google por defecto.
 */
import admin from 'firebase-admin';
import { GoogleGenAI } from '@google/genai';
import { PDFDocument } from 'pdf-lib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    compararExtracciones, leerRespuestaDeTramo, medirTexto, partirTramo, rellenarConCapa, separarEnBlanco, pedidoDeTramo, planearTramos, tramosQueFaltan, unirPaginas,
    PAGINAS_POR_TRAMO, type Tramo,
} from '../packages/functions/src/library/loteDeExtraccion';
import { camposDeMedicion } from '../packages/functions/src/library/medirExtraccion';
import { leerPaginasDelPdf } from '../packages/functions/src/library/textoDelPdf';
import { censusOf } from '../packages/functions/src/library/scriptCensus';
import { truncateUtf8 } from '../packages/functions/src/library/truncateUtf8';
import { MODEL_VISION } from '../packages/functions/src/llm/modelCatalog';
import { pricingFor } from '../packages/functions/src/llm/llmCost';
import type { GeminiPage } from '../packages/functions/src/library/geminiExtraction';
import { ubicacionEnStorage } from './lib/storage';

const PROJECT_ID = 'dosfilosapp';
const BUCKET = 'dosfilosapp.firebasestorage.app';
const LIMITE_TEXTCONTENT = 900_000;
const VERSION = '6.0-gemini-cola';
const MODELO_VIEJO = new Set(['4.0-gemini-standard', '6.0-gemini-cola', '2.0-gemini']);
/** Precio del lote = la mitad del de línea. Supuesto: documentado por Google, a confirmar en la factura. */
const precioDelLote = () => { const p = pricingFor(MODEL_VISION); return { entrada: p.inputPer1M / 2, salida: p.outputPer1M / 2 }; };
/** Estados finales de un lote que no terminó bien: sus tramos pendientes ya no van a volver. */
const TERMINO_MAL = new Set(['JOB_STATE_FAILED', 'JOB_STATE_CANCELLED', 'JOB_STATE_EXPIRED']);

interface TramoDelLote extends Tramo {
    rid: string;
    ronda: number;
    indice: number;
    /** `abandonado`: una página sola que falló dos veces seguidas (en blanco, ilegible); no frena al libro. */
    estado: 'pendiente' | 'ok' | 'fallo' | 'incompleto' | 'reemplazado' | 'abandonado';
    motivo?: string;
    faltan?: Tramo[];
    /** Veces seguidas que esta página se pidió sola. */
    intento?: number;
}
interface Estado {
    nombre: string;
    creado: string;
    libros: Array<{ rid: string; titulo: string; uid: string; totalPaginas: number }>;
    rondas: Array<{ job: string; creada: string; archivos?: string[]; archivosBorrados?: boolean }>;
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
    const archivos: string[] = [];
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
        if (subido.name) archivos.push(subido.name);
        process.stdout.write('.');
    }
    const job = await ai.batches.create({ model: MODEL_VISION, src: pedidos, config: { displayName: `reproceso-${estado.nombre}-r${estado.rondas.length + 1}` } });
    estado.rondas.push({ job: job.name!, creada: new Date().toISOString(), archivos });
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

/** Los tramos subidos ocupan cuota de la Files API hasta que vencen (48 h): se borran al leer la ronda. */
async function borrarArchivos(ronda: Estado['rondas'][number]): Promise<void> {
    if (ronda.archivosBorrados || !ronda.archivos?.length) return;
    await Promise.all(ronda.archivos.map(name => ai.files.delete({ name }).catch(() => undefined)));
    ronda.archivosBorrados = true;
}

/**
 * Revisa los tramos «ok» contra TODAS las páginas guardadas del libro: una
 * página que volvió en blanco (y que ninguna ronda posterior llenó) deja el
 * tramo incompleto para que `reintentar` la pida otra vez.
 */
function revisarTramosOk(estado: Estado): void {
    for (const libro of estado.libros) {
        const ok = estado.tramos.filter(t => t.rid === libro.rid && t.estado === 'ok');
        if (ok.length === 0 || !existsSync(archivoDePaginas(libro.rid))) continue;
        const unidas = unirPaginas(JSON.parse(readFileSync(archivoDePaginas(libro.rid), 'utf8'))).paginas;
        // Una página abandonada cuenta como devuelta: ya no se pide.
        const abandonadas = estado.tramos.filter(t => t.rid === libro.rid && t.estado === 'abandonado')
            .flatMap(t => Array.from({ length: t.hasta - t.desde + 1 }, (_, i) => ({ page: t.desde + i, md: '(abandonada)' })));
        for (const t of ok) {
            const faltan = tramosQueFaltan(t, [...unidas, ...abandonadas].filter(p => p.page >= t.desde && p.page <= t.hasta));
            if (faltan.length === 0) continue;
            t.estado = 'incompleto';
            t.faltan = faltan;
            t.motivo = `páginas en blanco: ${faltan.map(f => f.desde === f.hasta ? f.desde : `${f.desde}-${f.hasta}`).join(', ')}`;
        }
    }
}

/** Recoge lo que terminó; deja los tramos en ok o fallo. */
async function recoger(estado: Estado): Promise<boolean> {
    let todo = true;
    for (let r = 0; r < estado.rondas.length; r++) {
        const job = await ai.batches.get({ name: estado.rondas[r]!.job });
        const tramos = estado.tramos.filter(t => t.ronda === r + 1);
        console.log(`ronda ${r + 1}: ${job.state} (${tramos.length} tramos)`);
        if (job.state && TERMINO_MAL.has(job.state)) {
            tramos.filter(t => t.estado === 'pendiente').forEach(t => { t.estado = 'fallo'; t.motivo = `el lote terminó en ${job.state}`; });
            await borrarArchivos(estado.rondas[r]!);
            continue;
        }
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
        guardarEstado(estado);
        await borrarArchivos(estado.rondas[r]!);
    }
    revisarTramosOk(estado);
    guardarEstado(estado);
    const precio = precioDelLote();
    const costo = (estado.uso.entrada * precio.entrada + estado.uso.salida * precio.salida) / 1e6;
    const fallos = estado.tramos.filter(t => t.estado === 'fallo' || t.estado === 'incompleto');
    console.log(`tramos: ${estado.tramos.filter(t => t.estado === 'ok').length} ok, ${fallos.length} con falla o incompletos, ${estado.tramos.filter(t => t.estado === 'pendiente').length} pendientes. Costo estimado en lote: US$${costo.toFixed(2)}`);
    for (const f of fallos.slice(0, 20)) console.log(`  falla ${f.rid.slice(0, 8)} ${f.desde}-${f.hasta}: ${f.motivo}`);
    return todo;
}

/** El texto de la capa del PDF por página (pdfjs tarda minutos en un libro grande: se guarda en el lote). */
async function textoDeLaCapa(rid: string): Promise<string[] | null> {
    const archivo = join(dir(), `${rid}.capa-texto.json`);
    if (existsSync(archivo)) return JSON.parse(readFileSync(archivo, 'utf8'));
    const d = (await admin.firestore().collection('library_resources').doc(rid).get()).data()!;
    try {
        const textos = (await leerPaginasDelPdf((await bajar(d.storageUrl))!, Date.now() + 300_000)).map(p => p.text);
        writeFileSync(archivo, JSON.stringify(textos));
        return textos;
    } catch (err) {
        console.warn(`  sin capa de texto para ${rid}: ${err instanceof Error ? err.message : err}`);
        return null;
    }
}

/** Caracteres (sin espacios) de la capa por página: lo mismo que mide producción. */
async function capaDelLibro(rid: string): Promise<number[] | null> {
    return (await textoDeLaCapa(rid))?.map(t => t.replace(/\s/g, '').length) ?? null;
}

async function reintentar(): Promise<void> {
    const estado = leerEstado();
    await recoger(estado);
    // Páginas que volvieron en blanco y en el PDF también lo están: no se piden más.
    for (const f of estado.tramos.filter(t => t.estado === 'incompleto' && t.faltan?.length)) {
        const { pedir, enBlanco } = separarEnBlanco(f.faltan!, await capaDelLibro(f.rid));
        if (enBlanco.length === 0) continue;
        estado.tramos.push(...enBlanco.map(n => ({ desde: n, hasta: n, rid: f.rid, ronda: 0, indice: -1, estado: 'abandonado' as const, motivo: 'en blanco también en el PDF' })));
        f.faltan = pedir;
        if (pedir.length === 0) { f.estado = 'ok'; f.motivo = `páginas en blanco en el PDF: ${enBlanco.join(', ')}`; }
    }
    const fallos = estado.tramos.filter(t => t.estado === 'fallo' || t.estado === 'incompleto');
    if (fallos.length === 0) { console.log('No hay tramos que reintentar.'); return; }
    const ronda = estado.rondas.length + 1;
    // Una página sola que ya falló sola una vez no se pide más (en blanco o
    // ilegible): sin esto se pediría para siempre y frenaría al libro.
    const sola = (t: Tramo) => t.desde === t.hasta;
    // También: una página sola que volvió en blanco ya por segunda vez (antes en
    // un tramo mayor), y un tramo chico que RECITATION sigue cortando. Al
    // aplicar, esas páginas se rellenan con la capa de texto del PDF.
    const abandonar = fallos.filter(f => (sola(f) && ((f.intento ?? 1) >= 2 || (f.estado === 'incompleto' && f.ronda > 1)))
        || (f.estado === 'fallo' && /RECITATION/.test(f.motivo ?? '') && f.hasta - f.desde < 3));
    abandonar.forEach(f => { f.estado = 'abandonado'; f.motivo = `${f.motivo ?? ''}; se abandona tras ${f.intento} intentos`; });
    const reintentables = fallos.filter(f => !abandonar.includes(f));
    if (reintentables.length === 0) { guardarEstado(estado); console.log(`No hay tramos que reintentar (${abandonar.length} páginas abandonadas).`); return; }
    // Un tramo que falló entero se parte en dos; uno incompleto pide sólo lo que faltó.
    // Si lo que falta es el tramo entero (volvió todo en blanco), se parte:
    // pedirlo igual otra vez no avanza nunca.
    const aPedir = (f: TramoDelLote): Tramo[] => {
        const faltan = f.estado === 'incompleto' ? f.faltan ?? [] : [];
        const sinAvance = faltan.length === 0 || (faltan.length === 1 && faltan[0]!.desde === f.desde && faltan[0]!.hasta === f.hasta);
        return sinAvance ? partirTramo(f) : faltan;
    };
    const nuevos: TramoDelLote[] = reintentables.flatMap(f => aPedir(f)
        .map(t => ({ ...t, rid: f.rid, ronda, indice: -1, estado: 'pendiente' as const, intento: sola(t) && sola(f) ? (f.intento ?? 1) + 1 : 1 })));
    reintentables.forEach(f => { f.estado = 'reemplazado'; f.motivo = `partido en la ronda ${ronda}`; });
    nuevos.forEach((t, i) => { t.indice = estado.tramos.length + i; });
    estado.tramos.push(...nuevos);
    await crearRonda(estado, nuevos);
    guardarEstado(estado);
}

async function aplicar(): Promise<void> {
    const escribir = process.argv.includes('--escribir');
    const aceptarIncompletos = process.argv.includes('--aceptar-incompletos');
    const estado = leerEstado();
    await recoger(estado);
    for (const libro of estado.libros) {
        const delLibro = estado.tramos.filter(t => t.rid === libro.rid);
        // Un tramo incompleto todavía tiene páginas por pedir: aplicar ahora y
        // otra vez después de reintentar dejaría un respaldo de la versión parcial.
        const pendientes = delLibro.filter(t => t.estado === 'pendiente' || t.estado === 'fallo' || (t.estado === 'incompleto' && !aceptarIncompletos));
        const abandonadas = delLibro.filter(t => t.estado === 'abandonado').map(t => t.desde);
        if (pendientes.length > 0) { console.log(`- ${libro.titulo.slice(0, 50)}: faltan ${pendientes.length} tramos (${pendientes.map(t => t.estado).join(', ')}); se espera`); continue; }
        if (abandonadas.length > 0) console.log(`  (${libro.titulo.slice(0, 40)}: páginas abandonadas ${abandonadas.join(', ')})`);
        const ref = admin.firestore().collection('library_resources').doc(libro.rid);
        const d = (await ref.get()).data()!;
        const capa = await capaDelLibro(libro.rid);
        const leidas: GeminiPage[] = existsSync(archivoDePaginas(libro.rid)) ? JSON.parse(readFileSync(archivoDePaginas(libro.rid), 'utf8')) : [];
        const relleno = rellenarConCapa(leidas, libro.totalPaginas, (await textoDeLaCapa(libro.rid)) ?? []);
        if (relleno.rellenadas.length > 0) console.log(`  (${libro.titulo.slice(0, 40)}: ${relleno.rellenadas.length} páginas con el texto del PDF: ${relleno.rellenadas.slice(0, 15).join(', ')}${relleno.rellenadas.length > 15 ? '…' : ''})`);
        const nuevo = unirPaginas(relleno.paginas);
        const mdActual = d.structuredContentUrl ? (await bajar(d.structuredContentUrl))!.toString('utf8') : '';
        const tcActual = typeof d.textContent === 'string' ? d.textContent : '';
        const medidaActual = medirTexto(mdActual || tcActual, libro.totalPaginas, capa, tcActual);
        const medidaNueva = medirTexto(nuevo.markdown, libro.totalPaginas, capa, nuevo.texto);
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
        const carpeta = `users/${libro.uid}/library/${libro.rid}`;
        const mdPath = `${carpeta}/structured.md`;
        // Respaldo de AMBOS textos (en los libros de LlamaParse el md trae sólo
        // marcas y el texto real vive en `textContent`), con la hora en el
        // nombre y sin pisar nunca uno anterior.
        const sello = `antes-del-lote-${estado.nombre}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
        const sinPisar = { preconditionOpts: { ifGenerationMatch: 0 } };
        if (mdActual) await bucket.file(`${carpeta}/structured.${sello}.md`).save(mdActual, { contentType: 'text/markdown; charset=utf-8', ...sinPisar });
        if (tcActual) await bucket.file(`${carpeta}/textContent.${sello}.txt`).save(tcActual, { contentType: 'text/plain; charset=utf-8', ...sinPisar });
        await bucket.file(mdPath).save(nuevo.markdown, { contentType: 'text/markdown; charset=utf-8', metadata: { resourceId: libro.rid, extractionVersion: VERSION } });
        const recortado = truncateUtf8(nuevo.texto, LIMITE_TEXTCONTENT);
        try {
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
                reprocesadoEnLote: { lote: estado.nombre, fecha: new Date(), motivo: cmp.motivo, paginasConTextoDelPdf: relleno.rellenadas },
                updatedAt: new Date(),
            });
        } catch (err) {
            // El libro no puede quedar con el md nuevo y el documento viejo, ni
            // en «processing» (el barrido lo marcaría fallido): se deshace.
            if (mdActual) await bucket.file(mdPath).save(mdActual, { contentType: 'text/markdown; charset=utf-8' });
            await ref.update({ textExtractionStatus: d.textExtractionStatus ?? 'ready', updatedAt: new Date() });
            throw err;
        }
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
