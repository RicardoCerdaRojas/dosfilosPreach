import { usesExtractedExcerpts, type ProjectSource } from '../entities/ProjectSource';
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
