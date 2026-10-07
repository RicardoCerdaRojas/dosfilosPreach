import {
    AlignmentType,
    Document,
    Footer,
    FootnoteReferenceRun,
    Header,
    HeadingLevel,
    LineRuleType,
    NumberFormat,
    PageBreak,
    PageNumber,
    Packer,
    Paragraph,
    TextRun,
} from 'docx';
import {
    DEFAULT_PAPER_FORMATTING,
    esEncabezadoDeBibliografia,
    exportPaperToMarkdown,
    findInlineCitations,
    formatFirstNote,
    formatPassageReference,
    formatShortNote,
    hasCover,
    TMS_COVER_STYLE,
    type CoverStyle,
    resolvesToCitedSource,
    type BibliographyEntry,
    type ExegeticalPaper,
    type PaperCover,
    type CitationForm,
    type PaperFormatting,
} from '@dosfilos/domain';
import {
    BIBLIOGRAPHY_PARAGRAPH,
    BLOCK_QUOTE_PARAGRAPH,
    BODY_RUN,
    bodyParagraphFor,
    HEADING_PARAGRAPH,
    isMostlyHebrew,
    splitHebrew,
    TMS,
} from './tmsLayout';

/**
 * Renders an `ExegeticalPaper` to a Word `.docx` Blob with NATIVE
 * footnotes — the killer-feature gap vs the markdown export.
 *
 * Source-of-truth precedence mirrors `exportPaperToMarkdown`:
 *   1. `paper.assembledMarkdown` if present (post-assembly canonical).
 *   2. Fall back to the same routine the markdown exporter uses, so
 *      any partial state is consistent across the two formats.
 *
 * Pipeline:
 *   1. Take the assembled markdown (calling the existing exporter so
 *      header/title/passage/brief render identically).
 *   2. Parse blocks (headings / paragraphs / lists / blockquotes).
 *   3. For each paragraph, walk the inline content; convert every
 *      `(Author, "Title", p. N)` parenthetical into a real Word
 *      footnote that contains the same citation text. Preserves
 *      `**bold**` and `*italic*` runs.
 *   4. Assemble a Document with the registered footnotes and Pack it
 *      to a Blob the caller can hand to a download anchor.
 *
 * Why footnotes from the parenthetical (vs full TMS rendering): the
 * `DeterministicStyleFormatter` already produces TMS-shape strings at
 * generation time (first/subsequent/ibid). The exporter just needs to
 * relocate them from inline parentheticals to native footnote bodies
 * — which is the academic export the seminary actually wants.
 */
