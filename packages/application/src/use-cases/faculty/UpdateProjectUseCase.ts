import { IAIProjectRepository, AIProject, ProjectColor, ProjectType, cleanProjectCourseInfo, cleanProjectWorkTypes, type ProjectCourseInfo, type ProjectWorkType } from '@dosfilos/domain';

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
            ...(dto.sourceIds !== undefined && { sourceIds: dto.sourceIds }),
        });
    }
}
