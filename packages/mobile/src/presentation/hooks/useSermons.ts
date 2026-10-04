import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Sermon, SermonListGroup, SermonSummary } from '@/domain/models/sermon.model';
import type { PreachingLog } from '@dosfilos/domain';
import { SermonRepositoryImpl } from '@/data/repositories/sermon.repository.impl';
import { PREVIEW_SERMON, PREVIEW_SERMON_ID } from '@/core/dev/previewSermon';
import {
    LIST_DEADLINE_MS,
    SERMON_DEADLINE_MS,
    listBriefcase,
    loadPublishedList,
    loadSermon,
    readBriefcase,
    readListSnapshot,
    writeBriefcase,
    writeListSnapshot,
} from '@/data/offline/offlineSermons';
import { useAuthStore } from '@/presentation/state/auth.store';
import { useConnectivityStore } from '@/presentation/state/connectivity.store';

const repository = new SermonRepositoryImpl();
const setOffline = (offline: boolean) => useConnectivityStore.getState().setOffline(offline);

const newestFirst = (a: SermonSummary, b: SermonSummary) =>
    (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);

/**
 * Lista de predicación: sermones PUBLICADOS agrupados por serie (plan §8, F1).
 * Grupos ordenados por su sermón más reciente; los sueltos al final.
 */
export const usePublishedSermons = () => {
    return useQuery({
        queryKey: ['sermons', 'published-groups'],
        queryFn: async (): Promise<SermonListGroup[]> => {
            // Sin red, la última lista vista más lo guardado en el maletín
            // (A1): el inicio ya no dice «no tienes sermones» por falta de WiFi.
            const uid = useAuthStore.getState().user?.id ?? '';
            const { summaries: all, origin } = await loadPublishedList({
                fetchLive: () => repository.getPublishedSummaries(),
                readSnapshot: () => readListSnapshot(uid),
                writeSnapshot: (list) => writeListSnapshot(uid, list),
                listBriefcase: () => listBriefcase(uid),
                deadlineMs: LIST_DEADLINE_MS,
            });
            setOffline(origin !== 'live');
            // Publicar varias veces crea copias, enlazadas por uno de dos
            // campos: `versionOf` lo pone "crear versión" y `sourceSermonId`
            // lo pone PUBLICAR, que copia el borrador. Acá se miraba sólo el
            // primero y el resto caía en la identidad de respaldo —que
            // funciona, pero adivina—; con el enlace explícito, adivinar queda
            // para el historial viejo que no tiene ninguno de los dos.
            //
            // Para predicar interesa sólo la más reciente de cada cadena; el
            // historial vive en la web.
            const byChain = new Map<string, SermonSummary>();
            for (const s of all) {
                const chain =
                    s.versionOf ??
                    s.sourceSermonId ??
                    `${s.seriesId ?? ''}|${s.title}|${s.bibleReferences.join(',')}`;
                const prev = byChain.get(chain);
                if (!prev || (s.publishedAt?.getTime() ?? 0) > (prev.publishedAt?.getTime() ?? 0)) {
                    byChain.set(chain, s);
                }
            }
            const summaries = [...byChain.values()];
            const seriesIds = summaries.map((s) => s.seriesId).filter((id): id is string => !!id);
            const titles = await repository.getSeriesTitles(seriesIds);

            const bySeries = new Map<string | null, SermonSummary[]>();
            for (const s of summaries) {
                const key = s.seriesId && titles[s.seriesId] ? s.seriesId : null;
                const bucket = bySeries.get(key) ?? [];
                bucket.push(s);
                bySeries.set(key, bucket);
            }

            const groups: SermonListGroup[] = [...bySeries.entries()].map(([seriesId, sermons]) => ({
                seriesId,
                seriesTitle: seriesId ? titles[seriesId] : null,
                sermons: sermons.sort(newestFirst),
            }));

            return groups.sort((a, b) => {
                if (a.seriesId === null) return 1;
                if (b.seriesId === null) return -1;
                return newestFirst(a.sermons[0], b.sermons[0]);
            });
        },
    });
};

export const useSermon = (id: string) => {
    // Vista previa del púlpito sin backend: en esta máquina no hay firma, así
    // que no hay login y sin login no hay Firestore. Ver previewSermon.ts.
    const isPreview = __DEV__ && id === PREVIEW_SERMON_ID;
    return useQuery({
        queryKey: ['sermon', id],
        queryFn: async () => {
            if (isPreview) return PREVIEW_SERMON;
            // De la red con plazo; si no contesta, la copia del maletín (A1).
            const { sermon, origin } = await loadSermon(id, {
                fetchLive: (sid) => repository.getSermonById(sid),
                read: readBriefcase,
                write: writeBriefcase,
                deadlineMs: SERMON_DEADLINE_MS,
            });
            setOffline(origin !== 'live');
            return sermon;
        },
        enabled: !!id,
    });
};

/**
 * Guarda los cambios del editor. Escribe la caché primero: el pastor tiene
 * que ver su texto guardado aunque la iglesia no tenga WiFi.
 */
export const useUpdateSermon = (id: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (patch: { title: string; content: string }) =>
            repository.updateSermonDraft(id, patch),
        onMutate: (patch) => {
            queryClient.setQueryData(['sermon', id], (current: Sermon | null | undefined) =>
                current ? { ...current, ...patch, updatedAt: new Date() } : current,
            );
            queryClient.invalidateQueries({ queryKey: ['sermons', 'published-groups'] });
        },
    });
};

/** Registro post-predicación (F3): cierra el ciclo de vida del sermón. */
export const useAddPreachingLog = (id: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (log: PreachingLog) => repository.addPreachingLog(id, log),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sermon', id] }),
    });
};