export async function exportPaperToDocx(
    paper: ExegeticalPaper,
    options: {
        exportedAt?: Date;
        bibliography?: ReadonlyArray<BibliographyEntry>;
        /** Cómo arma la portada la guía del trabajo; sin ella, la de TMS. */
        coverStyle?: CoverStyle;
    } = {},
): Promise<Blob> {
    const exportedAt = options.exportedAt ?? new Date();
    // La portada manda: si se va a imprimir, el cuerpo NO lleva la cabecera de
    // trabajo. Se pregunta antes de componer el markdown porque es lo que
    // decide qué se compone.
    const cover = coverSection(paper.cover ?? null, titleDisplayOf(paper), options.coverStyle ?? TMS_COVER_STYLE);
    const markdown = exportPaperToMarkdown(paper, {
        exportedAt,
        bibliography: options.bibliography,
        omitHeader: cover !== null,
    });
    const titleDisplay = titleDisplayOf(paper);

    const citationForm = (paper.rubric?.formatting ?? DEFAULT_PAPER_FORMATTING).citationForm;
    // Las fuentes que el trabajo declara. Son el discriminador que separa una
    // cita sin título —«(Mayor, 77)»— de un pie de imprenta —«(Nashville:
    // Broadman & Holman, 2003)»—, que por su forma son idénticos.
    const citationKeys = (paper.sources ?? []).map(s => s.citationKey);
    /**
     * La ficha de cada obra, por clave de cita.
     *
     * Turabian pide que la nota lleve la obra completa —autor con nombre de
     * pila, título, colección, pie de imprenta y página—, y eso NO está en el
     * paréntesis del cuerpo: el paréntesis dice «(Craigie, …, 206)» y la nota
     * tiene que decir «Peter C. Craigie, *Psalms 1-50*, vol. 19, Word Biblical
     * Commentary (Waco, TX: Word Books, 1983), 206». El dato existe, lo trae
     * la ficha del libro en la biblioteca, y la nota se armaba con un eco del
     * paréntesis porque nunca se le pasó.
     */
    const fichas = new Map(
        (options.bibliography ?? [])
            .filter(e => e.data)
            .map(e => [e.citationKey, e.data!]),
    );
    /**
     * Qué obras ya llevan una nota completa.
     *
     * Turabian: la primera nota a una obra va entera y las siguientes van
     * abreviadas —«Ross, *Commentary on the Psalms*, 562»—. Repetir la ficha
     * completa en cada nota no es un estilo más prolijo, es otro estilo.
     */
    const yaCitadas = new Set<string>();
    const blocks = parseMarkdownBlocks(markdown);
    const footnotes: Record<number, { children: Paragraph[] }> = {};
    let footnoteCounter = 0;

    // La bibliografía se compone distinto —sangría francesa, espacio
    // simple— y empieza en página nueva, como pide la guía.
    const bibliographyAt = blocks.findIndex(
        b => b.type === 'heading' && esEncabezadoDeBibliografia(b.text),
    );

    const paragraphs: Paragraph[] = [];
    blocks.forEach((block, index) => {
        const inBibliography = bibliographyAt >= 0 && index >= bibliographyAt;
        switch (block.type) {
            case 'heading':
                paragraphs.push(new Paragraph({
                    heading: HEADING_LEVELS[Math.min(block.level, 3) as 1 | 2 | 3],
                    children: [
                        ...(index === bibliographyAt ? [new PageBreak()] : []),
                        ...textRuns(block.text),
                    ],
                }));
                break;
            case 'paragraph':
                paragraphs.push(new Paragraph({
                    children: buildInlineRuns(block.text, registerFootnote, citationForm, citationKeys),
                    ...(inBibliography ? BIBLIOGRAPHY_PARAGRAPH : {}),
                }));
                break;
            case 'list-item':
                paragraphs.push(new Paragraph({
                    children: buildInlineRuns(block.text, registerFootnote, citationForm, citationKeys),
                    // En la bibliografía, cada entrada es un párrafo con
                    // sangría francesa: una viñeta delante la desarma.
                    ...(inBibliography ? BIBLIOGRAPHY_PARAGRAPH : { bullet: { level: 0 }, indent: { firstLine: 0 } }),
                }));
                break;
            case 'blockquote':
                paragraphs.push(new Paragraph({
                    children: buildInlineRuns(block.text, registerFootnote, citationForm, citationKeys),
                    ...BLOCK_QUOTE_PARAGRAPH,
                    // Una cita hebrea se lee de derecha a izquierda y se
                    // alinea a ese lado; sin esto Word la deja colgando a
                    // la izquierda con la puntuación cambiada de sitio.
                    ...(isMostlyHebrew(block.text)
                        ? { alignment: AlignmentType.RIGHT, bidirectional: true }
                        : {}),
                }));
                break;
            case 'rule':
                paragraphs.push(new Paragraph({
                    children: [new TextRun({ text: '' })],
                    spacing: { after: 240 },
                }));
                break;
        }
    });


    const doc = new Document({
        title: titleDisplay,
        creator: paper.cover?.author?.trim() || 'Dosfilos · Exegesis',
        styles: documentStyles(paper.rubric?.formatting ?? null),
        footnotes,
        sections: [
            ...(cover ? [cover] : []),
            {
                properties: {
                    page: {
                        size: TMS.page,
                        margin: { top: TMS.margin, right: TMS.margin, bottom: TMS.margin, left: TMS.margin, header: TMS.headerFooterDistance, footer: TMS.headerFooterDistance },
                        pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
                    },
                    // La primera página del cuerpo lleva el número abajo al
                    // centro y las siguientes arriba a la derecha: es la
                    // regla de la guía y la razón de tener primera página
                    // distinta.
                    titlePage: true,
                },
                headers: { default: new Header({ children: [pageNumberParagraph(AlignmentType.RIGHT)] }) },
                footers: {
                    first: new Footer({ children: [pageNumberParagraph(AlignmentType.CENTER)] }),
                    default: new Footer({ children: [new Paragraph({ children: [] })] }),
                },
                children: paragraphs,
            },
        ],
    });

    return await Packer.toBlob(doc);

    /**
     * El texto de la nota: Turabian cuando hay ficha, el paréntesis cuando no.
     *
     * Sin ficha NO se inventa: se escribe lo que el cuerpo decía. Una nota
     * incompleta se ve y se corrige; una nota con una editorial inventada no
     * se ve. El aviso de fichas cojas al descargar ya nombra a los libros que
     * están en este caso.
     */
    function textoDeLaNota(author: string, pages: string | null, crudo: string): string {
        const clave = [...fichas.keys()].find(k => resolvesToCitedSource(author, [k]));
        const ficha = clave ? fichas.get(clave)! : null;
        if (!ficha || !clave) return crudo;
        const primera = !yaCitadas.has(clave);
        yaCitadas.add(clave);
        const nota = primera
            ? formatFirstNote(ficha, pages ?? undefined)
            : formatShortNote(ficha, pages ?? undefined);
        // Turabian cierra la nota con punto; las dos funciones devuelven la
        // referencia sin él porque también sirven en pantalla.
        return nota.endsWith('.') ? nota : `${nota}.`;
    }

    function registerFootnote(cita: { author: string; pages: string | null; raw: string }): number {
        const citationText = textoDeLaNota(cita.author, cita.pages, cita.raw);
        footnoteCounter += 1;
        footnotes[footnoteCounter] = {
            children: [
                new Paragraph({
                    // La nota va a 10 pt y espacio simple; el cuerpo, a 12
                    // y doble. Heredar el cuerpo llena el pie de página con
                    // tres notas y empuja el texto fuera de la página.
                    spacing: { line: TMS.singleLine, lineRule: LineRuleType.AUTO, after: 120 },
                    indent: { firstLine: TMS.firstLineIndent },
                    children: textRuns(citationText, { size: TMS.footnoteHalfPt }),
                }),
            ],
        };
        return footnoteCounter;
    }
}


