import { useMutation } from '@tanstack/react-query';
import { exegesisService } from '@dosfilos/application';
import { useFirebase } from '@/context/firebase-context';

/**
 * «Revisión antes de entregar», la parte con modelo (TP #8, 8b, E3). No
 * guarda nada, así que no invalida ninguna consulta.
 */
export function useReviewVerseProse() {
    const { user } = useFirebase();
    return useMutation({
        mutationFn: async (input: { paperId: string; stepId: string }) => {
            if (!user) throw new Error('No authenticated user');
            return exegesisService.reviewVerseProse.execute({ ...input, ownerId: user.uid });
        },
    });
}
