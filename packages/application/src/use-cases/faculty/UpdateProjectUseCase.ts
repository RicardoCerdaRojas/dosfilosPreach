import {
    IAIProjectRepository, AIProject, ProjectColor, ProjectType,
    cleanBibliographyCriteria, cleanProjectBibliography, cleanSearchLog, cleanProjectCourseInfo, cleanProjectWorkTypes, sourceIdsFromBibliography,
    FRAMING_TEXT_MAX, cleanFramingPatch, newHypothesisEntry, scopeFitsBooks,
    applyCourseOps, cleanCourseScheduleMode, projectWorkTypes,
    type CourseOp, type CourseScheduleMode,
    type AIProjectUpdate, type BibleBookId, type BibliographySearchLogEntry, type NewHypothesisEntry, type ProjectBibliographyCriteria,
    type ProjectBibliographyEntry, type ProjectCourseInfo, type ProjectFraming, type ProjectFramingPatch, type ProjectWorkType,
} from '@dosfilos/domain';

/** Los campos que «estudio personal» no usa: si llegan sin propósito, manda el guardado. */
const PASTORALES = ['audience', 'need', 'needEvidence', 'desiredChange', 'rhythm'] as const;

export interface UpdateProjectDTO {
    title?: string;
    color?: ProjectColor;
    type?: ProjectType;
    icon?: string;
    /** `''` o `null` la borran. */
    contextNote?: string | null;
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
    /**
     * El encuadre, por campo: solo se escriben las claves presentes, y `null`
     * o vacío las borra. El formulario no pisa el registro ni la revisión.
     */
    framingPatch?: Partial<Record<keyof ProjectFraming, unknown | null>>;
    /** Los libros del proyecto, desde el encuadre: única fuente, `bibliographyCriteria.bibleBooks`. */
    bibleBooks?: BibleBookId[];
    /**
     * Una anotación del registro de la hipótesis. Se agrega con `arrayUnion`
     * (sin leer el proyecto): dos anotaciones casi simultáneas no se pisan.
     */
    hypothesisEntry?: NewHypothesisEntry;
    /**
     * Curso: operaciones sobre el calendario de entregas y los patrones de
     * corrección (`applyCourseOps`). Se aplican sobre el proyecto RELEÍDO, no
     * sobre la caché de la página, y se guardan las dos listas enteras y
     * limpias. Dos pestañas no se pisan a ciegas: cada una aplica SUS
     * operaciones sobre lo último guardado. Entre la lectura y la escritura
     * (milisegundos) gana la última; no hay transacción.
     */
    courseOps?: CourseOp[];
    /** Curso: con calendario o semana a semana. `null` lo quita. */
    courseScheduleMode?: CourseScheduleMode | null;
}

export class UpdateProjectUseCase {
    constructor(private readonly projectRepository: IAIProjectRepository) { }

    async execute(projectId: string, dto: UpdateProjectDTO): Promise<AIProject> {
        const guardado = this.hayQueLeer(dto) ? await this.projectRepository.getProject(projectId) : null;
        const libros = dto.bibleBooks !== undefined ? cleanBibliographyCriteria({ bibleBooks: dto.bibleBooks }).bibleBooks ?? [] : undefined;
        const criterios = this.criterios(dto, guardado, libros);
        const framingPatch = this.encuadre(dto, guardado, libros);
        const hypothesisAppend = dto.hypothesisEntry ? newHypothesisEntry(dto.hypothesisEntry) : null;
        const curso = this.curso(dto, guardado);
        const update: AIProjectUpdate = {
            ...(dto.title !== undefined && { title: dto.title.trim() }),
            ...(dto.color !== undefined && { color: dto.color }),
            ...(dto.type !== undefined && { type: dto.type }),
            ...(dto.icon !== undefined && { icon: dto.icon }),
            // Vacía o null se borra (el repositorio escribe deleteField()).
            ...(dto.contextNote !== undefined && { contextNote: dto.contextNote?.trim() || null }),
            // `null` quita los datos del curso; se escribe tal cual (Firestore acepta null).
            ...(dto.courseInfo !== undefined && { courseInfo: dto.courseInfo === null ? null : cleanProjectCourseInfo(dto.courseInfo) }),
            ...(dto.workTypes !== undefined && { workTypes: cleanProjectWorkTypes(dto.workTypes) }),
            ...(criterios !== undefined && { bibliographyCriteria: criterios }),
            // Con los criterios enteros, los libros ya van adentro (`criterios`).
            ...(libros !== undefined && criterios === undefined && { bibleBooks: libros }),
            ...(dto.bibliographySearchLog !== undefined && { bibliographySearchLog: cleanSearchLog(dto.bibliographySearchLog) }),
            ...(framingPatch && { framingPatch }),
            ...(hypothesisAppend && { hypothesisAppend }),
            ...curso,
            ...(dto.courseScheduleMode !== undefined && { courseScheduleMode: cleanCourseScheduleMode(dto.courseScheduleMode) }),
            ...this.fuentes(dto),
        };
        return this.projectRepository.updateProject(projectId, update);
    }