/** Encabezados que abren la bibliografía, en los dos idiomas del producto. */

/**
 * Estilos del documento. Word trae Calibri 11 y encabezados azules; sin
 * redefinirlos, el trabajo sale con una tipografía que la guía no admite
 * y el estudiante la arregla a mano cada vez.
 */
/**
 * Los estilos del documento, con el cuerpo maquetado como lo pida la entrega.
 *
 * Era una constante: el interlineado doble estaba cableado y ganaba siempre,
 * aunque el encuadre pidiera otra cosa. Los títulos, las citas en bloque y la
 * bibliografía NO se parametrizan —van a espacio simple en las dos guías—.
 */
function documentStyles(formatting: PaperFormatting | null) {
    return {
    default: {
        document: { run: BODY_RUN, paragraph: bodyParagraphFor(formatting) },
        heading1: {
            run: { ...BODY_RUN, bold: true, color: '000000' },
            paragraph: HEADING_PARAGRAPH,
        },
        heading2: {
            run: { ...BODY_RUN, bold: false, color: '000000' },
            paragraph: HEADING_PARAGRAPH,
        },
        heading3: {
            run: { ...BODY_RUN, bold: false, italics: true, color: '000000' },
            paragraph: HEADING_PARAGRAPH,
        },
    },
    } as const;
}

/** Número de página como campo, para que Word lo actualice solo. */
function pageNumberParagraph(alignment: (typeof AlignmentType)[keyof typeof AlignmentType]): Paragraph {
    return new Paragraph({
        alignment,
        indent: { firstLine: 0 },
        spacing: { line: TMS.singleLine, lineRule: LineRuleType.AUTO },
        children: [new TextRun({ children: [PageNumber.CURRENT], font: TMS.font, size: TMS.bodyHalfPt })],
    });
}

