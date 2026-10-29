import { useMemo } from 'react';
import { toast } from 'sonner';
import { consolidateIdea, type AIProject, type DeskOldNote, type NewHypothesisEntry } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';
import { useProjectWorkspace } from '@/hooks/faculty/useProjectWorkspace';
import type { FramingSave } from '../../ProjectFramingForm';
import type { ConsolidateInput } from '../../ProjectFramingConsolidateDialog';

/**
 * Las escrituras de las secciones del Exegético: anotar en el registro,
 * revisar la idea central y guardar el encuadre con la nota de antes. Cada
 * una avisa con un toast y relanza el error para que su diálogo quede
 * abierto (como `useProjectFramingActions`, que sigue siendo el del panel:
 * este no abre nada por la dirección).
 */
export function useExegeticalDeskActions(project: Pick<AIProject, 'id' | 'framing'>) {
    const { t } = useTranslation('projects');
    const { updateProject } = useFacultyProjects();

    const saveFraming = async ({ framingPatch, bibleBooks }: FramingSave) => {
        try {
            await updateProject.mutateAsync({ projectId: project.id, framingPatch, bibleBooks });
            toast.success(t('framing.dialog.saved'));
        } catch (err) {
            console.error('[projects] save framing from the desk failed:', err);
            toast.error(t('framing.dialog.saveFailed'));
            throw err;
        }
    };

    const annotate = async (hypothesisEntry: NewHypothesisEntry) => {
        try {
            await updateProject.mutateAsync({ projectId: project.id, hypothesisEntry });
            toast.success(t('framing.annotate.saved'));
        } catch (err) {
            console.error('[projects] save hypothesis entry from the desk failed:', err);
            toast.error(t('framing.annotate.saveFailed'));
            throw err;
        }
    };

    /** El caso de uso fija `ofIdea` con la idea GUARDADA (`consolidateIdea`). */
    const consolidate = async (input: ConsolidateInput) => {
        try {
            await updateProject.mutateAsync({ projectId: project.id, framingPatch: consolidateIdea(project.framing, input) });
            toast.success(t('framing.consolidate.saved'));
        } catch (err) {
            console.error('[projects] consolidate idea from the desk failed:', err);
            toast.error(t('framing.consolidate.saveFailed'));
            throw err;
        }
    };

    return { saveFraming, annotate, consolidate, saving: updateProject.isPending };
}

/**
 * El texto de la nota de antes, para precargarlo en el encuadre: la nota de
 * contexto del proyecto o la nota del material (que ya está en la caché del
 * panel: misma clave de `useProjectWorkspace`, sin lectura nueva).
 */
export function useOldNoteText(
    project: Pick<AIProject, 'id' | 'contextNote'>,
    oldNote: DeskOldNote | null,
): { text: string | null; loading: boolean } {
    const { outputs, isLoadingOutputs } = useProjectWorkspace(oldNote?.source === 'output' ? project.id : undefined);
    return useMemo(() => {
        if (!oldNote) return { text: null, loading: false };
        if (oldNote.source === 'contextNote') return { text: project.contextNote?.trim() || null, loading: false };
        const nota = (outputs ?? []).find(o => o.id === oldNote.outputId);
        return { text: nota?.content?.trim() || null, loading: !nota && isLoadingOutputs };
    }, [oldNote, project.contextNote, outputs, isLoadingOutputs]);
}
