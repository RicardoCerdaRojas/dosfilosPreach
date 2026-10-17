import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
    abrirReserva,
    barrerReservas,
    liberarReserva,
    reclamarReserva,
    SaldoInsuficienteError,
} from '../../packages/functions/src/exegesis/reservasDeExegesis';
import { ESPERA_PARA_DEVOLVER_MS } from '../../packages/functions/src/exegesis/catalogoDeCobro';

/**
 * Las reservas del cobro de exégesis contra el emulador de Firestore: las
 * transacciones de verdad (dos reservas a la vez, idempotencia, reembolso),
 * que una prueba con dobles no puede mostrar. Va en esta suite porque es la
 * que corre con el emulador en CI.
 */

const PASTOR = 'pastor-reservas';
let app: App;
let db: Firestore;

beforeAll(() => {
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
    app = initializeApp({ projectId: 'demo-dosfilos-rules' }, 'reservas-de-exegesis');
    db = getFirestore(app);
});
afterAll(async () => { await deleteApp(app); });
afterEach(async () => {
    await db.recursiveDelete(db.collection('users').doc(PASTOR));
    await db.recursiveDelete(db.collection('users').doc('cuenta-borrada'));
});

async function conSaldo(plan: number, pack: number) {
    await db.collection('users').doc(PASTOR).set({
        processingBalance: { planExegesisUsd: plan, packExegesisUsd: pack, exegesisUsdAvailable: plan + pack, exegesisSpentTotalUsd: 0, exegesisPlanPeriodo: 1 },
    });
}
const saldo = async () => (await db.collection('users').doc(PASTOR).get()).data()!.processingBalance;

