import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { readSavedWordIbid } from '../readSavedWord';

/** Un .docx de verdad (zip), con la forma del que guarda Word. */
async function docx(cuerpo: string, notas: string | null): Promise<Blob> {
    const zip = new JSZip();
    zip.file('word/document.xml', `<w:document><w:body>${cuerpo}</w:body></w:document>`);
    if (notas !== null) zip.file('word/footnotes.xml', notas);
    return new Blob([await zip.generateAsync({ type: 'uint8array' })]);
}
const NOTAS = '<w:footnotes><w:footnote w:id="1"><w:p><w:r><w:t>Ross, Commentary on the Psalms, 565.</w:t></w:r></w:p></w:footnote><w:footnote w:id="2"><w:p><w:r><w:t>Ibid., 566.</w:t></w:r></w:p></w:footnote></w:footnotes>';

describe('readSavedWordIbid', () => {
    it('lee el zip y encuentra el «Ibid.» que abre página', async () => {
        const r = await readSavedWordIbid(await docx('<w:p><w:r><w:footnoteReference w:id="1"/></w:r></w:p><w:p><w:r><w:lastRenderedPageBreak/></w:r><w:r><w:footnoteReference w:id="2"/></w:r></w:p>', NOTAS));
        expect(r.findings.map(f => [f.note, f.page])).toEqual([[2, 2]]);
    });

    it('sin notas al pie no falla', async () => {
        const r = await readSavedWordIbid(await docx('<w:p><w:r><w:t>Hola</w:t></w:r></w:p>', null));
        expect(r).toMatchObject({ notes: 0, findings: [] });
    });

    it('un archivo que no es .docx se rechaza', async () => {
        const zip = new JSZip();
        zip.file('otra/cosa.txt', 'x');
        await expect(readSavedWordIbid(new Blob([await zip.generateAsync({ type: 'uint8array' })]))).rejects.toThrow();
    });
});
