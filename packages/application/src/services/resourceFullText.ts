import { textContentIsComplete } from '@dosfilos/domain';

interface Deps {
    findResource: (id: string) => Promise<{ textContent?: string | null; characterCount?: number } | null>;
    fetchFromChunks: (id: string) => Promise<string>;
}

/**
 * El texto completo de un recurso para el corpus (E2).
 *
 * `textContent` cuando está entero; desde los fragmentos indexados sólo lo que
 * la extracción cortó por el tope de Firestore. El armado desde los fragmentos
 * pierde encabezados y repite solapamientos (`textContentIsComplete`), así que
 * usarlo siempre empeoraba los documentos chicos (revisión adversarial de E2).
 * Si el documento no está indexado o la callable falla, el guardado.
 */
export async function readResourceFullText(resourceId: string, deps: Deps): Promise<string | null> {
    const resource = await deps.findResource(resourceId);
    const guardado = resource?.textContent ?? null;
    if (textContentIsComplete(guardado, resource?.characterCount)) return guardado;
    try {
        const text = await deps.fetchFromChunks(resourceId);
        if (text.trim()) return text;
    } catch (err) {
        console.warn('[exegesis] sin texto desde los fragmentos; se usa textContent', resourceId, err);
    }
    return guardado;
}