/**
 * Texto en runs, con el hebreo marcado de derecha a izquierda.
 */
function textRuns(text: string, options: { size?: number; bold?: boolean; italics?: boolean } = {}): TextRun[] {
    return splitHebrew(text).map(seg => new TextRun({
        text: seg.text,
        font: TMS.font,
        size: options.size ?? TMS.bodyHalfPt,
        ...(options.bold ? { bold: true } : {}),
        ...(options.italics ? { italics: true } : {}),
        ...(seg.hebrew ? { rightToLeft: true } : {}),
    }));
}

/**
 * La portada que pide la guía: institución arriba, título al medio, autor
 * y lugar abajo, todo centrado, en mayúsculas y sin número de página.
 *
 * Devuelve `null` cuando el trabajo no tiene datos de portada: un
 * documento sin portada es lo que había, y es mejor que una portada con
 * el nombre de otro.
 */
function titleDisplayOf(paper: ExegeticalPaper): string {
    return paper.title?.trim() || formatPassageReference(paper.passage, paper.displayLanguage);
}

/** Un rango de versículos va con guion medio: «3:1–12», no con el signo menos (−) ni el guion corto. */
function coverText(text: string): string {
    return text.replace(/(\d)\s*[\u2212\u2010\u2011-]\s*(\d)/g, '$1–$2');
}

/** Lo que se compara para saber si un renglón ya dice lo que diría otro. */
function comparable(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('es')
        .replace(/[\u2212\u2010\u2011\u2013\u2014-]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
}

function mentions(text: string, part: string): boolean {
    const p = comparable(part);
    return p.length > 0 && comparable(text).includes(p);
}

function coverSection(cover: PaperCover | null, fallbackTitle: string, style: CoverStyle = TMS_COVER_STYLE) {
    if (!hasCover(cover)) return null;
    const { layout } = style;
    const institution = cover.institution?.trim();
    const author = cover.author?.trim();

    const parrafo = (text: string) => new Paragraph({
        alignment: AlignmentType.CENTER,
        indent: { firstLine: 0 },
        // Sin espacio antes ni después, como el estilo «Carátula» de TMS: la
        // separación la dan SÓLO los renglones en blanco. Sin fijarlo, cada
        // renglón heredaba los 12 pt «después» del cuerpo del trabajo, unos
        // 300 pt de más en 25 renglones, y el lugar y la fecha se pasaban a la
        // segunda hoja (TP #6, 2026-10-07, cotejado contra la portada del
        // fundador).
        spacing: { line: 360, lineRule: LineRuleType.AUTO, before: 0, after: 0 },
        children: text ? textRuns(coverText(style.uppercase ? text.toLocaleUpperCase('es') : text)) : [],
    });
    const line = (text: string) => [parrafo(text)];
    const blancos = (n: number) => Array.from({ length: n }, () => parrafo(''));

    // El bloque del título: el nombre que le da el profesor a la entrega, el
    // pasaje y, si está escrito, el curso. Sin renglones en blanco entre
    // ellos: el modelo de TMS los trata como UN título.
    const assignmentTitle = cover.assignmentTitle?.trim();
    const course = cover.course?.trim();
    return {
        properties: {
            page: {
                size: TMS.page,
                margin: { top: TMS.margin, right: TMS.margin, bottom: TMS.margin, left: TMS.margin },
            },
            titlePage: true,
        },
        // Sin número: la portada no se cuenta.
        footers: { first: new Footer({ children: [new Paragraph({ children: [] })] }) },
        children: [
            ...blancos(layout.beforeInstitution),
            ...(institution ? line(institution) : []),
            ...blancos(layout.afterInstitution),
            ...(assignmentTitle ? line(assignmentTitle) : []),
            // El pasaje, salvo que el nombre de la entrega ya lo diga: si no,
            // salía dos veces («TRABAJO PRÁCTICO #6 - SANTIAGO 3:1–12» y abajo
            // «SANTIAGO 3:1-12»).
            ...(assignmentTitle && mentions(assignmentTitle, fallbackTitle) ? [] : line(fallbackTitle)),
            ...(course ? line(course) : []),
            ...blancos(layout.afterTitle),
            ...(style.byLine.trim() ? line(style.byLine.trim()) : []),
            ...line(author ?? ''),
            ...blancos(layout.afterAuthor),
            ...(cover.place?.trim() ? line(cover.place) : []),
            ...(cover.date?.trim() ? line(cover.date) : []),
        ],
    };
}

const HEADING_LEVELS = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
} as const;

