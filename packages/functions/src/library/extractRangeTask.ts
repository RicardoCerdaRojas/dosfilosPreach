import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { getFunctions } from 'firebase-admin/functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { extraerRangoDelPdf } from './geminiExtraction';


import { rutaDeRango } from './corridaDeExtraccion';
import {
    procesarRango,
    type CargaDeRango,
    type PuertasDeRango,
} from './procesarRango';

// `CargaDeRango` se define junto a la orquestación y se reexporta acá porque
// es el contrato de la cola: quien encola lo importa desde la tarea.
export type { CargaDeRango };
import { ensamblarDesdeRangos, limpiarRangos } from './ensamblarExtraccion';
import { parseFirebaseStorageLocation } from './storageLocation';
import { truncateUtf8 } from './truncateUtf8';
import { consumePagesAdmin } from './processingBalance';

export const EXTRACTION_VERSION = '6.0-gemini-cola';
const FIRESTORE_TEXT_LIMIT_BYTES = 900_000;
const COLA = 'locations/us-central1/functions/extractRangeTask';

/** Encola un rango. Se usa desde el callable que arranca y desde esta misma tarea. */
export async function encolarRango(carga: CargaDeRango): Promise<void> {
    await getFunctions().taskQueue(COLA).enqueue(carga, { dispatchDeadlineSeconds: 900 });
}

/**
 * Un rango de páginas de un libro, extraído por visión.
 *
 * POR QUÉ EXISTE. La extracción entera vivía dentro de una invocación, y eso
 * tiene un techo duro: 900 s. Medido, un rango tarda ~200 s, así que caben
 * cuatro o cinco — suficiente para una gramática de 170 páginas y muy
 * insuficiente para un diccionario de 1 006, que necesita ~25. En treinta días
 * de registros, el camino de visión no completó NINGÚN libro de más de 80
 * páginas.
 *
 * Acá cada rango es su propia invocación, con sus propios 900 s y sus propios
 * reintentos, y encola al siguiente cuando termina. El libro deja de tener un
 * plazo único que cumplir.
 *
 * POR QUÉ CADENA Y NO ABANICO. El tamaño de rango se MIDE del primero (ver
 * `calibrarTanda`). Encolarlos todos de entrada obligaría a adivinar ese
 * número, que es justamente lo que se eliminó al medirlo. La cadena paga reloj
 * de pared —un diccionario son ~83 min— y a cambio nunca adivina. El abanico es
 * una optimización posterior, cuando la cadena esté probada.
 *
 * LO QUE ESTA TAREA GARANTIZA:
 *
 * - **Idempotencia.** Cloud Tasks reintenta. Una tarea que murió DESPUÉS de
 *   escribir su rango no vuelve a pagar la llamada al modelo: mira si su
 *   archivo ya existe y sigue de largo.
 * - **Latido.** Escribe `extractionHeartbeatAt` al empezar y al terminar. Sin
 *   eso, `sweepStalledExtractions` mataría a los 20 minutos un diccionario que
 *   legítimamente tarda 83: ese barrido decide por la hora de ARRANQUE, y con
 *   la cadena esa hora deja de significar nada.
 * - **Una corrida a la vez.** Una tarea cuyo `runId` ya no es el vigente se
 *   retira. Dos extracciones del mismo libro lanzadas con minutos de
 *   diferencia mezclarían sus páginas sin forma de saber cuál es cuál.
 */
export const extractRangeTask = onTaskDispatched(
    {
        region: 'us-central1',
        memory: '2GiB',
        timeoutSeconds: 900,
        secrets: ['GEMINI_API_KEY'],
        retryConfig: {
            // Tres intentos. Lo que se arregla solo acá es una caída transitoria
            // de la API; lo que no, queda escrito como `failed` con el rango que
            // rompió, y los rangos ya hechos se conservan.
            maxAttempts: 3,
            minBackoffSeconds: 30,
        },
        rateLimits: {
            // La cadena procesa un rango por vez POR LIBRO, pero pueden correr
            // varios libros a la vez. Tres es el mismo techo que usa el
            // indexado para no pelear contra la cuota del modelo.
            maxConcurrentDispatches: 3,
        },
    },
    async (req) => {
        const carga = req.data as CargaDeRango;
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error(`[Rango] ${carga?.resourceId}: falta GEMINI_API_KEY`);
            throw new Error('falta GEMINI_API_KEY');
        }

        const resultado = await procesarRango(puertasReales(apiKey), carga);

        if (resultado.estado === 'descartado') {
            console.log(`[Rango] ${carga?.resourceId}: ${resultado.motivo}; se retira`);
        } else if (resultado.estado === 'siguiente') {
            console.log(
                `⛓️ [Rango] ${carga.resourceId}: encolado ${resultado.rango.desde}-${resultado.rango.hasta}` +
                ` (de a ${resultado.tamano})`,
            );
        }
        // Un error de las puertas se propaga a propósito: es lo que hace que
        // Cloud Tasks reintente, y la idempotencia evita repetir lo ya hecho.
    },
);

/**
 * Las puertas contra la nube de verdad.
 *
 * La orquestación vive en `procesarRango`, que no conoce Firestore ni Storage.
 * Esto es el adaptador: lo único que hace es traducir cada operación a su
 * servicio. Se separaron porque los dos defectos que rompieron la extracción en
 * cola estaban en el cableado y no en las piezas, y mientras todo esto viviera
 * dentro del cuerpo del disparador no había forma de recorrerlo sin la
 * plataforma.
 */
