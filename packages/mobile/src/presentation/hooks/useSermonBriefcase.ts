import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { SermonRepositoryImpl } from '@/data/repositories/sermon.repository.impl';
import { AnnotationRepositoryImpl } from '@/data/repositories/annotation.repository.impl';
import {
    listBriefcase,
    readBriefcase,
    removeBriefcase,
    writeBriefcase,
    type BriefcaseEntry,
} from '@/data/offline/offlineSermons';
import { useAuthStore } from '@/presentation/state/auth.store';

const sermons = new SermonRepositoryImpl();
const annotations = new AnnotationRepositoryImpl();

export type { BriefcaseEntry };

/**
 * El maletín (M-03): offline EXPLÍCITO, no caché con suerte.
 *
 * El sermón del domingo no puede depender de que la caché de Firestore
 * "probablemente" lo tenga. "Preparar para predicar" baja el documento entero
 * —cuerpo, manifiesto de citas y marcas— y lo guarda en una copia propia.
 *
 * Desde A1 esa copia SE LEE: el atril y el detalle la usan cuando la red no
 * contesta (`loadSermon`), y la lista la muestra aunque nunca se haya visto
 * con red (`loadPublishedList`). Antes sólo pintaba el check verde.
 */
export const useBriefcase = (sermonId: string) =>
    useQuery({
        queryKey: ['briefcase', sermonId],
        queryFn: () => readBriefcase(sermonId),
        enabled: !!sermonId,
        staleTime: Infinity,
    });

/** Los ids guardados: la lista y el inicio marcan cuáles están listos. */
export const useBriefcaseIds = () => {
    const uid = useAuthStore((s) => s.user?.id);
    return useQuery({
        queryKey: ['briefcase', 'ids', uid],
        queryFn: async () => new Set((await listBriefcase(uid ?? '')).map((e) => e.sermon.id)),
        enabled: !!uid,
        staleTime: Infinity,
    });
};

export const usePrepareBriefcase = (sermonId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (): Promise<BriefcaseEntry> => {
            const sermon = await sermons.getSermonById(sermonId);
            if (!sermon) throw new Error('sermon-not-found');
            // Las marcas se piden aunque no se guarden en la copia: el pedido
            // fuerza a la caché del SDK a traerlas ahora, con red, en vez de
            // el domingo sin ella.
            await annotations.list(sermonId).catch(() => []);
            const entry: BriefcaseEntry = { sermon, savedAt: new Date().toISOString() };
            await writeBriefcase(entry);
            return entry;
        },
        onSuccess: (entry) => {
            queryClient.setQueryData(['briefcase', sermonId], entry);
            queryClient.invalidateQueries({ queryKey: ['briefcase', 'ids'] });
        },
    });
};

export const useRemoveBriefcase = (sermonId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => removeBriefcase(sermonId),
        onSuccess: () => {
            queryClient.setQueryData(['briefcase', sermonId], null);
            queryClient.invalidateQueries({ queryKey: ['briefcase', 'ids'] });
        },
    });
};
