import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { DEFAULT_TMS_EXEGETICAL_RUBRIC, PAPER_COVER_FIELDS, buildCitationFormBlock } from '@dosfilos/domain';
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

describe('exportPaperToDocx — la forma de cita sale de la rúbrica', () => {
    const conForma = (citationForm: string) => paper({
        rubric: {
            ...DEFAULT_TMS_EXEGETICAL_RUBRIC,
            formatting: { lineSpacing: 'single', blankLineBetweenParagraphs: true, citationForm },
        },
    } as unknown as Partial<ExegeticalPaper>);

    it('por omisión la cita va a nota al pie, como antes', async () => {
        const blob = await exportPaperToDocx(paper(), { exportedAt: new Date('2026-09-17') });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        expect(Object.keys(zip.files)).toContain('word/footnotes.xml');
        const notas = await zip.file('word/footnotes.xml')!.async('string');
        expect(notas).toContain('Waltke');
    });

    it('cuando el encuadre pide cita entre paréntesis, la cita se queda en el texto', async () => {
        // No es «no hacer nada»: es la otra convención. El trabajo práctico
        // semanal pide «(Apellido, página)» en el texto más bibliografía al
        // final, sin notas, y el exportador convertía a nota siempre.
        const blob = await exportPaperToDocx(conForma('parenthetical'), { exportedAt: new Date('2026-09-17') });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const doc = await zip.file('word/document.xml')!.async('string');
        expect(doc).toContain('Waltke');
        const notas = zip.file('word/footnotes.xml');
        if (notas) expect(await notas.async('string')).not.toContain('Waltke');
    });

    it('«footnote» explícito se comporta como el valor por omisión', async () => {
        const blob = await exportPaperToDocx(conForma('footnote'), { exportedAt: new Date('2026-09-17') });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        expect(await zip.file('word/footnotes.xml')!.async('string')).toContain('Waltke');
    });
});

/**
 * El puente entre lo que se le PIDE al compositor y lo que el exportador
 * sabe maquetar.
 *
 * `buildCitationFormBlock` afirma, en prosa, que la forma con título entre
 * comillas es «la única que el exportador reconoce para bajar la cita a nota
 * al pie». Esa afirmación vivía sólo en un comentario, en otro paquete, y el
 * día que alguien toque cualquiera de las dos puntas nada se iba a enterar.
 * Medido en Santiago 2:1-13: tres versículos salieron con la forma corta y el
 * cuarto con la larga, en el mismo trabajo.
 */
describe('la forma que se le pide al compositor es la que el exportador convierte', () => {
    const conCita = (cita: string) => paper({
        assembledMarkdown: ['## Versículo 1', '', `El genitivo es atributivo ${cita}.`].join('\n'),
    });

    it('la forma que el bloque enseña como ejemplo sí baja a nota al pie', async () => {
        // El ejemplo se toma del bloque, no se reescribe acá: si alguien
        // cambia la forma que se le enseña al compositor, esta prueba cae.
        const bloque = buildCitationFormBlock('footnote', 'es');
        const ejemplo = bloque.match(/\(Wallace[^)]*\)/)?.[0];
        expect(ejemplo).toBeTruthy();
        const notas = await xmlOf(conCita(ejemplo!), 'word/footnotes.xml');
        expect(notas).toContain('Wallace');
    });

    it('la forma corta se queda varada en el cuerpo, que es por lo que se prohíbe mezclarlas', async () => {
        const doc = await xmlOf(conCita('(Wallace, hoja 87)'), 'word/document.xml');
        expect(doc).toContain('Wallace');
        const blob = await exportPaperToDocx(conCita('(Wallace, hoja 87)'), { exportedAt: new Date('2026-09-17') });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const notas = zip.file('word/footnotes.xml');
        if (notas) expect(await notas.async('string')).not.toContain('Wallace');
    });
});

