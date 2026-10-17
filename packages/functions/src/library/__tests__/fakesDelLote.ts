import { PDFDocument } from 'pdf-lib';
import type { Firestore } from 'firebase-admin/firestore';
import type { GeminiDelLote } from '../geminiDelLote';
import type { Lote, RespuestaCruda } from '../estadoDelLote';
import { lanzarLote, type CargaDeLote, type Dependencias } from '../orquestarLote';

/**
 * Los simuladores de las pruebas del lote: Firestore, Storage y Gemini en
 * memoria, y PDF reales en blanco. No es un archivo de pruebas (no termina en
 * `.test.ts`): lo importan `orquestarLote.test.ts` y `aplicarLote.test.ts`.
 */

/** Firestore en memoria: lo justo que usa la orquestación (doc, create, transacción, getAll). */
export function firestoreFalso() {
    const docs = new Map<string, Record<string, unknown>>();
    const actualizaciones: Array<{ path: string; campos: Record<string, unknown> }> = [];
    let fallarActualizacion: (path: string, campos: Record<string, unknown>) => boolean = () => false;
    const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x));
    // La «hora» de cada documento: sube con cada escritura (para `lastUpdateTime`).
    const versiones = new Map<string, number>();
    const tocar = (path: string) => versiones.set(path, (versiones.get(path) ?? 0) + 1);
    const hora = (path: string) => { const v = versiones.get(path) ?? 0; return { v, isEqual: (o: { v: number }) => o.v === v }; };
    const ref = (c: string, id: string) => ({
        path: `${c}/${id}`, id,
        get: async () => ({
            id, exists: docs.has(`${c}/${id}`), updateTime: hora(`${c}/${id}`),
            data: () => (docs.has(`${c}/${id}`) ? copia(docs.get(`${c}/${id}`)) : undefined),
        }),
        create: async (d: Record<string, unknown>) => {
            if (docs.has(`${c}/${id}`)) throw Object.assign(new Error('ALREADY_EXISTS'), { code: 6 });
            docs.set(`${c}/${id}`, copia(d));
        },
        set: async (d: Record<string, unknown>) => { docs.set(`${c}/${id}`, copia(d)); tocar(`${c}/${id}`); },
        update: async (d: Record<string, unknown>, condicion?: { lastUpdateTime?: { v: number } }) => {
            if (!docs.has(`${c}/${id}`)) throw new Error('NOT_FOUND');
            if (condicion?.lastUpdateTime && condicion.lastUpdateTime.v !== (versiones.get(`${c}/${id}`) ?? 0)) throw Object.assign(new Error('FAILED_PRECONDITION'), { code: 9 });
            tocar(`${c}/${id}`);
            actualizaciones.push({ path: `${c}/${id}`, campos: d });
            if (fallarActualizacion(`${c}/${id}`, d)) throw new Error('la escritura falló');
            docs.set(`${c}/${id}`, { ...docs.get(`${c}/${id}`), ...copia(d) });
        },
    });
    type Ref = ReturnType<typeof ref>;
    const db = {
        collection: (c: string) => {
            // Sólo lo que piden las fichas de extracción: una consulta que no encuentra nada.
            const consulta = { where: () => consulta, limit: () => consulta, get: async () => ({ empty: true, docs: [] }) };
            return { doc: (id: string) => ref(c, id), where: () => consulta };
        },
        doc: (path: string) => {
            const [c, id] = path.split('/');
            const r = ref(c!, id!);
            return { ...r, set: async (d: Record<string, unknown>, o?: { merge?: boolean }) => {
                docs.set(path, o?.merge ? { ...(docs.get(path) ?? {}), ...copia(d) } : copia(d));
            } };
        },
        getAll: (...refs: Ref[]) => Promise.all(refs.map(r => r.get())),
        runTransaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn({
            get: (r: Ref) => r.get(),
            set: (r: Ref, d: Record<string, unknown>) => { docs.set(r.path, copia(d)); },
        }),
    };
    return { db: db as unknown as Firestore, docs, actualizaciones, tocar, fallarEn: (f: typeof fallarActualizacion) => { fallarActualizacion = f; } };
}

