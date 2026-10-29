import type { PaperCover } from '../exegesis/entities/ExegeticalPaper';
import type { BibliographySearchLogEntry, ProjectBibliographyCriteria, ProjectBibliographyEntry } from '../exegesis/services/projectBibliography';
import type { ProjectFraming } from '../exegesis/services/projectFraming';
import type { CourseScheduleEntry, CourseScheduleMode, FeedbackPattern } from '../exegesis/services/courseSchedule';
import { SOURCE_TYPE_CATALOG, type SourceType } from '../exegesis/entities/SourceType';

export type ProjectColor = 'amber' | 'emerald' | 'sky' | 'rose' | 'violet' | 'slate' | 'orange' | 'teal';

/**
 * The kind of ministerial work this project represents. Drives the workspace's
 * roadmap (the guided sequence of phases shown to the pastor) and the default
 * suggestions for tutors, sources, and outputs. `general` is the catch-all
 * for free-form projects without a prescribed flow.
 */
export type ProjectType = 'sermon' | 'series' | 'counseling' | 'study' | 'general' | 'course' | 'exegetical';

/**
 * Los tipos que se ofrecen al crear un proyecto (ADR-046, decisión del
 * fundador 2026-10-22). «Sermón» y «Serie» ya no: esos casos van al
 * planificador; los proyectos que ya los tienen los conservan. `study` se
 * muestra como «Investigación».
 */
export const CREATABLE_PROJECT_TYPES: ReadonlyArray<ProjectType> = ['course', 'study', 'exegetical', 'counseling', 'general'];

export interface AIProject {
    id: string;
    userId: string;
    title: string;
    color: ProjectColor;
    type?: ProjectType;
    icon?: string;
    /**
     * Short context injected by the orchestrator into every session within this project.
     * Example: "Serie sobre Romanos 1-8, congregación reformada de 80 personas, nivel teológico medio."
     */
    contextNote?: string;
    /**
     * IDs of library_resources the user has attached to this project as its
     * dedicated source set. When present, RAG retrieval inside the project's
     * sessions is scoped to these resources (NotebookLM-style).
     *
     * Empty / undefined → sessions fall back to the user's full personal library
     * (backwards-compatible behavior).
     */
    sourceIds?: string[];
    createdAt: Date;
    updatedAt: Date;
    /**
     * When set, the project is archived: hidden from the active projects list
     * and from dashboard "Proyectos activos", but still accessible via the
     * "Archivados" filter and direct URL. Null/undefined = active.
     */
    archivedAt?: Date;
    /**
     * Soft-delete marker. When set, the project lives in the user's "Papelera"
     * tab — recoverable via Restore. Permanent deletion (hard delete) only
     * happens when the user explicitly empties trash. Sessions, sermons, and
     * language sessions linked via `projectId` keep their links intact.
     */
    deletedAt?: Date;
    /**
     * Lo común a todos los trabajos del proyecto (ADR-046, etapa 1b): el
     * nombre del curso y, si la hay, la guía de estilo del curso.
     */
    courseInfo?: ProjectCourseInfo | null;
    /**
     * Los tipos de trabajo del proyecto: un curso pide TP semanales, un
     * ensayo y un paper final, cada uno con su rúbrica, encuadre y guía, y
     * todos comparten la bibliografía. Cada estudio nace como uno de ellos.
     */
    workTypes?: ProjectWorkType[];
    /**
     * La bibliografía del proyecto: el estado del arte (etapa 2). Las fichas
     * aprobadas que están en la biblioteca se copian a `sourceIds`, que
     * siguen acotando las conversaciones. Ausente: se lee de `sourceIds`.
     */
    bibliography?: ProjectBibliographyEntry[];
    /** Los criterios de la bibliografía: requisitos, inclusión, exclusión. */
    bibliographyCriteria?: ProjectBibliographyCriteria | null;
    /** Las búsquedas e importaciones hechas, con fecha y resultado (etapa 2b). */
    bibliographySearchLog?: BibliographySearchLogEntry[];
    /**
     * El encuadre: pasaje, lectura del libro, propósito y ritmo
     * (`docs/FASE_ENCUADRE_SERIE_2026-10.md`). Se escribe por campo con
     * rutas con punto, así el formulario no pisa el registro ni la revisión.
     * Los libros NO van aquí: viven en `bibliographyCriteria.bibleBooks`.
     */
    framing?: ProjectFraming;
    /**
     * Curso: el calendario de entregas, con lo entregado y la devolución del
     * profesor de cada una (`docs/FASE_ESCRITORIO_PROYECTO_2026-10.md` §9.1).
     */
    courseSchedule?: CourseScheduleEntry[];
    /** Curso: con calendario, o semana a semana sin calendario. */
    courseScheduleMode?: CourseScheduleMode | null;
    /** Curso: los patrones de corrección del profesor y qué se decidió con cada uno. */
    feedbackPatterns?: FeedbackPattern[];
    /**
     * @deprecated Etapa 1: un solo encargo por proyecto. Ya no se escribe;
     * se lee como datos del curso y un tipo de trabajo, para no perder uno
     * guardado antes de la etapa 1b (en producción no había ninguno).
     */
    charge?: ProjectCharge | null;
}