/**
 * Las citas SIN título: la forma que el exportador no sabía leer.
 *
 * Medido sobre los 14 trabajos con prosa ensamblada en producción: 63 citas
 * bajaban a nota al pie y 103 se quedaban varadas en el cuerpo, con seis
 * trabajos enteros sin una sola nota. El compositor emite «Kistemaker
 * (p. 259)» y «(Mayor, 77)» además de la forma con título, y este archivo
 * sólo conocía la última.
 *
 * Ensanchar el patrón a secas convertiría en nota al pie el pie de imprenta de
 * la propia bibliografía. El discriminador es el corpus del trabajo.
 */
describe('una cita sin título baja al pie sólo si su autor es fuente del trabajo', () => {
    const conFuentes = (texto: string, claves: Array<string | null>): ExegeticalPaper => paper({
        sources: claves.map((citationKey, i) => ({ id: `s${i}`, citationKey })) as never,
        assembledMarkdown: ['## Versículo 1', '', texto].join('\n'),
    });

    const notas = async (texto: string, claves: Array<string | null>) => {
        const blob = await exportPaperToDocx(conFuentes(texto, claves), { exportedAt: new Date('2026-09-17') });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const f = zip.file('word/footnotes.xml');
        return f ? await f.async('string') : '';
    };

    it('«(Mayor, 77)» con Mayor declarado baja al pie', async () => {
        expect(await notas('El genitivo es apositivo (Mayor, 77).', ['Mayor'])).toContain('Mayor');
    });

    it('«Kistemaker (p. 259)», con el autor fuera del paréntesis, también', async () => {
        expect(await notas('Así lo sostiene Kistemaker (p. 259).', ['Kistemaker'])).toContain('Kistemaker');
    });

    it('el rótulo honesto «hoja N» no queda afuera', async () => {
        expect(await notas('Wallace lo clasifica así (Wallace, hoja 87).', ['Wallace'])).toContain('Wallace');
    });

    it('un pie de imprenta NO es una cita, aunque tenga la misma forma', async () => {
        // El caso que prohibía ensanchar el patrón: la ficha Turabian de la
        // propia bibliografía es «(Ciudad: Editorial, año)».
        const n = await notas('Ross, Allen P. *Commentary*. (Nashville: Broadman & Holman, 2003).', ['Mayor']);
        expect(n).not.toContain('Broadman');
    });

    it('una referencia bíblica tampoco', async () => {
        const n = await notas('La prohibición viene de antes (Génesis 19:25, 29).', ['Mayor']);
        expect(n).not.toContain('Génesis');
    });

    it('un autor que el trabajo no declara se queda en el cuerpo', async () => {
        // Sin ficha no hay entrada de bibliografía a la que remitir: bajarla
        // al pie produciría una nota que no lleva a ninguna parte.
        const n = await notas('Algo dice Fulano (p. 12).', ['Mayor']);
        expect(n).not.toContain('Fulano');
    });

    it('el título SIN comillas también baja, si el autor es fuente del trabajo', async () => {
        // La cuarta forma. Un trabajo entero de Salmo 23:1-3 exportó sin una
        // sola nota al pie teniendo seis citas así.
        const n = await notas(
            'Así lo señala Craigie (Craigie, Word Biblical Commentary Vol_ 19, Psalms 1-50, 206).',
            ['Craigie'],
        );
        expect(n).toContain('Craigie');
    });

    it('y admite los paréntesis que el título lleva de verdad', async () => {
        const n = await notas(
            'Ross argumenta (Ross, A Commentary on the Psalms 1-41 (Kregel Exegetical Library), 560).',
            ['Ross'],
        );
        expect(n).toContain('Ross');
    });

    it('un pie de imprenta tiene esa MISMA estructura y sigue sin bajar', async () => {
        // Tres campos separados por comas, el último numérico: por su forma
        // es indistinguible de la cita de arriba. Sólo el corpus las separa.
        const n = await notas('Craigie, Peter C. *Psalms 1-50*. (Waco, TX: Word Books, 1983).', ['Craigie']);
        expect(n).not.toContain('Word Books');
    });

    it('con la forma parentética no baja ninguna, resuelva o no', async () => {
        const conForma = paper({
            sources: [{ id: 's0', citationKey: 'Mayor' }] as never,
            rubric: { formatting: { lineSpacing: 'single', blankLineBetweenParagraphs: true, citationForm: 'parenthetical' } } as never,
            assembledMarkdown: ['## Versículo 1', '', 'El genitivo es apositivo (Mayor, 77).'].join('\n'),
        });
        const blob = await exportPaperToDocx(conForma, { exportedAt: new Date('2026-09-17') });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const doc = await zip.file('word/document.xml')!.async('string');
        expect(doc).toContain('Mayor');
        const f = zip.file('word/footnotes.xml');
        if (f) expect(await f.async('string')).not.toContain('Mayor');
    });
});

