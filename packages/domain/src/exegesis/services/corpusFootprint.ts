import type { ProjectSource } from '../entities/ProjectSource';
import { countChars, type PageIndexEntry } from '../outline/documentPageIndex';
import { hasCuratedScope } from './curatedScope';

/**
 * Cuántos caracteres ocupa una fuente en el presupuesto del trabajo.
 *
 * Había dos medidores y los dos sumaban sólo los FRAGMENTOS guardados. Una
 * fuente con páginas elegidas guarda la RECETA —qué hojas entran—, no su
 * texto, así que contaba cero: en Jonás 4:5-11 (2026-10-02) el corpus decía 4%
 * con 77 hojas de un léxico y 13 de un comentario adentro, y el selector de
 * páginas decía 72% sin contar las hojas de las otras fuentes. El total real
 * pasaba el 100%.
 *
 * Con receta, lo que ocupa son sus hojas (`charCount` del índice del
 * documento). Si el índice todavía no llegó, `null`: no se sabe, y decir cero
 * es exactamente el error que esto corrige.
 */
export function sourceFootprintChars(
    source: Pick<ProjectSource, 'excerpts' | 'excerptRecipe'>,
    pageIndex: ReadonlyArray<PageIndexEntry> | null,
): number | null {
    const fragmentos = source.excerpts.reduce((n, e) => n + e.text.length, 0);
    if (!hasCuratedScope(source)) return fragmentos;
    if (!pageIndex) return null;
    return countChars(pageIndex, source.excerptRecipe!.sheetRanges);
}

/**
 * El corpus entero. `pending` cuando alguna fuente con receta todavía no tiene
 * su índice: el total es un mínimo, no el número.
 */
export function corpusFootprint(
    sources: ReadonlyArray<Pick<ProjectSource, 'id' | 'excerpts' | 'excerptRecipe'>>,
    indexBySource: ReadonlyMap<string, ReadonlyArray<PageIndexEntry> | null>,
): { chars: number; pending: boolean } {
    let chars = 0;
    let pending = false;
    for (const s of sources) {
        const c = sourceFootprintChars(s, indexBySource.get(s.id) ?? null);
        if (c === null) pending = true;
        else chars += c;
    }
    return { chars, pending };
}