/**
 * Lo que hereda un estudio al nacer de un proyecto: los datos del curso más
 * los del tipo de trabajo elegido. Mismos campos que el perfil de trabajo,
 * que sigue siendo la plantilla de la que se copia.
 */
export interface ProjectCharge {
    /** El perfil del que se copió, para mostrarlo. No se sigue en vivo. */
    workProfileId?: string | null;
    course?: string | null;
    rubricTemplateId?: string | null;
    briefTemplateId?: string | null;
    styleGuideId?: string | null;
    exegeticalStrategy?: 'free' | 'dialectical';
    /** El método del trabajo (capa 3). */
    exegeticalMethod?: import('../exegesis/entities/ExegeticalPaper').ExegeticalMethod | null;
    cover?: PaperCover | null;
}

/** Los datos del curso: valen para todos sus trabajos. */
export interface ProjectCourseInfo {
    course?: string | null;
    /** La guía del curso. La de un tipo de trabajo, si la tiene, gana. */
    styleGuideId?: string | null;
}

/**
 * Un tipo de trabajo del proyecto: «TP semanal», «Paper final». En la
 * rúbrica, tres estados como en el perfil: ausente (la plantilla por defecto
 * del usuario), `null` (la del sistema) o una plantilla.
 */
export interface ProjectWorkType extends Omit<ProjectCharge, 'course'> {
    id: string;
    label: string;
    /**
     * «El curso no da rúbrica»: el estudiante confirmó que el tipo se evalúa
     * con la del sistema o con su plantilla por defecto. Sin esta marca, una
     * rúbrica que no es del profesor deja la fase 1 del Curso en curso. Solo
     * se guarda `true`.
     */
    rubricConfirmed?: boolean;
    /**
     * Qué tipos de fuente NO se repiten entre dos entregas seguidas de este
     * tipo de trabajo. En NT785 el profesor prohíbe repetir los comentarios
     * del TP anterior; las gramáticas y el texto base sí se repiten (TP #9,
     * B11). Ausente: el curso no lo dijo y rige la regla general; `[]`: todo
     * se puede repetir.
     */
    noRepeatSourceTypes?: SourceType[];
}

/** Sin campos `undefined` (Firestore los rechaza también anidados) y sin texto vacío. */
function limpio<T extends object>(obj: T): T {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v === undefined) continue;
        if (typeof v === 'string' && !v.trim()) { out[k] = null; continue; }
        out[k] = typeof v === 'string' ? v.trim() : v;
    }
    return out as T;
}

export function cleanProjectCourseInfo(info: ProjectCourseInfo): ProjectCourseInfo {
    return limpio({ course: info.course, styleGuideId: info.styleGuideId });
}

/** Los tipos listos para guardar: con id único y con nombre. */
export function cleanProjectWorkTypes(types: ReadonlyArray<ProjectWorkType>): ProjectWorkType[] {
    const vistos = new Set<string>();
    const out: ProjectWorkType[] = [];
    for (const t of types) {
        const label = t.label?.trim();
        if (!t.id || !label || vistos.has(t.id)) continue;
        vistos.add(t.id);
        // `rubricConfirmed` solo como `true`: un `false` o basura no dice nada.
        const { rubricConfirmed, noRepeatSourceTypes, ...resto } = t;
        const noRepetir = cleanNoRepeatSourceTypes(noRepeatSourceTypes);
        out.push({
            ...limpio(resto), id: t.id, label,
            ...(rubricConfirmed === true ? { rubricConfirmed: true } : {}),
            ...(noRepetir ? { noRepeatSourceTypes: noRepetir } : {}),
        });
    }
    return out;
}

/**
 * Los tipos que no se repiten, listos para guardar: solo tipos del catálogo,
 * sin repetir. `null` si no hay lista (ausente o basura): «el curso no lo
 * dijo» no se convierte en «todo se repite».
 */
export function cleanNoRepeatSourceTypes(value: unknown): SourceType[] | null {
    if (!Array.isArray(value)) return null;
    return [...new Set(value.filter((x): x is SourceType => typeof x === 'string' && x in SOURCE_TYPE_CATALOG))];
}

/** Los datos del curso, o los del encargo de la etapa 1 si no se guardaron aparte. */
export function projectCourseInfo(project: Pick<AIProject, 'courseInfo' | 'charge'> | null | undefined): ProjectCourseInfo | null {
    if (!project) return null;
    if (project.courseInfo !== undefined) return project.courseInfo;
    return project.charge?.course?.trim() ? { course: project.charge.course } : null;
}

/** El id con que se lee el encargo de la etapa 1 como tipo de trabajo. */
export const LEGACY_WORK_TYPE_ID = 'encargo';

