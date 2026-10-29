import { useState } from 'react';
import { toast } from 'sonner';
import { projectWorkTypes, type AIProject, type ExegeticalMethod } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';

/**
 * Guardar en el tipo de trabajo el método elegido al crear (TP #9, B8: el
 * «Mixto» no quedaba en «TP Semanal» y cada TP lo volvía a pedir). Se
 * ofrece cuando el método elegido no es el del tipo; viene marcado si el
 * tipo no tenía ninguno.
 */
export function useMethodToWorkType(project: AIProject | null, workTypeId: string | null, method: ExegeticalMethod | null) {
    const { updateProject } = useFacultyProjects();
    const { t } = useTranslation('exegesis');
    const tipo = project && workTypeId ? projectWorkTypes(project).find(x => x.id === workTypeId) ?? null : null;
    const [elegido, setElegido] = useState<boolean | null>(null);
    const offer = !!project && !!tipo && !!method && method !== (tipo.exegeticalMethod ?? null);
    const checked = elegido ?? !tipo?.exegeticalMethod;

    /** Después de crear: guarda el método en el tipo si se pidió. Un fallo avisa y no deshace nada. */
    const saveIfChosen = async () => {
        if (!offer || !checked || !project || !tipo || !method) return;
        const nombre = t(`method.${method}.label`);
        try {
            // Los tipos guardados, con solo el método cambiado.
            const workTypes = projectWorkTypes(project).map(x => (x.id === tipo.id ? { ...x, exegeticalMethod: method } : x));
            await updateProject?.mutateAsync({ projectId: project.id, workTypes });
            toast.success(t('method.savedToType', { type: tipo.label, method: nombre }));
        } catch (err) {
            console.error('[exegesis] no se pudo guardar el método en el tipo de trabajo:', err);
            toast.error(t('method.saveToTypeFailed', { type: tipo.label }));
        }
    };
    return { offer, checked, setChecked: setElegido, typeLabel: tipo?.label ?? '', saveIfChosen };
}
