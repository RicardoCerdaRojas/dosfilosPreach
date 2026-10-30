import { DEFAULT_PAPER_FORMATTING, type PaperFormatting } from '@dosfilos/domain';
import {
    AlignmentType,
    LeaderType,
    LineRuleType,
    TabStopType,
    convertInchesToTwip,
    type IParagraphStylePropertiesOptions,
    type IRunStylePropertiesOptions,
} from 'docx';

/**
 * El formato que exige la guía de estilo del seminario, en un solo sitio.
 *
 * Los números no son decoración: un trabajo a espacio simple con sangría
 * de un centímetro tiene la misma cantidad de palabras y la mitad de
 * páginas, y la extensión es parte de la nota. Salen de la guía de TMS y
 * del trabajo de Salmo 23:1–3 que se entregó con este formato.
 *
 * Times New Roman 12 · cuerpo a doble espacio, alineado a la izquierda,
 * sangría de primera línea 0,5" · márgenes de 1" · notas al pie a 10 pt y
 * espacio simple · títulos centrados en el mismo cuerpo de letra, sin
 * color y sin fuente de tema.
 */
export const TMS = {
    font: 'Times New Roman',
    /** Cuerpo, en medios puntos (docx cuenta así). */
    bodyHalfPt: 24,
    footnoteHalfPt: 20,
    /** Doble espacio: 240 veinteavos de punto = una línea. */
    doubleLine: 480,
    singleLine: 240,
    firstLineIndent: convertInchesToTwip(0.5),
    blockIndent: convertInchesToTwip(0.5),
    margin: convertInchesToTwip(1),
    headerFooterDistance: convertInchesToTwip(0.5),
    /** Carta: 8,5 × 11 pulgadas. */
    page: { width: convertInchesToTwip(8.5), height: convertInchesToTwip(11) },
} as const;

export const BODY_RUN: IRunStylePropertiesOptions = {
    font: TMS.font,
    size: TMS.bodyHalfPt,
};

/**
 * Veinteavos de punto de cada interlineado. 240 = una línea.
 *
 * Los dos extremos SALEN de `TMS` en vez de repetirse: son los mismos números
 * que ya gobiernan los títulos, las citas en bloque y la bibliografía, y dos
 * copias de una medida son dos medidas apenas alguien toca una.
 */
const LINEA = {
    single: TMS.singleLine,
    'one-and-a-half': TMS.singleLine * 1.5,
    double: TMS.doubleLine,
} as const;

/**
 * El párrafo del cuerpo, según lo que pida la entrega.
 *
 * `null` es la guía de la casa —doble espacio, sin línea entre párrafos—,
 * que es lo que el exportador hacía cableado y lo que sigue haciendo cuando
 * la rúbrica no dice otra cosa.
 *
 * La línea entre párrafos se escribe como espacio POSTERIOR y no como un
 * renglón vacío: un renglón vacío es un párrafo más, se descuadra al editar,
 * y cuenta en cualquier recuento que mire párrafos.
 *
 * La sangría de primera línea no se toca. Es independiente del interlineado
 * y ninguna de las dos guías la quita; el trabajo práctico a espacio simple
 * que originó este campo la conserva.
 */
export function bodyParagraphFor(
    formatting: PaperFormatting | null,
): IParagraphStylePropertiesOptions {
    const f = formatting ?? DEFAULT_PAPER_FORMATTING;
    return {
        spacing: {
            line: LINEA[f.lineSpacing],
            lineRule: LineRuleType.AUTO,
            before: 0,
            after: f.blankLineBetweenParagraphs ? TMS.singleLine : 0,
        },
        indent: { firstLine: TMS.firstLineIndent },
        alignment: AlignmentType.LEFT,
    };
}

/**
 * Títulos: mismo cuerpo de letra que el texto, centrados, negrita solo el
 * de primer nivel. Word trae los suyos en azul y con otra tipografía; sin
 * redefinirlos, el trabajo sale con encabezados que la guía no admite.
 */
/**
 * Los encabezados, como pide la guía de TMS (2024–2025, hoja 11): 12 pt
 * antes («dos líneas en blanco a espacio simple»; nota 10: «12 puntos
 * antes del encabezado», que con el cuerpo a doble espacio da esas dos
 * líneas) y una línea en blanco después. Eran 24 pt antes, y el profesor
 * del TI #1 marcó «Revisa el espaciado antes y después de títulos» (B51).
 */
export const HEADING_PARAGRAPH: IParagraphStylePropertiesOptions = {
    spacing: { before: 240, after: 240, line: TMS.singleLine, lineRule: LineRuleType.AUTO },
    indent: { firstLine: 0 },
    alignment: AlignmentType.CENTER,
    keepNext: true,
};

