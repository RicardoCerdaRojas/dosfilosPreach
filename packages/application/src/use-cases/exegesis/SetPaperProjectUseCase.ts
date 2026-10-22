import {
    paperRoleInProject,
    type ExegeticalPaper,
    type IAIProjectRepository,
    type IExegeticalPaperRepository,
} from '@dosfilos/domain';

/**
 * Qué cambiar en la relación de un estudio con los proyectos (ADR-046).
 *
 * - `origin`: el proyecto de origen, que define su encargo. `null` lo quita.
 * - `link` / `unlink`: un proyecto con el que colabora sin cambiarle reglas.
 */
export type PaperProjectChange =
    | { kind: 'origin'; projectId: string | null }
    | { kind: 'link'; projectId: string }
    | { kind: 'unlink'; projectId: string };

export interface SetPaperProjectInput {
    ownerId: string;
    paperId: string;
    change: PaperProjectChange;
}

/**
 * Asocia un estudio a un proyecto, o lo desasocia (ADR-046, etapa 1).
 *
 * Reglas:
 * - El proyecto tiene que ser del dueño del estudio y no estar en la papelera.
 * - El origen nunca queda además como vínculo: hacer origen a un proyecto
 *   vinculado lo saca de los vínculos, y vincular el proyecto de origen no
 *   hace nada.
 */
export class SetPaperProjectUseCase {
    constructor(
        private readonly paperRepository: IExegeticalPaperRepository,
        private readonly projectRepository: IAIProjectRepository,
    ) { }

    async execute(input: SetPaperProjectInput): Promise<ExegeticalPaper> {
        const { ownerId, paperId, change } = input;
        if (!ownerId || !paperId) throw new Error('SetPaperProject: ownerId y paperId requeridos');
        const paper = await this.paperRepository.getPaper(ownerId, paperId);
        if (!paper) throw new Error(`Paper ${paperId} not found`);

        // Quitar o desvincular no pide que el proyecto siga disponible: un
        // proyecto archivado tiene que poder soltarse.
        if (change.projectId && change.kind !== 'unlink') await this.requireProject(ownerId, change.projectId);

        if (change.kind === 'origin') {
            if (paper.projectId === change.projectId) return paper;
            const eraVinculo = !!change.projectId && paperRoleInProject(paper, change.projectId) === 'linked';
            return this.paperRepository.setProjectLinks(ownerId, paperId, {
                projectId: change.projectId,
                ...(eraVinculo ? { unlink: change.projectId! } : {}),
            });
        }
        if (change.kind === 'link') {
            if (paperRoleInProject(paper, change.projectId)) return paper;
            return this.paperRepository.setProjectLinks(ownerId, paperId, { link: change.projectId });
        }
        if (paperRoleInProject(paper, change.projectId) !== 'linked') return paper;
        return this.paperRepository.setProjectLinks(ownerId, paperId, { unlink: change.projectId });
    }

    private async requireProject(ownerId: string, projectId: string): Promise<void> {
        // Un proyecto ajeno o inexistente no vuelve `null`: las reglas niegan
        // la lectura. Las dos cosas son «no disponible».
        const project = await this.projectRepository.getProject(projectId).catch(() => null);
        if (!project || project.userId !== ownerId || project.deletedAt || project.archivedAt) {
            throw new Error(`Proyecto ${projectId} no disponible`);
        }
    }
}