// ── Markdown parsing (block level) ──────────────────────────────────

type Block =
    | { type: 'heading'; level: 1 | 2 | 3; text: string }
    | { type: 'paragraph'; text: string }
    | { type: 'list-item'; text: string }
    | { type: 'blockquote'; text: string }
    | { type: 'rule' };

/**
 * Tiny block-level parser tailored to exegetical paper output.
 * Handles `#` `##` `###` headings, `-`/`*` lists, `>` blockquotes,
 * `---` rules, and paragraph blocks separated by blank lines. Inline
 * formatting is left in the text and parsed at run-render time.
 */
function parseMarkdownBlocks(markdown: string): Block[] {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const blocks: Block[] = [];
    let buffer: string[] = [];

    const flushParagraph = () => {
        if (buffer.length === 0) return;
        const text = buffer.join(' ').trim();
        if (text) blocks.push({ type: 'paragraph', text });
        buffer = [];
    };

    for (const raw of lines) {
        const line = raw.trimEnd();
        if (line.trim() === '') {
            flushParagraph();
            continue;
        }
        if (/^---+$/.test(line.trim())) {
            flushParagraph();
            blocks.push({ type: 'rule' });
            continue;
        }
        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
            flushParagraph();
            blocks.push({
                type: 'heading',
                level: heading[1]!.length as 1 | 2 | 3,
                text: heading[2]!.trim(),
            });
            continue;
        }
        const list = line.match(/^[-*]\s+(.+)$/);
        if (list) {
            flushParagraph();
            blocks.push({ type: 'list-item', text: list[1]!.trim() });
            continue;
        }
        const quote = line.match(/^>\s?(.*)$/);
        if (quote) {
            flushParagraph();
            blocks.push({ type: 'blockquote', text: quote[1]!.trim() });
            continue;
        }
        buffer.push(line);
    }
    flushParagraph();
    return blocks;
}

// ── Inline run rendering ────────────────────────────────────────────

const BOLD_PATTERN = /\*\*([^*]+)\*\*/g;
const ITALIC_PATTERN = /(?<!\*)\*([^*]+)\*(?!\*)/g;

/**
 * Walks a paragraph's text, emitting Word runs:
 *   - Inline citations `(...)` are stripped and registered as
 *     footnotes; a `FootnoteReferenceRun` is inserted at the citation
 *     position.
 *   - `**bold**` and `*italic*` markers become run-level formatting.
 *
 * Conservative: anything the regexes don't match falls through as
 * plain text. The orchestrator's output stays predictable, so a small
 * matcher is enough — we don't need a full markdown AST.
 */
