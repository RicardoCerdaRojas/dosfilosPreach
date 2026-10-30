import {
    AlignmentType,
    Document,
    Footer,
    FootnoteReferenceRun,
    Header,
    HeadingLevel,
    LineRuleType,
    NumberFormat,
    PageNumber,
    Packer,
    Paragraph,
    SectionType,
    TableOfContents,
    TextRun,
} from 'docx';
import {
    DEFAULT_PAPER_FORMATTING,
    esEncabezadoDeBibliografia,
    exportPaperToMarkdown,
    findInlineCitations,
    formatFirstNote,
    formatPassageReference,
    rangosConRaya,
    formatShortNote,
    hasCover,
    TMS_COVER_STYLE,
    type CoverStyle,
    type IbidRules,
    resolvesToCitedSource,
    referenceAbbreviationOf,
    referenceKindOfSourceType,
    formatReferenceShortNote,
    sourceTypeWithoutIbid,
    sectionHeadingKey,
    verseTextBlocks,
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
    HEADING3_PARAGRAPH,
    TITLE_HEADING_SPACING,
    TOC_STYLES,
    VERSE_ORIGINAL_PARAGRAPH,
    VERSE_TRANSLATION_PARAGRAPH,
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
        /**
         * El «Ibid.» de la guía del trabajo: si lo admite, con qué rótulo y
         * si lleva página distinta. Sin guía, el de TMS («Ibid.», con página).
         */
        ibid?: IbidRules;
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
    const ibid = options.ibid ?? { enabled: true, label: 'Ibid.', allowPageOverride: true };
    /** El tipo de cada fuente, por su clave: decide la forma de un léxico o una gramática. */
    const tipoDeFuente = new Map((paper.sources ?? []).filter(s => s.citationKey).map(s => [s.citationKey!, s.sourceType]));
    const rotuloIbid = ibid.label.trim() || 'Ibid.';
    /** La obra de la nota anterior: con la misma, «Ibid.». */
    let ultimaClave: string | null = null;
    let ultimaPagina: string | null = null;
    // Con portada, el cuerpo no repite el título del trabajo: ya está en la
    // portada, y el cuerpo empieza en «Introducción», nivel uno (decisión del
    // fundador, 2026-10-29, B68d). El ensamble lo escribe como `#` en la
    // primera línea; sin portada se queda, o el documento no diría qué es.
    const parsed = parseMarkdownBlocks(markdown);
    const blocks = cover && parsed[0]?.type === 'heading' && parsed[0].level === 1 ? parsed.slice(1) : parsed;
    const footnotes: Record<number, { children: Paragraph[] }> = {};
    let footnoteCounter = 0;

    // La bibliografía se compone distinto —sangría francesa, espacio
    // simple— y empieza en página nueva, como pide la guía.
    const bibliographyAt = blocks.findIndex(
        b => b.type === 'heading' && esEncabezadoDeBibliografia(b.text),
    );

    const paragraphs: Paragraph[] = [];
    /** Dónde empieza la bibliografía entre los párrafos: va en su propia sección. */
    let bibliographyParagraphAt = -1;
    /** El original y la traducción de cada versículo, para ponerlos bajo su título (B68c). */
    const textosDeVersiculo = verseTextBlocks(paper);
    blocks.forEach((block, index) => {
        const inBibliography = bibliographyAt >= 0 && index >= bibliographyAt;
        switch (block.type) {
            case 'heading':
                if (index === bibliographyAt) bibliographyParagraphAt = paragraphs.length;
                paragraphs.push(new Paragraph({
                    heading: HEADING_LEVELS[nivelDeWord(block.level)],
                    // La bibliografía es un encabezado de título (guía, hoja 11):
                    // en mayúsculas y con dos líneas en blanco después.
                    ...(index === bibliographyAt ? { spacing: TITLE_HEADING_SPACING } : {}),
                    // Nivel uno para el índice (guía, hoja 6: «trátela como un
                    // encabezado de nivel uno»), pero sin negrita: el nivel de
                    // título es «centrado, mayúsculas», y así sale en la propia
                    // guía (BIBLIOGRAFÍA y CONTENIDO en redonda, medido en su PDF).
                    children: index === bibliographyAt
                        ? textRuns(block.text.toLocaleUpperCase('es'), { bold: false })
                        : textRuns(block.text),
                }));
                {
                    // Bajo el título de un versículo, su texto y la traducción
                    // del trabajo, como el TI #1 entregado. Solo un título de
                    // sección (`##`) cuyo rótulo es el del versículo.
                    const texto = block.level === 2 ? textosDeVersiculo.get(sectionHeadingKey(block.text)) : undefined;
                    if (texto) {
                        const hebreo = isMostlyHebrew(texto.original);
                        paragraphs.push(new Paragraph({
                            ...VERSE_ORIGINAL_PARAGRAPH,
                            alignment: hebreo ? AlignmentType.RIGHT : AlignmentType.LEFT,
                            ...(hebreo ? { bidirectional: true } : {}),
                            children: textRuns(texto.original),
                        }));
                        if (texto.translation) {
                            paragraphs.push(new Paragraph({ ...VERSE_TRANSLATION_PARAGRAPH, children: textRuns(texto.translation) }));
                        }
                    }
                }
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
                // Una línea «---» del ensamblado separa secciones en pantalla; en
                // el Word era un párrafo vacío más antes de cada título, y la guía
                // pide no agregar espacios a mano (B51). El encabezado ya separa.
                break;
        }
    });


    // La guía arma el documento en secciones, cada una con su numeración
    // (hojas 3, 6 y 17; medido en Word): portada sin número, CONTENIDO en
    // romanos, cuerpo desde 1 y bibliografía siguiendo al cuerpo con su
    // primera página abajo al centro, «como si comenzara un nuevo capítulo».
    // Dentro de la sección del cuerpo, la bibliografía salía arriba a la
    // derecha, como en el TI #1.
    const conIndice = paper.rubric?.formatting?.tableOfContents === true;
    const cuerpo = bibliographyParagraphAt >= 0 ? paragraphs.slice(0, bibliographyParagraphAt) : paragraphs;
    const bibliografia = bibliographyParagraphAt >= 0 ? paragraphs.slice(bibliographyParagraphAt) : [];
    const doc = new Document({
        title: titleDisplay,
        creator: paper.cover?.author?.trim() || 'Dosfilos · Exegesis',
        styles: documentStyles(paper.rubric?.formatting ?? null),
        // El índice es un campo: Word lo arma al abrir el archivo (medido en
        // Word para Mac: entradas y páginas correctas, sin preguntar).
        ...(conIndice ? { features: { updateFields: true } } : {}),
        footnotes,
        sections: [
            ...(cover ? [cover] : []),
            ...(conIndice ? [indexSection(paper.displayLanguage)] : []),
            numberedSection(cuerpo, true),
            ...(bibliografia.length > 0 ? [numberedSection(bibliografia, false)] : []),
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
    function textoDeLaNota(cita: CitaDeNota, sinIbid = false): string {
        const { author, pages, raw: crudo } = cita;
        const clave = [...fichas.keys()].find(k => resolvesToCitedSource(author, [k]));
        const ficha = clave ? fichas.get(clave)! : null;
        // Una nota sin ficha corta la racha: el «Ibid.» siguiente sería ambiguo.
        if (!ficha || !clave) { ultimaClave = null; return crudo; }
        // Léxicos y gramáticas de referencia (guía, «Léxicos y gramáticas»):
        // la nota siguiente va con la abreviatura, y un léxico, un diccionario
        // o un artículo nunca lleva «Ibid.» (nota 31).
        const tipo = tipoDeFuente.get(clave);
        const referencia = referenceAbbreviationOf(ficha);
        const clase = referencia?.kind ?? referenceKindOfSourceType(tipo);
        const sinIbidPorTipo = sourceTypeWithoutIbid(tipo) || clase === 'lexicon';
        const primera = !yaCitadas.has(clave);
        yaCitadas.add(clave);
        // La misma obra que la nota inmediatamente anterior: «Ibid.», como
        // admite la guía de TMS (y como salió el TI #1, notas 24, 40 y 44).
        // Sin página detrás de una nota con página, «Ibid.» solo diría «la
        // misma página»: va la abreviada. Y lo que la guía no admite, tampoco.
        const pagina = pages?.trim() || null;
        const repetida = ibid.enabled && !sinIbid && !sinIbidPorTipo && !primera && ultimaClave === clave
            && !(pagina === null && ultimaPagina !== null)
            && (pagina === ultimaPagina || ibid.allowPageOverride);
        // Turabian: la misma página que la nota anterior, «Ibid.» solo.
        const mismaPagina = repetida && pagina === ultimaPagina;
        ultimaClave = clave;
        ultimaPagina = pagina;
        const nota = primera
            ? formatFirstNote(ficha, pages ?? undefined)
            : repetida
                // En cursiva, como el ejemplo de la guía de TMS (hoja 22): «² *Ibid.*, 12».
                ? (pagina && !mismaPagina ? `*${rotuloIbid}*, ${pagina}` : `*${rotuloIbid}*`)
                : referencia && clase
                    ? formatReferenceShortNote(referencia, clase, clase === 'lexicon' ? entradaDelLexico(cita, ficha, referencia.abbreviation) : null, pagina)
                    : formatShortNote(ficha, pages ?? undefined);
        // Turabian cierra la nota con punto; las dos funciones devuelven la
        // referencia sin él porque también sirven en pantalla.
        // «*Ibid.*» ya termina en punto, aunque detrás venga el cierre de la cursiva.
        return /\.\*?$/.test(nota) ? nota : `${nota}.`;
    }

    function registerFootnote(citas: ReadonlyArray<CitaDeNota>): number {
        // «(A, 638; B, 59)» es UNA nota con dos obras separadas por punto y
        // coma, como en Turabian; dos llamadas seguidas no lo son. Dentro de
        // ella no hay «Ibid.», y después tampoco: no diría a cuál de las dos.
        const citationText = citas.length === 1
            ? textoDeLaNota(citas[0]!)
            : `${citas.map(c => textoDeLaNota(c, true).replace(/\.$/, '')).join('; ')}.`;
        if (citas.length > 1) ultimaClave = null;
        footnoteCounter += 1;
        footnotes[footnoteCounter] = {
            children: [
                new Paragraph({
                    // La nota va a 10 pt y espacio simple; el cuerpo, a 12
                    // y doble. Heredar el cuerpo llena el pie de página con
                    // tres notas y empuja el texto fuera de la página.
                    spacing: { line: TMS.singleLine, lineRule: LineRuleType.AUTO, after: 120 },
                    indent: { firstLine: TMS.firstLineIndent },
                    children: noteRuns(citationText),
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
            paragraph: HEADING3_PARAGRAPH,
        },
    },
    paragraphStyles: TOC_STYLES,
    };
}

const PAGE = {
    size: TMS.page,
    margin: { top: TMS.margin, right: TMS.margin, bottom: TMS.margin, left: TMS.margin, header: TMS.headerFooterDistance, footer: TMS.headerFooterDistance },
};
const emptyParagraph = () => new Paragraph({ children: [] });

/**
 * El cuerpo, o la bibliografía: la primera página con el número abajo al
 * centro y las siguientes arriba a la derecha. El cuerpo empieza en 1; la
 * bibliografía sigue su numeración.
 */
function numberedSection(children: Paragraph[], startsAtOne: boolean) {
    return {
        properties: {
            type: SectionType.NEXT_PAGE,
            page: { ...PAGE, ...(startsAtOne ? { pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } : {}) },
            titlePage: true,
        },
        headers: { default: new Header({ children: [pageNumberParagraph(AlignmentType.RIGHT)] }), first: new Header({ children: [emptyParagraph()] }) },
        footers: { first: new Footer({ children: [pageNumberParagraph(AlignmentType.CENTER)] }), default: new Footer({ children: [emptyParagraph()] }) },
        children,
    };
}

/**
 * CONTENIDO (guía, hoja 3): «parte de la portada», con número romano abajo al
 * centro desde «i». El título es un encabezado de título —centrado, en
 * mayúsculas, sin negrita y con dos líneas en blanco después— pero NO un
 * estilo de título: el índice no se lista a sí mismo.
 */
function indexSection(language: 'es' | 'en') {
    const titulo = language === 'en' ? 'CONTENTS' : 'CONTENIDO';
    return {
        properties: {
            type: SectionType.NEXT_PAGE,
            page: { ...PAGE, pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } },
        },
        headers: { default: new Header({ children: [emptyParagraph()] }) },
        footers: { default: new Footer({ children: [pageNumberParagraph(AlignmentType.CENTER)] }) },
        children: [
            new Paragraph({
                alignment: AlignmentType.CENTER,
                indent: { firstLine: 0 },
                spacing: { line: TMS.singleLine, lineRule: LineRuleType.AUTO, before: 0, after: TITLE_HEADING_SPACING.after },
                children: textRuns(titulo),
            }),
            new TableOfContents(titulo, { hyperlink: true, headingStyleRange: '1-3' }),
        ],
    };
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
/**
 * El apóstrofo y la comilla simple tipográficos: «O'Connor» → «O’Connor».
 * El profesor del TI #1 marcó «Este apóstrofe no es de redacción, sino de
 * programación» (B52). Va al final, sobre el texto ya armado: las claves de
 * cita («Waltke-O'Connor») se reconocen antes, con el apóstrofo recto. El
 * hebreo no se toca.
 */
export function typographicQuotes(text: string): string {
    return text
        // Comilla de apertura: al comienzo o tras un espacio, paréntesis o comilla, antes de una letra.
        .replace(/(^|[\s([«“])'(?=\p{L})/gu, '$1\u2018')
        // El resto —entre letras, al final de una palabra— es apóstrofo o cierre.
        .replace(/'/g, '\u2019');
}

/** Una cita del cuerpo que va a nota: lo que hace falta para buscar su ficha. */
interface CitaDeNota {
    author: string;
    pages: string | null;
    raw: string;
    /** El título entre comillas de la cita; en un léxico, la entrada. */
    title?: string;
}

/**
 * La entrada de un léxico, cuando la cita la trae: el título entre comillas
 * que no es el de la obra —«(HALOT, "כָּבוֹד", p. 457)»— o un «s.v. σοφία».
 */
function entradaDelLexico(cita: CitaDeNota, ficha: { title?: string; shortTitle?: string }, abreviatura: string): string | null {
    const sv = cita.raw.match(/s\.\s?v\.\s*([^,;)]+)/i)?.[1]?.trim();
    if (sv) return sv;
    const titulo = (cita.title ?? '').trim();
    if (!titulo) return null;
    const comparable = (t: string) => t.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const esLaObra = [ficha.title, ficha.shortTitle, abreviatura].some(t => {
        const c = comparable(t ?? '');
        return c.length > 0 && (comparable(titulo).includes(c) || c.includes(comparable(titulo)));
    });
    return esLaObra ? null : titulo;
}

/**
 * El texto de una nota, con el título de la obra en cursiva. La nota
 * Turabian llega con el título entre asteriscos (`*Psalms 1-50*`, igual que
 * en pantalla); un run plano los dejaba impresos en el Word.
 */
function noteRuns(text: string): TextRun[] {
    const size = TMS.footnoteHalfPt;
    const runs: TextRun[] = [];
    let cursor = 0;
    for (const m of text.matchAll(ITALIC_PATTERN)) {
        if (m.index > cursor) runs.push(...textRuns(text.slice(cursor, m.index), { size }));
        runs.push(...textRuns(m[1] ?? '', { size, italics: true }));
        cursor = m.index + m[0].length;
    }
    if (cursor < text.length) runs.push(...textRuns(text.slice(cursor), { size }));
    return runs;
}

function textRuns(text: string, options: { size?: number; bold?: boolean; italics?: boolean } = {}): TextRun[] {
    return splitHebrew(text).map(seg => new TextRun({
        text: seg.hebrew ? seg.text : typographicQuotes(seg.text),
        font: TMS.font,
        size: options.size ?? TMS.bodyHalfPt,
        // `false` explícito apaga la negrita del estilo del párrafo (BIBLIOGRAFÍA en nivel uno).
        ...(options.bold !== undefined ? { bold: options.bold } : {}),
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

/**
 * Un rango de versículos va con raya corta: «3:1–12», no con el signo menos
 * (−) ni el guion corto. La regla es la del dominio, la misma del título del
 * ensamble (TP #9, B44); no toca fechas.
 */
function coverText(text: string): string {
    return rangosConRaya(text);
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

/**
 * El nivel de la guía para un encabezado del markdown.
 *
 * El ensamble escribe el título del trabajo en `#` y cada sección
 * (introducción, versículo, conclusión, bibliografía) en `##`; los
 * subtítulos de una sección, en `###`. La guía de TMS (2024–2025, hoja 11)
 * dice que los trabajos de MDiv y MMB «comienzan el cuerpo del texto con
 * un encabezado Nivel Uno», y el TI #1 entregado lleva el título y cada
 * versículo en nivel uno y las cuestiones en nivel dos. Pasado tal cual,
 * el TI #2 salió con todas las secciones en nivel dos, sin negrita.
 *
 * Se corre aquí y no en el markdown: la pantalla y el reensamble buscan
 * el `## ` escrito (`replaceVerseSection`, `sectionHeadings`).
 */
export function nivelDeWord(nivelMarkdown: number): 1 | 2 | 3 {
    return Math.min(Math.max(nivelMarkdown - 1, 1), 3) as 1 | 2 | 3;
}

// ── Markdown parsing (block level) ──────────────────────────────────

type Block =
    | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
    | { type: 'paragraph'; text: string }
    | { type: 'list-item'; text: string }
    | { type: 'blockquote'; text: string }
    | { type: 'rule' };

/**
 * Tiny block-level parser tailored to exegetical paper output.
 * Handles `#` to `####` headings, `-`/`*` lists, `>` blockquotes,
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
        const heading = line.match(/^(#{1,4})\s+(.+)$/);
        if (heading) {
            flushParagraph();
            blocks.push({
                type: 'heading',
                level: heading[1]!.length as 1 | 2 | 3 | 4,
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
    registerFootnote: (citas: ReadonlyArray<CitaDeNota>) => number,
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
        /** Las obras de una cita combinada «(A, 638; B, 59)», en orden. */
        parts?: CitaDeNota[];
    }
    const markers: Marker[] = [];

    let m: RegExpExecArray | null;
    if (citationForm === 'footnote') {
        // Las claves viajan al reconocedor porque hay una forma —título sin
        // comillas— que sin el corpus no se puede distinguir de un pie de
        // imprenta, y por eso sólo participa cuando se las pasan.
        // En orden de aparición: el reconocedor no las devuelve así, y unir
        // «(A; B)» exige ver la primera antes que la segunda.
        for (const cita of [...findInlineCitations(paragraphText, citationKeys)].sort((a, b) => a.offset - b.offset)) {
            // Con título entre comillas es inequívoca por su forma. Sin
            // título, sólo si el autor es una fuente que el trabajo declara:
            // es la única señal que la separa de un pie de imprenta o de una
            // referencia bíblica.
            if (!cita.title && !resolvesToCitedSource(cita.author, citationKeys)) continue;
            const part: CitaDeNota = {
                author: cita.author,
                pages: cita.pages,
                title: cita.title,
                raw: cita.raw.replace(/^[(;]\s*/, '').replace(/\s*[);]$/, ''),
            };
            // «; B, 59» pegado a la cita anterior es la segunda obra del mismo
            // paréntesis: va en la misma nota, no en una llamada aparte.
            const previa = markers[markers.length - 1];
            if (cita.raw.startsWith(';') && previa?.kind === 'citation' && previa.end === cita.offset) {
                previa.parts!.push(part);
                previa.end = cita.end;
                continue;
            }
            markers.push({ kind: 'citation', start: cita.offset, end: cita.end, body: part.raw, author: cita.author, pages: cita.pages, parts: [part] });
        }
        // El reconocedor deja fuera el «)» que cierra la cita —«(Ross, 565»—,
        // y el Word mostraba «divinos¹²).» (TI #2: siete veces, más las tres
        // combinadas). Se consume si el paréntesis de la cita quedó abierto.
        for (const mk of markers) {
            if (mk.kind !== 'citation' || paragraphText[mk.end] !== ')') continue;
            const tramo = paragraphText.slice(mk.start, mk.end);
            if ((tramo.match(/\(/g) ?? []).length > (tramo.match(/\)/g) ?? []).length) mk.end += 1;
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
            // La llamada de nota va pegada a la palabra: «ellos¹.», no «ellos ¹.».
            const antes = paragraphText.slice(cursor, mk.start);
            runs.push(...textRuns(mk.kind === 'citation' && paragraphText[mk.start] === '(' ? antes.trimEnd() : antes));
        }
        if (mk.kind === 'citation') {
            const id = registerFootnote(mk.parts ?? [{ author: mk.author ?? '', pages: mk.pages ?? null, raw: mk.body }]);
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