describe('exportPaperToDocx — la maquetación sale de la rúbrica', () => {
    const conFormato = (formatting: unknown) => paper({
        rubric: { ...DEFAULT_TMS_EXEGETICAL_RUBRIC, formatting },
    } as unknown as Partial<ExegeticalPaper>);

    it('sin rúbrica que diga otra cosa, manda la guía de la casa: doble espacio', async () => {
        const styles = await xmlOf(paper(), 'word/styles.xml');
        expect(styles).toMatch(/w:line="480"/);
    });

    it('el encuadre pide espacio simple y el documento sale a espacio simple', async () => {
        // Es el caso que originó el campo: el trabajo práctico semanal de
        // griego se pide a espacio simple y el exportador lo sacaba a doble,
        // porque el número estaba cableado.
        const styles = await xmlOf(
            conFormato({ lineSpacing: 'single', blankLineBetweenParagraphs: false }),
            'word/styles.xml',
        );
        const cuerpo = styles.slice(0, styles.indexOf('w:styleId="Heading1"'));
        expect(cuerpo).toMatch(/w:line="240"/);
        expect(cuerpo).not.toMatch(/w:line="480"/);
    });

    it('la línea entre párrafos se escribe como espacio posterior, no como renglón vacío', async () => {
        // Un renglón vacío es un párrafo más: se descuadra al editar y cuenta
        // en cualquier recuento que mire párrafos.
        const styles = await xmlOf(
            conFormato({ lineSpacing: 'single', blankLineBetweenParagraphs: true }),
            'word/styles.xml',
        );
        const cuerpo = styles.slice(0, styles.indexOf('w:styleId="Heading1"'));
        expect(cuerpo).toMatch(/w:after="240"/);
    });

    it('espacio y medio', async () => {
        const styles = await xmlOf(
            conFormato({ lineSpacing: 'one-and-a-half', blankLineBetweenParagraphs: false }),
            'word/styles.xml',
        );
        expect(styles.slice(0, styles.indexOf('w:styleId="Heading1"'))).toMatch(/w:line="360"/);
    });

    it('la sangría de primera línea no la toca el interlineado', async () => {
        const styles = await xmlOf(
            conFormato({ lineSpacing: 'single', blankLineBetweenParagraphs: true }),
            'word/styles.xml',
        );
        expect(styles).toMatch(/w:firstLine="720"/);
    });
});

describe('exportPaperToDocx — la portada manda sobre la cabecera', () => {
    const conPortada = paper({
        cover: {
            institution: "The Master's Seminary", assignmentTitle: 'Trabajo práctico #4',
            author: 'Ricardo Cerda', place: 'Concepción, Chile', date: 'Septiembre 2026', course: null,
        },
    } as unknown as Partial<ExegeticalPaper>);

    it('con portada, el cuerpo NO repite título, pasaje ni fecha de exportación', async () => {
        const xml = await xmlOf(conPortada, 'word/document.xml');
        // La portada sí los dice, en mayúsculas y centrados. Lo que no puede
        // pasar es que la página 1 del cuerpo los repita con «Exportado».
        expect(xml).not.toContain('Exportado');
    });

    it('sin portada, la cabecera se conserva: el archivo tiene que decir de qué es', async () => {
        const xml = await xmlOf(paper(), 'word/document.xml');
        expect(xml).toContain('Exportado');
    });
});

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
