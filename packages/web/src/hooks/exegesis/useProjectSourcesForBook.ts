import { useMemo } from 'react';
import {
    inheritableProjectEntries,
    projectSourcesForBook,
    type AddProjectSourceInput,
    type AIProject,
    type BibleBookId,
    type LibraryResourceEntity,
    type ProjectBibliographyEntry,
} from '@dosfilos/domain';
import { useLibrary } from '@/hooks/library';

interface UseProjectSourcesForBookResult {
    /** Las fuentes iniciales de un estudio de este libro, sin las desmarcadas. */
    sources: AddProjectSourceInput[];
    /** Todas las fichas heredables, también las desmarcadas: la lista para elegir. */
    entries: ProjectBibliographyEntry[];
    resourceOf: (id: string) => LibraryResourceEntity | undefined;
    /** Mientras la biblioteca carga, lo heredable todavía no se sabe. */
    isLoading: boolean;
}

/**
 * Lo que un estudio de este libro hereda del estado del arte del proyecto.
 * La regla vive en el dominio (`inheritableProjectEntries`); aquí solo se le
 * pasa la biblioteca. Lo usan el planificador y el estudio suelto, para que
 * los dos hereden lo mismo.
 */
export function useProjectSourcesForBook(
    project: AIProject | null,
    bookId: BibleBookId | null,
    excludedResourceIds: readonly string[] = [],
): UseProjectSourcesForBookResult {
    const { resources, isLoading } = useLibrary();
    const porId = useMemo(() => new Map(resources.map(r => [r.id, r])), [resources]);
    const resourceOf = useMemo(() => (id: string) => porId.get(id), [porId]);
    const entries = useMemo(() => inheritableProjectEntries(project, bookId, resourceOf), [project, bookId, resourceOf]);
    // Por contenido: la biblioteca puede llegar como un arreglo nuevo en cada
    // render, y un arreglo de fuentes nuevo con lo mismo hacía un ciclo de
    // renders en quien lo mira con un efecto.
    const fuera = JSON.stringify([...excludedResourceIds].sort());
    const clave = useMemo(
        () => JSON.stringify(projectSourcesForBook(project, bookId, resourceOf, JSON.parse(fuera) as string[])),
        [project, bookId, resourceOf, fuera],
    );
    const sources = useMemo(() => JSON.parse(clave) as AddProjectSourceInput[], [clave]);
    return { sources, entries, resourceOf, isLoading };
}
