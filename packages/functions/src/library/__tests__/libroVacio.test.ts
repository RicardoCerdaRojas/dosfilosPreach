import { describe, expect, it } from 'vitest';
import { motivoDeLibroVacio } from '../libroVacio';

/**
 * El caso que lo motiva: 807 páginas, 10.381 caracteres, extracción «lista»,
 * 807 páginas cobradas y el texto anterior pisado.
 */
describe('motivoDeLibroVacio', () => {
    it('el léxico que volvió en blanco no pasa', () => {
        const motivo = motivoDeLibroVacio({ pageCount: 807, textLength: 10_381 });
        expect(motivo).toMatch(/en blanco/);
        expect(motivo).toMatch(/protegidos o escaneados/);
        expect(motivo).toMatch(/se conserva/);
    });

    it('el mismo libro bien extraído pasa', () => {
        // La corrida de abril: 1.258.947 caracteres para 807 páginas.
        expect(motivoDeLibroVacio({ pageCount: 807, textLength: 1_258_947 })).toBeNull();
    });

    it('un libro escueto pero real pasa: el piso es de vida o muerte, no de calidad', () => {
        // 100 caracteres por página es poquísimo y aun así es un libro.
        expect(motivoDeLibroVacio({ pageCount: 200, textLength: 20_000 })).toBeNull();
    });

    it('un extracto de pocas páginas no se juzga por promedio', () => {
        expect(motivoDeLibroVacio({ pageCount: 3, textLength: 12 })).toBeNull();
    });

    it('cero caracteres en un libro largo es el caso más claro', () => {
        expect(motivoDeLibroVacio({ pageCount: 500, textLength: 0 })).not.toBeNull();
    });
});