    /**
     * Solo se lee el proyecto cuando lo guardado decide algo de esta
     * escritura: los libros (alcance y títulos por libro se validan contra
     * ellos), el propósito guardado, o la idea que se revisa.
     */
    private hayQueLeer(dto: UpdateProjectDTO): boolean {
        const p = dto.framingPatch ?? {};
        const presente = (v: unknown) => v !== undefined && v !== null;
        return !!dto.courseOps?.length
            || dto.bibliographyCriteria !== undefined
            || dto.bibleBooks !== undefined
            || presente(p.scope)
            || presente(p.reading)
            || presente(p.revision)
            || (p.purpose === undefined && PASTORALES.some(k => p[k] !== undefined));
    }

    /**
     * Estado del arte manda los criterios enteros desde su borrador. Con
     * encuadre, los libros son del encuadre: se conservan los GUARDADOS, no
     * los de una caché vieja. Sin encuadre, como antes.
     */
    private criterios(dto: UpdateProjectDTO, guardado: AIProject | null, libros: BibleBookId[] | undefined): ProjectBibliographyCriteria | null | undefined {
        if (dto.bibliographyCriteria === undefined) return undefined;
        const limpios = dto.bibliographyCriteria === null ? null : cleanBibliographyCriteria(dto.bibliographyCriteria);
        const conEncuadre = !!guardado?.framing;
        if (!conEncuadre && libros === undefined) return limpios;
        const { bibleBooks: _borrador, ...resto } = limpios ?? {};
        const finales = libros ?? guardado?.bibliographyCriteria?.bibleBooks;
        if (limpios === null && !finales?.length) return null;
        return { ...resto, ...(finales ? { bibleBooks: finales } : {}) };
    }

    private encuadre(dto: UpdateProjectDTO, guardado: AIProject | null, libros: BibleBookId[] | undefined): ProjectFramingPatch | undefined {
        const librosVigentes = libros ?? guardado?.bibliographyCriteria?.bibleBooks ?? [];
        const patch: ProjectFramingPatch = dto.framingPatch
            ? cleanFramingPatch(dto.framingPatch, { bibleBooks: librosVigentes, savedPurpose: guardado?.framing?.purpose ?? null })
            : {};
        // Cambiar los libros invalida un alcance que ya no es de ese único libro.
        const alcance = guardado?.framing?.scope;
        if (libros !== undefined && !('scope' in patch) && alcance && !scopeFitsBooks(alcance, libros)) patch.scope = null;
        // La revisión guarda la idea que revisó: la GUARDADA (o la que viene en
        // este mismo cambio), no la de la caché de la página, que puede ser vieja.
        if (patch.revision) {
            const idea = 'centralIdea' in patch ? patch.centralIdea : guardado?.framing?.centralIdea;
            patch.revision = { ...patch.revision, ofIdea: (idea ?? '').trim().slice(0, FRAMING_TEXT_MAX) };
        }
        return Object.keys(patch).length ? patch : undefined;
    }

    /**
     * Las operaciones del curso sobre lo GUARDADO. Sin proyecto no hay sobre
     * qué aplicarlas: error, para que la página no crea que guardó.
     */
    private curso(dto: UpdateProjectDTO, guardado: AIProject | null): Pick<AIProjectUpdate, 'courseSchedule' | 'feedbackPatterns'> {
        if (!dto.courseOps?.length) return {};
        if (!guardado) throw new Error('UpdateProject: proyecto no encontrado');
        const { schedule, patterns } = applyCourseOps(
            { schedule: guardado.courseSchedule ?? [], patterns: guardado.feedbackPatterns ?? [] },
            dto.courseOps,
            { workTypeIds: projectWorkTypes(guardado).map(t => t.id) },
        );
        return { courseSchedule: schedule, feedbackPatterns: patterns };
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
