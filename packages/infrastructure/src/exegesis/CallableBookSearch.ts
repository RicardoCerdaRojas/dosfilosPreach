import {
    chunkRangesForSheets,
    normalizeSheetRanges,
    type IBookSearch,
    type IDocumentChunkReader,
} from '@dosfilos/domain';
import { fetchDocumentPageIndex, searchDocumentText } from './DocumentPageIndexClient';

/**
 * Leer el libro de una fuente para ubicar una cita antes de alarmar (TP #8,
 * fase 8b, D1), con las callables que ya existen: la búsqueda de texto del
 * libro entero (`searchDocumentText`, lee los fragmentos del lado del
 * servidor) y la lectura de fragmentos por hoja (`getDocumentChunks`).
 *
 * Sólo corre sobre las alarmas del verificador: unas pocas por paso.
 */
export class CallableBookSearch implements IBookSearch {
    constructor(private readonly chunkReader: IDocumentChunkReader) { }

    async sheetsWithTerm(resourceId: string, term: string) {
        const { hits, truncated } = await searchDocumentText(resourceId, term, 'texto');
        return { hits: hits.map(h => ({ sheet: h.sheet, count: h.count })), truncated: !!truncated };
    }

    async readSheets(resourceId: string, sheets: ReadonlyArray<number>) {
        if (sheets.length === 0) return [];
        const index = await fetchDocumentPageIndex(resourceId);
        const ranges = chunkRangesForSheets(index.pages, normalizeSheetRanges(sheets.map(s => ({ start: s, end: s }))));
        if (ranges.length === 0) return [];
        const chunks = await this.chunkReader.readChunks(resourceId, ranges);
        return joinBySheet(chunks);
    }
}

/** Los fragmentos de cada hoja, en orden, como un solo texto. */
export function joinBySheet(
    chunks: ReadonlyArray<{ chunkIndex: number; text: string; page: number | null; section: string | null }>,
): Array<{ sheet: number; text: string; section: string | null }> {
    const porHoja = new Map<number, { partes: Array<{ i: number; text: string }>; section: string | null }>();
    for (const c of chunks) {
        if (typeof c.page !== 'number') continue;
        const h = porHoja.get(c.page) ?? { partes: [], section: c.section ?? null };
        h.partes.push({ i: c.chunkIndex, text: c.text });
        porHoja.set(c.page, h);
    }
    return [...porHoja.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([sheet, h]) => ({
            sheet,
            text: h.partes.sort((a, b) => a.i - b.i).map(p => p.text).join('\n'),
            section: h.section,
        }));
}
