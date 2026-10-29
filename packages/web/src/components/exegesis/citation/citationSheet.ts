import {
    printedLabelForSheet,
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
    /** El índice de secciones del libro, para las citas por sección. */
    sections?: ReadonlyArray<{ section: string; sheet: number }>;
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
    citation: { page: number; pageKind?: CitationPageKind; locator?: string },
    ctx: SheetContext,
): number {
    // Por sección (libro sin páginas impresas): la hoja donde empieza esa
    // sección en el índice del libro.
    if (citation.pageKind === 'section' && citation.locator?.trim()) {
        const buscada = plegar(citation.locator.replace(/^§\s*/, ''));
        const hallada = ctx.sections?.find(s => plegar(s.section) === buscada)
            ?? ctx.sections?.find(s => plegar(s.section).startsWith(buscada));
        return hallada?.sheet ?? 1;
    }
    if (citation.pageKind !== 'printed') return Math.max(1, citation.page);
    return sheetForPrintedIn(ctx.numbering, citation.page)
        ?? sheetForPrintedPage(citation.page, ctx.offset)
        ?? Math.max(1, citation.page);
}

// «Ir a página» ya no vive aquí: tomaba en silencio como hoja la página que
// no existía, y el mismo número significaba dos cosas (TP #9, B27). Ver
// `resolvePageJump` en el dominio e `IrAPagina`.

/**
 * Qué número lleva impreso una hoja: la MISMA regla que «Ir a»
 * (`resolvePageJump`) y el selector. Antes, con una numeración por tramos
 * que no cubría todas las hojas, no caía al desfase: «Ir a 150» iba a la
 * hoja 145 y la cabecera la rotulaba «sin número» (revisión de B27).
 */
export function printedOfSheet(sheet: number, ctx: SheetContext): string | null {
    return printedLabelForSheet(sheet, ctx.numbering, ctx.offset);
}

export function clampSheet(sheet: number, total: number | null): number {
    const lo = Math.max(1, sheet);
    return total && total >= 1 ? Math.min(lo, total) : lo;
}

/** Sin tildes, mayúsculas ni espacios repetidos: «2.3  El Genitivo» = «2.3 el genitivo». */
function plegar(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
