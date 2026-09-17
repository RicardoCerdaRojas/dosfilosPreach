import {
    printedLabelIn,
    printedPageFor,
    sheetForPrintedIn,
    sheetForPrintedPage,
    type CitationPageKind,
    type PageNumbering,
} from '@dosfilos/domain';

/**
 * Cómo se conoce el libro desde el visor: la calibración confirmada por
 * tramos, si existe, y el desfase único que dedujo el índice, si no.
 */
export interface SheetContext {
    numbering: PageNumbering | null;
    offset: number | null;
}

/**
 * La hoja del archivo donde se abre una cita.
 *
 * Una cita en página impresa se lleva a la hoja con la calibración
 * confirmada; si no la hay, con el desfase detectado; y si tampoco, se
 * abre el número como hoja, que es lo que hacían todas las citas antes de
 * la calibración. Sin `pageKind` el número es hoja.
 */
export function resolveCitationSheet(
    citation: { page: number; pageKind?: CitationPageKind },
    ctx: SheetContext,
): number {
    if (citation.pageKind !== 'printed') return Math.max(1, citation.page);
    return sheetForPrintedIn(ctx.numbering, citation.page)
        ?? sheetForPrintedPage(citation.page, ctx.offset)
        ?? Math.max(1, citation.page);
}

/**
 * A qué hoja lleva un número escrito en «ir a página».
 *
 * El lector escribe lo que ve en el libro: el folio impreso. Se convierte
 * cuando el libro está calibrado o tiene desfase deducido; si ninguna de
 * las dos produce esa página —número fuera del libro, o libro sin
 * calibrar—, se toma como hoja. Así el mismo cuadro sirve para los dos
 * casos sin pedirle al lector que sepa cuál es.
 */
export function sheetForPageInput(input: number, ctx: SheetContext): number | null {
    if (!Number.isInteger(input) || input < 1) return null;
    return sheetForPrintedIn(ctx.numbering, input)
        ?? sheetForPrintedPage(input, ctx.offset)
        ?? input;
}

/** Qué número lleva impreso una hoja, con la calibración o con el desfase. */
export function printedOfSheet(sheet: number, ctx: SheetContext): string | number | null {
    return ctx.numbering ? printedLabelIn(ctx.numbering, sheet) : printedPageFor(sheet, ctx.offset);
}

export function clampSheet(sheet: number, total: number | null): number {
    const lo = Math.max(1, sheet);
    return total && total >= 1 ? Math.min(lo, total) : lo;
}
