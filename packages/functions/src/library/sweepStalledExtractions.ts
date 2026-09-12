import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Cierra las extracciones que quedaron colgadas.
 *
 * El guardia de tiempo del trigger cubre la muerte por timeout que se
 * ve venir. No cubre lo demás: una instancia que se cae, un despliegue
 * en medio de una extracción, un `catch` que no llegó a escribir. Todas
 * esas dejan el recurso en `processing` con el `updatedAt` del
 * arranque, para siempre, y la tarjeta gira sobre un trabajo que ya no
 * existe.
 *
 * El invariante es calculable, así que se calcula: **todo recurso en
 * `processing` cuyo comienzo sea más viejo que la invocación más larga
 * posible está muerto por definición.** No hay que adivinar nada.
 *
 * Es el mismo agujero que ya se cerró para el indexado —`indexFailed`
 * con su reintento y el barrido diario de `alertFailedIndexing`—. La
 * extracción quedó fuera de aquel trabajo.
 */

/**
 * Desde cuándo un `processing` es un cadáver.
 *
 * La invocación más larga que existe hoy es el callable de reproceso,
 * con 900 s de tope. Veinte minutos deja margen sobre eso: por debajo,
 * el barrido mataría extracciones vivas; muy por encima, el usuario
 * mira girar la tarjeta más de lo necesario.
 */
export const STALLED_AFTER_SECONDS = 1200;

export interface StalledCandidate {
    processingStartedAt?: Date | null;
    updatedAt?: Date | null;
    /**
     * Último avance real de una extracción en cola.
     *
     * La extracción larga dejó de ser una invocación: es una CADENA de tareas
     * que puede durar más de una hora —un diccionario de 1 006 páginas son ~25
     * rangos de ~200 s—. El supuesto de arriba («la invocación más larga son
     * 900 s») deja de valer, y juzgar por la hora de ARRANQUE mataría a los
     * veinte minutos un trabajo que avanza bien.
     *
     * Lo que distingue vivo de muerto pasa a ser cuándo avanzó por última vez.
     * Cada rango escribe este campo al empezar y al terminar.
     */
    extractionHeartbeatAt?: Date | null;
}

/**
 * Si un recurso en `processing` ya no puede tener a nadie trabajando.
 *
 * Un recurso sin fecha alguna NO se toca: sin comienzo no se puede
 * decir que se le acabó el tiempo, y matar por sospecha es exactamente
 * el error que este barrido viene a corregir en el otro sentido.
 */
export function isStalledExtraction(
    candidate: StalledCandidate,
    now: Date,
    staleAfterSeconds: number = STALLED_AFTER_SECONDS,
): boolean {
    // El latido manda cuando existe: dice «alguien avanzó hace poco», que es lo
    // que de verdad queremos preguntar. La hora de arranque queda como respaldo
    // para los recursos anteriores a la cola, que no laten.
    const referencia = candidate.extractionHeartbeatAt
        ?? candidate.processingStartedAt
        ?? candidate.updatedAt
        ?? null;
    if (!referencia) return false;
    const ageSeconds = (now.getTime() - referencia.getTime()) / 1000;
    return ageSeconds > staleAfterSeconds;
}

function toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === 'function') return value.toDate();
    return null;
}

export const sweepStalledExtractions = onSchedule(
    {
        // Cada media hora: el techo de lo que un usuario mira girar una
        // tarjeta muerta pasa de «para siempre» a «media hora».
        schedule: 'every 30 minutes',
        timeZone: 'UTC',
        region: 'us-central1',
        memory: '256MiB',
    },
    async () => {
        const db = getFirestore();
        // Igualdad simple y filtrado en memoria, como `alertFailedIndexing`:
        // la colección es chica y así no hace falta un índice compuesto
        // nuevo para una consulta que corre dos veces por hora.
        const snap = await db
            .collection('library_resources')
            .where('textExtractionStatus', '==', 'processing')
            .get();

        const now = new Date();
        let cerrados = 0;

        for (const doc of snap.docs) {
            const data = doc.data();
            const candidate: StalledCandidate = {
                processingStartedAt: toDate(data.processingStartedAt),
                updatedAt: toDate(data.updatedAt),
                extractionHeartbeatAt: toDate(data.extractionHeartbeatAt),
            };
            if (!isStalledExtraction(candidate, now)) continue;

            // Se informa el silencio, no la edad: con la cola, un libro puede
            // llevar 80 minutos en `processing` y estar perfectamente vivo. Lo
            // que lo condena es que nadie avanzó en el último rato.
            const ultimoAvance = candidate.extractionHeartbeatAt
                ?? candidate.processingStartedAt
                ?? candidate.updatedAt;
            const minutos = ultimoAvance
                ? Math.round((now.getTime() - ultimoAvance.getTime()) / 60000)
                : null;
            console.warn(
                `🧹 [Sweep] ${doc.id} ("${data.title ?? 'sin título'}") lleva ${minutos ?? '?'} min sin avanzar; se marca 'failed'`,
            );

            await doc.ref.update({
                textExtractionStatus: 'failed',
                extractionError: 'El procesamiento se interrumpió y no dejó resultado. Vuelve a intentarlo.',
                extractionFailureReason: 'stalled',
                extractionAttemptedAt: now,
                updatedAt: now,
            });
            cerrados++;
        }

        console.log(
            `🧹 [Sweep] ${snap.size} recurso(s) en 'processing'; ${cerrados} cerrado(s) por interrupción.`,
        );
    },
);
