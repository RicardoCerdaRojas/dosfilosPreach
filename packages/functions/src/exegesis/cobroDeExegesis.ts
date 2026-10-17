import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import { consumeRateLimitToken } from '../shared/rateLimit';
import { ETIQUETAS_QUE_COBRAN } from './catalogoDeCobro';
import {
    abrirReserva,
    barrerReservas,
    liberarReserva,
    OperacionDesconocidaError,
    reclamarReserva,
    reservaIdValido,
    SaldoInsuficienteError,
} from './reservasDeExegesis';

/**
 * Los callables y el barrido del cobro de exégesis en el servidor (fase
 * «el cobro de la exégesis pasa al servidor», 2026-10-17). La lógica vive en
 * `reservasDeExegesis`; esto es el cableado.
 */

/**
 * Lo que distingue «sin saldo» del tope por hora, que también usa
 * `resource-exhausted`. El navegador lo traduce a
 * `InsufficientExegesisCreditsError` y `StepCard` abre el aviso de compra.
 */
export const MOTIVO_SALDO_INSUFICIENTE = 'insufficient-exegesis-credits';
export const MOTIVO_RESERVA_REQUERIDA = 'exegesis-reservation-required';
/** Holgado: un paper completo son unas 30 operaciones; el tope es contra un bucle o un cliente manipulado. */
const APERTURAS_POR_HORA = 300;

export const abrirReservaDeExegesis = onCall(
    { ...appCheckCallableOptions(), region: 'us-central1', memory: '256MiB', timeoutSeconds: 30 },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign-in required');
        const data = (request.data ?? {}) as { operacion?: unknown; reservaId?: unknown };
        const operacion = typeof data.operacion === 'string' ? data.operacion : '';
        if (!reservaIdValido(data.reservaId)) throw new HttpsError('invalid-argument', 'reservaId inválido');
        // Tope por hora, además del de `runLlmPrompt`: abrir reservas es barato
        // y cada una que no se usa la devuelve el barrido.
        const permitido = await consumeRateLimitToken(getFirestore(), { bucket: 'exegesis_reservas', key: request.auth.uid, windowMs: 60 * 60 * 1000, max: APERTURAS_POR_HORA });
        if (!permitido) throw new HttpsError('resource-exhausted', 'Demasiadas operaciones seguidas. Espera unos minutos.');
        try {
            return await abrirReserva(getFirestore(), request.auth.uid, operacion, data.reservaId);
        } catch (err) {
            if (err instanceof SaldoInsuficienteError) {
                throw new HttpsError('resource-exhausted', 'No te alcanza el saldo de estudio para esta operación.', {
                    reason: MOTIVO_SALDO_INSUFICIENTE,
                    neededUsd: err.necesarioUsd,
                    availableUsd: err.disponibleUsd,
                    operation: operacion,
                });
            }
            if (err instanceof OperacionDesconocidaError) throw new HttpsError('invalid-argument', err.message);
            throw err;
        }
    },
);

export const liberarReservaDeExegesis = onCall(
    { ...appCheckCallableOptions(), region: 'us-central1', memory: '256MiB', timeoutSeconds: 30 },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign-in required');
        const data = (request.data ?? {}) as { reservaId?: unknown };
        if (!reservaIdValido(data.reservaId)) throw new HttpsError('invalid-argument', 'reservaId inválido');
        return liberarReserva(getFirestore(), request.auth.uid, data.reservaId);
    },
);

export const barrerReservasDeExegesis = onSchedule(
    { schedule: 'every 15 minutes', timeZone: 'UTC', region: 'us-central1', memory: '256MiB' },
    async () => {
        const { devueltas, usd } = await barrerReservas(getFirestore());
        if (devueltas > 0) console.log(`[barrerReservasDeExegesis] ${devueltas} reservas sin uso devueltas (US$${usd})`);
    },
);

/**
 * Lo que hace `runLlmPrompt` antes de llamar al modelo: si la etiqueta cobra,
 * toma una reserva. En `sombra` sólo registra la que no tiene; en
 * `obligatorio` la rechaza. Las etiquetas que no cobran pasan sin mirar.
 */
export async function cobrarLlamadaDeExegesis(uid: string, etiqueta: string, modo: 'sombra' | 'obligatorio'): Promise<void> {
    if (!ETIQUETAS_QUE_COBRAN.has(etiqueta)) return;
    const db = getFirestore();
    let reserva: string | null;
    try {
        reserva = await reclamarReserva(db, uid, etiqueta);
    } catch (err) {
        // Una falla de Firestore no deja al pastor sin respuesta mientras se
        // mide; en obligatorio, sí: sin reserva comprobada no hay modelo.
        console.error(`[cobroDeExegesis] no se pudo reclamar la reserva de ${etiqueta}:`, err);
        if (modo === 'obligatorio') throw new HttpsError('unavailable', 'No se pudo comprobar el saldo de estudio. Intenta de nuevo.');
        reserva = null;
    }
    // Sin esperar: es una métrica, y un documento por día recibe todas las
    // llamadas (las citas de una verificación van en paralelo).
    void anotarEnLaSombra(db, etiqueta, reserva !== null);
    if (reserva === null && modo === 'obligatorio') {
        throw new HttpsError('failed-precondition', 'Esta operación necesita una reserva de saldo de estudio.', { reason: MOTIVO_RESERVA_REQUERIDA });
    }
    if (reserva === null) console.warn(`[cobroDeExegesis] ${uid.slice(0, 8)} ${etiqueta}: llamada que cobra SIN reserva (sombra)`);
}

/**
 * El contador del día que dice si se puede pasar a obligatorio: llamadas que
 * cobran, con y sin reserva, por etiqueta. Si en unos días no aparecen
 * llamadas legítimas sin reserva, se enciende.
 */
async function anotarEnLaSombra(db: FirebaseFirestore.Firestore, etiqueta: string, conReserva: boolean): Promise<void> {
    const dia = new Date().toISOString().slice(0, 10);
    const clave = etiqueta.replace(/\./g, '_');
    try {
        await db.collection('metricas_cobro_exegesis').doc(dia).set({
            [conReserva ? 'conReserva' : 'sinReserva']: { [clave]: FieldValue.increment(1) },
            actualizado: FieldValue.serverTimestamp(),
        }, { merge: true });
    } catch (err) {
        console.warn('[cobroDeExegesis] no se pudo anotar la métrica:', err);
    }
}
