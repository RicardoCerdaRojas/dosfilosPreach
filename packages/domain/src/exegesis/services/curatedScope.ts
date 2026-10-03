import type { ProjectSource } from '../entities/ProjectSource';

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
