import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { exegesisService } from '@dosfilos/application';
import type { WorkProfile } from '@dosfilos/domain';
import { useFirebase } from '@/context/firebase-context';

const KEY = 'exegesis-work-profiles';

/**
 * Los perfiles de trabajo del usuario: cómo configuró trabajos anteriores.
 *
 * Se cachea por sesión porque cambia sólo cuando el usuario guarda uno, y
 * lo lee la página de creación en cada visita.
 */
export function useWorkProfiles() {
    const { user } = useFirebase();
    const query = useQuery<WorkProfile[]>({
        queryKey: [KEY, user?.uid],
        queryFn: () => exegesisService.workProfiles.listProfiles(user!.uid),
        enabled: !!user?.uid,
        staleTime: 5 * 60 * 1000,
    });
    return {
        profiles: query.data ?? [],
        defaultProfile: (query.data ?? []).find(p => p.isDefault) ?? null,
        isLoading: query.isLoading,
    };
}

/** Guarda la configuración de un trabajo como perfil reusable. */
export function useSaveWorkProfile() {
    const { user } = useFirebase();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: {
            paperId: string;
            displayName: string;
            course?: string;
            rubricTemplateId?: string | null;
            briefTemplateId?: string | null;
            makeDefault?: boolean;
        }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.saveWorkProfileFromPaper.execute({ ownerId: user.uid, ...input });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [KEY, user?.uid] });
        },
    });
}
