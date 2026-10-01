import {
    chunkRangesForSheets,
    type CorpusChunk,
    type ICuratedCorpusReader,
    type SheetRange,
} from '@dosfilos/domain';
import { fetchDocumentPageIndex } from './DocumentPageIndexClient';
import { CallableDocumentChunkReader } from './CallableDocumentChunkReader';

/**
 * Lee las hojas que una fuente admite, sin rankear.
 *
 * Comparte las dos piezas del selector —el índice de hojas, cacheado por
 * recurso, y la lectura de fragmentos por lotes— porque la pregunta es la misma
 * que hace el selector al materializar: "dame el texto de estas hojas".
 */
export class CallableCuratedCorpusReader implements ICuratedCorpusReader {
    private chunkReader = new CallableDocumentChunkReader();

    async readAdmitted(input: {
        resourceId: string;
        sheetRanges: ReadonlyArray<SheetRange>;
    }): Promise<ReadonlyArray<CorpusChunk>> {
        if (input.sheetRanges.length === 0) return [];
        const index = await fetchDocumentPageIndex(input.resourceId);
        const ranges = chunkRangesForSheets(index.pages, input.sheetRanges as SheetRange[]);
        const chunks = await this.chunkReader.readChunks(input.resourceId, ranges);
        return chunks.map(c => ({
            resourceId: input.resourceId,
            chunkIndex: c.chunkIndex,
            text: c.text,
            sheet: c.page,
            section: c.section,
            // No hay ranking aquí: se devuelve todo lo admitido.
            score: 1,
        }));
    }
}
