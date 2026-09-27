import type { SourceRole } from '@dosfilos/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { exegesisService } from '@dosfilos/application';
import { useFirebase } from '@/context/firebase-context';

/**
 * v1.7 corpus-usage planning — mutation that asks the LLM planner to
 * propose `pinnedSources` for every generation step in the paper.
 *
 * Stamps `proposedAt` + `proposalCorpusSourceIds` on success, which
 * drives the stale-banner detection elsewhere. Cache invalidates the
 * paper subtree so the wizard refreshes from Firestore.
 */
export function useProposeStepCorpusAllocations() {
    const { user } = useFirebase();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: { paperId: string }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.proposeStepCorpusAllocations.execute({
                ownerId: user.uid,
                paperId: input.paperId,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });
}

/**
 * v1.7 corpus-usage planning — mutation for the manual chip
 * add/remove on a single step's pinned sources. Does NOT touch the
 * staleness signal (`proposedAt` / `proposalCorpusSourceIds`) — those
 * are owned by the planner.
 */
export function useUpdateStepCorpusAllocation() {
    const { user } = useFirebase();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: {
            paperId: string;
            stepId: string;
            pinnedSources: ReadonlyArray<string>;
            note?: string | null;
            /** Ausente conserva los roles; un mapa explícito los reemplaza. */
            pinnedSourceRoles?: Readonly<Record<string, SourceRole>>;
        }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.updateStepCorpusAllocation.execute({
                ownerId: user.uid,
                paperId: input.paperId,
                stepId: input.stepId,
                pinnedSources: input.pinnedSources,
                ...(input.note !== undefined && { note: input.note }),
                ...(input.pinnedSourceRoles !== undefined && { pinnedSourceRoles: input.pinnedSourceRoles }),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });
}
