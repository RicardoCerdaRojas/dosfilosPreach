import { describe, it, expect } from 'vitest';
import { commentaryBookCoverage, sourceTypesForRubric } from '../commentaryCoverage';
import type { BibleBookId } from '../../../bible/canon/BibleCanon';

/**
 * TP #6 (Santiago 3): Subukjian, homilética, cumplía «Comentario expositivo
 * · 1/1» de un trabajo sobre Santiago.
 */
const JAS = 'JAS' as BibleBookId;
const ROM = 'ROM' as BibleBookId;

describe('si un comentario comenta el libro del pasaje', () => {
    it('lo comenta, o comenta la Biblia o un testamento sin detallar libros', () => {
        expect(commentaryBookCoverage({ coversBibleBooks: [JAS], scope: 'book' }, JAS)).toBe('covers');
        expect(commentaryBookCoverage({ coversBibleBooks: [], scope: 'whole-bible' }, JAS)).toBe('covers');
        expect(commentaryBookCoverage({ coversBibleBooks: [], scope: 'whole-testament' }, JAS)).toBe('covers');
        // Sin ficha de biblioteca no hay de dónde saberlo.
        expect(commentaryBookCoverage(null, JAS)).toBe('covers');
    });

    it('comenta otros libros, o la biblioteca no dice cuál', () => {
        expect(commentaryBookCoverage({ coversBibleBooks: [ROM], scope: 'book' }, JAS)).toBe('other-books');
        expect(commentaryBookCoverage({ coversBibleBooks: [], scope: 'book' }, JAS)).toBe('no-book');
        expect(commentaryBookCoverage({ coversBibleBooks: undefined, scope: undefined }, JAS)).toBe('no-book');
    });
});

describe('lo que cuenta la rúbrica', () => {
    const recursos: Record<string, { coversBibleBooks: BibleBookId[]; scope?: 'book' }> = {
        moo: { coversBibleBooks: [JAS], scope: 'book' },
        romanos: { coversBibleBooks: [ROM], scope: 'book' },
        subido: { coversBibleBooks: [] },
    };
    const de = (id: string) => recursos[id];

    it('REGRESIÓN: un comentario de OTRO libro no suma al requisito de comentario', () => {
        const tipos = sourceTypesForRubric([
            { sourceType: 'commentary-expository', sourceLibraryResourceId: 'moo', corpusId: 'c1' },
            { sourceType: 'commentary-expository', sourceLibraryResourceId: 'romanos', corpusId: 'c2' },
        ], de, JAS);
        expect(tipos).toEqual(['commentary-expository']);
    });

    it('sin libro registrado sigue contando (el archivo subido desde el corpus queda así)', () => {
        expect(sourceTypesForRubric([
            { sourceType: 'commentary-critical', sourceLibraryResourceId: null, corpusId: 'subido' },
        ], de, JAS)).toEqual(['commentary-critical']);
    });

    it('sólo afecta a los comentarios: una gramática de alcance amplio cuenta igual', () => {
        expect(sourceTypesForRubric([
            { sourceType: 'grammar-syntax', sourceLibraryResourceId: 'romanos', corpusId: 'c3' },
        ], de, JAS)).toEqual(['grammar-syntax']);
    });
});
