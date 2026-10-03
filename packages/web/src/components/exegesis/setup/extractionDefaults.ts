import {
    deriveCitationKeyFromAuthor,
    sourceForResource,
    type LibraryResource,
    type ProjectSource,
    type SourceRole,
    type SourceType,
} from '@dosfilos/domain';
import { defaultSourceTypeFor } from './tipoAcademico';

/** Lo que el diálogo «Extraer de mi biblioteca» manda por cada libro elegido. */
export interface SelectionEntry {
    sourceType: SourceType;
    displayLabel: string;
    citationKey: string;
    /** `null`: el rol lo deduce el tipo. */
    chosenRole: SourceRole | null;
}

/**
 * Con qué arranca la fila de un libro en el diálogo de extracción.
 *
 * Si el libro YA está en el corpus, con lo suyo: tipo, rol, nombre y clave.
 * Antes el tipo salía de la biblioteca y el rol arrancaba vacío: la fila
 * mostraba datos que no eran los de la fuente (McComiskey: expositivo · ancla
 * en el corpus; crítico · «Según el tipo» en el diálogo, Jonás 4:5-11) y al
 * extraer el tipo se pisaba. La clave importa igual: derivarla del autor
 * pisaría una escrita a mano («BDF» → «Blass»).
 */
export function initialSelectionFor(
    resource: LibraryResource,
    sources: ReadonlyArray<ProjectSource>,
): SelectionEntry {
    const existente = sourceForResource(sources, resource.id);
    if (existente) {
        return {
            sourceType: existente.sourceType,
            displayLabel: existente.displayLabel,
            citationKey: existente.citationKey ?? deriveCitationKeyFromAuthor(resource.author),
            chosenRole: existente.chosenRole ?? null,
        };
    }
    return {
        // El tipo cacheado de una extracción anterior gana sobre el mapeo
        // grueso: el usuario clasifica BDAG una vez y queda.
        sourceType: resource.exegeticalType ?? defaultSourceTypeFor(resource),
        displayLabel: resource.title,
        // La clave sale del autor desde el principio: vacía, una fuente sin
        // autor quedaba fuera de las citas sin aviso.
        citationKey: deriveCitationKeyFromAuthor(resource.author),
        chosenRole: null,
    };
}

/**
 * Los ids de biblioteca de las fuentes que cumplen `pred`. Registra el
 * backref Y el `corpusId`: las fuentes de la ruta vieja sólo tienen el
 * segundo.
 */
export function resourceIdsOf(
    sources: ReadonlyArray<ProjectSource>,
    pred: (s: ProjectSource) => boolean,
): Set<string> {
    const ids = new Set<string>();
    for (const s of sources) {
        if (!pred(s)) continue;
        if (s.sourceLibraryResourceId) ids.add(s.sourceLibraryResourceId);
        if (s.corpusId) ids.add(s.corpusId);
    }
    return ids;
}
