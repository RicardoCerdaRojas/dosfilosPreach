import { describe, it, expect, vi, beforeEach } from 'vitest';

const llamadas: Array<{ sources: Array<{ resourceId: string }> }> = [];
let fallarTanda = -1;

vi.mock('firebase/functions', () => ({
    getFunctions: () => ({}),
    httpsCallable: () => async (payload: { sources: Array<{ resourceId: string }> }) => {
        const n = llamadas.push(payload) - 1;
        if (n === fallarTanda) throw new Error('caída');
        return { data: { chunks: payload.sources.map((s, i) => ({ resourceId: s.resourceId, chunkIndex: i, text: 'x', sheet: 1, section: null, score: 0.5 })), sourcesQueried: payload.sources.length, failedSources: [], emptySources: [] } };
    },
}));
vi.mock('../DocumentPageIndexClient', () => ({
    fetchDocumentPageIndex: async () => ({ pages: [{ sheet: 1, chunkIndices: [0], section: null, firstLine: '', charCount: 10 }] }),
}));

const { CallableCuratedCorpusRetriever, MAX_SOURCES_PER_CALL } = await import('../CallableCuratedCorpusRetriever');

/**
 * La callable rechaza más de 25 fuentes, y un rechazo dejaba en silencio a
 * TODAS. Desde que el documento completo y los fragmentos también se
 * consultan por versículo, un corpus grande pasa ese número.
 */
describe('CallableCuratedCorpusRetriever — ranking en tandas', () => {
    const fuentes = (n: number) => Array.from({ length: n }, (_, i) => ({
        resourceId: `r${i}`, sheetRanges: [{ start: 1, end: 1 }], pinnedRanges: [],
    }));
    beforeEach(() => { llamadas.length = 0; fallarTanda = -1; });

    it('más fuentes que el tope: varias llamadas, ninguna pasa del tope', async () => {
        await new CallableCuratedCorpusRetriever().retrieve({ userId: 'u', query: 'q', sources: fuentes(30), budgetChars: 100_000 });
        expect(llamadas).toHaveLength(2);
        expect(Math.max(...llamadas.map(l => l.sources.length))).toBeLessThanOrEqual(MAX_SOURCES_PER_CALL);
    });

    it('una tanda caída sólo apaga sus fuentes', async () => {
        fallarTanda = 1;
        const r = await new CallableCuratedCorpusRetriever().retrieve({ userId: 'u', query: 'q', sources: fuentes(30), budgetChars: 100_000 });
        expect(r.failedSources).toHaveLength(5);
        expect(r.byResource['r0']!.length).toBeGreaterThan(0);
    });
});
