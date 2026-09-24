import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { PAPER_COVER_FIELDS } from '@dosfilos/domain';
import type { ExegeticalPaper, PaperCover } from '@dosfilos/domain';
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

describe('exportPaperToDocx — la bibliografía generada', () => {
    /** Un trabajo sin `assembledMarkdown`: el cuerpo sale de los pasos aceptados. */
    const sinEnsamblar = paper({
        assembledMarkdown: null,
        steps: [{
            kind: 'verse', order: 0,
            verseRef: { bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 1, verseEnd: 1 },
            accepted: { markdown: 'El salmo abre con una metáfora pastoral.' },
        }],
    } as unknown as Partial<ExegeticalPaper>);

    it('la sección entra con sangría francesa y sin viñeta', async () => {
        const blob = await exportPaperToDocx(sinEnsamblar, {
            exportedAt: new Date('2026-09-17'),
            bibliography: [{
                citationKey: 'Ross', displayLabel: 'A Commentary on the Psalms',
                text: 'Ross, Allen P. *A Commentary on the Psalms*. Grand Rapids: Kregel, 2011.',
                missing: [],
            }],
        });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const xml = await zip.file('word/document.xml')!.async('string');
        expect(xml).toContain('Bibliograf');
        expect(xml).toContain('Ross, Allen P.');
        // Sangría francesa: medio pulgada a la izquierda y media negativa en
        // la primera línea. Sin esto la entrada sale como un párrafo normal.
        expect(xml).toMatch(/w:ind[^>]*w:hanging="720"/);
        // Y sin viñeta: una bibliografía con topos no es una bibliografía.
        const desdeBiblio = xml.slice(xml.indexOf('Bibliograf'));
        expect(desdeBiblio).not.toContain('w:numPr');
    });

    it('una ficha incompleta llega al documento diciendo qué le falta', async () => {
        const blob = await exportPaperToDocx(sinEnsamblar, {
            exportedAt: new Date('2026-09-17'),
            bibliography: [{
                citationKey: 'Adamson', displayLabel: 'The Epistle of James',
                text: null, missing: ['city', 'publisher', 'year'],
            }],
        });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const xml = await zip.file('word/document.xml')!.async('string');
        expect(xml).toContain('FICHA INCOMPLETA');
        expect(xml).toContain('The Epistle of James');
    });
});

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

    it('el título del trabajo va ENCIMA del pasaje, que es como lo nombra el profesor', async () => {
        // La portada abría con el pasaje y el trabajo llegaba sin
        // identificarse: «Trabajo práctico #3» es el renglón que el
        // profesor busca para saber qué entrega está corrigiendo.
        const doc = await xmlOf(paper({
            cover: {
                institution: "The Master's Seminary",
                assignmentTitle: 'Trabajo práctico #3',
                author: 'Ricardo Cerda',
                place: 'Concepción, Chile',
                date: 'Septiembre 2026',
            },
        } as Partial<ExegeticalPaper>), 'word/document.xml');

        expect(doc).toContain('TRABAJO PRÁCTICO #3');
        expect(doc.indexOf('THE MASTER&apos;S SEMINARY')).toBeLessThan(doc.indexOf('TRABAJO PRÁCTICO #3'));
        expect(doc.indexOf('TRABAJO PRÁCTICO #3')).toBeLessThan(doc.indexOf('POR'));
    });

    it('el exportador imprime TODOS los campos de la portada, no una lista aparte', async () => {
        // El exportador arma la portada renglón por renglón, con sus
        // líneas en blanco, así que no puede recorrer la lista del
        // dominio. Esta prueba es lo que los ata: un campo nuevo que
        // alguien agregue al dominio y olvide aquí deja de imprimirse
        // sin un solo error, que es el mismo fallo que ya costó el
        // título del trabajo una capa más abajo.
        const marcas = Object.fromEntries(
            PAPER_COVER_FIELDS.map(campo => [campo, `marca${campo}`]),
        ) as PaperCover;
        const doc = await xmlOf(paper({ cover: marcas } as Partial<ExegeticalPaper>), 'word/document.xml');

        const ausentes = PAPER_COVER_FIELDS.filter(
            campo => !doc.includes(`MARCA${campo.toLocaleUpperCase('es')}`),
        );
        expect(ausentes, 'campos que el exportador NO imprime').toEqual([]);
    });

    // Las dos que siguen fijan comportamiento que ya existía antes de
    // agregar el título: el curso nunca fue obligatorio en el exportador.
    // No prueban nada nuevo de este cambio y no pretenden hacerlo; están
    // para que el reordenamiento del formulario no lo rompa sin querer.
    it('sin curso no aparece ningún renglón de curso: la portada del seminario no lo lleva', async () => {
        const doc = await xmlOf(paper({
            cover: { institution: "The Master's Seminary", author: 'Ricardo Cerda' },
        } as Partial<ExegeticalPaper>), 'word/document.xml');
        expect(doc).not.toContain('OT603');
    });

    it('con curso escrito, se imprime: otra guía sí puede pedirlo', async () => {
        const doc = await xmlOf(paper({
            cover: { institution: "The Master's Seminary", author: 'Ricardo Cerda', course: 'OT603' },
        } as Partial<ExegeticalPaper>), 'word/document.xml');
        expect(doc).toContain('OT603');
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