/** Nivel tres: «alineado a la izquierda, primera letra mayúscula, cursiva» (no centrado). */
export const HEADING3_PARAGRAPH: IParagraphStylePropertiesOptions = {
    ...HEADING_PARAGRAPH,
    alignment: AlignmentType.LEFT,
};

/**
 * Encabezado de título (todo mayúsculas: CONTENIDO, BIBLIOGRAFÍA, APÉNDICE):
 * «se separan del cuerpo del texto que sigue por dos líneas en blanco».
 */
export const TITLE_HEADING_SPACING = { before: 240, after: 480 } as const;

/** Cita en bloque: espacio simple, sangrada por los dos lados, sin sangría de primera línea. */
export const BLOCK_QUOTE_PARAGRAPH = {
    spacing: { line: TMS.singleLine, lineRule: LineRuleType.AUTO, after: 240 },
    indent: { left: TMS.blockIndent, right: TMS.blockIndent, firstLine: 0 },
} as const;

/**
 * Entrada de bibliografía (guía, hoja 17): sangría francesa de 0,5", espacio
 * simple, 12 pt entre entradas, y una entrada no se parte entre dos páginas.
 */
export const BIBLIOGRAPHY_PARAGRAPH = {
    spacing: { line: TMS.singleLine, lineRule: LineRuleType.AUTO, after: 240 },
    indent: { left: TMS.blockIndent, hanging: TMS.blockIndent },
    keepLines: true,
} as const;

/**
 * Los tres niveles del índice (guía, hoja 4): 12 pt sin negrita, el título a
 * la izquierda y el número a la derecha unidos por una línea de puntos; nivel
 * uno a doble espacio, nivel dos con sangría de 0,5" a 1,5, nivel tres con
 * sangría de 1" a espacio simple. Los ids son los que Word usa para el campo
 * TOC: con ellos, el índice que Word arma al abrir sale con este formato.
 */
const TOC_TAB = TMS.page.width - 2 * TMS.margin;
const tocStyle = (level: 1 | 2 | 3, indent: number, line: number) => ({
    id: `TOC${level}`,
    name: `toc ${level}`,
    basedOn: 'Normal',
    next: 'Normal',
    run: { font: TMS.font, size: TMS.bodyHalfPt, bold: false },
    paragraph: {
        indent: { left: indent, firstLine: 0 },
        spacing: { line, lineRule: LineRuleType.AUTO, before: 0, after: 0 },
        tabStops: [{ type: TabStopType.RIGHT, position: TOC_TAB, leader: LeaderType.DOT }],
    },
});
export const TOC_STYLES = [
    tocStyle(1, 0, TMS.doubleLine),
    tocStyle(2, convertInchesToTwip(0.5), LINEA['one-and-a-half']),
    tocStyle(3, convertInchesToTwip(1), TMS.singleLine),
];

/** Bloque hebreo continuo, con sus signos y separadores. */
const HEBREW = /[֐-׿יִ-ﭏ]+(?:[ ־][֐-׿יִ-ﭏ]+)*/g;

export interface TextSegment {
    text: string;
    hebrew: boolean;
}

/**
 * Parte un texto en tramos latinos y hebreos.
 *
 * El hebreo necesita su propio `run` marcado de derecha a izquierda; sin
 * eso Word reordena la frase al abrirla y las palabras salen invertidas
 * —el defecto que apareció en el léxico de Ortiz—. Dentro del tramo
 * hebreo los espacios pasan a ser de no separación para que una frase no
 * se parta entre dos renglones, que es donde el bidi vuelve a romperse.
 */
export function splitHebrew(text: string): TextSegment[] {
    const out: TextSegment[] = [];
    let at = 0;
    for (const match of text.matchAll(HEBREW)) {
        if (match.index! > at) out.push({ text: text.slice(at, match.index), hebrew: false });
        out.push({ text: match[0].replace(/ /g, ' '), hebrew: true });
        at = match.index! + match[0].length;
    }
    if (at < text.length) out.push({ text: text.slice(at), hebrew: false });
    return out.length > 0 ? out : [{ text, hebrew: false }];
}

/** Si un texto es hebreo en su mayor parte: decide si el párrafo va a la derecha. */
export function isMostlyHebrew(text: string): boolean {
    const letters = text.replace(/[\s\d\p{P}]/gu, '');
    if (letters.length === 0) return false;
    const hebrew = letters.match(/[֐-׿יִ-ﭏ]/g)?.length ?? 0;
    return hebrew / letters.length > 0.5;
}
