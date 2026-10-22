import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { exegesisService, type ReviewVerseProseOutput } from '@dosfilos/application';
import { useFirebase } from '@/context/firebase-context';

/**
 * «Revisión antes de entregar», la parte con modelo (TP #8, 8b, E3). No
 * guarda nada en el trabajo; el resultado queda en la caché por paso, para
 * que cerrar la tarjeta o cambiar a la vista de estudio no tire una revisión
 * pagada (revisión de 8b).
 */
export function useReviewVerseProse(paperId: string, stepId: string) {
    const { user } = useFirebase();
    const queryClient = useQueryClient();
    const key = ['exegesis', 'proseReview', user?.uid, paperId, stepId] as const;
    const cached = useQuery<ReviewVerseProseOutput | null>({
        queryKey: key,
        queryFn: () => null,
        enabled: false,
        staleTime: Infinity,
        gcTime: 60 * 60 * 1000,
    });
    const mutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error('No authenticated user');
            return exegesisService.reviewVerseProse.execute({ paperId, stepId, ownerId: user.uid });
        },
        onSuccess: (data) => queryClient.setQueryData(key, data),
    });
    return { mutateAsync: mutation.mutateAsync, isPending: mutation.isPending, data: cached.data ?? undefined };
}
