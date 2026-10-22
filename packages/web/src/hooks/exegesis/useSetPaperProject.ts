import { useMutation, useQueryClient } from '@tanstack/react-query';
import { exegesisService, type PaperProjectChange } from '@dosfilos/application';
import { useFirebase } from '@/context/firebase-context';

/** El proyecto de origen y los vínculos de un estudio (ADR-046). */
export function useSetPaperProject() {
    const { user } = useFirebase();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ paperId, change }: { paperId: string; change: PaperProjectChange }) => {
            if (!user) throw new Error('No authenticated user');
            return exegesisService.setPaperProject.execute({ ownerId: user.uid, paperId, change });
        },
        // La lista y el trabajo abierto comparten el prefijo de la clave.
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] }),
    });
}
