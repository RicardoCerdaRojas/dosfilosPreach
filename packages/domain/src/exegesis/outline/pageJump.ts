/**
 * «Ir a»: lo que el lector escribe en el visor, llevado a una hoja del PDF.
 *
 * Un libro tiene dos números por hoja: la hoja del ARCHIVO y la página
 * IMPRESA. En el TP #9 (B27) el fundador escribió 803 en «Ir a p.» queriendo
 * la hoja 803 del NA28 —que lleva impresa la p. 692— y el cuadro, que tomaba
 * el número como página impresa, lo llevó a la p. 803. Y cuando la página no
 * existía, el cuadro la tomaba EN SILENCIO como hoja: el mismo número podía
 * significar dos cosas según el libro, sin decir cuál.
 *
 * Aquí el modo es explícito (`printed` o `sheet`), un prefijo lo cambia
 * («h. 803», «p. 692») y lo que no tiene hoja se dice en vez de saltar a
 * cualquier lado.
 */

import {
    parseRomanNumeral,
    printedLabelForSheet,
    toRomanNumeral,
    type NumberingStyle,
    type PageNumbering,
} from './pageNumbering';

/** Qué número pide el cuadro: la página impresa o la hoja del archivo. */
export type PageJumpMode = 'printed' | 'sheet';

export interface PageJumpContext {
    /** La numeración por tramos del libro (confirmada o detectada). */
    numbering: PageNumbering | null | undefined;
    /** El desfase único deducido del índice, respaldo de la numeración. */
    offset: number | null;
    /** Hojas del archivo, cuando se conocen. */
    totalSheets: number | null;
}

export type PageJumpResult =
    /** Hay hoja: ir ahí. */
    | { kind: 'go'; sheet: number }
    /** Lo escrito no es un número de página ni de hoja. */
    | { kind: 'invalid'; mode: PageJumpMode }
    /** Se pidió una página impresa en un libro sin numeración conocida. */
    | { kind: 'noNumbering' }
    /** La hoja pedida no está en el archivo. */
    | { kind: 'sheetOutOfBook'; total: number }
    /**
     * La página está fuera de lo que el libro numera. `first`/`last` dicen
     * hasta dónde llega su numeración en esas cifras, si se sabe.
     */
    | { kind: 'printedOutOfBook'; page: string; first: string | null; last: string | null }
    /**
     * La página cae DENTRO de lo que el libro numera pero ninguna hoja la
     * lleva: láminas, un tramo sin numerar o una hoja que el archivo no tiene.
     */
    | { kind: 'printedUnnumbered'; page: string };

/**
 * ¿El libro tiene numeración impresa conocida? Con ella el cuadro pide la
 * página impresa por defecto; sin ella, la hoja del archivo.
 */
export function hasKnownPrintedNumbering(
    numbering: PageNumbering | null | undefined,
    offset: number | null,
): boolean {
    return offset !== null || !!numbering?.segments.some(s => s.offset !== null);
}

/** El modo con que abre el cuadro para este libro. */
export function defaultPageJumpMode(
    numbering: PageNumbering | null | undefined,
    offset: number | null,
): PageJumpMode {
    return hasKnownPrintedNumbering(numbering, offset) ? 'printed' : 'sheet';
}

// «h. 803», «h803», «hoja 803», «sheet 803», «s. 803»: la hoja, diga lo que diga el modo.
const SHEET_PREFIX = /^(?:hoja|sheet|sh|h|s)\.?\s*/;
// «p. 692», «pág. 692», «page 692»: la impresa.
const PRINTED_PREFIX = /^(?:p[áa]g(?:ina)?|page|pp?)\.?\s*/;

/**
 * Lleva lo escrito a una hoja, o dice por qué no hay.
 *
 * Una página impresa se acepta con las cifras del libro: «692», «xii» en un
 * tramo romano, «142*» en una serie con asterisco. La hoja que se devuelve
 * es la que el encabezado del visor rotula con ESE mismo número
 * (`printedLabelForSheet`), así lo que se pide y lo que se ve no pueden
 * discrepar.
 */
