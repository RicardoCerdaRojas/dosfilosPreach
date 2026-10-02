import { describe, it, expect } from 'vitest';
import { corpusFootprint, sourceFootprintChars } from '../corpusFootprint';

/**
 * Jonás 4:5-11 (2026-10-02): el corpus decía 4% con 77 hojas de un léxico y
 * 13 de un comentario adentro — sólo sumaba fragmentos, y una fuente con
 * páginas elegidas guarda las hojas, no su texto.
 */
const indice = (hojas: number, chars: number) =>
    Array.from({ length: hojas }, (_, i) => ({ sheet: i + 1, chunkIndices: [i], section: null, firstLine: '', charCount: chars }) as never);
const conPaginas = (id: string, start: number, end: number) =>
    ({ id, excerpts: [], excerptRecipe: { sheetRanges: [{ start, end }], proposedRanges: [], pinnedRanges: [], passageFingerprint: '' } }) as never;
const conFragmentos = (id: string, chars: number) =>
    ({ id, excerpts: [{ text: 'x'.repeat(chars) }], excerptRecipe: null }) as never;

describe('sourceFootprintChars', () => {
    it('una fuente con páginas ocupa lo que sus hojas, no cero', () => {
        expect(sourceFootprintChars(conPaginas('lex', 1, 77), indice(807, 1000))).toBe(77_000);
    });

    it('sin el índice todavía, no se sabe (null), en vez de decir cero', () => {
        expect(sourceFootprintChars(conPaginas('lex', 1, 77), null)).toBeNull();
    });

    it('una fuente con fragmentos ocupa sus fragmentos', () => {
        expect(sourceFootprintChars(conFragmentos('g', 8741), null)).toBe(8741);
    });
});

describe('corpusFootprint', () => {
    it('suma páginas y fragmentos; avisa si falta medir alguna', () => {
        const fuentes = [conPaginas('lex', 1, 77), conPaginas('burt', 79, 91), conFragmentos('gelston', 8741)];
        const completo = corpusFootprint(fuentes, new Map([['lex', indice(807, 1000)], ['burt', indice(98, 3500)]]));
        expect(completo).toEqual({ chars: 77_000 + 13 * 3500 + 8741, pending: false });

        const aMedias = corpusFootprint(fuentes, new Map([['lex', indice(807, 1000)]]));
        expect(aMedias.pending).toBe(true);
    });
});
