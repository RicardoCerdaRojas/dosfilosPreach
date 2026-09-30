import type { SheetRange } from '../entities/ProjectSource';
import type { ChunkRange } from './documentOutline';

/**
 * El índice de hojas de un documento: qué hay en cada hoja física del PDF.
 *
 * Es lo que dibuja el panel izquierdo del selector y lo que traduce la
 * elección del usuario —«las hojas 68 a 71»— a los fragmentos concretos que
 * van al prompt. Se arma del lado del servidor con una consulta plana sobre
 * los fragmentos ya indexados: sin embeddings, sin texto completo, sin tocar
 * el PDF.
 */
export interface PageIndexEntry {
    /** Hoja física del PDF, tal como la guarda `metadata.page`. */
    sheet: number;
    /** Índices de fragmento que caen en esta hoja, en orden. */
    chunkIndices: ReadonlyArray<number>;
    /** Encabezado de la hoja, cuando el documento trae estructura. */
    section: string | null;
    /** Primer renglón con contenido, para ubicarse cuando no hay encabezado. */
    firstLine: string;
    /**
     * Final del texto de la hoja. Ahí está el folio en los libros que
     * numeran al pie, que en tipografía académica son mayoría.
     *
     * Opcional porque un índice cacheado de antes de existir este campo
     * sigue siendo válido: sin cola, la detección del desfase se
     * conforma con el encabezado, que es como funcionaba.
     */
    lastLine?: string;
    /** Caracteres de texto en la hoja. Alimenta el medidor de presupuesto. */
    charCount: number;
}

/**
 * Traduce hojas elegidas a rangos de fragmentos.
 *
 * La conversión vive aquí y no en el servidor a propósito: el cliente ya tiene
 * el índice de hojas cargado para dibujar el panel, así que puede resolverlo
 * sin otra vuelta a la red, y `getDocumentChunks` sigue teniendo una sola
 * forma de pedir —por rango de fragmentos— en vez de dos.
 *
 * El resultado son rangos contiguos de `chunkIndex`, que es lo que esa
 * callable espera. Las hojas que no existen en el índice se ignoran: un
 * documento puede saltear números de hoja (el indexador no emite fragmentos
 * para una página en blanco o ilegible), y pedir un fragmento inexistente
 * sería pedir por pedir.
 */
export function chunkRangesForSheets(
    pageIndex: ReadonlyArray<PageIndexEntry>,
    sheetRanges: ReadonlyArray<SheetRange>,
): ChunkRange[] {
    const wanted = new Set<number>();
    for (const range of sheetRanges) {
        const start = Math.min(range.start, range.end);
        const end = Math.max(range.start, range.end);
        for (const entry of pageIndex) {
            if (entry.sheet < start || entry.sheet > end) continue;
            for (const index of entry.chunkIndices) wanted.add(index);
        }
    }

    const sorted = [...wanted].sort((a, b) => a - b);
    const out: ChunkRange[] = [];
    for (const index of sorted) {
        const last = out[out.length - 1];
        if (last && index === last.end + 1) last.end = index;
        else out.push({ start: index, end: index });
    }
    return out;
}

/**
 * El camino inverso: de fragmentos a hojas.
 *
 * La selección estructural razona en fragmentos —es lo que el índice del libro
 * le permite— pero el selector, el carrito y la receta hablan de hojas. Esta es
 * la traducción que deja enchufar una como propuesta del otro.
 *
 * `gapTolerance` funde hojas separadas por huecos chicos. Hace falta sobre todo
 * para la propuesta semántica, que devuelve aciertos dispersos: sin fundir,
 * el carrito arrancaría con quince tramos de una hoja cada uno en vez de con
 * dos o tres bloques legibles.
 */
export function sheetsForChunkRanges(
    pageIndex: ReadonlyArray<PageIndexEntry>,
    chunkRanges: ReadonlyArray<ChunkRange>,
    gapTolerance = 0,
): SheetRange[] {
    const sheets = new Set<number>();
    for (const entry of pageIndex) {
        const hit = entry.chunkIndices.some(index =>
            chunkRanges.some(range => index >= range.start && index <= range.end),
        );
        if (hit) sheets.add(entry.sheet);
    }

    const sorted = [...sheets].sort((a, b) => a - b);
    const out: SheetRange[] = [];
    for (const sheet of sorted) {
        const last = out[out.length - 1];
        if (last && sheet - last.end <= gapTolerance + 1) last.end = sheet;
        else out.push({ start: sheet, end: sheet });
    }
    return out;
}

/**
 * Normaliza el carrito: ordena, funde tramos que se tocan o se superponen, y
 * descarta los invertidos.
 *
 * Hace falta porque el usuario arma la selección en cualquier orden —acepta la
 * propuesta, después agrega la introducción que está antes— y guardar
 * `[{68,71},{60,67}]` en vez de `[{60,71}]` haría que el mismo carrito se vea
 * distinto según en qué orden se armó.
 */
export function normalizeSheetRanges(ranges: ReadonlyArray<SheetRange>): SheetRange[] {
    const clean = ranges
        .map(r => ({ start: Math.min(r.start, r.end), end: Math.max(r.start, r.end) }))
        .filter(r => Number.isFinite(r.start) && Number.isFinite(r.end) && r.start >= 1)
        .sort((a, b) => a.start - b.start);

    const out: SheetRange[] = [];
    for (const range of clean) {
        const last = out[out.length - 1];
        // `end + 1` funde también los tramos apenas adyacentes: 60-67 y 68-71
        // son un solo tramo de 60 a 71 para quien lo lee.
        if (last && range.start <= last.end + 1) {
            last.end = Math.max(last.end, range.end);
        } else {
            out.push({ ...range });
        }
    }
    return out;
}

/** Total de hojas cubiertas por un carrito ya normalizado. */
export function countSheets(ranges: ReadonlyArray<SheetRange>): number {
    return ranges.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
}

/**
 * Caracteres que aporta una selección. Es la cuenta que alimenta el medidor de
 * presupuesto, y solo suma hojas que existen en el índice — las que no están
 * no aportan texto porque no tienen fragmentos.
 */
export function countChars(
    pageIndex: ReadonlyArray<PageIndexEntry>,
    ranges: ReadonlyArray<SheetRange>,
): number {
    let total = 0;
    for (const entry of pageIndex) {
        for (const range of ranges) {
            if (entry.sheet >= range.start && entry.sheet <= range.end) {
                total += entry.charCount;
                break;
            }
        }
    }
    return total;
}

/**
 * Recorta unos tramos para que no salgan de otros.
 *
 * Lo fijado tiene que ser un subconjunto de lo elegido: marcar como
 * «siempre incluir» una hoja que después se quita del carrito dejaría al
 * prompt pidiendo material que la fuente ya no declara, y el filtro por receta
 * lo descartaría igual — pero el medidor lo seguiría contando.
 */
export function clipRangesTo(
    inner: ReadonlyArray<SheetRange>,
    outer: ReadonlyArray<SheetRange>,
): SheetRange[] {
    const out: SheetRange[] = [];
    for (const a of inner) {
        for (const b of outer) {
            const start = Math.max(a.start, b.start);
            const end = Math.min(a.end, b.end);
            if (start <= end) out.push({ start, end });
        }
    }
    return normalizeSheetRanges(out);
}
