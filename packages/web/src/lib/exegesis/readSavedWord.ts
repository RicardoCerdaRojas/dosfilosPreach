import JSZip from 'jszip';
import { reviewSavedWordIbid, type SavedWordIbidReview } from '@dosfilos/domain';

/**
 * Lee el Word que el estudiante guardó desde Word y revisa el «Ibid.» que
 * abre página (fase «Lecciones del TI #2», etapa 2.3). Todo en el navegador:
 * el archivo no se sube a ningún lado.
 *
 * Lanza si no es un .docx (no trae `word/document.xml`).
 */
export async function readSavedWordIbid(file: Blob): Promise<SavedWordIbidReview> {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const documento = zip.file('word/document.xml');
    if (!documento) throw new Error('No es un documento de Word (.docx)');
    const notas = zip.file('word/footnotes.xml');
    return reviewSavedWordIbid(await documento.async('string'), notas ? await notas.async('string') : '');
}
