import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { CATALOGO_DE_COBRO, ESPERA_PARA_DEVOLVER_MS, VIGENCIA_DE_RESERVA_MS } from './catalogoDeCobro';

/**
 * Las reservas del cobro de exégesis, en el servidor (fase «el cobro de la
 * exégesis pasa al servidor», 2026-10-17).
 *
 *   1. `abrirReserva`: el navegador avisa qué operación va a hacer; el
 *      servidor descuenta su costo del catálogo (primero el plan, después el
 *      pack) y deja `users/{uid}/exegesis_reservas/{id}`.
 *   2. `reclamarReserva`: `runLlmPrompt` toma una reserva antes de llamar al
 *      modelo y marca que el modelo se contactó. Lo marca el SERVIDOR: un
 *      navegador modificado no puede pedir un reembolso falso.
 *   3. `liberarReserva`: si el modelo nunca se llamó, devuelve el saldo.
 *   4. `barrerReservas`: devuelve las que quedaron abiertas sin uso.
 *
 * Todo en transacciones sobre `users/{uid}`: dos reservas a la vez (el
 * pastor analiza 7–15 versículos en paralelo) no se pisan.
 */

const COLECCION = 'exegesis_reservas';

export type EstadoDeReserva = 'abierta' | 'usada' | 'devuelta';

export interface Reserva {
    operacion: string;
    costoUsd: number;
    dePlan: number;
    dePack: number;
    etiquetas: string[];
    maxLlamadas: number;
    llamadas: number;
    llmContactadoEn: number | null;
    estado: EstadoDeReserva;
    /** El período del plan al reservar: si la cuota se renovó, lo del plan no vuelve. */
    periodoDelPlan: number | null;
    creada: number;
}

export interface Saldo {
    plan: number;
    pack: number;
    gastado: number;
    periodoDelPlan: number | null;
}

/** Montos en dólares con seis decimales: sin restos de coma flotante que se acumulen. */
const redondear = (usd: number) => Math.round(usd * 1e6) / 1e6;

export class SaldoInsuficienteError extends Error {
    constructor(readonly necesarioUsd: number, readonly disponibleUsd: number) {
        super(`Saldo de exégesis insuficiente: hace falta ${necesarioUsd} y hay ${disponibleUsd}.`);
        this.name = 'SaldoInsuficienteError';
    }
}

export class OperacionDesconocidaError extends Error {
    constructor(operacion: string) {
        super(`Operación de exégesis desconocida: ${operacion}`);
        this.name = 'OperacionDesconocidaError';
    }
}

/** El descuento: primero el plan, después el pack. `null` si no alcanza. */
export function descontar(saldo: Saldo, costo: number): { nuevo: Saldo; dePlan: number; dePack: number } | null {
    if (costo <= 0) return { nuevo: saldo, dePlan: 0, dePack: 0 };
    if (redondear(saldo.plan + saldo.pack) < redondear(costo)) return null;
    const dePlan = redondear(Math.min(saldo.plan, costo));
    const dePack = redondear(costo - dePlan);
    return {
        nuevo: { ...saldo, plan: redondear(saldo.plan - dePlan), pack: redondear(saldo.pack - dePack), gastado: redondear(saldo.gastado + costo) },
        dePlan,
        dePack,
    };
}

/**
 * La devolución de una reserva que no llegó al modelo. Lo del pack vuelve
 * siempre; lo del plan sólo si la cuota no se renovó desde que se reservó
 * (si se renovó, el plan ya está lleno de nuevo).
 */
export function devolver(saldo: Saldo, reserva: Pick<Reserva, 'dePlan' | 'dePack' | 'periodoDelPlan'>): { nuevo: Saldo; devueltoUsd: number } {
    const mismoPeriodo = (reserva.periodoDelPlan ?? null) === (saldo.periodoDelPlan ?? null);
    const alPlan = mismoPeriodo ? reserva.dePlan : 0;
    const devuelto = redondear(alPlan + reserva.dePack);
    return {
        nuevo: {
            ...saldo,
            plan: redondear(saldo.plan + alPlan),
            pack: redondear(saldo.pack + reserva.dePack),
            gastado: redondear(Math.max(0, saldo.gastado - devuelto)),
        },
        devueltoUsd: devuelto,
    };
}

/**
 * Cuál reserva cubre una llamada: entre las vigentes que admiten la
 * etiqueta y no llegaron a su tope, primero las que todavía no se usaron
 * (cada operación en paralelo toma la suya), y entre ellas la más vieja.
 */
