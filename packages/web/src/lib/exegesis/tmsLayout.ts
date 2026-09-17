import {
    AlignmentType,
    LineRuleType,
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

export const BODY_PARAGRAPH: IParagraphStylePropertiesOptions = {
    spacing: { line: TMS.doubleLine, lineRule: LineRuleType.AUTO, before: 0, after: 0 },
    indent: { firstLine: TMS.firstLineIndent },
    alignment: AlignmentType.LEFT,
};

/**
 * Títulos: mismo cuerpo de letra que el texto, centrados, negrita solo el
 * de primer nivel. Word trae los suyos en azul y con otra tipografía; sin
 * redefinirlos, el trabajo sale con encabezados que la guía no admite.
 */
export const HEADING_PARAGRAPH: IParagraphStylePropertiesOptions = {
    spacing: { before: 480, after: 240, line: TMS.singleLine, lineRule: LineRuleType.AUTO },
    indent: { firstLine: 0 },
    alignment: AlignmentType.CENTER,
    keepNext: true,
};

/** Cita en bloque: espacio simple, sangrada por los dos lados, sin sangría de primera línea. */
export const BLOCK_QUOTE_PARAGRAPH = {
    spacing: { line: TMS.singleLine, lineRule: LineRuleType.AUTO, after: 240 },
    indent: { left: TMS.blockIndent, right: TMS.blockIndent, firstLine: 0 },
} as const;

/** Entrada de bibliografía: sangría francesa, espacio simple. */
export const BIBLIOGRAPHY_PARAGRAPH = {
    spacing: { line: TMS.singleLine, lineRule: LineRuleType.AUTO, after: 240 },
    indent: { left: TMS.blockIndent, hanging: TMS.blockIndent },
} as const;

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
