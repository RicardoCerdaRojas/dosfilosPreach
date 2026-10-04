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

const PUBLISHED_ALL_KEY = ['sermons', 'published-all'] as const;

/** Todos los publicados, sin agrupar ni deduplicar: lo que pide el plan. */
async function fetchAllPublished(): Promise<SermonSummary[]> {
    // Sin red, la última lista vista más lo guardado en el maletín (A1): el
    // inicio ya no dice «no tienes sermones» por falta de WiFi.
    const uid = useAuthStore.getState().user?.id ?? '';
    const { summaries, origin } = await loadPublishedList({
        fetchLive: () => repository.getPublishedSummaries(),
        readSnapshot: () => readListSnapshot(uid),
        writeSnapshot: (list) => writeListSnapshot(uid, list),
        listBriefcase: () => listBriefcase(uid),
        deadlineMs: LIST_DEADLINE_MS,
    });
    setOffline(origin !== 'live');
    return summaries;
}

/**
 * Los publicados tal como llegan, con TODAS las copias. El plan resuelve sus
 * perícopas contra esta lista y no contra la agrupada: la agrupación ya
 * descartó copias y el plan elegía mal (revisión adversarial de A6).
 */
export const usePublishedSummaries = () =>
    // Un reintento: cada intento ya espera hasta LIST_DEADLINE_MS, y sin
    // nada guardado tres intentos dejaban el esqueleto casi medio minuto.
    useQuery({ queryKey: PUBLISHED_ALL_KEY, queryFn: fetchAllPublished, retry: 1 });

/**
 * Lista de predicación: sermones PUBLICADOS agrupados por serie (plan §8, F1).
 * Grupos ordenados por su sermón más reciente; los sueltos al final.
 */
export const usePublishedSermons = () => {
    const queryClient = useQueryClient();
    return useQuery({
        queryKey: ['sermons', 'published-groups'],
        queryFn: async (): Promise<SermonListGroup[]> => {
            // Misma consulta de base que el plan: una sola llamada a la red.
            // `staleTime: 0`: refrescar la lista (deslizar hacia abajo) tiene
            // que ir a la red, no devolver la base cacheada.
            const all = await queryClient.fetchQuery({
                queryKey: PUBLISHED_ALL_KEY,
                queryFn: fetchAllPublished,
                staleTime: 0,
            });
            // Publicar varias veces crea copias, enlazadas por uno de dos
            // campos: `versionOf` lo pone "crear versión" y `sourceSermonId`
            // lo pone PUBLICAR, que copia el borrador. Acá se miraba sólo el
            // primero y el resto caía en la identidad de respaldo —que
            // funciona, pero adivina—; con el enlace explícito, adivinar queda
            // para el historial viejo que no tiene ninguno de los dos.
            //
            // Para predicar interesa sólo la más reciente de cada cadena; el
            // historial vive en la web.
            //
            // SIN RED gana el que está en el maletín: si el sermón se
            // republicó después de prepararlo, la copia nueva no está guardada
            // y el domingo el pastor no encontraba la que sí preparó
            // (revisión adversarial de A1).
            const offline = useConnectivityStore.getState().offline;
            const uid = useAuthStore.getState().user?.id ?? '';
            const saved = offline
                ? new Set((await listBriefcase(uid)).map((e) => e.sermon.id))
                : new Set<string>();
            const byChain = new Map<string, SermonSummary>();
            for (const s of all) {
                const chain =
                    s.versionOf ??
                    s.sourceSermonId ??
                    `${s.seriesId ?? ''}|${s.title}|${s.bibleReferences.join(',')}`;
                const prev = byChain.get(chain);
                const newer = (s.publishedAt?.getTime() ?? 0) > (prev?.publishedAt?.getTime() ?? 0);
                const prefer = !prev || (saved.has(s.id) !== saved.has(prev.id) ? saved.has(s.id) : newer);
                if (prefer) byChain.set(chain, s);
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

/**
 * `stable`: para el atril. Una vez cargado, el sermón NO se vuelve a pedir al
 * volver a la app: si llegaba una versión editada en la web, el texto y las
 * secciones cambiaban bajo el pastor a mitad de la predicación (revisión
 * adversarial de A2).
 */
export const useSermon = (id: string, options: { stable?: boolean } = {}) => {
    const queryClient = useQueryClient();
    // Vista previa del púlpito sin backend: en esta máquina no hay firma, así
    // que no hay login y sin login no hay Firestore. Ver previewSermon.ts.
    const isPreview = __DEV__ && id === PREVIEW_SERMON_ID;
    return useQuery({
        queryKey: ['sermon', id],
        queryFn: async () => {
            if (isPreview) return PREVIEW_SERMON;
            // De la red con plazo; si no contesta, la copia del maletín (A1).
            const uid = useAuthStore.getState().user?.id;
            const { sermon, origin } = await loadSermon(id, {
                fetchLive: (sid) => repository.getSermonWithSource(sid),
                // Sólo el maletín de quien está adentro.
                read: async (sid) => {
                    const entry = await readBriefcase(sid);
                    return entry && entry.sermon.userId === uid ? entry : null;
                },
                write: writeBriefcase,
                deadlineMs: SERMON_DEADLINE_MS,
            });
            setOffline(origin !== 'live');
            // La copia pudo renovarse: el detalle muestra su fecha.
            if (origin === 'live') void queryClient.invalidateQueries({ queryKey: ['briefcase', id] });
            return sermon;
        },
        enabled: !!id,
        ...(options.stable ? { staleTime: Infinity, refetchOnWindowFocus: false } : {}),
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
            queryClient.invalidateQueries({ queryKey: ['sermons'] });
        },
    });
};

/**
 * Suma o resta una predicación en las listas cacheadas, ya.
 *
 * El registro no espera al servidor (sin red la promesa no resuelve), así
 * que volver a pedir la lista al callable traía el dato VIEJO y lo dejaba
 * cinco minutos en caché: el sermón recién marcado seguía «sin predicar»
 * (revisión adversarial de A5).
 */
function bumpTimesPreached(queryClient: ReturnType<typeof useQueryClient>, id: string, delta: number) {
    const bump = (s: SermonSummary): SermonSummary =>
        s.id === id ? { ...s, timesPreached: Math.max(0, s.timesPreached + delta) } : s;
    queryClient.setQueryData<SermonSummary[]>(PUBLISHED_ALL_KEY, (list) => list?.map(bump));
    queryClient.setQueryData<SermonListGroup[]>(['sermons', 'published-groups'], (groups) =>
        groups?.map((g) => ({ ...g, sermons: g.sermons.map(bump) })),
    );
}

/** Registro post-predicación (F3): cierra el ciclo de vida del sermón. */
export const useAddPreachingLog = (id: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (log: PreachingLog) => repository.addPreachingLog(id, log),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sermon', id] });
            // La lista y el inicio muestran «predicado»: se actualizan en la
            // caché, no pidiéndole al servidor algo que todavía no tiene.
            bumpTimesPreached(queryClient, id, +1);
        },
    });
};

/** El «Deshacer» de un registro recién agregado (A5). */
export const useRemovePreachingLog = (id: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (log: PreachingLog) => repository.removePreachingLog(id, log),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sermon', id] });
            bumpTimesPreached(queryClient, id, -1);
        },
    });
};
