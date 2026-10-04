import { describe, expect, it } from 'vitest';

import { addDays, fromStoredDate } from '../dateUtils';

describe('fecha guardada → su día', () => {
    // Esta prueba sólo discrimina donde la medianoche UTC es el día anterior
    // (el CI corre con TZ=America/Santiago). En otro huso, falla: no pasa a ciegas.
    it('corre en un huso al oeste de Greenwich', () => {
        expect(new Date('2026-10-04T00:00:00.000Z').getDate()).toBe(3);
    });

    it('REGRESIÓN: una fecha a medianoche UTC sigue siendo ese domingo (antes se curaba al sábado)', () => {
        const stored = new Date('2026-10-04T00:00:00.000Z');
        const day = fromStoredDate(stored);
        expect([day.getFullYear(), day.getMonth() + 1, day.getDate()]).toEqual([2026, 10, 4]);
        // El «curado» de antes la llevaba al 3.
        expect(addDays(stored, 0).getDate()).toBe(3);
    });

    it('una fecha con hora local conserva su día local', () => {
        const day = fromStoredDate(new Date(2026, 9, 4, 0, 0));
        expect([day.getMonth() + 1, day.getDate()]).toEqual([10, 4]);
    });
});
