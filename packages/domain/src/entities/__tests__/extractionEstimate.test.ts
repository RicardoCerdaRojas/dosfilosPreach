import { describe, it, expect } from 'vitest';
import {
    estimateRemainingFromProgressMs,
    formatElapsedShort,
    formatEstimateShort,
} from '../extractionEstimate';

const MIN = 60_000;
const inicio = new Date('2026-09-16T20:00:00Z');
const tras = (minutos: number) => new Date(inicio.getTime() + minutos * MIN);

describe('estimateRemainingFromProgressMs', () => {
    it('proyecta lo que falta con el ritmo medido', () => {
        // 300 de 900 páginas en 60 minutos: faltan 600 al mismo ritmo, 120 min.
        const ms = estimateRemainingFromProgressMs({
            startedAt: inicio, now: tras(60), paginasHechas: 300, totalPaginas: 900,
        });
        expect(ms).toBe(120 * MIN);
    });

    it('baja a medida que avanza, en vez de quedarse fijo', () => {
        // El defecto original: «~11 min estimado» durante tres horas.
        const antes = estimateRemainingFromProgressMs({ startedAt: inicio, now: tras(60), paginasHechas: 300, totalPaginas: 900 })!;
        const despues = estimateRemainingFromProgressMs({ startedAt: inicio, now: tras(150), paginasHechas: 780, totalPaginas: 900 })!;
        expect(despues).toBeLessThan(antes);
    });

    it('no proyecta sin base honesta', () => {
        expect(estimateRemainingFromProgressMs({ startedAt: undefined, now: tras(5), paginasHechas: 10, totalPaginas: 100 })).toBeNull();
        expect(estimateRemainingFromProgressMs({ startedAt: inicio, now: tras(5), paginasHechas: 0, totalPaginas: 100 })).toBeNull();
        expect(estimateRemainingFromProgressMs({ startedAt: inicio, now: tras(5), paginasHechas: 100, totalPaginas: 100 })).toBeNull();
        expect(estimateRemainingFromProgressMs({ startedAt: inicio, now: tras(0), paginasHechas: 10, totalPaginas: 100 })).toBeNull();
        expect(estimateRemainingFromProgressMs({ startedAt: inicio, now: tras(5), paginasHechas: 10, totalPaginas: 0 })).toBeNull();
    });
});

describe('formatEstimateShort', () => {
    it('conserva minutos y segundos bajo la hora', () => {
        expect(formatEstimateShort(30_000)).toBe('~30s');
        expect(formatEstimateShort(11 * MIN)).toBe('~11 min');
    });

    it('pasa a horas desde los 60 minutos', () => {
        expect(formatEstimateShort(60 * MIN)).toBe('~1 h');
        expect(formatEstimateShort(95 * MIN)).toBe('~1 h 35 min');
    });
});

describe('formatElapsedShort', () => {
    it('muestra segundos mientras dura poco', () => {
        expect(formatElapsedShort(42_000)).toBe('42s');
        expect(formatElapsedShort(4 * MIN + 5_000)).toBe('4m 05s');
    });

    it('un trabajo largo se lee en horas, no en «165m 49s»', () => {
        expect(formatElapsedShort(165 * MIN + 49_000)).toBe('2 h 45 min');
        expect(formatElapsedShort(120 * MIN)).toBe('2 h');
    });

    it('nunca muestra negativo', () => {
        expect(formatElapsedShort(-5_000)).toBe('0s');
    });
});