export function geminiFalso() {
    const g = {
        subidos: [] as string[],
        jobs: [] as Array<{ nombre: string; pedidos: Array<{ indice: number; uri: string }> }>,
        cancelados: [] as string[],
        borrados: [] as string[],
        huerfano: null as string | null,
        estados: new Map<string, { estado: string; respuestas: RespuestaCruda[] | null }>(),
    };
    const api: GeminiDelLote = {
        subirPdf: async () => { const n = `files/${g.subidos.length}`; g.subidos.push(n); return { name: n, uri: `https://f/${n}` }; },
        crearJob: async (nombre, pedidos) => { g.jobs.push({ nombre, pedidos: [...pedidos] }); return `batches/${g.jobs.length}`; },
        buscarJob: async () => g.huerfano,
        verJob: async job => g.estados.get(job) ?? { estado: 'JOB_STATE_RUNNING', respuestas: null },
        cancelarJob: async job => { g.cancelados.push(job); },
        borrarArchivo: async n => { g.borrados.push(n); },
    };
    return { g, api };
}

export const texto = (n: number) => `Contenido legible de la página ${n} con bastante texto para contar como leída.`;
export const responder = (indice: number, paginas: number[]): RespuestaCruda => ({
    metadata: { tramo: String(indice) }, finishReason: 'STOP', error: null, entrada: 2000, salida: 1000,
    text: JSON.stringify({ pages: paginas.map(p => ({ page: p, md: texto(p) })) }),
});

export async function pdfDe(paginas: number): Promise<Buffer> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < paginas; i++) doc.addPage([200, 200]);
    return Buffer.from(await doc.save());
}

let PDF_25: Buffer;
let PDF_10: Buffer;
/** Llamar en `beforeAll`: los PDF de prueba (25 y 10 páginas en blanco). */
export async function prepararPdfs(): Promise<void> { PDF_25 = await pdfDe(25); PDF_10 = await pdfDe(10); }

export function armar(extra: Partial<{ archivos: Record<string, Buffer> }> = {}) {
    const { db, docs, actualizaciones, fallarEn, tocar } = firestoreFalso();
    const generaciones: Record<string, string> = {};
    const escritos = new Map<string, { contenido: string; contentType: string; sinPisar: boolean }>();
    const borrados: string[] = [];
    const { g, api } = geminiFalso();
    const guardados = new Map<string, string>();
    const archivos: Record<string, Buffer> = { 'users/u/a.pdf': PDF_25, 'users/u/b.pdf': PDF_10, ...extra.archivos };
    const encolados: CargaDeLote[] = [];
    const gastos: Array<{ entrada: number; salida: number }> = [];
    let reloj = 1_000_000;
    const d: Dependencias = {
        db, gemini: api, bucketPorDefecto: 'b',
        almacen: {
            bajar: async ({ path }) => {
                if (archivos[path]) return archivos[path]!;
                if (guardados.has(path)) return Buffer.from(guardados.get(path)!);
                throw Object.assign(new Error(`no existe ${path}`), { code: 404 });
            },
            borrar: async p => { borrados.push(p); guardados.delete(p); escritos.delete(p); },
            guardar: async (p, c) => { guardados.set(p, c); },
            leer: async p => guardados.get(p) ?? null,
            listar: async prefijo => [...guardados.keys()].filter(k => k.startsWith(prefijo)),
            generacion: async ({ path }) => generaciones[path] ?? '1',
            escribir: async (p, contenido, o) => {
                if (o.sinPisar && (escritos.has(p) || guardados.has(p))) throw new Error(`ya existe ${p}`);
                escritos.set(p, { contenido, contentType: o.contentType, sinPisar: !!o.sinPisar });
                guardados.set(p, contenido);
            },
        },
        ahora: () => (reloj += 1000),
        usdDeLote: (e, s) => (e * 0.375 + s * 1.875) / 1e6,
        registrarGasto: async uso => { gastos.push(uso); },
        encolar: async c => { encolados.push(c); },
    };
    const recurso = (id: string, extraR: Record<string, unknown> = {}) => (tocar(`library_resources/${id}`), docs.set(`library_resources/${id}`, {
        title: `Libro ${id}`, userId: 'u', mimeType: 'application/pdf', storageUrl: `gs://b/users/u/${id.toLowerCase()}.pdf`,
        textExtractionStatus: 'ready', extractionVersion: '3.0-llamaparse', ...extraR,
    }));
    recurso('A');
    recurso('B');
    const lote = () => docs.get('admin_lotes/b6') as unknown as Lote;
    return { d, g, docs, guardados, encolados, gastos, recurso, lote, generaciones, escritos, actualizaciones, fallarEn, borrados, tocar };
}

export const lanzar = (d: Dependencias, ids = ['A', 'B']) => lanzarLote(d, { nombre: 'b6', dueno: 'u', ids, estimadoUsd: 0.07, por: 'admin', email: 'a@x' });
export const PLAZO = Number.MAX_SAFE_INTEGER;
