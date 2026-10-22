import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * TP #8 (2026-10-21, fase 8a, A1): la propuesta de páginas de una gramática no
 * miraba las hojas que NOMBRAN el pasaje. Wallace propuso 14 tramos por
 * parecido de texto y ninguno contenía las hojas 569, 633 y 698.
 */
const llamadas: string[] = [];
const referencia = vi.fn();
vi.mock('firebase/functions', () => ({
    getFunctions: () => ({}),
    httpsCallable: (_f: unknown, nombre: string) => async () => {
        llamadas.push(nombre);
        if (nombre === 'getDocumentOutline') return { data: { sections: [] } };
        if (nombre === 'retrieveChunks') return { data: { chunks: [{ resourceId: 'r', chunkIndex: 0, metadata: { page: 144 } }] } };
        return { data: {} };
    },
}));
vi.mock('../DocumentPageIndexClient', () => ({ searchDocumentByReference: (...a: unknown[]) => referencia(...a) }));
const { proposeSheetRanges, selectionModeOf } = await import('../SheetRangeProposer');

const indice = Array.from({ length: 900 }, (_, i) => ({ sheet: i + 1, chunkIndices: [i] }));
const base = {
    resourceId: 'r',
    userId: 'u',
    passage: { bookId: 'JAS' as const, chapterStart: 4, chapterEnd: 4, verseStart: 1, verseEnd: 10 },
    assignmentBrief: null,
    language: 'es' as const,
    pageIndex: indice as never,
};
const hojasDeWallace = {
    hits: [
        { sheet: 569, count: 1, verses: [5, 6], snippet: '', section: null },
        { sheet: 633, count: 1, verses: [2], snippet: '', section: null },
        { sheet: 698, count: 1, verses: [2], snippet: '', section: null },
        { sheet: 850, count: 1, verses: [8], snippet: '', section: null },
    ],
};

describe('proposeSheetRanges · por pasaje', () => {
    beforeEach(() => { llamadas.length = 0; referencia.mockReset(); referencia.mockResolvedValue(hojasDeWallace); });

    it('una gramática propone las hojas que nombran los versículos con pregunta, antes que nada', async () => {
        const p = await proposeSheetRanges({ ...base, sourceType: 'grammar-syntax', questionVerses: [1, 2, 3, 5] });
        expect(p).toEqual({ kind: 'passage', ranges: [{ start: 569, end: 569 }, { start: 633, end: 633 }, { start: 698, end: 698 }] });
        expect(llamadas).not.toContain('retrieveChunks');
        // El servidor recibe el libro, para leer también el índice `refs`.
        expect(referencia.mock.calls[0]![1]).toMatchObject({ bookId: 'JAS', chapterStart: 4 });
    });

    it('un léxico suma la hoja anterior: la definición empieza antes de la lista de citas', async () => {
        referencia.mockResolvedValue({ hits: [{ sheet: 585, count: 1, verses: [1], snippet: '', section: null }] });
        const p = await proposeSheetRanges({ ...base, sourceType: 'lexicon-technical', questionVerses: [1] });
        expect(p.ranges).toEqual([{ start: 584, end: 585 }]);
    });

    it('un comentario sin secciones por versículo usa el pasaje antes que el parecido', async () => {
        const p = await proposeSheetRanges({ ...base, sourceType: 'commentary-critical', questionVerses: [2] });
        expect(p.kind).toBe('passage');
        expect(llamadas).toContain('getDocumentOutline');
        expect(llamadas).not.toContain('retrieveChunks');
    });

    it('si ninguna hoja nombra el pasaje, cae al parecido de texto como antes', async () => {
        referencia.mockResolvedValue({ hits: [] });
        const p = await proposeSheetRanges({ ...base, sourceType: 'grammar-syntax', questionVerses: [2] });
        expect(p.kind).toBe('semantic');
    });

    it('un fallo de la búsqueda por pasaje no rompe la propuesta', async () => {
        referencia.mockRejectedValue(new Error('caída'));
        const p = await proposeSheetRanges({ ...base, sourceType: 'grammar-syntax', questionVerses: [2] });
        expect(p.kind).toBe('semantic');
    });
});

describe('selectionModeOf (A4)', () => {
    it('la propuesta por pasaje se registra como tal, no como coincidencia aproximada', () => {
        expect(selectionModeOf('passage')).toBe('passage');
        expect(selectionModeOf('structural')).toBe('structural');
        expect(selectionModeOf('semantic')).toBe('semantic');
    });
});
