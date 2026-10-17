import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { getFunctions } from 'firebase-admin/functions';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import { writeAuditLog, writeAuditLogAndWait } from '../admin/auditLog';
import { MODEL_VISION } from '../llm/modelCatalog';
import { estimateUsd } from '../llm/llmCost';
import { recordLlmUsage } from '../llm/llmUsageRecorder';
import { geminiDelLote } from './geminiDelLote';
import { aplicarLibro, compararLibro } from './aplicarLote';
import { COLECCION_DE_LOTES, resumirLote, type Lote } from './estadoDelLote';
import {
    abandonarLibroEnTarea, cancelarLote, ErrorDelLote, lanzarLote, procesarLibro, reintentarLote, sondearLote,
    type CargaDeLote, type Dependencias,
} from './orquestarLote';

/**
 * Las funciones del reproceso en lote desde el panel (fase «lote desde el
 * panel de super admin», PR 2: lanzar y seguir). Todas sólo para super admin;
 * la lógica vive en `orquestarLote` y `estadoDelLote`.
 */

const COLA = 'locations/us-central1/functions/batchBookTask';
/** La Batch API cobra la mitad del precio de lista. */
const FACTOR_DE_LOTE = 0.5;
const INTENTOS_POR_LIBRO = 3;

/** Comparar y aplicar no llaman a Gemini: no necesitan la clave. */
function dependenciasSinGemini(): Dependencias {
    return dependenciasCon(null);
}

const sinGemini = new Proxy({}, { get: () => () => { throw new Error('esta función no usa Gemini'); } }) as Dependencias['gemini'];

function dependencias(): Dependencias {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY secret not configured');
    return dependenciasCon(apiKey);
}

function dependenciasCon(apiKey: string | null): Dependencias {
    const bucket = admin.storage().bucket();
    return {
        db: admin.firestore(),
        bucketPorDefecto: bucket.name,
        almacen: {
            bajar: async ({ bucket: b, path }) => (await admin.storage().bucket(b).file(path).download())[0],
            generacion: async ({ bucket: b, path }) => {
                const [meta] = await admin.storage().bucket(b).file(path).getMetadata();
                return meta.generation !== undefined ? String(meta.generation) : null;
            },
            borrar: async path => { await bucket.file(path).delete({ ignoreNotFound: true }); },
            escribir: async (path, contenido, o) => {
                await bucket.file(path).save(contenido, {
                    contentType: o.contentType,
                    ...(o.metadata ? { metadata: { metadata: o.metadata } } : {}),
                    ...(o.sinPisar ? { preconditionOpts: { ifGenerationMatch: 0 } } : {}),
                });
            },
            guardar: async (path, contenido) => { await bucket.file(path).save(contenido, { contentType: 'application/json; charset=utf-8' }); },
            leer: async path => {
                const archivo = bucket.file(path);
                const [existe] = await archivo.exists();
                return existe ? (await archivo.download())[0].toString('utf8') : null;
            },
            listar: async prefijo => (await bucket.getFiles({ prefix: prefijo }))[0].map(f => f.name),
        },
        gemini: apiKey ? geminiDelLote(apiKey) : sinGemini,
        ahora: () => Date.now(),
        usdDeLote: (entrada, salida) => estimateUsd(MODEL_VISION, entrada, salida) * FACTOR_DE_LOTE,
        registrarGasto: uso => recordLlmUsage({
            feature: 'library.batchReprocess', model: MODEL_VISION,
            inputTokens: uso.entrada, outputTokens: uso.salida, factorDePrecio: FACTOR_DE_LOTE,
        }),
        // Id fijo por libro y ronda: volver a encolar (el sondeo lo hace con lo
        // que no dio señales) nunca crea una segunda tarea para lo mismo.
        encolar: async carga => {
            try {
                await getFunctions().taskQueue<CargaDeLote>(COLA).enqueue(carga, {
                    dispatchDeadlineSeconds: 900,
                    id: `${carga.loteId}-${carga.rid}-r${carga.ronda}`,
                });
            } catch (err) {
                if ((err as { code?: string }).code !== 'functions/task-already-exists') throw err;
            }
        },
    };
}

