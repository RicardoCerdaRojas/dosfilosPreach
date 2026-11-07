import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { corpusFootprint, pinnedSheetsInAnyStep, retrievalScopeOf, type CorpusFootprint, type ProjectSource, type PageIndexEntry, type StepSourcePlan } from '@dosfilos/domain';
import { fetchDocumentPageIndex } from '@dosfilos/infrastructure';

/**
 * Cuánto corpus llega a un versículo (ver `corpusFootprint`).
 *
 * Trae el índice de cada fuente que se consulta por versículo —con páginas,
 * con fragmentos o el documento entero— para medir lo que el recuperador
 * consulta de verdad. Misma clave de caché que el selector, así que no se pide
 * dos veces.
 */
export function useCorpusFootprint(
    sources: ReadonlyArray<ProjectSource>,
    excludeSourceId?: string,
    /** Para lo fijado solo en un paso: cuenta el paso que más trae (PR 2). */
    plan?: Pick<StepSourcePlan, 'perStep'> | null,
): CorpusFootprint {
    const consideradas = useMemo(
        () => sources.filter(s => s.id !== excludeSourceId),
        [sources, excludeSourceId],
    );
    const conPaginas = useMemo(
        () => consideradas.filter(s => retrievalScopeOf(s) !== null || pinnedSheetsInAnyStep(plan, s.id).length > 0),
        [consideradas, plan],
    );
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
        return corpusFootprint(consideradas, porFuente, plan);
        // `clave` resume qué índices ya llegaron; `listo` cambia de identidad en cada render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [consideradas, conPaginas, clave, plan]);
}
