import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WHOLE_DOCUMENT_RANGE, SMALL_DOCUMENT_CHARS } from '@dosfilos/domain';

const rankeadas: string[][] = [];
vi.mock('firebase/functions', () => ({
    getFunctions: () => ({}),
    httpsCallable: () => async (payload: { sources: Array<{ resourceId: string }> }) => {
        rankeadas.push(payload.sources.map(s => s.resourceId));
        return { data: { chunks: payload.sources.map(s => ({ resourceId: s.resourceId, chunkIndex: 0, text: 'rankeado', sheet: 1, section: null, score: 0.5 })), sourcesQueried: payload.sources.length, failedSources: [], emptySources: [] } };
    },
}));
const tamanos: Record<string, number> = {};
vi.mock('../DocumentPageIndexClient', () => ({
    fetchDocumentPageIndex: async (id: string) => ({
        pages: [{ sheet: 1, chunkIndices: [0, 1], section: null, firstLine: '', charCount: tamanos[id] ?? 0 }],
    }),
}));
vi.mock('../CallableDocumentChunkReader', () => ({
    CallableDocumentChunkReader: class {
        async readChunks(resourceId: string) {
            return [
                { chunkIndex: 0, text: `${resourceId} parte 1`, page: 1, section: null },
                { chunkIndex: 1, text: `${resourceId} parte 2`, page: 1, section: null },
            ];
        }
    },
}));

const { CallableCuratedCorpusRetriever } = await import('../CallableCuratedCorpusRetriever');

/**
 * Revisión adversarial de A4: el extracto corto subido a mano, consultado por
 * versículo, competía por el tope y llegaba recortado.
 */
describe('documento completo chico: viaja entero', () => {
    beforeEach(() => { rankeadas.length = 0; });
    const fuente = (resourceId: string) => ({ resourceId, sheetRanges: [WHOLE_DOCUMENT_RANGE], pinnedRanges: [] });

    it('chico: va fijado, completo, y no se manda al ranking', async () => {
        tamanos.chico = 6_000;
        tamanos.libro = 900_000;
        const r = await new CallableCuratedCorpusRetriever().retrieve({
            userId: 'u', query: 'Jonás 4:6', budgetChars: 100_000, sources: [fuente('chico'), fuente('libro')],
        } as never);
        expect(r.byResource.chico!.map(c => c.text)).toEqual(['chico parte 1', 'chico parte 2']);
        expect(rankeadas.flat()).toEqual(['libro']);
    });

    it('justo sobre el umbral: se consulta como un libro', async () => {
        tamanos.mediano = SMALL_DOCUMENT_CHARS + 1;
        await new CallableCuratedCorpusRetriever().retrieve({
            userId: 'u', query: 'Jonás 4:6', budgetChars: 100_000, sources: [fuente('mediano')],
        } as never);
        expect(rankeadas.flat()).toEqual(['mediano']);
    });
});
