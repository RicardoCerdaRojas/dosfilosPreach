import type { IPageNumberingReader, PageNumbering, ProjectSource } from '@dosfilos/domain';

/**
 * Numeración impresa de cada fuente de un trabajo, resuelta en paralelo.
 *
 * Se pide una vez por paso y no una vez por fragmento: el lector cachea por
 * recurso, pero pedirlo dentro del bucle ataría el armado del corpus a una
 * consulta por ancla.
 *
 * Vive fuera de los casos de uso porque la necesitan varios —el analizador
 * canónico, el generador de pasos del asistente y el compositor— y la regla
 * que importa es la misma en los tres: una fuente cuya numeración no se pueda
 * leer queda en `null`, y sus anclas dicen «hoja N». Duplicarla en cada uno
 * fue exactamente cómo la conversión terminó cableada en un solo camino de
 * tres.
 */
export async function loadSourceNumberings(
    reader: IPageNumberingReader | undefined,
    sources: ReadonlyArray<ProjectSource>,
): Promise<Map<string, PageNumbering | null>> {
    if (!reader) return new Map();
    const entries = await Promise.all(sources.map(async source => {
        const resourceId = source.sourceLibraryResourceId ?? source.corpusId;
        try {
            return [source.id, await reader.numberingFor(resourceId)] as const;
        } catch (err) {
            // Una numeración ilegible no puede tumbar la generación: se sigue
            // con anclas de hoja, que es como venía funcionando.
            console.warn('[sourceNumberings] sin numeración para', resourceId, err);
            return [source.id, null] as const;
        }
    }));
    return new Map(entries);
}