export function resolvePageJump(raw: string, mode: PageJumpMode, ctx: PageJumpContext): PageJumpResult {
    let text = (raw ?? '').trim().toLowerCase();
    let effective: PageJumpMode = mode;
    if (SHEET_PREFIX.test(text)) {
        effective = 'sheet';
        text = text.replace(SHEET_PREFIX, '');
    } else if (PRINTED_PREFIX.test(text)) {
        effective = 'printed';
        text = text.replace(PRINTED_PREFIX, '');
    }
    text = text.trim();

    if (effective === 'sheet') {
        if (!/^\d+$/.test(text)) return { kind: 'invalid', mode: 'sheet' };
        const sheet = Number(text);
        if (sheet < 1) return { kind: 'invalid', mode: 'sheet' };
        if (ctx.totalSheets && sheet > ctx.totalSheets) return { kind: 'sheetOutOfBook', total: ctx.totalSheets };
        return { kind: 'go', sheet };
    }

    const wanted = parsePrintedLabel(text);
    if (!wanted) return { kind: 'invalid', mode: 'printed' };
    if (!hasKnownPrintedNumbering(ctx.numbering, ctx.offset)) return { kind: 'noNumbering' };

    const label = labelOf(wanted.value, wanted.style);
    const sheet = candidateSheets(wanted.value, wanted.style, ctx)
        .find(s => printedLabelForSheet(s, ctx.numbering, ctx.offset) === label);
    if (sheet !== undefined) return { kind: 'go', sheet };

    const range = printedRange(wanted.style, ctx);
    if (range && wanted.value >= range.min && wanted.value <= range.max) {
        return { kind: 'printedUnnumbered', page: label };
    }
    return {
        kind: 'printedOutOfBook',
        page: label,
        first: range ? labelOf(range.min, wanted.style) : null,
        last: range ? labelOf(range.max, wanted.style) : null,
    };
}

/** «692» → arábiga, «142*» → con asterisco, «xii» → romana. */
function parsePrintedLabel(text: string): { value: number; style: NumberingStyle } | null {
    if (/^\d+$/.test(text)) {
        const value = Number(text);
        return value >= 1 ? { value, style: 'arabic' } : null;
    }
    const starred = /^(\d+)\s*\*$/.exec(text);
    if (starred) {
        const value = Number(starred[1]);
        return value >= 1 ? { value, style: 'asterisked' } : null;
    }
    const roman = parseRomanNumeral(text);
    return roman === null ? null : { value: roman, style: 'roman' };
}

function labelOf(value: number, style: NumberingStyle): string {
    if (style === 'roman') return toRomanNumeral(value);
    if (style === 'asterisked') return `${value}*`;
    return String(value);
}

/** Hojas que podrían llevar ese número: una por tramo, más la del desfase. */
function candidateSheets(value: number, style: NumberingStyle, ctx: PageJumpContext): number[] {
    const out: number[] = [];
    for (const segment of ctx.numbering?.segments ?? []) {
        if (segment.offset === null || (segment.style ?? 'arabic') !== style) continue;
        const sheet = (value - segment.offset) / (segment.step ?? 1);
        if (Number.isInteger(sheet) && sheet >= segment.fromSheet && sheet <= segment.toSheet) out.push(sheet);
    }
    // El desfase único solo numera arábigas, y solo las hojas que la
    // numeración no describe (la misma regla que `printedLabelForSheet`).
    if (style === 'arabic' && ctx.offset !== null) out.push(value - ctx.offset);
    return out.filter(s => s >= 1 && (!ctx.totalSheets || s <= ctx.totalSheets));
}

/** De qué número a qué número llega la numeración del libro en esas cifras. */
function printedRange(style: NumberingStyle, ctx: PageJumpContext): { min: number; max: number } | null {
    const values: number[] = [];
    for (const segment of ctx.numbering?.segments ?? []) {
        if (segment.offset === null || (segment.style ?? 'arabic') !== style) continue;
        const step = segment.step ?? 1;
        pushEnds(values, segment.offset + step * segment.fromSheet, segment.offset + step * segment.toSheet);
    }
    if (values.length === 0 && style === 'arabic' && ctx.offset !== null && ctx.totalSheets) {
        pushEnds(values, 1 + ctx.offset, ctx.totalSheets + ctx.offset);
    }
    if (values.length === 0) return null;
    return { min: Math.min(...values), max: Math.max(...values) };
}

/** Los extremos de un tramo; la cuenta que empieza en las preliminares (≤ 0) arranca en 1. */
function pushEnds(values: number[], a: number, b: number): void {
    if (Math.max(a, b) < 1) return;
    values.push(Math.max(1, a), Math.max(1, b));
}