/** Sólo super admin (el rol vive en `users/{uid}.role`). Devuelve su correo para la auditoría. */
export async function exigirSuperAdmin(request: CallableRequest): Promise<{ uid: string; email: string | null }> {
    if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated');
    const yo = await admin.firestore().collection('users').doc(request.auth.uid).get();
    if (!yo.exists || yo.data()?.role !== 'super_admin') throw new HttpsError('permission-denied', 'Super admin only');
    return { uid: request.auth.uid, email: (request.auth.token.email as string | undefined) ?? null };
}

function comoHttps(err: unknown): never {
    if (err instanceof ErrorDelLote) throw new HttpsError(err.codigo, err.message);
    throw err;
}

const idDeLote = (data: unknown) => {
    const id = (data as { loteId?: unknown } | undefined)?.loteId;
    if (typeof id !== 'string' || !id) throw new HttpsError('invalid-argument', 'Falta el lote');
    return id;
};

export const launchBatch = onCall({ ...appCheckCallableOptions(), secrets: ['GEMINI_API_KEY'], timeoutSeconds: 300 }, async request => {
    const yo = await exigirSuperAdmin(request);
    const data = (request.data ?? {}) as { nombre?: unknown; ownerUid?: unknown; ids?: unknown; estimadoUsd?: unknown };
    const dueno = typeof data.ownerUid === 'string' && data.ownerUid.trim() ? data.ownerUid.trim() : yo.uid;
    const ids = Array.isArray(data.ids) ? data.ids.filter((x): x is string => typeof x === 'string') : [];
    const r = await lanzarLote(dependencias(), {
        nombre: String(data.nombre ?? ''), dueno, ids,
        estimadoUsd: typeof data.estimadoUsd === 'number' ? data.estimadoUsd : 0,
        por: yo.uid, email: yo.email,
    }).catch(comoHttps);
    writeAuditLog({ actorUid: yo.uid, actorEmail: yo.email ?? undefined, action: 'library.batch_launch', targetUid: dueno, details: { lote: r.id, libros: r.libros, estimadoUsd: data.estimadoUsd ?? null } });
    return r;
});

export const retryBatch = onCall({ ...appCheckCallableOptions(), secrets: ['GEMINI_API_KEY'], timeoutSeconds: 300 }, async request => {
    const yo = await exigirSuperAdmin(request);
    const loteId = idDeLote(request.data);
    const r = await reintentarLote(dependencias(), loteId, `boton-${yo.uid}`).catch(comoHttps);
    writeAuditLog({ actorUid: yo.uid, actorEmail: yo.email ?? undefined, action: 'library.batch_retry', details: { lote: loteId, ...r } });
    return r;
});

export const cancelBatch = onCall({ ...appCheckCallableOptions(), secrets: ['GEMINI_API_KEY'], timeoutSeconds: 300 }, async request => {
    const yo = await exigirSuperAdmin(request);
    const loteId = idDeLote(request.data);
    await cancelarLote(dependencias(), loteId).catch(comoHttps);
    writeAuditLog({ actorUid: yo.uid, actorEmail: yo.email ?? undefined, action: 'library.batch_cancel', details: { lote: loteId } });
    return { ok: true };
});

const idDeLibro = (data: unknown) => {
    const rid = (data as { rid?: unknown } | undefined)?.rid;
    if (typeof rid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(rid)) throw new HttpsError('invalid-argument', 'Falta el libro');
    return rid;
};

/** «Comparar»: el texto actual de un libro contra el nuevo (no escribe el libro). */
export const compareBatchBook = onCall({ ...appCheckCallableOptions(), timeoutSeconds: 300, memory: '2GiB' }, async request => {
    await exigirSuperAdmin(request);
    return compararLibro(dependenciasSinGemini(), idDeLote(request.data), idDeLibro(request.data)).catch(comoHttps);
});

