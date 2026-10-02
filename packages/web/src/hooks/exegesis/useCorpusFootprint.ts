import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { corpusFootprint, hasCuratedScope, type ProjectSource, type PageIndexEntry } from '@dosfilos/domain';
import { fetchDocumentPageIndex } from '@dosfilos/infrastructure';

/**
 * Cuánto ocupa el corpus del trabajo, contando las páginas elegidas.
 *
 * Los dos medidores —el del corpus y el del selector de páginas— sumaban sólo
 * fragmentos, y una fuente con páginas elegidas guarda las hojas, no su texto:
 * contaba cero (ver `sourceFootprintChars`). Aquí se trae el índice de cada
 * fuente con páginas para medir sus hojas. Misma clave de caché que el
 * selector, así que no se pide dos veces.
 */
export function useCorpusFootprint(
    sources: ReadonlyArray<ProjectSource>,
    excludeSourceId?: string,
): { chars: number; pending: boolean } {
    const consideradas = useMemo(
        () => sources.filter(s => s.id !== excludeSourceId),
        [sources, excludeSourceId],
    );
    const conPaginas = useMemo(() => consideradas.filter(hasCuratedScope), [consideradas]);
    const indices = useQueries({
        queries: conPaginas.map(s => {
            const resourceId = s.sourceLibraryResourceId ?? s.corpusId;
            return {
                queryKey: ['exegesis-document-page-index', resourceId],
                queryFn: () => fetchDocumentPageIndex(resourceId),
                staleTime: Infinity,
                gcTime: 30 * 60 * 1000,
                retry: 1,
            };
        }),
    });
    const listo = indices.map(q => q.data?.pages ?? null);
    const clave = listo.map(p => (p ? p.length : -1)).join(',');
    return useMemo(() => {
        const porFuente = new Map<string, ReadonlyArray<PageIndexEntry> | null>(
            conPaginas.map((s, i) => [s.id, listo[i] ?? null]),
        );
        return corpusFootprint(consideradas, porFuente);
        // `clave` resume qué índices ya llegaron; `listo` cambia de identidad en cada render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [consideradas, conPaginas, clave]);
}
