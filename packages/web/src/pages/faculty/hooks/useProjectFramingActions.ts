import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { consolidateIdea, type AIProject, type NewHypothesisEntry } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import type { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';
import type { FramingSave } from '../components/project/ProjectFramingForm';
import type { ConsolidateInput } from '../components/project/ProjectFramingConsolidateDialog';

type UpdateProject = ReturnType<typeof useFacultyProjects>['updateProject'];

/**
 * Lo mínimo que el diálogo del encuadre necesita para escribir: la mutación
 * de `useFacultyProjects` lo cumple, y las pruebas pasan solo `mutateAsync`.
 */
export interface FramingWriter {
    mutateAsync: (v: { projectId: string } & FramingSave) => Promise<unknown>;
    isPending?: boolean;
}

/**
 * Guardar el encuadre: UNA escritura con sus campos (`framingPatch`) y sus
 * libros. Avisa y relanza el error para que el diálogo quede abierto.
 */
function useSaveFraming(project: Pick<AIProject, 'id'> | null | undefined, writer: FramingWriter) {
    const { t } = useTranslation('projects');
    return useCallback(async ({ framingPatch, bibleBooks }: FramingSave): Promise<boolean> => {
        if (!project) return false;
        try {
            await writer.mutateAsync({ projectId: project.id, framingPatch, bibleBooks });
            toast.success(t('framing.dialog.saved'));
            return true;
        } catch (err) {
            console.error('[projects] save framing failed:', err);
            toast.error(t('framing.dialog.saveFailed'));
            throw err;
        }
    }, [project, writer, t]);
}

/**
 * El diálogo del encuadre abierto EN EL LUGAR, fuera del panel (Requisitos
 * del estado del arte, el planificador): antes se iba al panel por la URL y
 * se perdía lo que se estaba haciendo. Devuelve las props de
 * `ProjectFramingDialog`; `onSaved` recibe lo guardado (el planificador
 * toma de ahí el ritmo nuevo).
 */
export function useFramingDialogInPlace({ project, updateProject, onSaved }: {
    project: Pick<AIProject, 'id'> | null | undefined;
    updateProject: FramingWriter;
    onSaved?: (save: FramingSave) => void;
}) {
    const [open, setOpen] = useState(false);
    const guardar = useSaveFraming(project, updateProject);
    const onSave = async (save: FramingSave) => {
        if (await guardar(save)) {
            setOpen(false);
            onSaved?.(save);
        }
    };
    return { open, onOpenChange: setOpen, onSave, saving: !!updateProject?.isPending };
}

/**
 * El encuadre del panel del proyecto: abrir el diálogo (también con
 * `?encuadre=1`, de enlaces viejos o guardados), guardarlo, anotar en el
 * registro y revisar la idea central. Cada acción avisa con un toast y
 * relanza el error para que su diálogo quede abierto.
 */
export function useProjectFramingActions({ projectId, projects, project, updateProject }: {
    projectId: string | undefined;
    projects: ReadonlyArray<Pick<AIProject, 'id' | 'type'>> | undefined;
    project: AIProject | undefined;
    updateProject: UpdateProject;
}) {
    const { t } = useTranslation('projects');
    const [framingOpen, setFramingOpen] = useState(false);

    // Abre el diálogo una vez y limpia la dirección. `volver` ya no se usa
    // (Requisitos abre el encuadre en el lugar), pero un enlace guardado
    // puede traerlo: se borra igual.
    const [searchParams, setSearchParams] = useSearchParams();
    const pideEncuadre = searchParams.get('encuadre') === '1';
    useEffect(() => {
        if (!pideEncuadre || !projects) return;
        if (projects.some(p => p.id === projectId && p.type === 'exegetical')) setFramingOpen(true);
        const resto = new URLSearchParams(searchParams);
        resto.delete('encuadre');
        resto.delete('volver');
        setSearchParams(resto, { replace: true });
    }, [pideEncuadre, projects, projectId, searchParams, setSearchParams]);

    const guardar = useSaveFraming(project, updateProject);
    const guardarEncuadre = async (save: FramingSave) => {
        if (await guardar(save)) setFramingOpen(false);
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
