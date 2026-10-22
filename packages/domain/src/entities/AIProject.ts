import type { PaperCover } from '../exegesis/entities/ExegeticalPaper';

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
     * El encargo del proyecto (ADR-046): lo que hoy guarda un perfil de
     * trabajo, pero viviendo en el curso. Cada estudio que nace del
     * proyecto lo hereda como valores iniciales que el estudiante revisa.
     */
    charge?: ProjectCharge | null;
}

/**
 * El encargo de un proyecto académico: con qué rúbrica, encuadre, guía,
 * estrategia y portada nacen sus estudios. Mismos campos que el perfil de
 * trabajo, que sigue siendo la plantilla de la que se copia.
 */
export interface ProjectCharge {
    /** El perfil del que se copió, para mostrarlo. No se sigue en vivo. */
    workProfileId?: string | null;
    course?: string | null;
    rubricTemplateId?: string | null;
    briefTemplateId?: string | null;
    styleGuideId?: string | null;
    exegeticalStrategy?: 'free' | 'dialectical';
    cover?: PaperCover | null;
}

/**
 * El encargo listo para guardar: sin campos `undefined` (Firestore los rechaza
 * también anidados) y sin texto vacío.
 */
export function cleanProjectCharge(charge: ProjectCharge): ProjectCharge {
    const out: ProjectCharge = {};
    for (const [k, v] of Object.entries(charge) as Array<[keyof ProjectCharge, unknown]>) {
        if (v === undefined) continue;
        if (typeof v === 'string' && !v.trim()) { (out as Record<string, unknown>)[k] = null; continue; }
        (out as Record<string, unknown>)[k] = typeof v === 'string' ? v.trim() : v;
    }
    return out;
}

/** Si el proyecto ya tiene un encargo con algo que heredar. */
export function hasProjectCharge(project: Pick<AIProject, 'charge'> | null | undefined): boolean {
    const c = project?.charge;
    return !!c && !!(c.rubricTemplateId || c.briefTemplateId || c.styleGuideId || c.cover || c.course?.trim());
}

/** El encargo que sale de un perfil de trabajo: se copia, no se enlaza. */
export function chargeFromWorkProfile(profile: {
    id: string; course?: string; rubricTemplateId: string | null; briefTemplateId: string | null;
    styleGuideId: string | null; exegeticalStrategy: 'free' | 'dialectical'; cover?: PaperCover | null;
}): ProjectCharge {
    return {
        workProfileId: profile.id,
        course: profile.course?.trim() || null,
        // En un perfil, `null` es el de antes del 2026-10-07 sin plantilla, no
        // una elección: se omite y queda la plantilla por defecto.
        ...(profile.rubricTemplateId ? { rubricTemplateId: profile.rubricTemplateId } : {}),
        briefTemplateId: profile.briefTemplateId,
        styleGuideId: profile.styleGuideId,
        exegeticalStrategy: profile.exegeticalStrategy,
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
