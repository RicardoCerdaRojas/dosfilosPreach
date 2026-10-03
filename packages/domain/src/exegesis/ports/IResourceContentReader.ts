/**
 * Read-only port the exegesis use cases use to fetch the extracted text
 * of a library resource. Just enough surface for the current generator —
 * a thin slice of the broader library repo that lives in infrastructure.
 *
 * Defined as a domain port so use cases stay free of any direct
 * dependency on the concrete `ILibraryRepository`. The infrastructure
 * layer adapts its repository to this interface in the composition root.
 */
export interface IResourceContentReader {
    /**
     * Returns the extracted text of a library_resource, or null if the
     * resource doesn't exist or hasn't been extracted yet.
     */
    getTextContent(resourceId: string): Promise<string | null>;

    /**
     * El texto COMPLETO de un documento del corpus, desde sus fragmentos
     * indexados. `textContent` es una copia con huecos (tope de 1 MB del
     * documento de Firestore): para el texto de una fuente que se va a citar
     * o verificar, esto. Para guías y rúbricas, que son cortas y se leen en
     * cada composición, `getTextContent` alcanza y cuesta una lectura.
     *
     * Opcional: quien no lo implemente sigue con `getTextContent`
     * (`readFullText`).
     */
    getFullText?(resourceId: string): Promise<string | null>;
}

/** El texto completo si el lector sabe darlo; si no, el de siempre. */
export function readFullText(reader: IResourceContentReader, resourceId: string): Promise<string | null> {
    return reader.getFullText ? reader.getFullText(resourceId) : reader.getTextContent(resourceId);
}
