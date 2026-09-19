import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { exegesisService } from '@dosfilos/application';
import type { GlossaryTerm } from '@dosfilos/domain';
import { useFirebase } from '@/context/firebase-context';

const KEY = 'exegesis-term-glossary';

/**
 * Las palabras que este autor no usa.
 *
 * Es del usuario, no del trabajo: una palabra que no es suya no lo es en
 * ninguna entrega, y la lista sólo crece con el uso.
 */
export function useTermGlossary() {
    const { user } = useFirebase();
    const query = useQuery({
        queryKey: [KEY, user?.uid],
        queryFn: () => exegesisService.termGlossary.getGlossary(user!.uid),
        enabled: !!user?.uid,
        staleTime: 5 * 60 * 1000,
    });
    return { terms: query.data?.terms ?? [], isLoading: query.isLoading };
}

export function useSaveTermGlossary() {
    const { user } = useFirebase();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (terms: ReadonlyArray<GlossaryTerm>) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.termGlossary.saveTerms(user.uid, terms);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [KEY, user?.uid] });
        },
    });
}
