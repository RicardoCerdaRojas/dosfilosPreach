import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { facultyService } from '@dosfilos/application';
import { useFirebase } from '@/context/firebase-context';
import type { ProjectOutput, ProjectOutputKind, SourceReference } from '@dosfilos/domain';
import {
    removeFromCachedLists,
    restoreCaches,
} from '@/hooks/optimisticListCache';

/**
 * Hook for the project workspace — outputs (notes / drafts / outlines / sermons)
 * and the attached-sources set on the project. Used by the ProjectDashboard.
 */
export function useProjectWorkspace(projectId: string | undefined) {
    const { user } = useFirebase();
    const queryClient = useQueryClient();

    const outputsKey = ['faculty', 'projects', projectId, 'outputs', user?.uid];

    const outputsQuery = useQuery({
        queryKey: outputsKey,
        queryFn: async (): Promise<ProjectOutput[]> => {
            if (!user?.uid || !projectId) return [];
            return facultyService.listOutputs.execute(user.uid, projectId);
        },
        enabled: !!user?.uid && !!projectId,
    });

    const createOutput = useMutation({
        mutationFn: async (input: {
            kind: ProjectOutputKind;
            title: string;
            content: string;
            sources?: SourceReference[];
            sessionId?: string;
        }) => {
            if (!user?.uid || !projectId) throw new Error('No project or user');
            return facultyService.createOutput.execute({
                userId: user.uid,
                projectId,
                ...input,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: outputsKey });
        },
    });

    const updateOutput = useMutation({
        mutationFn: async (input: {
            outputId: string;
            title?: string;
            content?: string;
            kind?: ProjectOutputKind;
        }) => {
            if (!user?.uid || !projectId) throw new Error('No project or user');
            return facultyService.updateOutput.execute({
                userId: user.uid,
                projectId,
                ...input,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: outputsKey });
        },
    });

    const deleteOutput = useMutation({
        mutationFn: async (outputId: string) => {
            if (!user?.uid || !projectId) throw new Error('No project or user');
            return facultyService.deleteOutput.execute(user.uid, projectId, outputId);
        },
        // El diálogo se queda abierto mientras el servidor contesta, con
        // el botón inerte: se lee como pantalla trabada. Sacando la fila
        // acá, cerrar el diálogo y ver desaparecer el elemento ocurren
        // en el mismo gesto.
        onMutate: (outputId: string) => ({
            snapshots: removeFromCachedLists<{ id: string }>(
                queryClient,
                outputsKey,
                output => output.id === outputId,
            ),
        }),
        onError: (_err, _vars, context) => {
            if (context?.snapshots) restoreCaches(queryClient, context.snapshots);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: outputsKey });
        },
    });

    return {
        outputs: outputsQuery.data ?? [],
        isLoadingOutputs: outputsQuery.isLoading,
        createOutput,
        updateOutput,
        deleteOutput,
    };
}