function buildInlineRuns(
    paragraphText: string,
    registerFootnote: (cita: { author: string; pages: string | null; raw: string }) => number,
    /**
     * `'parenthetical'` deja la cita donde está, tal como se escribió.
     *
     * No es «no hacer nada»: es la otra convención. El sílabo del trabajo
     * práctico semanal pide «(Apellido, página)» en el texto más bibliografía
     * al final, sin notas, y el exportador convertía a nota al pie siempre
     * porque la forma estaba cableada.
     */
    citationForm: CitationForm = 'footnote',
    /**
     * Claves de cita de las fuentes del trabajo.
     *
     * Sin ellas sólo se convertían las citas con título entre comillas, que
     * era el único patrón que este archivo sabía leer. Medido sobre los 14
     * trabajos con prosa ensamblada en producción: 63 citas bajaban al pie y
     * 103 se quedaban varadas en el cuerpo —«Kistemaker (p. 259)», «(Mayor,
     * 77)»—, seis trabajos enteros sin una sola nota al pie y nada que lo
     * dijera.
     *
     * Ensanchar el patrón a secas no servía: `(Nashville: Broadman & Holman,
     * 2003)` y `(Génesis 19:25, 29)` tienen exactamente esa forma. El corpus
     * del trabajo es lo que los separa, y los separa entero: de esas 103, 89
     * resuelven a una fuente declarada y las 14 que no son, una por una, pies
     * de imprenta y referencias bíblicas.
     */
    citationKeys: ReadonlyArray<string | null | undefined> = [],
): Array<TextRun | FootnoteReferenceRun> {
    interface Marker {
        kind: 'citation' | 'bold' | 'italic';
        start: number;
        end: number;
        body: string;
        /** Sólo en las citas: lo que hace falta para buscar su ficha. */
        author?: string;
        pages?: string | null;
    }
    const markers: Marker[] = [];

    let m: RegExpExecArray | null;
    if (citationForm === 'footnote') {
        // Las claves viajan al reconocedor porque hay una forma —título sin
        // comillas— que sin el corpus no se puede distinguir de un pie de
        // imprenta, y por eso sólo participa cuando se las pasan.
        for (const cita of findInlineCitations(paragraphText, citationKeys)) {
            // Con título entre comillas es inequívoca por su forma. Sin
            // título, sólo si el autor es una fuente que el trabajo declara:
            // es la única señal que la separa de un pie de imprenta o de una
            // referencia bíblica.
            if (!cita.title && !resolvesToCitedSource(cita.author, citationKeys)) continue;
            markers.push({
                kind: 'citation',
                start: cita.offset,
                end: cita.end,
                body: cita.raw.replace(/^[(;]\s*/, '').replace(/\s*[);]$/, ''),
                author: cita.author,
                pages: cita.pages,
            });
        }
    }
    BOLD_PATTERN.lastIndex = 0;
    while ((m = BOLD_PATTERN.exec(paragraphText)) !== null) {
        if (overlapsExisting(m.index, m.index + m[0].length, markers)) continue;
        markers.push({
            kind: 'bold',
            start: m.index,
            end: m.index + m[0].length,
            body: m[1] ?? '',
        });
    }
    ITALIC_PATTERN.lastIndex = 0;
    while ((m = ITALIC_PATTERN.exec(paragraphText)) !== null) {
        if (overlapsExisting(m.index, m.index + m[0].length, markers)) continue;
        markers.push({
            kind: 'italic',
            start: m.index,
            end: m.index + m[0].length,
            body: m[1] ?? '',
        });
    }
    markers.sort((a, b) => a.start - b.start);

    const runs: Array<TextRun | FootnoteReferenceRun> = [];
    let cursor = 0;
    for (const mk of markers) {
        if (mk.start > cursor) {
            // `textRuns` y no un run suelto: el hebreo que aparece en
            // mitad de una frase castellana necesita su propia marca de
            // derecha a izquierda o Word lo reordena al abrir.
            runs.push(...textRuns(paragraphText.slice(cursor, mk.start)));
        }
        if (mk.kind === 'citation') {
            const id = registerFootnote({ author: mk.author ?? '', pages: mk.pages ?? null, raw: mk.body });
            runs.push(new FootnoteReferenceRun(id));
        } else if (mk.kind === 'bold') {
            runs.push(...textRuns(mk.body, { bold: true }));
        } else {
            runs.push(...textRuns(mk.body, { italics: true }));
        }
        cursor = mk.end;
    }
    if (cursor < paragraphText.length) {
        runs.push(...textRuns(paragraphText.slice(cursor)));
    }
    return runs.length > 0 ? runs : textRuns(paragraphText);
}

function overlapsExisting(
    start: number,
    end: number,
    markers: Array<{ start: number; end: number }>,
): boolean {
    return markers.some(mk => start < mk.end && end > mk.start);
}
