import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { libraryService } from '@dosfilos/application';
import { useTranslation } from '@/i18n';

export interface AttachedSource {
    id: string;
    title: string;
    author: string;
    indexingStatus?: string;
    extractionVersion?: string;
}

interface UseProjectAttachedSourcesOptions {
    /** Owner of the resources — usually the authenticated user. */
    userId: string | null | undefined;
    /** IDs of library_resources currently attached to the project. */
    sourceIds: string[] | undefined;
}

interface UseProjectAttachedSourcesResult {
    sources: AttachedSource[];
    /**
     * Cargando por primera vez. Mientras tanto `sources` está vacío y NO
     * significa «sin fuentes»: el panel no debe ofrecer la fase 2 como
     * próximo paso por eso.
     */
    isLoading: boolean;
    /** El fallo de la lectura, si lo hubo (los datos en caché se conservan). */
    error: Error | null;
    /** True per source while a reprocess request is in flight. */
    reprocessing: Record<string, boolean>;
    /**
     * Procesa una fuente (solo administradores): vuelve a extraerla o la
     * re-indexa según cómo se extrajo (`libraryService.reprocessProjectSource`).
     */
    reprocessSource: (source: AttachedSource) => Promise<void>;
}

const SIN_FUENTES: AttachedSource[] = [];

/** La clave de la consulta: estable aunque `sourceIds` cambie de identidad o de orden. */
export const attachedSourcesKey = (userId: string | null | undefined, sourceIds: readonly string[] | undefined) =>
    ['library', 'byIds', userId ?? null, [...new Set((sourceIds ?? []).filter(id => !!id))].sort()] as const;

/**
 * Las fuentes de un proyecto (id, título, autor, estado de extracción e
 * indexado) y la acción de procesarlas.
 *
 * Antes leía TODA la biblioteca del usuario con Firestore directo y filtraba en
 * el navegador, con un `useEffect` sin manejar el rechazo y que volvía a leer
 * con cada guardado del proyecto (el arreglo `sourceIds` cambia de identidad
 * aunque no cambie de contenido). Ahora pide solo esos ids, con React Query y
 * una clave ordenada: el mismo conjunto de ids es la misma consulta.
 */
export function useProjectAttachedSources({
    userId,
    sourceIds,
}: UseProjectAttachedSourcesOptions): UseProjectAttachedSourcesResult {
    const { t } = useTranslation('projects');
    const queryClient = useQueryClient();
    const [reprocessing, setReprocessing] = useState<Record<string, boolean>>({});

    // La clave depende del contenido, no de la identidad del arreglo: el mismo
    // conjunto de ids (en cualquier orden) es la misma consulta.
    const queryKey = attachedSourcesKey(userId, sourceIds);
    const ids = queryKey[3];

    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<AttachedSource[]> => {
            const recursos = await libraryService.getResourcesByIds(userId!, ids);
            return recursos.map(r => ({
                id: r.id,
                title: r.title ?? '',
                author: r.author ?? '',
                indexingStatus: r.indexingStatus,
                extractionVersion: r.extractionVersion,
            }));
        },
        enabled: !!userId && ids.length > 0,
        staleTime: 60_000,
    });

    const reprocessSource = useCallback(async (source: AttachedSource) => {
        setReprocessing(prev => ({ ...prev, [source.id]: true }));
        try {
            const camino = await libraryService.reprocessProjectSource(source);
            toast.success(camino === 'reextracted'
                ? t('reprocess.successReextracted', { title: source.title })
                : t('reprocess.successReady', { title: source.title }));
            await queryClient.invalidateQueries({ queryKey: ['library', 'byIds', userId ?? null] });
        } catch (err: unknown) {
            // Solo lo ve un administrador: el mensaje del servidor le sirve
            // (sin saldo, sin cuenta de LlamaParse, permiso).
            const message = err instanceof Error ? err.message : String(err);
            console.error('[useProjectAttachedSources.reprocess]', err);
            toast.error(t('reprocess.error', { title: source.title, message }));
        } finally {
            setReprocessing(prev => {
                const { [source.id]: _, ...rest } = prev;
                return rest;
            });
        }
    }, [queryClient, userId, t]);

    // Sin ids, la consulta no corre y la lista es vacía de verdad.
    const sources = ids.length > 0 && userId ? (query.data ?? SIN_FUENTES) : SIN_FUENTES;

    return {
        sources,
        isLoading: query.isLoading,
        error: query.error ?? null,
        reprocessing,
        reprocessSource,
    };
}