/** «Aplicar»: reemplaza el texto del libro si mejora sin perder nada (respaldo, reindexado, ficha, auditoría). */
export const applyBatchBook = onCall({ ...appCheckCallableOptions(), timeoutSeconds: 300, memory: '2GiB' }, async request => {
    const yo = await exigirSuperAdmin(request);
    const loteId = idDeLote(request.data);
    const rid = idDeLibro(request.data);
    const aceptarIncompletos = (request.data as { aceptarIncompletos?: unknown }).aceptarIncompletos === true;
    const dueno = (await admin.firestore().collection(COLECCION_DE_LOTES).doc(loteId).get()).data()?.dueno as string | undefined;
    // La auditoría se escribe apenas el libro cambió, esperándola: si después
    // falla anotarlo en el lote, el cambio igual queda registrado.
    return aplicarLibro(dependenciasSinGemini(), { loteId, rid, aceptarIncompletos, por: yo.uid }, r => writeAuditLogAndWait({
        actorUid: yo.uid, actorEmail: yo.email ?? undefined, action: 'library.batch_apply', targetUid: dueno,
        details: { lote: loteId, rid, aceptarIncompletos, motivo: r.motivo },
    })).catch(comoHttps);
});

/** Los lotes, del más nuevo al más viejo, resumidos (sin los recortes ni las marcas internas). */
export const getBatchJobs = onCall({ ...appCheckCallableOptions() }, async request => {
    await exigirSuperAdmin(request);
    const s = await admin.firestore().collection(COLECCION_DE_LOTES).orderBy('creado', 'desc').limit(30).get();
    return { lotes: s.docs.map(d => resumirLote(d.data() as Lote)) };
});

/**
 * Un libro de un lote: lo prepara (ronda 1) o sube sus tramos de un
 * reintento. Una tarea por libro porque preparar 30 libros tardó 23 minutos
 * (medido) y una invocación dura como mucho 15. 4 GiB: un PDF de 250 MB con
 * pdf-lib y pdfjs no entra seguro en 2.
 */
export const batchBookTask = onTaskDispatched<CargaDeLote>(
    {
        region: 'us-central1',
        memory: '4GiB',
        timeoutSeconds: 900,
        secrets: ['GEMINI_API_KEY'],
        retryConfig: { maxAttempts: INTENTOS_POR_LIBRO, minBackoffSeconds: 60 },
        rateLimits: { maxConcurrentDispatches: 3 },
    },
    async request => {
        const inicio = Date.now();
        const d = dependencias();
        try {
            await procesarLibro(d, request.data, inicio + 780_000);
        } catch (err) {
            // El último intento deja el libro saltado (o sus tramos en «fallo»):
            // sin eso, el lote esperaría para siempre a un libro que no llega.
            if ((request.retryCount ?? 0) + 1 >= INTENTOS_POR_LIBRO) {
                await abandonarLibroEnTarea(d, request.data, `no se pudo preparar: ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`);
                return;
            }
            throw err;
        }
    },
);

/** Cada 10 minutos recoge lo que terminó en los lotes en marcha. */
export const pollBatchJobs = onSchedule(
    // 2 GiB: las respuestas de un job de 60 libros son decenas de MB de texto, copiadas al leerlas.
    { schedule: 'every 10 minutes', secrets: ['GEMINI_API_KEY'], timeoutSeconds: 540, memory: '2GiB' },
    async () => {
        const db = admin.firestore();
        const activos = await db.collection(COLECCION_DE_LOTES).where('estado', 'in', ['preparando', 'en-curso']).get();
        if (activos.empty) return;
        const d = dependencias();
        for (const lote of activos.docs) {
            try {
                await sondearLote(d, lote.id, `sondeo-${Date.now()}`);
            } catch (err) {
                console.error(`[lote] no se pudo revisar ${lote.id}`, err);
            }
        }
    },
);
