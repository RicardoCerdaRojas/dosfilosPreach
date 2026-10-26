import { useState } from 'react';
import { toast } from 'sonner';
import type { CourseOp, CourseScheduleMode } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';

/**
 * La escritura del calendario y la devolución desde el escritorio: manda las
 * operaciones y el caso de uso las aplica sobre el proyecto RELEÍDO (dos
 * pestañas no se pisan a ciegas). Avisa con su propio texto, y el error no
 * muestra el `message` crudo.
 *
 * `run` devuelve `true` si se guardó: el diálogo se cierra solo entonces y
 * no se pierde lo escrito.
 */
export function useCourseOps(projectId: string) {
    const { t } = useTranslation('projectDeskCourse');
    const { updateProject } = useFacultyProjects();
    const [pending, setPending] = useState(false);

    const run = async (
        input: { ops?: CourseOp[]; mode?: CourseScheduleMode | null },
        successKey: string = 'toast.saved',
    ): Promise<boolean> => {
        setPending(true);
        try {
            await updateProject.mutateAsync({
                projectId,
                ...(input.ops?.length ? { courseOps: input.ops } : {}),
                ...(input.mode !== undefined ? { courseScheduleMode: input.mode } : {}),
            });
            toast.success(t(successKey));
            return true;
        } catch (err) {
            console.error('[projects] course desk write failed:', err);
            toast.error(t('toast.saveFailed'));
            return false;
        } finally {
            setPending(false);
        }
    };

    return { run, pending };
}
