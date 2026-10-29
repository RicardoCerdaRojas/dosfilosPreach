import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * TP #9 (Santiago 4:11-17, B26): para el NA28 la sugerencia fueron 40 hojas de
 * otros libros, que salieron del parecido de contenido. En una edición del
 * texto sólo cuentan las hojas cuyo encabezado corrido es del libro del pasaje.
 */
const llamadas: string[] = [];
const referencia = vi.fn();
vi.mock('firebase/functions', () => ({
    getFunctions: () => ({}),
    httpsCallable: (_f: unknown, nombre: string) => async () => {
        llamadas.push(nombre);
        if (nombre === 'getDocumentOutline') return { data: { sections: [] } };
        if (nombre === 'retrieveChunks') return { data: { chunks: [{ resourceId: 'r', chunkIndex: 0, metadata: { page: 382 } }] } };
        return { data: {} };
    },
}));
vi.mock('../DocumentPageIndexClient', () => ({ searchDocumentByReference: (...a: unknown[]) => referencia(...a) }));
const { proposeSheetRanges } = await import('../SheetRangeProposer');

const hoja = (sheet: number, firstLine: string) => ({ sheet, chunkIndices: [sheet], section: '2', firstLine, charCount: 1000 });
const na28 = [
    hoja(382, '11,1–8 | ΚΑΤΑ ΛΟΥΚΑΝ **1** Καὶ ἐγένετο ἐν τῷ εἶναι αὐτὸν'),
    hoja(802, 'ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ | 3,10–4,2 ριον καὶ πατέρα'),
    hoja(803, '4,3–12 | ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ λεμεῖτε, ⸂οὐκ ἔχετε⸃'),
    hoja(804, 'ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ | 4,13–5,3 **13** Ἄγε νῦν'),
    hoja(805, '5,4–11 | ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ αὐτῶν εἰς μαρτύριον'),
];
const base = {
    resourceId: 'r',
    userId: 'u',
    passage: { bookId: 'JAS' as const, chapterStart: 4, chapterEnd: 4, verseStart: 11, verseEnd: 17 },
    assignmentBrief: 'Trabajo práctico semanal',
    language: 'es' as const,
};

describe('proposeSheetRanges · edición del texto (B26)', () => {
    beforeEach(() => {
        llamadas.length = 0;
        referencia.mockReset();
        // Las referencias cruzadas del margen nombran Santiago desde la hoja de otro libro.
        referencia.mockResolvedValue({ hits: [{ sheet: 382, count: 1, verses: [11], snippet: 'Jc 4,11', section: null }] });
    });

    it('el aparato crítico propone sólo las hojas de Santiago 4 por su encabezado corrido', async () => {
        const p = await proposeSheetRanges({ ...base, pageIndex: na28 as never, sourceType: 'critical-apparatus', questionVerses: [11, 13, 14] });
        expect(p).toEqual({ kind: 'structural', ranges: [{ start: 803, end: 804 }] });
        expect(llamadas).not.toContain('retrieveChunks');
        expect(referencia).not.toHaveBeenCalled();
    });

    it('la edición del texto, igual', async () => {
        const p = await proposeSheetRanges({ ...base, pageIndex: na28 as never, sourceType: 'biblical-text-edition' });
        expect(p.ranges).toEqual([{ start: 803, end: 804 }]);
    });

    it('sin encabezados del libro no propone nada: ni parecido de contenido ni referencias cruzadas', async () => {
        const sinSantiago = na28.filter(h => h.sheet === 382);
        const p = await proposeSheetRanges({ ...base, pageIndex: sinSantiago as never, sourceType: 'critical-apparatus' });
        expect(p).toEqual({ kind: 'none', ranges: [] });
        expect(llamadas).not.toContain('retrieveChunks');
        expect(referencia).not.toHaveBeenCalled();
    });

    it('un comentario sigue con su camino de siempre', async () => {
        const p = await proposeSheetRanges({ ...base, pageIndex: na28 as never, sourceType: 'commentary-critical' });
        expect(p.kind).toBe('passage');
        expect(referencia).toHaveBeenCalled();
    });
});
