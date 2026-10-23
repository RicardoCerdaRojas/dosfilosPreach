import { useCallback } from 'react';
import { applyLibrarySelection, newBibliographyEntryId, projectBibliography, type AIProject } from '@dosfilos/domain';
import { useLibrary } from '@/hooks/library';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';

/**
 * Guardar el selector de fuentes del proyecto (etapa 2). Pasa por la
 * bibliografía: lo marcado queda aprobado y lo desmarcado vuelve a
 * candidata. Así el selector y el estado del arte no se contradicen, y
 * `sourceIds` sale de la bibliografía como en la página del estado del arte.
 */
export function useSaveProjectSources(project: AIProject | undefined) {
    const { resources } = useLibrary();
    const { updateProject } = useFacultyProjects();
    const save = useCallback(async (ids: string[]) => {
        if (!project) throw new Error('No project');
        const lookup = (id: string) => {
            const r = resources.find(x => x.id === id);
            return r ? { title: r.title, author: r.author ?? null, exegeticalType: r.exegeticalType ?? null } : null;
        };
        const bibliography = applyLibrarySelection(projectBibliography(project, lookup), ids, lookup, newBibliographyEntryId, new Date());
        return updateProject.mutateAsync({ projectId: project.id, bibliography });
    }, [project, resources, updateProject]);
    return { save, saving: updateProject.isPending };
}
