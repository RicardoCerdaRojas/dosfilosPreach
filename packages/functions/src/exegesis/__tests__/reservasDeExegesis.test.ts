import { describe, expect, it } from 'vitest';
import { descontar, devolver, elegirReserva, reservaIdValido, type Reserva } from '../reservasDeExegesis';
import { VIGENCIA_DE_RESERVA_MS } from '../catalogoDeCobro';

const saldo = (plan: number, pack: number, gastado = 0, periodoDelPlan: number | null = 1) => ({ plan, pack, gastado, periodoDelPlan });

describe('descontar', () => {
    it('primero el plan, después el pack', () => {
        expect(descontar(saldo(0.15, 1), 0.2)).toEqual({ nuevo: saldo(0, 0.95, 0.2), dePlan: 0.15, dePack: 0.05 });
    });
    it('si no alcanza, nada', () => {
        expect(descontar(saldo(0.05, 0.04), 0.1)).toBeNull();
    });
    it('justo alcanza, aunque la suma tenga restos de coma flotante', () => {
        expect(descontar(saldo(0.1, 0.2), 0.3)).not.toBeNull();
    });
    it('costo cero no toca el saldo', () => {
        expect(descontar(saldo(0, 0), 0)).toEqual({ nuevo: saldo(0, 0), dePlan: 0, dePack: 0 });
    });
});

describe('devolver', () => {
    it('vuelve a donde salió', () => {
        expect(devolver(saldo(0, 0.95, 0.2), { dePlan: 0.15, dePack: 0.05, periodoDelPlan: 1 })).toEqual({ nuevo: saldo(0.15, 1, 0), devueltoUsd: 0.2 });
    });
    it('si la cuota del plan se renovó, lo del plan no vuelve (el plan ya está lleno)', () => {
        expect(devolver(saldo(2, 0.95, 0.2, 2), { dePlan: 0.15, dePack: 0.05, periodoDelPlan: 1 })).toEqual({ nuevo: saldo(2, 1, 0.15, 2), devueltoUsd: 0.05 });
    });
});

const reserva = (extra: Partial<Reserva>): Reserva => ({
    operacion: 'analyzeVerseCanonically', costoUsd: 0.1, dePlan: 0.1, dePack: 0, etiquetas: ['exegesis.analyzeVerse'],
    maxLlamadas: 6, llamadas: 0, llmContactadoEn: null, estado: 'abierta', periodoDelPlan: 1, creada: 1000, ...extra,
});

describe('elegirReserva', () => {
    const ahora = 10_000;
    it('primero las que no se usaron (cada operación en paralelo toma la suya), y entre ellas la más vieja', () => {
        const r = elegirReserva([
            { id: 'usada', reserva: reserva({ llamadas: 1, estado: 'usada', creada: 100 }) },
            { id: 'nueva-tarde', reserva: reserva({ creada: 3000 }) },
            { id: 'nueva-temprano', reserva: reserva({ creada: 2000 }) },
        ], 'exegesis.analyzeVerse', ahora);
        expect(r?.id).toBe('nueva-temprano');
    });
    it('si no hay sin usar, una usada que no llegó a su tope (un reintento)', () => {
        expect(elegirReserva([{ id: 'u', reserva: reserva({ llamadas: 3, estado: 'usada' }) }], 'exegesis.analyzeVerse', ahora)?.id).toBe('u');
    });
    it('nunca una de otra etiqueta, devuelta, vencida o en su tope', () => {
        expect(elegirReserva([
            { id: 'otra', reserva: reserva({ etiquetas: ['exegesis.composeVerse'] }) },
            { id: 'devuelta', reserva: reserva({ estado: 'devuelta' }) },
            { id: 'vencida', reserva: reserva({ creada: ahora - VIGENCIA_DE_RESERVA_MS - 1 }) },
            { id: 'tope', reserva: reserva({ llamadas: 6, estado: 'usada' }) },
        ], 'exegesis.analyzeVerse', ahora)).toBeNull();
    });
});

describe('reservaIdValido', () => {
    it('un UUID sí; vacío, con barras o larguísimo no', () => {
        expect(reservaIdValido('0b5c6f2e-6a1d-4a7e-9a52-2f1d0c3b9e11')).toBe(true);
        expect(reservaIdValido('')).toBe(false);
        expect(reservaIdValido('a/b/c/d/e/f')).toBe(false);
        expect(reservaIdValido('x'.repeat(65))).toBe(false);
        expect(reservaIdValido(42)).toBe(false);
    });
});

describe('elegirReserva — reintento con azar', () => {
    it('en un reintento elige entre las frescas al azar (para no pisarse), nunca una usada si hay frescas', () => {
        const reservas = [
            { id: 'usada', reserva: reserva({ llamadas: 2, estado: 'usada', creada: 10 }) },
            { id: 'f1', reserva: reserva({ creada: 100 }) },
            { id: 'f2', reserva: reserva({ creada: 200 }) },
            { id: 'f3', reserva: reserva({ creada: 300 }) },
        ];
        expect(elegirReserva(reservas, 'exegesis.analyzeVerse', 10_000, () => 0.99)?.id).toBe('f3');
        expect(elegirReserva(reservas, 'exegesis.analyzeVerse', 10_000, () => 0)?.id).toBe('f1');
        expect(elegirReserva(reservas, 'exegesis.analyzeVerse', 10_000, null)?.id).toBe('f1');
    });
});