export function elegirReserva(
    reservas: ReadonlyArray<{ id: string; reserva: Reserva }>,
    etiqueta: string,
    ahora: number,
    /**
     * En un reintento, entre las frescas se elige al azar: si quince
     * operaciones arrancan juntas, todas apuntaban a la más vieja y se
     * pisaban. Las frescas de una misma etiqueta son de la misma operación.
     */
    azar: (() => number) | null = null,
): { id: string; reserva: Reserva } | null {
    const candidatas = reservas.filter(({ reserva: r }) =>
        r.estado !== 'devuelta'
        && r.etiquetas.includes(etiqueta)
        && r.llamadas < r.maxLlamadas
        && ahora - r.creada <= VIGENCIA_DE_RESERVA_MS);
    candidatas.sort((a, b) => (Number(a.reserva.llamadas > 0) - Number(b.reserva.llamadas > 0)) || (a.reserva.creada - b.reserva.creada));
    const frescas = candidatas.filter(c => c.reserva.llamadas === 0);
    if (azar && frescas.length > 1) return frescas[Math.floor(azar() * frescas.length)]!;
    return candidatas[0] ?? null;
}

function leerSaldo(datos: FirebaseFirestore.DocumentData | undefined): Saldo {
    const b = (datos?.processingBalance ?? {}) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    return {
        plan: num(b.planExegesisUsd),
        pack: num(b.packExegesisUsd),
        gastado: num(b.exegesisSpentTotalUsd),
        periodoDelPlan: typeof b.exegesisPlanPeriodo === 'number' ? b.exegesisPlanPeriodo : null,
    };
}

function escribirSaldo(tx: Transaction, ref: FirebaseFirestore.DocumentReference, saldo: Saldo): void {
    tx.update(ref, {
        'processingBalance.planExegesisUsd': saldo.plan,
        'processingBalance.packExegesisUsd': saldo.pack,
        'processingBalance.exegesisUsdAvailable': redondear(saldo.plan + saldo.pack),
        'processingBalance.exegesisSpentTotalUsd': saldo.gastado,
        'processingBalance.updatedAt': FieldValue.serverTimestamp(),
    });
}

const refUsuario = (db: Firestore, uid: string) => db.collection('users').doc(uid);
const refReserva = (db: Firestore, uid: string, id: string) => refUsuario(db, uid).collection(COLECCION).doc(id);

/** Un id que viene del navegador: corto y sin barras (es un id de documento). */
export function reservaIdValido(id: unknown): id is string {
    return typeof id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(id);
}

/**
 * Abre la reserva de una operación. Idempotente por `reservaId`: repetir la
 * llamada (un reintento del navegador) devuelve la misma sin cobrar otra vez.
 */
export async function abrirReserva(
    db: Firestore,
    uid: string,
    operacion: string,
    reservaId: string,
    ahora: number = Date.now(),
): Promise<{ reservaId: string; costoUsd: number; nueva: boolean }> {
    const definicion = CATALOGO_DE_COBRO[operacion];
    if (!definicion) throw new OperacionDesconocidaError(operacion);
    return db.runTransaction(async (tx) => {
        const rRes = refReserva(db, uid, reservaId);
        const rUsr = refUsuario(db, uid);
        const [snapRes, snapUsr] = await Promise.all([tx.get(rRes), tx.get(rUsr)]);
        if (snapRes.exists) {
            const r = snapRes.data() as Reserva;
            if (r.operacion !== operacion) throw new OperacionDesconocidaError(operacion);
            return { reservaId, costoUsd: r.costoUsd, nueva: false };
        }
        const saldo = leerSaldo(snapUsr.data());
        const cobro = descontar(saldo, definicion.costoUsd);
        if (!cobro) throw new SaldoInsuficienteError(definicion.costoUsd, redondear(saldo.plan + saldo.pack));
        if (definicion.costoUsd > 0) escribirSaldo(tx, rUsr, cobro.nuevo);
        const reserva: Reserva = {
            operacion,
            costoUsd: definicion.costoUsd,
            dePlan: cobro.dePlan,
            dePack: cobro.dePack,
            etiquetas: [...definicion.etiquetas],
            maxLlamadas: definicion.maxLlamadas,
            llamadas: 0,
            llmContactadoEn: null,
            estado: 'abierta',
            periodoDelPlan: saldo.periodoDelPlan,
            creada: ahora,
        };
        tx.create(rRes, reserva);
        return { reservaId, costoUsd: definicion.costoUsd, nueva: true };
    });
}

