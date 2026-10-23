import { AIProject, ProjectOutput } from '../entities/AIProject';

export interface IAIProjectRepository {
    // ── Projects ─────────────────────────────────────────────────────────
    getUserProjects(userId: string): Promise<AIProject[]>;
    getProject(projectId: string): Promise<AIProject | null>;
    createProject(project: Omit<AIProject, 'id' | 'createdAt' | 'updatedAt'>): Promise<AIProject>;
    updateProject(
        projectId: string,
        updates: Partial<Pick<AIProject, 'title' | 'color' | 'type' | 'icon' | 'contextNote' | 'sourceIds' | 'courseInfo' | 'workTypes'>>
    ): Promise<AIProject>;
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
