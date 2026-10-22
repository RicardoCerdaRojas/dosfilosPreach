import { IAIProjectRepository, IAIChatRepository, IExtractionRepository, type IExegeticalPaperRepository } from '@dosfilos/domain';

/**
 * Deletes a project using the ORPHAN strategy:
 *   - Chat sessions are NOT deleted — their projectId is set to null so
 *     they move back to the "Sin proyecto" section of the sidebar.
 *   - Persisted extractions pinned to this project are NOT deleted —
 *     their projectId is set to null so they appear in the user's
 *     library but without project context. They retain their sessionId.
 *   - Exegetical studies are NOT deleted either: the project is removed as
 *     their origin and from their links (ADR-046), so none points to a
 *     project that no longer exists.
 */
export class DeleteProjectUseCase {
    constructor(
        private readonly projectRepository: IAIProjectRepository,
        private readonly chatRepository: IAIChatRepository,
        private readonly extractionRepository: IExtractionRepository,
        private readonly paperRepository?: Pick<IExegeticalPaperRepository, 'detachProject'>,
    ) { }

    async execute(userId: string, projectId: string): Promise<void> {
        await this.chatRepository.clearProjectFromSessions(userId, projectId);
        await this.extractionRepository.orphanByProject(userId, projectId);
        await this.paperRepository?.detachProject(userId, projectId);
        await this.projectRepository.deleteProject(projectId);
    }
}