describe('reservas de exégesis (emulador)', () => {
    it('abrir descuenta el costo del catálogo; repetir con el mismo id no cobra otra vez', async () => {
        await conSaldo(1, 0);
        const a = await abrirReserva(db, PASTOR, 'composeAcademicPaper', 'reserva-0001');
        const b = await abrirReserva(db, PASTOR, 'composeAcademicPaper', 'reserva-0001');
        expect(a).toEqual({ reservaId: 'reserva-0001', costoUsd: 0.2, nueva: true });
        expect(b.nueva).toBe(false);
        expect(await saldo()).toMatchObject({ planExegesisUsd: 0.8, exegesisUsdAvailable: 0.8, exegesisSpentTotalUsd: 0.2 });
    });

    it('sin saldo: SaldoInsuficienteError con lo que hace falta y lo que hay, y no deja reserva', async () => {
        await conSaldo(0.05, 0);
        await expect(abrirReserva(db, PASTOR, 'analyzeVerseCanonically', 'reserva-0002')).rejects.toMatchObject({
            name: 'SaldoInsuficienteError', necesarioUsd: 0.1, disponibleUsd: 0.05,
        });
        expect((await db.collection('users').doc(PASTOR).collection('exegesis_reservas').doc('reserva-0002').get()).exists).toBe(false);
        expect(SaldoInsuficienteError).toBeDefined();
    });

    it('diez reservas a la vez no se pisan: se descuenta exactamente diez veces', async () => {
        await conSaldo(1, 0);
        await Promise.all(Array.from({ length: 10 }, (_, i) => abrirReserva(db, PASTOR, 'analyzeVerseCanonically', `paralela-${String(i).padStart(4, '0')}`)));
        expect((await saldo()).planExegesisUsd).toBeCloseTo(0, 6);
        await expect(abrirReserva(db, PASTOR, 'analyzeVerseCanonically', 'una-mas-0001')).rejects.toBeInstanceOf(SaldoInsuficienteError);
    });

    it('la llamada al modelo reclama una reserva; sin reserva, null', async () => {
        await conSaldo(1, 0);
        expect(await reclamarReserva(db, PASTOR, 'exegesis.analyzeVerse')).toBeNull();
        await abrirReserva(db, PASTOR, 'analyzeVerseCanonically', 'reserva-0003');
        expect(await reclamarReserva(db, PASTOR, 'exegesis.analyzeVerse')).toBe('reserva-0003');
        // Otra etiqueta no la toma.
        expect(await reclamarReserva(db, PASTOR, 'exegesis.composeVerse')).toBeNull();
    });

    it('liberar devuelve sólo si el modelo nunca se llamó, y una sola vez', async () => {
        await conSaldo(1, 0);
        await abrirReserva(db, PASTOR, 'composeAcademicPaper', 'sin-usar-0001');
        await abrirReserva(db, PASTOR, 'runCoherencePass', 'usada-00001');
        await reclamarReserva(db, PASTOR, 'exegesis.reviewCoherence');
        expect(await liberarReserva(db, PASTOR, 'sin-usar-0001')).toEqual({ devueltoUsd: 0.2 });
        expect(await liberarReserva(db, PASTOR, 'sin-usar-0001')).toEqual({ devueltoUsd: 0 });
        expect(await liberarReserva(db, PASTOR, 'usada-00001')).toEqual({ devueltoUsd: 0 });
        expect(await saldo()).toMatchObject({ planExegesisUsd: 0.88, exegesisSpentTotalUsd: 0.12 });
    });

    it('el barrido devuelve las abiertas sin uso de más de 15 minutos', async () => {
        await conSaldo(1, 0);
        const hace = Date.now() - ESPERA_PARA_DEVOLVER_MS - 60_000;
        await abrirReserva(db, PASTOR, 'composeAcademicPaper', 'olvidada-001', hace);
        await abrirReserva(db, PASTOR, 'composeAcademicPaper', 'reciente-001');
        const r = await barrerReservas(db);
        expect(r.devueltas).toBeGreaterThanOrEqual(1);
        expect((await db.collection('users').doc(PASTOR).collection('exegesis_reservas').doc('olvidada-001').get()).data()!.estado).toBe('devuelta');
        expect((await db.collection('users').doc(PASTOR).collection('exegesis_reservas').doc('reciente-001').get()).data()!.estado).toBe('abierta');
    });

    it('las 40 citas de una verificación en paralelo: todas pasan con UNA reserva y se cuentan', async () => {
        await conSaldo(1, 0);
        await abrirReserva(db, PASTOR, 'verifyStepCitations', 'verifica-001');
        const t = Date.now();
        const ids = await Promise.all(Array.from({ length: 40 }, () => reclamarReserva(db, PASTOR, 'exegesis.verifyCitation')));
        expect(ids.every(id => id === 'verifica-001')).toBe(true);
        const r = (await db.collection('users').doc(PASTOR).collection('exegesis_reservas').doc('verifica-001').get()).data()!;
        expect(r.llamadas).toBe(40);
        console.log(`40 reclamos en paralelo sobre una reserva: ${Date.now() - t} ms (emulador)`);
    });

    it('quince operaciones en paralelo: cada llamada toma SU reserva (ninguna queda sin usar)', async () => {
        await conSaldo(2, 0);
        await Promise.all(Array.from({ length: 15 }, (_, i) => abrirReserva(db, PASTOR, 'analyzeVerseCanonically', `verso-${String(i).padStart(4, '0')}`)));
        await Promise.all(Array.from({ length: 15 }, () => reclamarReserva(db, PASTOR, 'exegesis.analyzeVerse')));
        const reservas = (await db.collection('users').doc(PASTOR).collection('exegesis_reservas').get()).docs.map(d => d.data());
        expect(reservas.map(r => r.llamadas)).toEqual(Array(15).fill(1));
    });

    it('una reserva de una cuenta borrada no frena el barrido de las demás', async () => {
        await conSaldo(1, 0);
        const hace = Date.now() - ESPERA_PARA_DEVOLVER_MS - 60_000;
        await db.collection('users').doc('cuenta-borrada').collection('exegesis_reservas').doc('huerfana-01').set({
            operacion: 'analyzeVerseCanonically', costoUsd: 0.1, dePlan: 0.1, dePack: 0, etiquetas: ['exegesis.analyzeVerse'],
            maxLlamadas: 6, llamadas: 0, llmContactadoEn: null, estado: 'abierta', periodoDelPlan: null, creada: hace - 1000,
        });
        await abrirReserva(db, PASTOR, 'composeAcademicPaper', 'sana-000001', hace);
        await barrerReservas(db);
        expect((await db.collection('users').doc(PASTOR).collection('exegesis_reservas').doc('sana-000001').get()).data()!.estado).toBe('devuelta');
        expect((await db.collection('users').doc('cuenta-borrada').collection('exegesis_reservas').doc('huerfana-01').get()).data()!.estado).toBe('devuelta');
        expect((await saldo()).planExegesisUsd).toBeCloseTo(1, 6);
    });
});
