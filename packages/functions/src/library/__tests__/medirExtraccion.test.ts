import { describe, it, expect } from 'vitest';
import { caracteresPorPagina, camposDeMedicion, medirExtraccion } from '../medirExtraccion';

/**
 * Auditoría de la biblioteca del fundador (2026-10-15): `pageCount` guardaba
 * lo que DEVOLVIÓ el extractor, así que Varner decía «244 páginas» con 17 sin
 * texto (189-200 seguidas), y 13 libros de LlamaParse tenían un
 * `structured.md` con marcas y sin texto.
 */
const pagina = (n: number, texto: string) => `<!-- page: ${n} -->\n${texto}\n`;
const TEXTO = 'x'.repeat(200);

describe('medirExtraccion', () => {
    it('una página ausente falta, aunque el extractor diga cuántas devolvió', () => {
        const md = pagina(1, TEXTO) + pagina(3, TEXTO);
        expect(medirExtraccion(md, 3).paginasFaltantes).toEqual({ total: 1, paginas: [2] });
    });

    it('una página vacía falta sólo si el PDF tiene texto en ella', () => {
        const md = pagina(1, TEXTO) + pagina(2, '') + pagina(3, '');
        // capa: la 2 tiene texto en el PDF (perdida), la 3 está en blanco (de verdad).
        expect(medirExtraccion(md, 3, [900, 900, 0]).paginasFaltantes).toEqual({ total: 1, paginas: [2] });
        // Sin capa de texto, una vacía puede ser una página en blanco: no se cuenta.
        expect(medirExtraccion(md, 3, null).paginasFaltantes.total).toBe(0);
    });

    it('lee también las marcas de textContent ([PAGE N])', () => {
        expect(caracteresPorPagina('[PAGE 1]\nabc\n[PAGE 2]\n  de f ')).toEqual(new Map([[1, 3], [2, 3]]));
    });

    it('sin marcas de página no inventa una lista', () => {
        expect(medirExtraccion('texto corrido sin marcas', 120).paginasFaltantes.total).toBe(0);
        expect(medirExtraccion('texto corrido sin marcas', 120).pdfPageCount).toBe(120);
    });

    it('detecta el texto estructurado vacío (marcas y nada más)', () => {
        const vacio = Array.from({ length: 50 }, (_, i) => pagina(i + 1, '\n---\n')).join('');
        expect(medirExtraccion(vacio, 50).textoVacio).toBe(true);
        expect(medirExtraccion(pagina(1, TEXTO), 1).textoVacio).toBe(false);
    });

    it('sin el total del PDF no mide faltantes', () => {
        expect(medirExtraccion(pagina(1, TEXTO), null)).toMatchObject({ pdfPageCount: null, paginasFaltantes: { total: 0 } });
    });

    it('los campos borran lo que ya no aplica', () => {
        const BORRAR = Symbol('borrar');
        expect(camposDeMedicion(medirExtraccion(pagina(1, TEXTO), 1), BORRAR))
            .toEqual({ pdfPageCount: 1, paginasFaltantes: BORRAR, textoEstructuradoVacio: BORRAR });
    });

    it('con el texto estructurado vacío, cuenta el de respaldo: la página no está perdida', () => {
        const md = pagina(1, '') + pagina(2, '');
        const respaldo = `[PAGE 1]\n${TEXTO}\n[PAGE 2]\n${TEXTO}`;
        expect(medirExtraccion(md, 2, [900, 900], respaldo).paginasFaltantes.total).toBe(0);
        expect(medirExtraccion(md, 2, [900, 900]).paginasFaltantes.total).toBe(2);
    });
});
