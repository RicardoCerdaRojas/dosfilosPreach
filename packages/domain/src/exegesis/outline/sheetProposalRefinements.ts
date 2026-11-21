/**
 * Ajustes a la propuesta de hojas de una fuente, medidos en el banco del corpus
 * (`scripts/bench/corpus`, fase «Asistente del corpus», A2, 2026-11-21).
 */
import type { SourceType } from '../entities/SourceType';
import type { SheetRange } from '../entities/ProjectSource';
import { normalizeSheetRanges, type PageIndexEntry } from './documentPageIndex';

/** Hasta este tamaño, un documento se propone entero: es un extracto, no un libro. */
export const SHORT_RESOURCE_MAX_SHEETS = 3;

/**
 * Un documento de pocas hojas se propone entero.
 *
 * Medido: la BHS del TI #3 de Salmo 23 era un extracto de 2 hojas con el salmo, y
 * ninguna ruta proponía nada porque no trae encabezado corrido ni índice. El
 * estudiante citó las dos.
 */
export function shortResourceSheets(pageIndex: ReadonlyArray<Pick<PageIndexEntry, 'sheet'>>): SheetRange[] {
    if (pageIndex.length === 0 || pageIndex.length > SHORT_RESOURCE_MAX_SHEETS) return [];
    return normalizeSheetRanges(pageIndex.map(p => ({ start: p.sheet, end: p.sheet })));
}

/** Hojas que se suman a cada lado de la sección de un comentario. */
export const COMMENTARY_CONTOUR_SHEETS = 1;

/**
 * La sección de un comentario, con una hoja más a cada lado.
 *
 * El índice del comentario corta la sección donde EMPIEZA la siguiente, y lo que
 * el estudiante cita a veces está en el borde: la hoja que sigue (Adamson 143),
 * las «Additional Notes» que cierran la sección (McCartney 194–195). Medido en el
 * banco: comentarios de desarrollo 89,1 % → 93,8 % de recall con 24 hojas más; en
 * el conjunto de prueba no cambia. Se probó también extender hasta el borde de la
 * sección madre (hasta 8 hojas): ganaba 2 citas de prueba a cambio de 50 hojas
 * más, y no se adoptó.
 *
 * Solo comentarios: en una gramática o un léxico la hoja vecina es otra categoría
 * u otra palabra.
 */
export function withCommentaryContour(
    ranges: ReadonlyArray<SheetRange>,
    pageIndex: ReadonlyArray<Pick<PageIndexEntry, 'sheet'>>,
    sourceType: SourceType | undefined,
): SheetRange[] {
    if (!sourceType || !isCommentary(sourceType) || ranges.length === 0) return [...ranges];
    const hojas = pageIndex.map(p => p.sheet);
    const min = hojas.length ? Math.min(...hojas) : 1;
    const max = hojas.length ? Math.max(...hojas) : Number.MAX_SAFE_INTEGER;
    return normalizeSheetRanges(ranges.map(r => ({
        start: Math.max(min, r.start - COMMENTARY_CONTOUR_SHEETS),
        end: Math.min(max, r.end + COMMENTARY_CONTOUR_SHEETS),
    })));
}

function isCommentary(t: SourceType): boolean {
    return t === 'commentary-critical' || t === 'commentary-expository';
}
