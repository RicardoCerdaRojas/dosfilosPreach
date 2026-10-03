import { usesExtractedExcerpts, type ProjectSource, type ProjectSourceExcerpt, type SheetRange } from '../entities/ProjectSource';
import { normalizeSheetRanges } from '../outline/documentPageIndex';
import { emptySourceReason, isCitableSourceType } from '../entities/SourceType';

/**
 * ¿Esta fuente declara qué hojas admitió el trabajo?
 *
 * Es la pregunta que decide de dónde sale su texto. Con receta, el
 * material lo elige la recuperación dentro de esas hojas. Sin receta,
 * el único camino es el documento entero.
 *
 * Vivía copiada en los dos casos de uso que arman el prompt, y de esa
 * copia salió el defecto que este archivo existe para cerrar: el filtro
 * que arma el pedido al corpus y la rama que decide el respaldo hacían
 * la misma pregunta por separado, así que una fuente podía quedar
 * dentro del pedido y aun así caer al respaldo del libro completo.
 */
export function hasCuratedScope(source: Pick<ProjectSource, 'excerptRecipe'>): boolean {
    return (source.excerptRecipe?.sheetRanges.length ?? 0) > 0;
}

/**
 * La fuente del trabajo que viene de este recurso de biblioteca.
 *
 * Mira el backref Y el `corpusId`: las fuentes adjuntadas por la ruta vieja
 * guardan el id en `corpusId` y dejan el backref en null. Extraer de la
 * biblioteca miraba sólo el backref y duplicaba esos libros; la selección de
 * páginas y la herencia de la serie ya miraban los dos (aquí vive ahora el
 * criterio, una sola vez).
 */
export function sourceForResource<S extends Pick<ProjectSource, 'sourceLibraryResourceId' | 'corpusId'>>(
    sources: ReadonlyArray<S>,
    libraryResourceId: string,
): S | null {
    return sources.find(
        s => s.sourceLibraryResourceId === libraryResourceId || s.corpusId === libraryResourceId,
    ) ?? null;
}

/**
 * Una fuente citable que no dice qué leer: sin páginas elegidas y sin
 * fragmentos.
 *
 * Así llegan las fuentes heredadas de la serie. En Jonás 4:5-11 (2026-10-02)
 * el análisis las leyó desde la primera página —portada, prólogo— y ningún
 * versículo tuvo diálogo con comentaristas, sin un solo aviso fuera de
 * Configuración → Corpus. Aquí vive la pregunta para que el corpus, el panel
 * de pasos y el diálogo de extracción hagan la misma.
 */
export function isSourceWithoutScope(
    source: Pick<ProjectSource, 'sourceType' | 'excerptRecipe' | 'mode' | 'excerpts'>,
): boolean {
    return isCitableSourceType(source.sourceType)
        && !hasCuratedScope(source)
        && !usesExtractedExcerpts(source);
}

/**
 * ¿Esta fuente se organiza por lema o por categoría (léxico, diccionario,
 * gramática)? Esas no se extraen por cercanía al pasaje: se eligen sus páginas
 * en el selector, por las formas del texto.
 */
export function isPickedByPages(source: Pick<ProjectSource, 'sourceType'>): boolean {
    return emptySourceReason(source.sourceType, 0) !== 'expected-by-passage';
}

/**
 * Dónde buscar el material de una fuente para UN versículo.
 *
 * Antes, sólo las fuentes con páginas elegidas se consultaban por versículo.
 * Las demás viajaban enteras: el documento completo, truncado desde la portada
 * (Jonás 4:5-11, 2026-10-02: ningún versículo tuvo diálogo con
 * comentaristas), y los fragmentos, todos en cada paso aunque hablaran de otro
 * versículo.
 *
 *   - `recipe` — las páginas que eligió el usuario, con sus fijadas.
 *   - `excerpt-sheets` — las hojas de donde salieron los fragmentos. Los que
 *     el usuario editó, o los que no dicen de qué hoja son, van siempre
 *     (`alwaysExcerpts`): el texto editado no está en el corpus.
 *   - `whole-document` — una fuente citable sin páginas ni fragmentos: se
 *     busca en el libro entero lo que habla del versículo.
 *
 * `null`: nada que consultar (una plantilla de estilo, una fuente vacía).
 */
export type RetrievalScope =
    | { kind: 'recipe'; sheetRanges: SheetRange[]; pinnedRanges: SheetRange[] }
    | { kind: 'excerpt-sheets'; sheetRanges: SheetRange[]; pinnedRanges: SheetRange[]; alwaysExcerpts: ProjectSourceExcerpt[] }
    | { kind: 'whole-document'; sheetRanges: SheetRange[]; pinnedRanges: SheetRange[] };

/** Todas las hojas: el filtro de la búsqueda deja pasar cualquiera. */
export const WHOLE_DOCUMENT_RANGE: SheetRange = { start: 1, end: Number.MAX_SAFE_INTEGER };

/**
 * Un documento completo así de chico viaja entero, como lo fijado, en vez de
 * consultarse por versículo. Es el caso del extracto corto subido a mano,
 * donde el documento ES la curaduría: consultado, competía por el tope con el
 * resto y le tocaba un piso de unos 4.000 caracteres en un trabajo de 12
 * fuentes (revisión adversarial de A4). Un libro nunca entra acá.
 */
export const SMALL_DOCUMENT_CHARS = 20_000;

/** Si un documento completo, por lo que dice su índice de hojas, viaja entero. */
export function wholeDocumentTravelsEntire(pages: ReadonlyArray<{ charCount: number }>): boolean {
    const total = pages.reduce((n, p) => n + (p.charCount ?? 0), 0);
    return total > 0 && total <= SMALL_DOCUMENT_CHARS;
}

/** Si un alcance es «el documento entero» (sin páginas, sin fragmentos). */
export function isWholeDocumentScope(sheetRanges: ReadonlyArray<SheetRange>): boolean {
    return sheetRanges.length === 1
        && sheetRanges[0]!.start === WHOLE_DOCUMENT_RANGE.start
        && sheetRanges[0]!.end === WHOLE_DOCUMENT_RANGE.end;
}

export function retrievalScopeOf(
    source: Pick<ProjectSource, 'sourceType' | 'excerptRecipe' | 'mode' | 'excerpts'>,
): RetrievalScope | null {
    if (hasCuratedScope(source)) {
        return {
            kind: 'recipe',
            sheetRanges: [...source.excerptRecipe!.sheetRanges],
            pinnedRanges: [...(source.excerptRecipe!.pinnedRanges ?? [])],
        };
    }
    if (usesExtractedExcerpts(source)) {
        const conHoja = source.excerpts.filter(e => !e.userEdited && typeof e.sheet === 'number');
        if (conHoja.length === 0) return null;
        return {
            kind: 'excerpt-sheets',
            sheetRanges: normalizeSheetRanges(conHoja.map(e => ({ start: e.sheet!, end: e.sheet! }))),
            pinnedRanges: [],
            alwaysExcerpts: source.excerpts.filter(e => e.userEdited || typeof e.sheet !== 'number'),
        };
    }
    if (isSourceWithoutScope(source)) {
        return { kind: 'whole-document', sheetRanges: [WHOLE_DOCUMENT_RANGE], pinnedRanges: [] };
    }
    return null;
}
