import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { getFunctions } from 'firebase-admin/functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { extraerRangoDelPdf } from './geminiExtraction';
import { densidadDe, densidadDeReferencia, tamanoParaDensidad } from './calibrarTanda';
import { siguienteRango, planDeRangos, type Rango } from './planDeRangos';
import { rutaDeRango, porcentajeDeAvance } from './corridaDeExtraccion';
import { ensamblarDesdeRangos, limpiarRangos } from './ensamblarExtraccion';
import { parseFirebaseStorageLocation } from './storageLocation';
import { truncateUtf8 } from './truncateUtf8';
import { consumePagesAdmin } from './processingBalance';

export const EXTRACTION_VERSION = '6.0-gemini-cola';
const FIRESTORE_TEXT_LIMIT_BYTES = 900_000;
const COLA = 'locations/us-central1/functions/extractRangeTask';

export interface CargaDeRango {
    resourceId: string;
    runId: string;
    desde: number;
    hasta: number;
    tamano: number;
    /**
     * Densidad más alta (tokens por página) vista hasta aquí en este libro.
     *
     * Viaja entre tareas porque la cadena no tiene otra memoria: cada tarea
     * nace sabiendo sólo lo que le pasaron. Sin esto, cada rango calibraría
     * contra su propio tramo y un capítulo liviano volvería a agrandar la
     * tanda justo antes de un tramo denso.
     */
    densidadMaxima?: number | null;
}

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
        const { resourceId, runId, desde, hasta, tamano } = carga ?? {};
        const densidadPrevia = carga?.densidadMaxima ?? null;
        if (!resourceId || !runId || !desde || !hasta) {
            console.error('[Rango] carga incompleta; se descarta', carga);
            return;
        }

        const db = getFirestore();
        const ref = db.collection('library_resources').doc(resourceId);
        const snap = await ref.get();
        if (!snap.exists) {
            console.error(`[Rango] ${resourceId}: el recurso ya no existe; se descarta`);
            return;
        }
        const data = snap.data()!;

        // Una corrida vieja no debe seguir escribiendo sobre una nueva.
        if (data.extractionRunId !== runId) {
            console.log(`[Rango] ${resourceId}: corrida ${runId} ya no es la vigente; se retira`);
            return;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error(`[Rango] ${resourceId}: falta GEMINI_API_KEY`);
            throw new Error('falta GEMINI_API_KEY');
        }

        const userId: string = data.userId;
        const totalPaginas: number = data.pageCount;
        const rango: Rango = { desde, hasta };
        const etiqueta = `${desde}-${hasta}`;

        await ref.update({ extractionHeartbeatAt: FieldValue.serverTimestamp() });

        const bucket = getStorage().bucket();
        const destino = bucket.file(rutaDeRango(userId, resourceId, runId, rango));

        let tamanoParaElResto = tamano;
        let densidadParaElResto = densidadPrevia;

        const [yaEstaba] = await destino.exists();
        if (yaEstaba) {
            // Reintento de una tarea que ya había terminado su parte. Volver a
            // leerlo costaría ~200 s y una llamada al modelo, por nada.
            console.log(`[Rango] ${resourceId} ${etiqueta}: ya estaba escrito; se salta la lectura`);
        } else {
            const { bucket: nombreBucket, path: rutaPdf } = parseFirebaseStorageLocation(
                data.storageUrl || '', bucket.name,
            );
            const temporal = path.join(os.tmpdir(), `${resourceId}-${runId}-${etiqueta}.pdf`);
            await getStorage().bucket(nombreBucket).file(rutaPdf).download({ destination: temporal });

            try {
                console.log(`📦 [Rango] ${resourceId}: páginas ${etiqueta} de ${totalPaginas}`);
                const { paginas, muestra } = await extraerRangoDelPdf(
                    temporal, resourceId, apiKey, desde, hasta,
                    { userId, laSiguienteRelee: hasta < totalPaginas },
                );

                await destino.save(JSON.stringify(paginas), {
                    contentType: 'application/json; charset=utf-8',
                    metadata: { resourceId, runId, rango: etiqueta },
                });
                console.log(`✅ [Rango] ${resourceId} ${etiqueta}: ${paginas.length} páginas guardadas`);

                // La densidad se remide en CADA rango, no sólo en el primero.
                // Medido sobre Sasson al subirlo: sus primeras 24 páginas
                // —portadilla, créditos, índice— dieron 611 tokens/página y el
                // cuerpo del libro mide 1 555. Calibrar una sola vez con ese
                // arranque fijó 48 páginas por tanda y el tercer rango se
                // estrelló contra el tope.
                const referencia = densidadDeReferencia(
                    densidadPrevia,
                    muestra ? densidadDe(muestra.tokensDeSalida, muestra.paginas) : null,
                );
                if (referencia !== null && referencia !== densidadPrevia) {
                    densidadParaElResto = referencia;
                    const nuevo = tamanoParaDensidad(referencia);
                    if (nuevo !== tamanoParaElResto) {
                        console.log(
                            `📐 [Rango] ${resourceId}: ${Math.round(referencia)} tokens/página ` +
                            `(el tramo más denso visto); el resto va de a ${nuevo}`,
                        );
                        tamanoParaElResto = nuevo;
                    }
                    // Se guarda AHORA y no al final: un corte por tiempo perdía
                    // también lo medido, y el reintento volvía a arrancar
                    // conservador.
                    await ref.update({ paginasPorTanda: tamanoParaElResto });
                }
            } finally {
                try { fs.unlinkSync(temporal); } catch { /* el temporal ya no importa */ }
            }
        }

        const siguiente = siguienteRango(hasta, tamanoParaElResto, totalPaginas);
        const plan = planDeRangos(totalPaginas, tamanoParaElResto);

        await ref.update({
            extractionHeartbeatAt: FieldValue.serverTimestamp(),
            extractionProgress: {
                paginasHechas: hasta,
                totalPaginas,
                porcentaje: porcentajeDeAvance({ paginasHechas: hasta, totalPaginas }),
                ultimoRango: etiqueta,
                rangosEstimados: plan.length,
            },
            updatedAt: new Date(),
        });

        if (siguiente) {
            await encolarRango({
                resourceId, runId,
                desde: siguiente.desde, hasta: siguiente.hasta,
                tamano: tamanoParaElResto,
                densidadMaxima: densidadParaElResto,
            });
            console.log(`⛓️ [Rango] ${resourceId}: encolado ${siguiente.desde}-${siguiente.hasta}`);
            return;
        }

        // Último rango: quien acaba de ver que no hay siguiente es quien sabe
        // que el libro está completo.
        await terminar(ref, userId, resourceId, runId, totalPaginas, data.userId);
    },
);

/**
 * Ensambla, guarda y deja el recurso listo.
 *
 * Si el ensamblado falla —le falta un tramo—, el recurso queda `failed` con el
 * motivo y **los rangos NO se borran**: un reintento los reusa por
 * idempotencia, en vez de volver a pagar el libro entero.
 */
async function terminar(
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