/** Los tipos de trabajo, o el encargo de la etapa 1 como único tipo si no se guardaron. */
export function projectWorkTypes(project: Pick<AIProject, 'workTypes' | 'charge'> | null | undefined): ProjectWorkType[] {
    if (!project) return [];
    if (Array.isArray(project.workTypes)) return project.workTypes.filter(t => !!t?.id);
    const c = project.charge;
    if (!c || !(c.rubricTemplateId !== undefined || c.briefTemplateId || c.styleGuideId || c.cover || c.exegeticalStrategy)) return [];
    const { course: _curso, ...resto } = c;
    return [{ ...resto, id: LEGACY_WORK_TYPE_ID, label: c.course?.trim() || 'Encargo' }];
}

/** El tipo que se elige solo: el único que hay. Con dos o más, decide quien crea. */
export function defaultWorkTypeId(project: Pick<AIProject, 'workTypes' | 'charge'> | null | undefined): string | null {
    const tipos = projectWorkTypes(project);
    return tipos.length === 1 ? tipos[0]!.id : null;
}

/**
 * Lo que hereda un estudio que nace del proyecto como el tipo `workTypeId`
 * (`null`: solo los datos del curso). La guía del tipo gana sobre la del
 * curso. `null` si no hay nada que heredar: sin tipo, el nombre del curso
 * solo no cambia nada del estudio y no debe desplazar al perfil por defecto.
 */
export function resolveProjectCharge(
    project: Pick<AIProject, 'courseInfo' | 'workTypes' | 'charge'> | null | undefined,
    workTypeId: string | null,
): ProjectCharge | null {
    const curso = projectCourseInfo(project);
    const tipo = workTypeId ? projectWorkTypes(project).find(t => t.id === workTypeId) ?? null : null;
    const out: ProjectCharge = {};
    if (tipo) {
        // `rubricConfirmed` es del escritorio del curso y la regla de no
        // repetir la lee el corpus: ninguna de las dos es del estudio al nacer.
        const { id: _id, label: _label, rubricConfirmed: _rc, noRepeatSourceTypes: _nr, ...resto } = tipo;
        Object.assign(out, resto);
    }
    if (curso?.course?.trim()) out.course = curso.course.trim();
    const guia = tipo?.styleGuideId || curso?.styleGuideId || null;
    if (guia) out.styleGuideId = guia;
    else delete out.styleGuideId;
    if (!tipo && !guia) return null;
    return out;
}

/** Si el proyecto ya tiene algo que heredar: datos del curso o algún tipo de trabajo. */
export function hasProjectCharge(project: Pick<AIProject, 'courseInfo' | 'workTypes' | 'charge'> | null | undefined): boolean {
    const curso = projectCourseInfo(project);
    return projectWorkTypes(project).length > 0 || !!(curso?.course?.trim() || curso?.styleGuideId);
}

/** Un id nuevo para un tipo de trabajo; único dentro del proyecto basta. */
export function newWorkTypeId(): string {
    return `wt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** El tipo de trabajo que sale de un perfil: se copia, no se enlaza. */
export function workTypeFromProfile(profile: {
    id: string; displayName: string; rubricTemplateId: string | null; briefTemplateId: string | null;
    styleGuideId: string | null; exegeticalStrategy: 'free' | 'dialectical'; cover?: PaperCover | null;
    exegeticalMethod?: import('../exegesis/entities/ExegeticalPaper').ExegeticalMethod | null;
}, id: string): ProjectWorkType {
    return {
        id,
        label: profile.displayName.trim(),
        workProfileId: profile.id,
        // En un perfil, `null` es el de antes del 2026-10-07 sin plantilla, no
        // una elección: se omite y queda la plantilla por defecto.
        ...(profile.rubricTemplateId ? { rubricTemplateId: profile.rubricTemplateId } : {}),
        briefTemplateId: profile.briefTemplateId,
        styleGuideId: profile.styleGuideId,
        exegeticalStrategy: profile.exegeticalStrategy,
        ...(profile.exegeticalMethod ? { exegeticalMethod: profile.exegeticalMethod } : {}),
        cover: profile.cover ?? null,
    };
}

/**
 * Output artifact produced within a project — a persistent piece of material
 * that the minister accumulates during the project's lifecycle (notes, drafts,
 * outlines, sermon manuscripts). Stored as markdown so it round-trips cleanly
 * with the chat rendering pipeline (citations, callouts, scripture refs, etc.).
 *
 * Persisted at: `users/{userId}/projects/{projectId}/outputs/{outputId}`.
 */
export type ProjectOutputKind = 'note' | 'draft' | 'outline' | 'sermon';

export interface ProjectOutput {
    id: string;
    projectId: string;
    userId: string;
    kind: ProjectOutputKind;
    title: string;
    /** Markdown content — may contain citations, scripture refs, Hebrew/Greek. */
    content: string;
    /** Optional snapshot of the sources referenced when this output was generated. */
    sources?: import('../services/IAIGeneratorService').SourceReference[];
    /** Session that produced this output (when applicable). */
    sessionId?: string;
    createdAt: Date;
    updatedAt: Date;
}
