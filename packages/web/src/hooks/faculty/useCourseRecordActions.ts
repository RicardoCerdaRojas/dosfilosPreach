import { useMutation, useQueryClient } from '@tanstack/react-query';
import { exegesisService, type PreviousWorkInput } from '@dosfilos/application';
import { useFirebase } from '@/context/firebase-context';

/**
 * Curso (`docs/FASE_ESCRITORIO_PROYECTO_2026-10.md` §9.1): las dos acciones
 * del escritorio que tocan algo más que el proyecto. El resto del calendario
 * (crear entregas, entregado, devolución, descartar un patrón) va por
 * `useFacultyProjects().updateProject` con `courseOps`.
 *
 * - `addRuleToGuide`: «Pasar a tu guía». Escribe la regla en la guía y
 *   registra la decisión del patrón. Errores con `code`
 *   (`AddRuleToStyleGuideError`) para traducirlos en la página.
 * - `importPreviousWorks`: «Traer los trabajos anteriores», sin reaplicarles
 *   el encargo. El resultado dice qué pasó con cada estudio (`linked`: tenía
 *   otro origen y quedó vinculado; la página lo avisa).
 */
export function useCourseRecordActions() {
    const { user } = useFirebase();
    const queryClient = useQueryClient();
    const invalidar = (...claves: string[][]) => {
        for (const k of claves) queryClient.invalidateQueries({ queryKey: [...k, user?.uid] });
    };

    const addRuleToGuide = useMutation({
        mutationFn: async (input: { projectId: string; patternId: string; guideId: string; ruleText: string }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.addRuleToStyleGuide.execute({ ownerId: user.uid, ...input });
        },
        onSuccess: () => invalidar(['faculty', 'projects'], ['exegesis', 'styleGuides']),
    });

    const importPreviousWorks = useMutation({
        mutationFn: async (input: { projectId: string; works: PreviousWorkInput[] }) => {
            if (!user?.uid) throw new Error('User not authenticated');
            return exegesisService.importPreviousWorks.execute({ ownerId: user.uid, ...input });
        },
        // Los estudios cambian de proyecto: la lista de estudios y la del resumen comparten el prefijo.
        onSuccess: () => invalidar(['faculty', 'projects'], ['exegesis', 'papers']),
    });

    return { addRuleToGuide, importPreviousWorks };
}
