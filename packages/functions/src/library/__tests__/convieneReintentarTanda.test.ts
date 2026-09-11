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

/**
 * INVARIANTE, no ejemplo.
 *
 * Las pruebas de arriba fijan casos concretos; si mañana alguien mueve
 * `MIN_PAGE_COVERAGE` o `OVERLAP_PAGES`, esos casos se actualizan uno por uno y
 * la CONTRADICCIÓN que causó el defecto puede volver sin que nada se ponga en
 * rojo. Lo que sigue ata la RELACIÓN entre las dos tolerancias, que es lo que
 * de verdad se rompió: un piso que acepta perder 5% conviviendo con un
 * reintento que exigía el 100%.
 *
 * Es el patrón que pide `docs/REVISION_ADVERSARIAL.md` §5: cuando dos
 * números se gobiernan entre sí, la relación se prueba, no se recuerda.
 */
describe('invariante: el reintento nunca es más estricto que el piso de cobertura', () => {
    const todasMenosUltimas = (n: number, faltan: number) =>
        Array.from({ length: n - faltan }, (_, i) => i + 1);

    it('ninguna pérdida que el piso acepta obliga a releer una tanda intermedia', () => {
        // Se recorren tamaños y pérdidas reales en vez de un solo ejemplo: la
        // contradicción no vivía en un caso, vivía en la comparación.
        for (const esperadas of [10, 20, 30, 43, 60]) {
            for (let faltan = 1; faltan < esperadas; faltan++) {
                const devueltas = todasMenosUltimas(esperadas, faltan);
                const proporcion = devueltas.length / esperadas;
                const cubiertoPorSolape = faltan <= OVERLAP_PAGES;

                if (proporcion >= MIN_PAGE_COVERAGE || cubiertoPorSolape) {
                    expect(
                        convieneReintentarTanda(devueltas, esperadas, true),
                        `${devueltas.length}/${esperadas}: el piso lo acepta (o lo cubre el solapamiento), releer es pagar de más`,
                    ).toBe(false);
                }
            }
        }
    });

    it('la última tanda sí relee, porque detrás no hay quien cubra su final', () => {
        // El invariante de arriba vale para tandas intermedias. En la última el
        // solapamiento no existe, y perder su final es perder el final del
        // libro — el caso de las 138 páginas de 170 que subió el piso a 0,95.
        const esperadas = 43;
        const faltan = OVERLAP_PAGES; // lo que el solapamiento perdonaría
        const devueltas = todasMenosUltimas(esperadas, faltan);
        expect(convieneReintentarTanda(devueltas, esperadas, true)).toBe(false);
        expect(convieneReintentarTanda(devueltas, esperadas, false)).toBe(
            devueltas.length / esperadas < MIN_PAGE_COVERAGE,
        );
    });
});
