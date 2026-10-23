import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facultyService } from '@dosfilos/application';
import { useFirebase } from '@/context/firebase-context';
import { ProjectColor, DEFAULT_LANGUAGE } from '@dosfilos/domain';
import type { AIChatSession, AIProject, BibliographySearchLogEntry, ProjectBibliographyCriteria, ProjectBibliographyEntry, ProjectCourseInfo, ProjectType, ProjectWorkType, SupportedLanguage } from '@dosfilos/domain';
import { useTranslation } from 'react-i18next';
import {
    removeFromCachedLists,
    restoreCaches,
    updateInCachedLists,
} from '@/hooks/optimisticListCache';

function resolveActiveLanguage(raw: string | undefined): SupportedLanguage {
    if (!raw) return DEFAULT_LANGUAGE;
    return raw.split('-')[0] === 'en' ? 'en' : 'es';
}

export function useFacultyProjects() {
    const { user } = useFirebase();
    const queryClient = useQueryClient();
    const { i18n } = useTranslation();

    const projectsQuery = useQuery({
        queryKey: ['faculty', 'projects', user?.uid],
        queryFn: async () => {
            if (!user?.uid) throw new Error('User not authenticated');
            return facultyService.getProjects.execute(user.uid);
        },
        enabled: !!user?.uid,
    });

    const createProject = useMutation({
        // El tipo decide el recorrido del proyecto. Se elegía en el diálogo y se
        // perdía aquí: todos los proyectos quedaban «General» (etapa 0).
        mutationFn: async ({ title, color, type, contextNote }: { title: string; color: ProjectColor; type?: ProjectType; contextNote?: string }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return facultyService.createProject.execute({ userId: user.uid, title, color, type, contextNote });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['faculty', 'projects', user?.uid] }),
    });

    const updateProject = useMutation({
        mutationFn: async ({ projectId, ...updates }: { projectId: string; title?: string; color?: ProjectColor; type?: ProjectType; contextNote?: string; courseInfo?: ProjectCourseInfo | null; workTypes?: ProjectWorkType[]; bibliography?: ProjectBibliographyEntry[]; bibliographyCriteria?: ProjectBibliographyCriteria | null; bibliographySearchLog?: BibliographySearchLogEntry[] }) => {
            return facultyService.updateProject.execute(projectId, updates);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['faculty', 'projects', user?.uid] }),
    });

    const projectsKey = ['faculty', 'projects', user?.uid] as const;
    const sessionsKey = ['faculty', 'sessions', user?.uid] as const;

    const deleteProject = useMutation({
        mutationFn: async (projectId: string) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return facultyService.deleteProject.execute(user.uid, projectId);
        },
        onMutate: (projectId: string) => ({
            snapshots: removeFromCachedLists<AIProject>(
                queryClient,
                projectsKey,
                project => project.id === projectId,
            ),
        }),
        onError: (_err, _vars, context) => {
            if (context?.snapshots) restoreCaches(queryClient, context.snapshots);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: projectsKey });
            queryClient.invalidateQueries({ queryKey: sessionsKey });
        },
    });

    // Archivar y mandar a la papelera son banderas con fecha, y las
    // pestañas filtran por ellas: escribirlas por adelantado hace que la
    // tarjeta cambie de pestaña en el mismo gesto. Sin esto la tarjeta
    // se quedaba donde estaba hasta que volvía el servidor, y el aviso
    // de éxito llegaba antes que el movimiento — dos señales
    // contradictorias sobre la misma acción.
    const archiveProject = useMutation({
        mutationFn: async ({ projectId, archived }: { projectId: string; archived: boolean }) => {
            return facultyService.setProjectArchived.execute(projectId, archived);
        },
        onMutate: ({ projectId, archived }) => ({
            snapshots: updateInCachedLists<AIProject>(
                queryClient,
                projectsKey,
                project => project.id === projectId,
                project => ({ ...project, archivedAt: archived ? new Date() : undefined }),
            ),
        }),
        onError: (_err, _vars, context) => {
            if (context?.snapshots) restoreCaches(queryClient, context.snapshots);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
    });

    /**
     * Soft-delete: moves the project to the Papelera tab. Reversible via
     * `softDeleteProject.mutate({ projectId, deleted: false })`.
     */
    const softDeleteProject = useMutation({
        mutationFn: async ({ projectId, deleted }: { projectId: string; deleted: boolean }) => {
            return facultyService.setProjectDeleted.execute(projectId, deleted);
        },
        onMutate: ({ projectId, deleted }) => ({
            snapshots: updateInCachedLists<AIProject>(
                queryClient,
                projectsKey,
                project => project.id === projectId,
                project => ({ ...project, deletedAt: deleted ? new Date() : undefined }),
            ),
        }),
        onError: (_err, _vars, context) => {
            if (context?.snapshots) restoreCaches(queryClient, context.snapshots);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
    });

    const assignToProject = useMutation({
        mutationFn: async ({ sessionId, projectId }: { sessionId: string; projectId: string | null }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return facultyService.updateSessionProject.execute(user.uid, sessionId, projectId);
        },
        // La sesión salta de grupo en el riel al elegir el proyecto: es
        // el único acuse que tiene esa acción, que no muestra aviso.
        onMutate: ({ sessionId, projectId }) => ({
            snapshots: updateInCachedLists<AIChatSession>(
                queryClient,
                sessionsKey,
                session => session.id === sessionId,
                session => ({ ...session, projectId: projectId ?? undefined }),
            ),
        }),
        onError: (_err, _vars, context) => {
            if (context?.snapshots) restoreCaches(queryClient, context.snapshots);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: sessionsKey }),
    });

    const generateContext = useMutation({
        mutationFn: async (projectId: string) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return facultyService.generateProjectContext.execute(
                user.uid, projectId, resolveActiveLanguage(i18n.language),
            );
        },
    });

    return {
        projects: projectsQuery.data || [],
        isLoadingProjects: projectsQuery.isLoading,
        createProject,
        updateProject,
        deleteProject,
        archiveProject,
        softDeleteProject,
        assignToProject,
        generateContext,
    };
}
