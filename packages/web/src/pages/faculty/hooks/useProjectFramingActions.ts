import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { consolidateIdea, type AIProject, type NewHypothesisEntry } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import type { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';
import type { FramingSave } from '../components/project/ProjectFramingForm';
import type { ConsolidateInput } from '../components/project/ProjectFramingConsolidateDialog';

type UpdateProject = ReturnType<typeof useFacultyProjects>['updateProject'];

/** Adónde vuelve «Volver a Requisitos»: el estado del arte, en su paso de requisitos. */
export function requirementsUrl(projectId: string): string {
    return `/dashboard/projects/${encodeURIComponent(projectId)}/estado-del-arte?paso=requisitos`;
}

/**
 * El encuadre del panel del proyecto: abrir el diálogo (también desde
 * «Cambiar en el encuadre», que llega con `?encuadre=1&volver=requisitos`),
 * guardarlo, anotar en el registro y revisar la idea central. Cada acción
 * avisa con un toast y relanza el error para que su diálogo quede abierto.
 */
export function useProjectFramingActions({ projectId, projects, project, updateProject }: {
    projectId: string | undefined;
    projects: ReadonlyArray<Pick<AIProject, 'id' | 'type'>> | undefined;
    project: AIProject | undefined;
    updateProject: UpdateProject;
}) {
    const { t } = useTranslation('projects');
    const navigate = useNavigate();
    const [framingOpen, setFramingOpenState] = useState(false);
    /** Si se llegó desde Requisitos: al guardar se ofrece volver allí. */
    const [volverARequisitos, setVolverARequisitos] = useState(false);

    // Abre el diálogo una vez y limpia la dirección (sin `encuadre` ni `volver`).
    const [searchParams, setSearchParams] = useSearchParams();
    const pideEncuadre = searchParams.get('encuadre') === '1';
    useEffect(() => {
        if (!pideEncuadre || !projects) return;
        if (projects.some(p => p.id === projectId && p.type === 'exegetical')) {
            setFramingOpenState(true);
            setVolverARequisitos(searchParams.get('volver') === 'requisitos');
        }
        const resto = new URLSearchParams(searchParams);
        resto.delete('encuadre');
        resto.delete('volver');
        setSearchParams(resto, { replace: true });
    }, [pideEncuadre, projects, projectId, searchParams, setSearchParams]);

    const setFramingOpen = (open: boolean) => {
        setFramingOpenState(open);
        if (!open) setVolverARequisitos(false);
    };

    /** El encuadre: UNA escritura con sus campos (`framingPatch`) y sus libros. */
    const guardarEncuadre = async ({ framingPatch, bibleBooks }: FramingSave) => {
        if (!project) return;
        try {
            await updateProject.mutateAsync({ projectId: project.id, framingPatch, bibleBooks });
            const id = project.id;
            toast.success(t('framing.dialog.saved'), volverARequisitos
                ? { action: { label: t('framing.dialog.backToRequirements'), onClick: () => navigate(requirementsUrl(id)) } }
                : undefined);
            setFramingOpen(false);
        } catch (err) {
            console.error('[projects] save framing failed:', err);
            toast.error(t('framing.dialog.saveFailed'));
            throw err;
        }
    };

    /** Una anotación del registro: el repositorio la agrega con `arrayUnion`. */
    const anotarEncuadre = async (hypothesisEntry: NewHypothesisEntry) => {
        if (!project) return;
        try {
            await updateProject.mutateAsync({ projectId: project.id, hypothesisEntry });
            toast.success(t('framing.annotate.saved'));
        } catch (err) {
            console.error('[projects] save hypothesis entry failed:', err);
            toast.error(t('framing.annotate.saveFailed'));
            throw err;
        }
    };

    /** Revisar la idea central: el caso de uso fija `ofIdea` con la idea GUARDADA. */
    const consolidarEncuadre = async (input: ConsolidateInput) => {
        if (!project) return;
        try {
            await updateProject.mutateAsync({ projectId: project.id, framingPatch: consolidateIdea(project.framing, input) });
            toast.success(t('framing.consolidate.saved'));
        } catch (err) {
            console.error('[projects] consolidate idea failed:', err);
            toast.error(t('framing.consolidate.saveFailed'));
            throw err;
        }
    };

    return { framingOpen, setFramingOpen, guardarEncuadre, anotarEncuadre, consolidarEncuadre };
}
