import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import type { ExegeticalPaper } from '@dosfilos/domain';
import { EMPTY_VERIFICATION_SUMMARY } from '@dosfilos/domain';
import { exportPaperToDocx } from '../exportPaperToDocx';

/**
 * El formato ES el entregable.
 *
 * Las pruebas de humo dicen que el archivo se arma; estas dicen que se
 * arma como la guía del seminario exige. Sí, miran el XML: es el único
 * sitio donde «Times New Roman 12 a doble espacio» es comprobable sin
 * abrir Word a mano, y ese cotejo manual es justo lo que se hizo tres
 * veces con el trabajo de Salmo 23.
 */
async function xmlOf(paper: ExegeticalPaper, entry: string): Promise<string> {
    const blob = await exportPaperToDocx(paper, { exportedAt: new Date('2026-09-17') });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    return zip.file(entry)!.async('string');
}

/**
 * Los encabezados y pies se numeran por orden de creación, así que el
 * nombre del archivo cambia al agregar una portada. Se buscan por lo que
 * contienen, no por cómo se llaman.
 */
async function headersAndFooters(paper: ExegeticalPaper): Promise<Array<{ name: string; xml: string }>> {
    const blob = await exportPaperToDocx(paper, { exportedAt: new Date('2026-09-17') });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const names = Object.keys(zip.files).filter(n => /^word\/(header|footer)\d+\.xml$/.test(n));
    return Promise.all(names.map(async name => ({ name, xml: await zip.file(name)!.async('string') })));
}

const paper = (over: Partial<ExegeticalPaper> = {}): ExegeticalPaper => ({
    id: 'p1', ownerId: 'o1', createdAt: new Date(), updatedAt: new Date(),
    passage: { bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 1, verseEnd: 3 },
    displayLanguage: 'es', title: 'Análisis de Salmo 23:1-3',
    assignmentBrief: null, styleGuideId: null, sources: [], rubric: null,
    stepPlan: { steps: [] } as never, phase: 'writing', steps: [], currentStepId: null,
    assembledMarkdown: [
        '## Introducción',
        '',
        'El salmo abre con una metáfora pastoral.',
        '',
        '> יְהוָה רֹעִי לֹא אֶחְסָר',
        '',
        'La raíz שׁוב aparece en el verso 3 (Waltke-O\'Connor, "Syntax", p. 436).',
        '',
        '## Bibliografía',
        '',
        '- Ross, Allen P. *A Commentary on the Psalms*. Grand Rapids: Kregel, 2011.',
    ].join('\n'),
    verifications: EMPTY_VERIFICATION_SUMMARY,
    ...over,
} as unknown as ExegeticalPaper);

describe('exportPaperToDocx — formato de la guía', () => {
    it('el documento entero va en Times New Roman 12 a doble espacio', async () => {
        const styles = await xmlOf(paper(), 'word/styles.xml');
        expect(styles).toContain('Times New Roman');
        // 24 medios puntos = 12 pt; 480 veinteavos = doble espacio.
        expect(styles).toMatch(/w:sz w:val="24"/);
        expect(styles).toMatch(/w:line="480"/);
        // Sangría de primera línea de media pulgada.
        expect(styles).toMatch(/w:firstLine="720"/);
    });

    it('los títulos son del mismo cuerpo, negros y centrados: no los azules de Word', async () => {
        const styles = await xmlOf(paper(), 'word/styles.xml');
        const heading1 = styles.slice(styles.indexOf('w:styleId="Heading1"'));
        expect(heading1).toContain('w:val="000000"');
        expect(heading1).toMatch(/w:jc w:val="center"/);
    });

    it('la hoja es carta con márgenes de una pulgada', async () => {
        const doc = await xmlOf(paper(), 'word/document.xml');
        expect(doc).toContain('w:w="12240"');
        expect(doc).toContain('w:h="15840"');
        expect(doc).toMatch(/w:top="1440"/);
    });

    it('una cita hebrea va de derecha a izquierda y alineada a ese lado', async () => {
        const doc = await xmlOf(paper(), 'word/document.xml');
        expect(doc).toContain('<w:rtl/>');
        expect(doc).toMatch(/w:jc w:val="right"/);
        // Y sus espacios no se parten entre renglones.
        expect(doc).toContain(' ');
    });

    it('la cita entre paréntesis sale como nota al pie a 10 pt y espacio simple', async () => {
        const notes = await xmlOf(paper(), 'word/footnotes.xml');
        expect(notes).toContain('Syntax');
        expect(notes).toMatch(/w:sz w:val="20"/);
        expect(notes).toMatch(/w:line="240"/);
    });

    it('la bibliografía empieza en página nueva y va con sangría francesa', async () => {
        const doc = await xmlOf(paper(), 'word/document.xml');
        expect(doc).toContain('<w:br w:type="page"/>');
        expect(doc).toMatch(/w:hanging="720"/);
    });

    it('sin datos de portada no se inventa una', async () => {
        const doc = await xmlOf(paper(), 'word/document.xml');
        expect(doc).not.toContain('POR');
    });

    it('con datos de portada, la portada va primero, en mayúsculas y sin número de página', async () => {
        const doc = await xmlOf(paper({
            cover: { institution: "The Master's Seminary", author: 'Ricardo Cerda', place: 'Chiguayante, Concepción', date: 'Septiembre 2026' },
        } as Partial<ExegeticalPaper>), 'word/document.xml');

        // El apóstrofo viaja escapado en el XML.
        expect(doc).toContain('THE MASTER&apos;S SEMINARY');
        expect(doc).toContain('RICARDO CERDA');
        expect(doc).toContain('POR');
        expect(doc.indexOf('THE MASTER&apos;S SEMINARY')).toBeLessThan(doc.indexOf('Introducción'));
        // Dos secciones: la portada y el cuerpo.
        expect(doc.match(/<w:sectPr/g)?.length).toBe(2);
    });

    it('el cuerpo numera sus páginas: la primera abajo al centro, las demás arriba a la derecha', async () => {
        const doc = await xmlOf(paper(), 'word/document.xml');
        expect(doc).toMatch(/w:titlePg/);
        // El número es un campo, en el encabezado y en el pie de la
        // primera página; Word lo actualiza solo al repaginar.
        const parts = await headersAndFooters(paper());
        const withPage = parts.filter(p => p.xml.includes('PAGE'));
        expect(withPage.some(p => p.name.includes('header') && /w:jc w:val="right"/.test(p.xml))).toBe(true);
        expect(withPage.some(p => p.name.includes('footer') && /w:jc w:val="center"/.test(p.xml))).toBe(true);
    });
});
