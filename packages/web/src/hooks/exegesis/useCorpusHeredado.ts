import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { exegesisService } from '@dosfilos/application';
import { useFirebase } from '@/context/firebase-context';

/**
 * El corpus que este trabajo puede heredar de sus hermanos de serie.
 *
 * Vive aparte de `useExegesisPapers` porque se consulta en un solo lugar —el
 * paso del corpus— y porque la consulta necesita el `paperId`, que aquel hook
 * no tiene.
 */
export function useCorpusHeredado(paperId: string | null | undefined) {
    const { user } = useFirebase();
    const queryClient = useQueryClient();

    const propuesta = useQuery({
        queryKey: ['exegesis', 'corpusHeredado', user?.uid, paperId],
        queryFn: async () => {
            if (!user?.uid || !paperId) return null;
            return exegesisService.inheritCorpus.proponer(user.uid, paperId);
        },
        enabled: !!user?.uid && !!paperId,
        // La propuesta sale de leer todos los trabajos del usuario. No cambia
        // mientras se mira la pantalla, así que no se revalida al enfocar.
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const heredar = useMutation({
        mutationFn: async (soloEstos?: ReadonlyArray<string>) => {
            if (!user?.uid || !paperId) throw new Error('User not authenticated');
            return exegesisService.inheritCorpus.aplicar({ ownerId: user.uid, paperId, soloEstos });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'corpusHeredado', user?.uid, paperId] });
        },
    });

    return { propuesta, heredar };
}
