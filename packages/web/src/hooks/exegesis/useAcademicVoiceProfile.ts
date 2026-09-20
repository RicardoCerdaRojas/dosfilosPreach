import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { exegesisService } from '@dosfilos/application';
import { useFirebase } from '@/context/firebase-context';

const KEY = 'exegesis-academic-voice';

/** Qué texto propio enseña cómo escribe el autor. Uno por persona. */
export function useAcademicVoiceProfile() {
    const { user } = useFirebase();
    const query = useQuery({
        queryKey: [KEY, user?.uid],
        queryFn: () => exegesisService.academicVoiceProfile.getProfile(user!.uid),
        enabled: !!user?.uid,
        staleTime: 5 * 60 * 1000,
    });
    return { profile: query.data ?? null, isLoading: query.isLoading };
}

export function useSetUseSermons() {
    const { user } = useFirebase();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (useSermons: boolean) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.academicVoiceProfile.setUseSermons(user.uid, useSermons);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [KEY, user?.uid] });
        },
    });
}

export function useSetAcademicVoiceResource() {
    const { user } = useFirebase();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { resourceId: string | null; resourceTitle?: string }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.academicVoiceProfile.setResource(user.uid, input.resourceId, input.resourceTitle);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [KEY, user?.uid] });
        },
    });
}
