import { beforeEach, describe, expect, it, vi } from 'vitest';

const { llamadas, respuesta } = vi.hoisted(() => ({
    llamadas: [] as Array<{ nombre: string; datos: unknown }>,
    respuesta: { error: null as unknown },
}));
vi.mock('firebase/functions', () => ({
    getFunctions: () => ({}),
    httpsCallable: (_f: unknown, nombre: string) => async (datos: unknown) => {
        llamadas.push({ nombre, datos });
        if (respuesta.error) throw respuesta.error;
        return { data: {} };
    },
}));

const { processingBalanceService, InsufficientExegesisCreditsError } = await import('../ProcessingBalanceService');

beforeEach(() => { llamadas.length = 0; respuesta.error = null; });

/**
 * El cobro de exégesis pasó al servidor (2026-10-17): el navegador ya no
 * escribe el saldo, llama a `abrirReservaDeExegesis` / `liberarReservaDeExegesis`.
 * El aviso de compra de `StepCard` depende de que «sin saldo» siga llegando
 * como `InsufficientExegesisCreditsError`.
 */
describe('cobro de exégesis en el servidor (navegador)', () => {
    it('reservar llama al servidor con la operación y el id; no manda el costo', async () => {
        await processingBalanceService.consumeExegesis('u', 0.1, { operation: 'analyzeVerseCanonically', reservaId: 'r-12345678' });
        expect(llamadas).toEqual([{ nombre: 'abrirReservaDeExegesis', datos: { operacion: 'analyzeVerseCanonically', reservaId: 'r-12345678' } }]);
    });

    it('«sin saldo» del servidor llega como InsufficientExegesisCreditsError (el aviso de compra)', async () => {
        respuesta.error = { code: 'functions/resource-exhausted', details: { reason: 'insufficient-exegesis-credits', neededUsd: 0.1, availableUsd: 0.04 } };
        const err = await processingBalanceService.consumeExegesis('u', 0.1, { operation: 'analyzeVerseCanonically', reservaId: 'r-12345678' }).catch(e => e);
        expect(err).toBeInstanceOf(InsufficientExegesisCreditsError);
        expect(err).toMatchObject({ neededUsd: 0.1, availableUsd: 0.04 });
    });

    it('el tope por hora (también resource-exhausted) NO se confunde con «sin saldo»', async () => {
        respuesta.error = { code: 'functions/resource-exhausted', details: {}, message: 'Demasiadas consultas' };
        const err = await processingBalanceService.consumeExegesis('u', 0.1, { operation: 'analyzeVerseCanonically', reservaId: 'r-12345678' }).catch(e => e);
        expect(err).not.toBeInstanceOf(InsufficientExegesisCreditsError);
    });

    it('reembolsar llama al servidor sólo con el id', async () => {
        await processingBalanceService.refundExegesis('u', 0.2, { reservaId: 'r-12345678' });
        expect(llamadas).toEqual([{ nombre: 'liberarReservaDeExegesis', datos: { reservaId: 'r-12345678' } }]);
    });
});
