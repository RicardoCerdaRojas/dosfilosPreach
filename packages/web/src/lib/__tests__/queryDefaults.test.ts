import { describe, it, expect } from 'vitest';
import { QUERY_GC_TIME_MS, queryRetry } from '../queryDefaults';

describe('las consultas de la app', () => {
    it('REGRESIÓN: un permiso negado no se reintenta (eran ~7 s de esqueleto)', () => {
        expect(queryRetry(0, { code: 'permission-denied' })).toBe(false);
    });

    it('los demás fallos se reintentan hasta 3 veces', () => {
        expect(queryRetry(0, { code: 'unavailable' })).toBe(true);
        expect(queryRetry(2, new Error('red'))).toBe(true);
        expect(queryRetry(3, new Error('red'))).toBe(false);
        expect(queryRetry(0, null)).toBe(true);
    });

    it('lo que se deja de mirar queda media hora en caché', () => {
        expect(QUERY_GC_TIME_MS).toBe(30 * 60_000);
    });
});
