import { AIProject, ProjectOutput } from '../entities/AIProject';
import type { BibleBookId } from '../bible/canon/BibleCanon';
import type { HypothesisEntry, ProjectFramingPatch } from '../exegesis/services/projectFraming';
import type { CourseScheduleEntry, CourseScheduleMode, FeedbackPattern } from '../exegesis/services/courseSchedule';

/**
 * Lo que acepta `updateProject` (lista blanca). Además de los campos enteros:
 *   - `contextNote: null` borra la nota (`deleteField()`);
 *   - `framingPatch` escribe `framing.<campo>` por cada clave, ya limpia
 *     (`cleanFramingPatch`); `null` borra ese campo;
 *   - `bibleBooks` escribe `bibliographyCriteria.bibleBooks` sin tocar el
 *     resto de los criterios;
 *   - `hypothesisAppend` agrega UNA anotación al registro con `arrayUnion`,
 *     sin leerlo: dos anotaciones casi simultáneas no se pisan. El tope de
 *     200 lo aplica la lectura (`withCappedHypothesisLog`);
 *   - `courseSchedule`, `feedbackPatterns` (Curso): enteros y ya limpios; el
 *     caso de uso los arma sobre el proyecto releído. `null` o `[]` los borran;
 *   - `courseScheduleMode: null` lo borra.
 * Todo va en un solo `updateDoc`.
 */
export type AIProjectUpdate =
    Partial<Pick<AIProject, 'title' | 'color' | 'type' | 'icon' | 'sourceIds' | 'courseInfo' | 'workTypes' | 'bibliography' | 'bibliographyCriteria' | 'bibliographySearchLog'>>
    & {
        contextNote?: string | null;
        framingPatch?: ProjectFramingPatch;
        bibleBooks?: BibleBookId[];
        hypothesisAppend?: HypothesisEntry;
        courseSchedule?: CourseScheduleEntry[] | null;
        feedbackPatterns?: FeedbackPattern[] | null;
        courseScheduleMode?: CourseScheduleMode | null;
    };

export interface IAIProjectRepository {
    // ── Projects ─────────────────────────────────────────────────────────
    getUserProjects(userId: string): Promise<AIProject[]>;
    getProject(projectId: string): Promise<AIProject | null>;
    createProject(project: Omit<AIProject, 'id' | 'createdAt' | 'updatedAt'>): Promise<AIProject>;
    updateProject(projectId: string, updates: AIProjectUpdate): Promise<AIProject>;
    /**
     * Toggle archive state. Pass `true` to archive (sets `archivedAt = now`)
     * or `false` to unarchive (clears the field).
     */
    setProjectArchived(projectId: string, archived: boolean): Promise<AIProject>;
    /**
     * Toggle soft-delete state. Pass `true` to move to trash (sets
     * `deletedAt = now`) or `false` to restore (clears the field).
     * Hard removal still goes through `deleteProject`.
     */
    setProjectDeleted(projectId: string, deleted: boolean): Promise<AIProject>;
    deleteProject(projectId: string): Promise<void>;

    // ── Outputs (subcollection per project) ──────────────────────────────
    listOutputs(userId: string, projectId: string): Promise<ProjectOutput[]>;
    getOutput(userId: string, projectId: string, outputId: string): Promise<ProjectOutput | null>;
    createOutput(output: Omit<ProjectOutput, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProjectOutput>;
    updateOutput(
        userId: string,
        projectId: string,
        outputId: string,
        updates: Partial<Pick<ProjectOutput, 'title' | 'content' | 'kind'>>
    ): Promise<ProjectOutput>;
    deleteOutput(userId: string, projectId: string, outputId: string): Promise<void>;
}
