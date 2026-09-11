import { describe, it, expect } from 'vitest';
import { convieneReintentarTanda, MIN_PAGE_COVERAGE } from '../coberturaDePaginas';
import { OVERLAP_PAGES } from '../calibrarTanda';

/**
 * El defecto que motivó esto: dos tolerancias del mismo módulo se contradecían.
 * El piso de cobertura daba por bueno un libro al que le faltaba hasta el 5%,
 * mientras el reintento exigía el 100% de cada tanda.
 *
 * Caso real, 11-09-2026 a las 18:09:40 sobre la gramática de Barrick:
 *
 *     ⚠️ Tanda 2 devolvió 42/43 páginas; reintentando una vez
 *
 * Releer una tanda cuesta lo mismo que leerla —181 s medidos— así que se
 * pagaron 181 s para recuperar una página que, además, la tanda siguiente iba a
 * releer igual por el solapamiento. Esa sola relectura sacó la extracción del
 * techo de 900 s.
 */
const todas = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const menos = (n: number, quitar: number[]) => todas(n).filter(p => !quitar.includes(p));

describe('convieneReintentarTanda', () => {
    it('no relee por la página que el solapamiento ya cubre (el caso Barrick)', () => {
        // 42 de 43, faltando la última: la tanda siguiente arranca antes y la lee.
        expect(convieneReintentarTanda(menos(43, [43]), 43, true)).toBe(false);
    });

    it('sí relee cuando esa misma tanda es la última', () => {
        // Detrás no hay nadie que la relea, y perder su final es perder el final
        // del libro — el caso de las 138 páginas de 170.
        expect(convieneReintentarTanda(todas(100), 170, false)).toBe(true);
    });

    it('no relee una falta interna que el piso de cobertura tolera', () => {
        // Una página suelta del medio: 42/43 = 97,7%, por encima del piso. El
        // guard de cobertura del libro entero la verá si importa.
        expect(convieneReintentarTanda(menos(43, [20]), 43, true)).toBe(false);
        expect(42 / 43).toBeGreaterThan(MIN_PAGE_COVERAGE);
    });

    it('relee cuando falta de verdad, dentro o fuera del solapamiento', () => {
        // La mitad de la tanda: ninguna tolerancia cubre esto.
        expect(convieneReintentarTanda(todas(20), 43, true)).toBe(true);
        expect(convieneReintentarTanda([], 43, true)).toBe(true);
    });

    it('una tanda completa nunca se relee', () => {
        expect(convieneReintentarTanda(todas(43), 43, true)).toBe(false);
        expect(convieneReintentarTanda(todas(43), 43, false)).toBe(false);
        // Y si vuelve de más —páginas repetidas o renumeradas—, tampoco.
        expect(convieneReintentarTanda(todas(45), 43, false)).toBe(false);
    });

    it('el tramo que el solapamiento perdona es exactamente el que relee', () => {
        // Justo las OVERLAP_PAGES últimas: perdonadas.
        const ultimas = Array.from({ length: OVERLAP_PAGES }, (_, i) => 43 - i);
        expect(convieneReintentarTanda(menos(43, ultimas), 43, true)).toBe(false);
        // Una más allá del tramo: ya no la cubre nadie, y encima cae bajo el piso.
        const unaDeMas = [...ultimas, 43 - OVERLAP_PAGES];
        expect(convieneReintentarTanda(menos(43, unaDeMas), 43, true)).toBe(true);
    });

    it('una tanda sin páginas esperadas no produce decisiones', () => {
        expect(convieneReintentarTanda([], 0, true)).toBe(false);
        expect(convieneReintentarTanda([], -1, false)).toBe(false);
    });
});
