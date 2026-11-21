import { describe, expect, it } from 'vitest';
import { commentarySectionsByVerse, shortResourceSheets, withCommentaryContour } from '../sheetProposalRefinements';

const indice = (desde: number, hasta: number) => Array.from({ length: hasta - desde + 1 }, (_, i) => ({ sheet: desde + i }));

describe('shortResourceSheets', () => {
    it('un extracto de 2 hojas se propone entero', () => {
        expect(shortResourceSheets(indice(1, 2))).toEqual([{ start: 1, end: 2 }]);
    });
    it('un libro no', () => {
        expect(shortResourceSheets(indice(1, 4))).toEqual([]);
        expect(shortResourceSheets([])).toEqual([]);
    });
});

describe('withCommentaryContour', () => {
    it('suma una hoja a cada lado de la sección de un comentario', () => {
        expect(withCommentaryContour([{ start: 142, end: 146 }], indice(1, 400), 'commentary-expository'))
            .toEqual([{ start: 141, end: 147 }]);
    });
    it('no sale del libro', () => {
        expect(withCommentaryContour([{ start: 1, end: 3 }, { start: 398, end: 400 }], indice(1, 400), 'commentary-critical'))
            .toEqual([{ start: 1, end: 4 }, { start: 397, end: 400 }]);
    });
    it('une tramos que quedan pegados', () => {
        expect(withCommentaryContour([{ start: 10, end: 12 }, { start: 15, end: 16 }], indice(1, 50), 'commentary-critical'))
            .toEqual([{ start: 9, end: 17 }]);
    });
    it('no toca gramáticas, léxicos ni ediciones', () => {
        for (const t of ['grammar-syntax', 'lexicon-technical', 'biblical-text-edition'] as const) {
            expect(withCommentaryContour([{ start: 10, end: 12 }], indice(1, 50), t)).toEqual([{ start: 10, end: 12 }]);
        }
    });
});

describe('commentarySectionsByVerse', () => {
    // Un comentario con encabezados por referencia, una sección por tramo de versículos.
    const tramos: Array<[string, number, number]> = [
        ['James 5:1-6', 200, 205], ['James 5:7-8', 206, 208], ['James 5:9-11', 209, 212], ['James 5:12', 213, 214],
    ];
    const entries = tramos.flatMap(([section, desde, hasta]) => Array.from({ length: hasta - desde + 1 }, (_, i) => ({
        chunkIndex: desde + i, page: desde + i, section, sectionPath: ['Commentary', section],
    })));
    const pageIndex = Array.from({ length: 30 }, (_, i) => ({ sheet: 190 + i, chunkIndices: [190 + i], section: null, firstLine: '', charCount: 1000 }));
    const passage = { bookId: 'JAS' as const, chapterStart: 5, chapterEnd: 5, verseStart: 7, verseEnd: 11 };

    it('da la sección de cada versículo, con su contorno', () => {
        const r = commentarySectionsByVerse({ entries, pageIndex, passage, verses: [7, 11], sourceType: 'commentary-critical' });
        expect(Object.keys(r).map(Number).sort((a, b) => a - b)).toEqual([7, 11]);
        // La sección de 5:7-8 (206–208) con una hoja de cada lado, sin salir de lo que el índice da.
        expect(r[7]![0]!.start).toBeLessThanOrEqual(205);
        expect(r[7]![r[7]!.length - 1]!.end).toBeGreaterThanOrEqual(209);
        expect(r[11]!.some(x => x.start <= 212 && x.end >= 209)).toBe(true);
        expect(r[11]!.some(x => x.start <= 201)).toBe(false);
    });

    it('no corre para una gramática ni sin índice', () => {
        expect(commentarySectionsByVerse({ entries, pageIndex, passage, verses: [7], sourceType: 'grammar-syntax' })).toEqual({});
        expect(commentarySectionsByVerse({ entries: [], pageIndex, passage, verses: [7], sourceType: 'commentary-critical' })).toEqual({});
    });
});
