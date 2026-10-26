import {
    newCourseEntryId,
    paperRoleInProject,
    projectWorkTypes,
    type AIProject,
    type CourseOp,
    type IAIProjectRepository,
    type IExegeticalPaperRepository,
    type PassageReference,
} from '@dosfilos/domain';
import { UpdateProjectUseCase } from '../faculty/UpdateProjectUseCase';

/** Tope por llamada: NT785 trae 8; un lote enorme es un error de la página. */
export const IMPORT_PREVIOUS_WORKS_MAX = 50;

export interface PreviousWorkInput {
    paperId: string;
    /** El tipo de trabajo del proyecto que es (`ProjectWorkType.id`). */
    workTypeId: string;
    /** Cómo lo llama el curso («TP #3»). Vacío: el título del estudio. */
    label: string;
    /** `YYYY-MM-DD` local. */
    dueDate?: string | null;
    /** Cuándo se entregó (ISO), si el estudiante lo sabe. */
    deliveredAt?: string | null;
    /** El pasaje de la entrega (numeración del original). */
    passage?: PassageReference | null;
}

export interface ImportPreviousWorksInput {
    ownerId: string;
    projectId: string;
    works: PreviousWorkInput[];
}

/**
 * Qué pasó con cada estudio:
 * - `origin-set`: estaba suelto; ahora su origen es este proyecto, con su tipo.
 * - `already-origin`: ya era de este proyecto (se le puso el tipo si faltaba o cambió).
 * - `linked`: tenía OTRO proyecto de origen; no se le cambió: queda vinculado.
 *   La página debe avisarlo («sigue siendo de X; aquí aparece vinculado»).
 * - `already-linked`: ya estaba vinculado a este proyecto.
 * - `not-found`: no existe o no es del dueño; no se creó entrada.
 */
export type PreviousWorkStatus = 'origin-set' | 'already-origin' | 'linked' | 'already-linked' | 'not-found';

export interface ImportPreviousWorksResult {
    project: AIProject;
    results: Array<{ paperId: string; status: PreviousWorkStatus; entryId: string | null }>;
}

/**
 * «Traer los trabajos anteriores» (`docs/FASE_ESCRITORIO_PROYECTO_2026-10.md`
 * §9.1, NT785): los TP sueltos se vinculan al curso con su tipo de trabajo y
 * quedan en el calendario como entradas `imported: true`.
 *
 * SIN volver a aplicar el encargo: un trabajo entregado no cambia de reglas.
 * Por eso no pasa por `CreateExegeticalPaperUseCase` ni ofrece fuentes: solo
 * escribe `projectId` + `projectWorkTypeId` con `setProjectLinks`, en UNA
 * escritura (`SetPaperProjectUseCase` pediría dos: origen y luego tipo, y el
 * primero borra el tipo). Rúbrica, guía, encargo y fuentes del estudio
 * quedan como estaban.
 *
 * Un estudio que ya tiene OTRO proyecto de origen no se mueve: su origen
 * define sus reglas, y cambiarlo sin que el estudiante lo vea sería pisarlo.
 * Queda vinculado (`linkedProjectIds`), con el tipo solo en su entrada del
 * calendario, y el resultado dice `linked` para que la página lo avise.
 *
 * Un estudio que ya cumple una entrada del calendario no crea otra.
 */
export class ImportPreviousWorksUseCase {
    constructor(
        private readonly paperRepository: IExegeticalPaperRepository,
        private readonly projectRepository: IAIProjectRepository,
        private readonly newId: () => string = newCourseEntryId,
    ) { }

    async execute(input: ImportPreviousWorksInput): Promise<ImportPreviousWorksResult> {
        const { ownerId, projectId } = input;
        if (!ownerId || !projectId) throw new Error('ImportPreviousWorks: ownerId y projectId requeridos');
        const works = input.works ?? [];
        if (works.length === 0) throw new Error('ImportPreviousWorks: no hay trabajos que traer');
        if (works.length > IMPORT_PREVIOUS_WORKS_MAX) throw new Error(`ImportPreviousWorks: más de ${IMPORT_PREVIOUS_WORKS_MAX} trabajos`);

        const project = await this.projectRepository.getProject(projectId).catch(() => null);
        if (!project || project.userId !== ownerId || project.deletedAt || project.archivedAt) {
            throw new Error(`Proyecto ${projectId} no disponible`);
        }
        // Todo se valida antes de escribir nada: un tipo inexistente no deja la importación a medias.
        const tipos = new Set(projectWorkTypes(project).map(t => t.id));
        for (const w of works) {
            if (!w.paperId) throw new Error('ImportPreviousWorks: falta paperId');
            if (!tipos.has(w.workTypeId)) throw new Error(`Tipo de trabajo ${w.workTypeId} no existe en el proyecto`);
        }

        const yaEnCalendario = new Map<string, string>();
        for (const e of project.courseSchedule ?? []) if (e.paperId) yaEnCalendario.set(e.paperId, e.id);
        const results: ImportPreviousWorksResult['results'] = [];
        const ops: CourseOp[] = [];
        const vistos = new Set<string>();
        for (const w of works) {
            if (vistos.has(w.paperId)) continue;
            vistos.add(w.paperId);
            const paper = await this.paperRepository.getPaper(ownerId, w.paperId).catch(() => null);
            if (!paper) { results.push({ paperId: w.paperId, status: 'not-found', entryId: null }); continue; }

            let status: PreviousWorkStatus;
            const rol = paperRoleInProject(paper, projectId);
            if (rol === 'origin') {
                status = 'already-origin';
                if ((paper.projectWorkTypeId ?? null) !== w.workTypeId) {
                    await this.paperRepository.setProjectLinks(ownerId, paper.id, { workTypeId: w.workTypeId });
                }
            } else if (!paper.projectId) {
                // Suelto: el curso pasa a ser su origen, con el tipo en la misma escritura.
                status = 'origin-set';
                await this.paperRepository.setProjectLinks(ownerId, paper.id, {
                    projectId, workTypeId: w.workTypeId,
                    // El origen nunca queda además como vínculo.
                    ...(rol === 'linked' ? { unlink: projectId } : {}),
                });
            } else if (rol === 'linked') {
                status = 'already-linked';
            } else {
                status = 'linked';
                await this.paperRepository.setProjectLinks(ownerId, paper.id, { link: projectId });
            }

            const existente = yaEnCalendario.get(paper.id);
            if (existente) { results.push({ paperId: paper.id, status, entryId: existente }); continue; }
            const entryId = this.newId();
            ops.push({
                op: 'upsertEntry',
                entry: {
                    id: entryId,
                    workTypeId: w.workTypeId,
                    label: (w.label ?? '').trim() || paper.title || '',
                    paperId: paper.id,
                    imported: true,
                    ...(w.dueDate ? { dueDate: w.dueDate } : {}),
                    ...(w.deliveredAt ? { deliveredAt: w.deliveredAt } : {}),
                    ...(w.passage ? { passage: w.passage } : {}),
                },
            });
            results.push({ paperId: paper.id, status, entryId });
        }

        const actualizado = ops.length
            ? await new UpdateProjectUseCase(this.projectRepository).execute(projectId, { courseOps: ops })
            : project;
        return { project: actualizado, results };
    }
}
