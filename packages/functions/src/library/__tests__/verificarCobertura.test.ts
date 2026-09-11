import { describe, it, expect } from 'vitest';
import { verificarCobertura, MIN_PAGE_COVERAGE } from '../coberturaDePaginas';

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

    it('no opina cuando no se sabe cuántas páginas esperar', () => {
        expect(verificarCobertura(paginas(1, 5), 0)).toEqual({ ok: true });
    });

    it('rechaza que no vuelva nada', () => {
        expect(verificarCobertura([], 100).ok).toBe(false);
    });

    it('el piso quedó por encima del que dejó pasar a Barrick', () => {
        expect(MIN_PAGE_COVERAGE).toBeGreaterThan(138 / 170);
    });
});
