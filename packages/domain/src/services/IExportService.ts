import { SermonEntity } from '../entities/Sermon';
import type { SermonPrintOptions } from '../drafting/sermonPrint';

export interface IExportService {
    /**
     * Export a sermon to a PDF file
     * @param sermon The sermon entity to export
     * @param options Who preaches it and the series it belongs to, for the cover
     */
    exportSermonToPdf(sermon: SermonEntity, options?: SermonPrintOptions): Promise<void>;
}