function puertasReales(apiKey: string): PuertasDeRango {
    const db = getFirestore();
    const refDe = (id: string) => db.collection('library_resources').doc(id);

    return {
        async leerRecurso(resourceId) {
            const snap = await refDe(resourceId).get();
            if (!snap.exists) return null;
            const d = snap.data()!;
            return { userId: d.userId, extractionRunId: d.extractionRunId };
        },

        async latir(resourceId) {
            await refDe(resourceId).update({ extractionHeartbeatAt: FieldValue.serverTimestamp() });
        },

        async rangoYaEscrito(recurso, carga, rango) {
            const ruta = rutaDeRango(recurso.userId, carga.resourceId, carga.runId, rango);
            const [existe] = await getStorage().bucket().file(ruta).exists();
            if (existe) {
                console.log(`[Rango] ${carga.resourceId} ${rango.desde}-${rango.hasta}: ya estaba escrito; se salta la lectura`);
            }
            return existe;
        },

        async extraerRango(recurso, carga, rango, laSiguienteRelee) {
            const snap = await refDe(carga.resourceId).get();
            const { bucket: nombreBucket, path: rutaPdf } = parseFirebaseStorageLocation(
                snap.data()?.storageUrl || '', getStorage().bucket().name,
            );
            const temporal = path.join(
                os.tmpdir(), `${carga.resourceId}-${carga.runId}-${rango.desde}-${rango.hasta}.pdf`,
            );
            await getStorage().bucket(nombreBucket).file(rutaPdf).download({ destination: temporal });
            try {
                console.log(
                    `📦 [Rango] ${carga.resourceId}: páginas ${rango.desde}-${rango.hasta} de ${carga.totalPaginas}`,
                );
                return await extraerRangoDelPdf(
                    temporal, carga.resourceId, apiKey, rango.desde, rango.hasta,
                    { userId: recurso.userId, laSiguienteRelee },
                );
            } finally {
                try { fs.unlinkSync(temporal); } catch { /* el temporal ya no importa */ }
            }
        },

        async guardarRango(recurso, carga, rango, paginas) {
            const ruta = rutaDeRango(recurso.userId, carga.resourceId, carga.runId, rango);
            await getStorage().bucket().file(ruta).save(JSON.stringify(paginas), {
                contentType: 'application/json; charset=utf-8',
                metadata: { resourceId: carga.resourceId, runId: carga.runId, rango: `${rango.desde}-${rango.hasta}` },
            });
            console.log(
                `✅ [Rango] ${carga.resourceId} ${rango.desde}-${rango.hasta}: ${paginas.length} páginas guardadas`,
            );
        },

        async guardarTamano(resourceId, tamano) {
            console.log(`📐 [Rango] ${resourceId}: el resto va de a ${tamano} páginas`);
            await refDe(resourceId).update({ paginasPorTanda: tamano });
        },

        async guardarAvance(resourceId, avance) {
            await refDe(resourceId).update({
                extractionHeartbeatAt: FieldValue.serverTimestamp(),
                extractionProgress: avance,
                updatedAt: new Date(),
            });
        },

        encolar: encolarRango,

        async terminar(recurso, carga) {
            const snap = await refDe(carga.resourceId).get();
            await ensamblarYGuardar(
                refDe(carga.resourceId), recurso.userId, carga.resourceId,
                carga.runId, carga.totalPaginas, snap.data()!.userId,
            );
        },
    };
}

/**
 * Ensambla, guarda y deja el recurso listo.
 *
 * Si el ensamblado falla —le falta un tramo—, el recurso queda `failed` con el
 * motivo y **los rangos NO se borran**: un reintento los reusa por
 * idempotencia, en vez de volver a pagar el libro entero.
 */
async function ensamblarYGuardar(
    ref: FirebaseFirestore.DocumentReference,
    userId: string,
    resourceId: string,
    runId: string,
    totalPaginas: number,
    dueño: string,
): Promise<void> {
    const libro = await ensamblarDesdeRangos(userId, resourceId, runId, totalPaginas);

    const bucket = getStorage().bucket();
    const mdPath = `users/${userId}/library/${resourceId}/structured.md`;
    await bucket.file(mdPath).save(libro.markdown, {
        contentType: 'text/markdown; charset=utf-8',
        metadata: { resourceId, extractionVersion: EXTRACTION_VERSION },
    });

    const recortado = truncateUtf8(libro.text, FIRESTORE_TEXT_LIMIT_BYTES);

    await ref.update({
        textContent: recortado,
        textExtractionStatus: 'ready',
        extractedAt: new Date(),
        pageCount: libro.pageCount,
        characterCount: libro.text.length,
        extractedWithGemini: true,
        extractedWithLlamaParse: false,
        extractionVersion: EXTRACTION_VERSION,
        structuredContentUrl: `gs://${bucket.name}/${mdPath}`,
        needsReindex: true,
        wasTruncated: recortado.length < libro.text.length,
        // El motivo del intento anterior se limpia: un recurso que termina bien
        // no puede seguir mostrándose como fallido.
        extractionError: null,
        extractionFailureReason: null,
        extractionProgress: FieldValue.delete(),
        updatedAt: new Date(),
    });

    console.log(
        `🧩 [Rango] ${resourceId}: ${libro.pageCount} páginas de ${libro.rangosLeidos} rangos — listo`,
    );

    // El cobro y la limpieza van DESPUÉS de guardar, y sus fallos no revierten
    // nada: la extracción ya salió bien y no se le devuelve un libro roto a
    // nadie por un contador.
    try {
        await consumePagesAdmin(dueño, 'standard', libro.pageCount);
    } catch (err) {
        console.warn(`[Rango] ${resourceId}: no se pudo descontar el saldo:`, err);
    }
    await limpiarRangos(userId, resourceId, runId);
}