/**
 * La llamada al modelo toma una reserva (`runLlmPrompt`, antes de llamar).
 * Devuelve el id de la reserva tomada, o `null` si no hay ninguna que la cubra.
 *
 * Sólo se leen las reservas VIGENTES (la consulta no crece con el historial)
 * y sólo se transacciona al tomar una reserva FRESCA, que es lo que no se
 * puede repartir entre dos operaciones en paralelo. Una reserva ya usada (el
 * reintento de un 503, o la cita número 12 de una verificación que lanza
 * todas a la vez) sólo suma una llamada: no hay saldo en juego, y así las 40
 * citas no se encolan detrás de una misma transacción (revisión adversarial).
 */
export async function reclamarReserva(db: Firestore, uid: string, etiqueta: string, ahora: number = Date.now()): Promise<string | null> {
    const vigentes = refUsuario(db, uid).collection(COLECCION)
        .where('estado', 'in', ['abierta', 'usada'])
        .where('creada', '>=', ahora - VIGENCIA_DE_RESERVA_MS);
    // Optimista, sin bloqueos: se toma la fresca con una precondición sobre su
    // hora de actualización; si otra llamada la tomó primero, se vuelve a leer.
    for (let intento = 0; intento < 12; intento++) {
        const snap = await vigentes.get();
        const elegida = elegirReserva(snap.docs.map(d => ({ id: d.id, reserva: d.data() as Reserva })), etiqueta, ahora, intento > 0 ? Math.random : null);
        if (!elegida) return null;
        const ref = refReserva(db, uid, elegida.id);
        if (elegida.reserva.llamadas > 0) {
            await ref.update({ llamadas: FieldValue.increment(1) });
            return elegida.id;
        }
        const doc = snap.docs.find(d => d.id === elegida.id)!;
        try {
            await ref.update(
                { llamadas: FieldValue.increment(1), llmContactadoEn: ahora, estado: 'usada' },
                { lastUpdateTime: doc.updateTime },
            );
            return elegida.id;
        } catch (err) {
            // 9 = FAILED_PRECONDITION: otra llamada la tomó (o se liberó) entre
            // la lectura y la escritura. Se elige de nuevo.
            if ((err as { code?: number }).code !== 9) throw err;
        }
    }
    throw new Error('No se pudo tomar una reserva tras varios intentos (mucha contención).');
}

/**
 * Devuelve el saldo de una reserva cuyo modelo nunca se llamó. Idempotente:
 * una reserva ya devuelta o ya usada no devuelve nada.
 */
export async function liberarReserva(db: Firestore, uid: string, reservaId: string): Promise<{ devueltoUsd: number }> {
    return db.runTransaction(async (tx) => {
        const rRes = refReserva(db, uid, reservaId);
        const rUsr = refUsuario(db, uid);
        const [snapRes, snapUsr] = await Promise.all([tx.get(rRes), tx.get(rUsr)]);
        if (!snapRes.exists) return { devueltoUsd: 0 };
        const r = snapRes.data() as Reserva;
        if (r.estado !== 'abierta' || r.llamadas > 0 || r.llmContactadoEn !== null) return { devueltoUsd: 0 };
        // La cuenta se borró mientras la reserva estaba abierta: no hay a quién
        // devolverle; se cierra para que el barrido no tropiece con ella.
        if (!snapUsr.exists) {
            tx.update(rRes, { estado: 'devuelta' });
            return { devueltoUsd: 0 };
        }
        const { nuevo, devueltoUsd } = devolver(leerSaldo(snapUsr.data()), r);
        if (devueltoUsd > 0) escribirSaldo(tx, rUsr, nuevo);
        tx.update(rRes, { estado: 'devuelta' });
        return { devueltoUsd };
    });
}

/** Las reservas abiertas sin uso de más de 15 minutos: la pestaña se cerró o el reembolso falló. */
export async function barrerReservas(db: Firestore, ahora: number = Date.now()): Promise<{ devueltas: number; usd: number }> {
    const snap = await db.collectionGroup(COLECCION)
        .where('estado', '==', 'abierta')
        .where('creada', '<', ahora - ESPERA_PARA_DEVOLVER_MS)
        .limit(500)
        .get();
    let devueltas = 0;
    let usd = 0;
    for (const d of snap.docs) {
        const uid = d.ref.parent.parent?.id;
        if (!uid) continue;
        // Una que falla no frena a las demás: vienen ordenadas por fecha, y
        // la que falla saldría primera en cada pasada (revisión adversarial).
        try {
            const { devueltoUsd } = await liberarReserva(db, uid, d.id);
            devueltas++;
            usd = redondear(usd + devueltoUsd);
        } catch (err) {
            console.error(`[barrerReservas] no se pudo devolver ${uid.slice(0, 8)}/${d.id}:`, err);
        }
    }
    return { devueltas, usd };
}
