import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { CourseOp, CourseScheduleMode, ProjectCourseInfo, ProjectWorkType } from '@dosfilos/domain';
import type { AddRuleToStyleGuideErrorCode, ImportPreviousWorksResult, PreviousWorkInput } from '@dosfilos/application';
import { useTranslation } from '@/i18n';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';
import { useCourseRecordActions } from '@/hooks/faculty/useCourseRecordActions';

/** Lo que el escritorio escribe en el proyecto fuera del calendario: los datos del curso y los tipos. */
export interface CourseProjectChange {
    courseInfo?: ProjectCourseInfo | null;
    workTypes?: ProjectWorkType[];
}

export interface AddRuleInput {
    patternId: string;
    guideId: string;
    ruleText: string;
}

/** Lo que las piezas del escritorio del Curso reciben para escribir. */
export interface CourseOpsApi {
    /** Operaciones del calendario y de los patrones, o el modo. `true` si se guardó. */
    run: (input: { ops?: CourseOp[]; mode?: CourseScheduleMode | null }, successKey?: string) => Promise<boolean>;
    /** Los datos del curso o los tipos de trabajo (como el formulario de tipos). */
    saveProject: (change: CourseProjectChange, successKey?: string) => Promise<boolean>;
    /** «Pasar a tu guía»: escribe la regla y registra la decisión. */
    addRule: (input: AddRuleInput) => Promise<boolean>;
    /** «Traer los trabajos anteriores». `null` si falló o había otra escritura en curso. */
    importWorks: (works: PreviousWorkInput[]) => Promise<ImportPreviousWorksResult | null>;
    /** Hay una escritura del curso en curso: los botones que escriben esperan. */
    pending: boolean;
}

/**
 * Todas las escrituras del escritorio del Curso pasan por aquí y comparten
 * UN estado de espera: el calendario, la devolución, los patrones, «Pasar a
 * tu guía», los tipos y «Traer los trabajos anteriores». Dos escrituras a la
 * vez sobre el mismo proyecto se pisaban (la última releía antes de que la
 * primera terminara); con una sola en vuelo, la segunda espera su turno.
 *
 * Las operaciones del calendario las aplica el caso de uso sobre el proyecto
 * RELEÍDO. Cada escritura avisa con su propio texto, y el error no muestra
 * el `message` crudo. Devuelven `true` si se guardó: el diálogo se cierra
 * solo entonces y no se pierde lo escrito.
 */
export function useCourseOps(projectId: string): CourseOpsApi {
    const { t } = useTranslation('projectDeskCourse');
    const { updateProject } = useFacultyProjects();
    const { addRuleToGuide, importPreviousWorks } = useCourseRecordActions();
    const [enCurso, setEnCurso] = useState(false);
    // El ref, y no solo el estado: dos clics en el mismo render ven `false` en el estado.
    const enVuelo = useRef(false);

    /** Corre `fn` si no hay otra escritura en vuelo; si la hay, no hace nada (`undefined`). */
    const exclusiva = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
        if (enVuelo.current) return undefined;
        enVuelo.current = true;
        setEnCurso(true);
        try {
            return await fn();
        } finally {
            enVuelo.current = false;
            setEnCurso(false);
        }
    }, []);

    const guardar = (escribir: () => Promise<unknown>, successKey: string, log: string) =>
        exclusiva(async () => {
            try {
                await escribir();
                toast.success(t(successKey));
                return true;
            } catch (err) {
                console.error(`[projects] ${log} failed:`, err);
                toast.error(t('toast.saveFailed'));
                return false;
            }
        }).then(ok => ok ?? false);

    const run: CourseOpsApi['run'] = (input, successKey = 'toast.saved') =>
        guardar(() => updateProject.mutateAsync({
            projectId,
            ...(input.ops?.length ? { courseOps: input.ops } : {}),
            ...(input.mode !== undefined ? { courseScheduleMode: input.mode } : {}),
        }), successKey, 'course desk write');

    const saveProject: CourseOpsApi['saveProject'] = (change, successKey = 'toast.saved') =>
        guardar(() => updateProject.mutateAsync({ projectId, ...change }), successKey, 'save course data / work types');

    const addRule: CourseOpsApi['addRule'] = input =>
        exclusiva(async () => {
            try {
                const r = await addRuleToGuide.mutateAsync({ projectId, ...input });
                toast.success(t(r.added ? 'guideRule.added' : 'guideRule.already'));
                return true;
            } catch (err) {
                console.error('[projects] add rule to guide failed:', err);
                const code = errorCode(err);
                toast.error(t(code ? `guideRule.errors.${code}` : 'toast.saveFailed'));
                return false;
            }
        }).then(ok => ok ?? false);

    const importWorks: CourseOpsApi['importWorks'] = works =>
        exclusiva(async () => {
            try {
                return await importPreviousWorks.mutateAsync({ projectId, works });
            } catch (err) {
                console.error('[projects] import previous works failed:', err);
                toast.error(t('import.failed'));
                return null;
            }
        }).then(r => r ?? null);

    return {
        run, saveProject, addRule, importWorks,
        pending: enCurso || addRuleToGuide.isPending || importPreviousWorks.isPending,
    };
}

const CODIGOS: ReadonlySet<AddRuleToStyleGuideErrorCode> = new Set([
    'empty-rule', 'rule-too-long', 'project-unavailable', 'pattern-not-found', 'guide-not-found', 'guide-without-manifest', 'guide-full',
]);

/**
 * El código estable de `AddRuleToStyleGuideError`, leído por forma y no con
 * `instanceof`: importar la clase arrastraría todos los servicios de la capa
 * de aplicación al escritorio.
 */
function errorCode(err: unknown): AddRuleToStyleGuideErrorCode | null {
    const code = (err as { code?: unknown } | null)?.code;
    return typeof code === 'string' && CODIGOS.has(code as AddRuleToStyleGuideErrorCode) ? code as AddRuleToStyleGuideErrorCode : null;
}
