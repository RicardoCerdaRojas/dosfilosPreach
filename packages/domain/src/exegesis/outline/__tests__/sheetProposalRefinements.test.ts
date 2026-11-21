import { describe, expect, it } from 'vitest';
import { shortResourceSheets, withCommentaryContour } from '../sheetProposalRefinements';

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
