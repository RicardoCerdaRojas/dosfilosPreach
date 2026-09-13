import { describe, it, expect } from 'vitest';
import { verificarCobertura, MIN_PAGE_COVERAGE, paginasQueFaltan } from '../coberturaDePaginas';

/**
 * El piso estaba en 0,80 y dejó pasar un caso real.
 *
 * La gramática hebrea de Barrick, de 170 páginas, volvió con 138 —cortada en la
 * 138, sin las últimas 32, y sin un solo hueco interno—. 81% supera un piso de
 * 80, así que el libro entró al corpus como completo y se citó 32 veces en un
 * trabajo entregado.
 *
 * Perder una de cada cinco páginas no es una extracción aceptable con un
 * defecto menor: es un libro distinto. Y el corte al FINAL es el caso peor,
 * porque en una gramática los capítulos avanzados son los que se citan.
 */
const paginas = (desde: number, hasta: number) =>
    Array.from({ length: hasta - desde + 1 }, (_, i) => ({ page: desde + i }));

describe('verificarCobertura', () => {
    it('rechaza el caso Barrick: 138 de 170, cortada al final', () => {
        const r = verificarCobertura(paginas(1, 138), 170);
        expect(r.ok).toBe(false);
        expect(r.ok === false && r.motivo).toContain('138');
    });

    it('acepta un libro completo', () => {
        expect(verificarCobertura(paginas(1, 425), 425)).toEqual({ ok: true });
    });

    it('tolera huecos sueltos: el resto del libro sirve', () => {
        // McComiskey: 420 de 425, con 5 huecos internos. Recuperable.
        const con5menos = paginas(1, 425).filter(p => ![10, 50, 90, 200, 300].includes(p.page));
        expect(verificarCobertura(con5menos, 425)).toEqual({ ok: true });
    });

    it('detecta el corte al final AUNQUE la proporción alcance', () => {
        // 96% de las páginas, pero todas al principio: el libro perdió su
        // cierre. La proporción sola lo dejaba pasar.
        expect(verificarCobertura(paginas(1, 960), 1000).ok).toBe(false);
    });

    it('deja pasar que falte la última página o dos', () => {
        // Cubiertas y colofones: no vale fallar una extracción entera por eso.
        expect(verificarCobertura(paginas(1, 398), 400)).toEqual({ ok: true });
    });

    it('se NIEGA a certificar cuando no sabe cuántas páginas esperar', () => {
        // Antes esto devolvía `{ ok: true }` con el argumento de que «sin total
        // no hay nada que comprobar». El 12-09-2026 eso certificó un libro de
        // 392 páginas con 24: el total llegó `null` y `null <= 0` es `true`.
        // Un guard que ante la duda aprueba no es un guard.
        expect(verificarCobertura(paginas(1, 5), 0).ok).toBe(false);
        expect(verificarCobertura(paginas(1, 5), null as unknown as number).ok).toBe(false);
        expect(verificarCobertura(paginas(1, 5), NaN).ok).toBe(false);
    });

    it('rechaza que no vuelva nada', () => {
        expect(verificarCobertura([], 100).ok).toBe(false);
    });

    it('el piso quedó por encima del que dejó pasar a Barrick', () => {
        expect(MIN_PAGE_COVERAGE).toBeGreaterThan(138 / 170);
    });
});

/**
 * «Aceptable» y «completo» no son lo mismo.
 *
 * El fascículo BHQ quedó `ready` con 314 de sus 315 hojas. El piso lo aceptó
 * —99,7%, muy por encima del 95%— y hace bien: la hoja perdida es un escaneo
 * defectuoso, con la mano de quien sostenía el libro tapando el tercio
 * inferior, y rechazar la obra entera por eso sería peor.
 *
 * Pero nada en el recurso decía cuál faltaba. Quien cite el folio 88 —Nahúm
 * 3:1-4 con su aparato— no recibe ningún aviso.
 */
describe('paginasQueFaltan', () => {
    const leidas = (ns: number[]) => ns.map(page => ({ page }));

    it('nombra la página perdida, no sólo cuenta', () => {
        const todas = Array.from({ length: 315 }, (_, i) => i + 1).filter(p => p !== 215);
        expect(paginasQueFaltan(leidas(todas), 315)).toEqual({ total: 1, paginas: [215] });
    });

    it('un libro completo no reporta nada', () => {
        expect(paginasQueFaltan(leidas([1, 2, 3]), 3)).toEqual({ total: 0, paginas: [] });
    });

    it('la lista se acota pero el total sigue siendo exacto', () => {
        // Una extracción muy mala puede perder cientos: guardarlas todas engorda
        // el documento sin decir nada nuevo.
        const r = paginasQueFaltan(leidas([1]), 500, 10);
        expect(r.total).toBe(499);
        expect(r.paginas).toHaveLength(10);
        expect(r.paginas[0]).toBe(2);
    });

    it('sin total que comparar no inventa faltantes', () => {
        expect(paginasQueFaltan(leidas([1, 2]), 0)).toEqual({ total: 0, paginas: [] });
        expect(paginasQueFaltan(leidas([1, 2]), null as unknown as number).total).toBe(0);
    });
});
