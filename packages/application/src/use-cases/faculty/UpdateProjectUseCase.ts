import {
    IAIProjectRepository, AIProject, ProjectColor, ProjectType,
    cleanBibliographyCriteria, cleanProjectBibliography, cleanSearchLog, cleanProjectCourseInfo, cleanProjectWorkTypes, sourceIdsFromBibliography,
    type BibliographySearchLogEntry, type ProjectBibliographyCriteria, type ProjectBibliographyEntry, type ProjectCourseInfo, type ProjectWorkType,
} from '@dosfilos/domain';

export interface UpdateProjectDTO {
    title?: string;
    color?: ProjectColor;
    type?: ProjectType;
    icon?: string;
    contextNote?: string;
    /** Attached library_resource IDs (project-scoped source set). Pass [] to detach all. */
    sourceIds?: string[];
    /** Los datos del curso (ADR-046, etapa 1b). `null` los quita. */
    courseInfo?: ProjectCourseInfo | null;
    /** Los tipos de trabajo del proyecto. `[]` los quita. */
    workTypes?: ProjectWorkType[];
    /**
     * La bibliografía del proyecto (etapa 2). Reemplaza `sourceIds` con las
     * aprobadas que están en la biblioteca: las conversaciones siguen
     * acotadas a lo que el proyecto aprobó.
     */
    bibliography?: ProjectBibliographyEntry[];
    /** Los criterios de la bibliografía. `null` los quita. */
    bibliographyCriteria?: ProjectBibliographyCriteria | null;
    /** El registro de búsquedas, entero (se reescribe). */
    bibliographySearchLog?: BibliographySearchLogEntry[];
}

export class UpdateProjectUseCase {
    constructor(private readonly projectRepository: IAIProjectRepository) { }

    async execute(projectId: string, dto: UpdateProjectDTO): Promise<AIProject> {
        return this.projectRepository.updateProject(projectId, {
            ...(dto.title !== undefined && { title: dto.title.trim() }),
            ...(dto.color !== undefined && { color: dto.color }),
            ...(dto.type !== undefined && { type: dto.type }),
            ...(dto.icon !== undefined && { icon: dto.icon }),
            ...(dto.contextNote !== undefined && { contextNote: dto.contextNote.trim() || undefined }),
            // `null` quita los datos del curso; se escribe tal cual (Firestore acepta null).
            ...(dto.courseInfo !== undefined && { courseInfo: dto.courseInfo === null ? null : cleanProjectCourseInfo(dto.courseInfo) }),
            ...(dto.workTypes !== undefined && { workTypes: cleanProjectWorkTypes(dto.workTypes) }),
            ...(dto.bibliographyCriteria !== undefined && {
                bibliographyCriteria: dto.bibliographyCriteria === null ? null : cleanBibliographyCriteria(dto.bibliographyCriteria),
            }),
            ...(dto.bibliographySearchLog !== undefined && { bibliographySearchLog: cleanSearchLog(dto.bibliographySearchLog) }),
            ...this.fuentes(dto),
        });
    }

    /** La bibliografía manda sobre `sourceIds`: no pueden quedar contradiciéndose. */
    private fuentes(dto: UpdateProjectDTO): Partial<Pick<AIProject, 'bibliography' | 'sourceIds'>> {
        if (dto.bibliography !== undefined) {
            const bibliography = cleanProjectBibliography(dto.bibliography);
            return { bibliography, sourceIds: sourceIdsFromBibliography(bibliography) };
        }
        return dto.sourceIds !== undefined ? { sourceIds: dto.sourceIds } : {};
    }
}
