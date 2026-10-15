/**
 * Auditoría de la extracción de una biblioteca: qué libros perdieron páginas,
 * cuáles tienen el texto estructurado vacío y cuáles leyó el modelo viejo.
 *
 * Mide con LO MISMO que producción (`medirExtraccion` y la capa de texto de
 * pdfjs), así que el informe y la tarjeta del libro dicen lo mismo. Nació de
 * la auditoría del 2026-10-15 sobre la biblioteca del fundador: 11 libros con
 * páginas perdidas (Varner, 17), 13 con el texto estructurado vacío y 17
 * leídos con Gemini 2.5.
 *
 * Uso:
 *   npx tsx scripts/auditar-biblioteca.ts --uid <uid>                 # sólo informa
 *   npx tsx scripts/auditar-biblioteca.ts --uid <uid> --json out.json # y guarda el detalle
 *   npx tsx scripts/auditar-biblioteca.ts --uid <uid> --escribir      # completa los campos en PRODUCCIÓN
 *
 * `--escribir` deja en cada recurso `pdfPageCount`, `paginasFaltantes` y
 * `textoEstructuradoVacio` (los mismos campos que escribe hoy la extracción).
 * Escribe en producción: correrlo sólo con el OK del dueño de la biblioteca.
 */
import admin from 'firebase-admin';
import { writeFileSync } from 'node:fs';
import { camposDeMedicion, capaDeTextoPorPagina, medirExtraccion } from '../packages/functions/src/library/medirExtraccion';

const PROJECT_ID = 'dosfilosapp';
const BUCKET = 'dosfilosapp.firebasestorage.app';
const VERSIONES_DE_VISION = new Set(['4.0-gemini-standard', '6.0-gemini-cola', '2.0-gemini']);
const MODELO_ACTUAL = 'gemini-3.8-flash';

function arg(nombre: string): string | undefined {
    const i = process.argv.indexOf(nombre);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

/** `gs://bucket/ruta` o la URL de descarga de Firebase → ruta dentro del bucket. */
export function ubicacionEnStorage(url: string | undefined): { bucket: string; ruta: string } | null {
    if (!url) return null;
    if (url.startsWith('gs://')) {
        const [bucket, ...ruta] = url.slice(5).split('/');
        return { bucket: bucket!, ruta: ruta.join('/') };
    }
    const m = url.match(/\/b\/([^/]+)\/o\/([^?]+)/);
    return m ? { bucket: m[1]!, ruta: decodeURIComponent(m[2]!) } : null;
}

interface Fila {
    id: string;
    titulo: string;
    version: string | null;
    modelo: string | null;
    pdfPageCount: number | null;
    faltantes: number;
    faltantesLista: number[];
    textoVacio: boolean;
    modeloViejo: boolean;
    hebreo: number;
    griego: number;
    error?: string;
}

async function main(): Promise<void> {
    const uid = arg('--uid');
    if (!uid) throw new Error('Falta --uid <uid>');
    const escribir = process.argv.includes('--escribir');
    if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET });
    const db = admin.firestore();

    const snap = await db.collection('library_resources').where('userId', '==', uid).get();
    console.log(`${snap.size} recursos de ${uid}${escribir ? ' — ESCRIBIENDO en producción' : ' (sólo lectura)'}`);

    const filas: Fila[] = [];
    for (const doc of snap.docs) {
        const d = doc.data();
        const fila: Fila = {
            id: doc.id, titulo: String(d.title ?? ''), version: d.extractionVersion ?? null, modelo: d.extractionModel ?? null,
            pdfPageCount: null, faltantes: 0, faltantesLista: [], textoVacio: false,
            modeloViejo: VERSIONES_DE_VISION.has(d.extractionVersion) && d.extractionModel !== MODELO_ACTUAL,
            hebreo: 0, griego: 0,
        };
        try {
            const pdfEn = ubicacionEnStorage(d.storageUrl);
            if (!pdfEn || !pdfEn.ruta.toLowerCase().endsWith('.pdf')) { filas.push(fila); continue; }
            const [pdf] = await admin.storage().bucket(pdfEn.bucket).file(pdfEn.ruta).download();
            const capa = await capaDeTextoPorPagina(pdf, 300_000);
            const mdEn = ubicacionEnStorage(d.structuredContentUrl);
            const md = mdEn ? (await admin.storage().bucket(mdEn.bucket).file(mdEn.ruta).download())[0].toString('utf8') : '';
            const respaldo = typeof d.textContent === 'string' ? d.textContent : '';
            // Sin `structured.md`, la única fuente es `textContent`; si está
            // truncado, todo lo que quedó después del corte parecería faltar:
            // no se mide (total desconocido).
            const soloTruncado = !md && d.wasTruncated === true;
            const medicion = medirExtraccion(md || respaldo, soloTruncado ? null : capa?.length ?? null, capa, respaldo);
            const todo = md + respaldo;
            Object.assign(fila, {
                pdfPageCount: medicion.pdfPageCount,
                faltantes: medicion.paginasFaltantes.total,
                faltantesLista: medicion.paginasFaltantes.paginas,
                textoVacio: medicion.textoVacio,
                hebreo: (todo.match(/[֐-׿]/g) ?? []).length,
                griego: (todo.match(/[Ͱ-Ͽἀ-῿]/g) ?? []).length,
            });
            if (escribir) {
                await doc.ref.update({ ...camposDeMedicion(medicion, admin.firestore.FieldValue.delete()), updatedAt: new Date() });
            }
        } catch (err) {
            fila.error = err instanceof Error ? err.message : String(err);
        }
        filas.push(fila);
        process.stdout.write('.');
    }
    console.log('\n');

    const conProblema = filas.filter(f => f.faltantes > 0 || f.textoVacio || f.modeloViejo || f.error);
    for (const f of conProblema.sort((a, b) => b.faltantes - a.faltantes)) {
        const que = [
            f.faltantes ? `faltan ${f.faltantes}/${f.pdfPageCount} (${f.faltantesLista.slice(0, 12).join(', ')}${f.faltantes > 12 ? '…' : ''})` : '',
            f.textoVacio ? 'texto estructurado vacío' : '',
            f.modeloViejo ? `modelo viejo (${f.modelo ?? 'gemini-2.5'})` : '',
            f.error ? `error: ${f.error}` : '',
        ].filter(Boolean).join('; ');
        console.log(`- ${f.titulo.slice(0, 50).padEnd(50)} | ${String(f.version ?? '-').padEnd(22)} | ${que}`);
    }
    console.log(`\n${conProblema.length} de ${filas.length} con algo que revisar.`);
    const salida = arg('--json');
    if (salida) writeFileSync(salida, JSON.stringify(filas, null, 1));
}

main().catch(err => { console.error(err); process.exit(1); });
