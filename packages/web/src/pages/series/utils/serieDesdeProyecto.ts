import {
    bookIdOfUnit,
    type AddProjectSourceInput,
    type AIProject,
    type BibleBookId,
    type BookPanorama,
    type ExegeticalUnit,
    type PlannedSermonExpositoryEnrichment,
    type PreachableUnit,
    type SyntacticUnit,
} from '@dosfilos/domain';
import type { SeriesService } from '@dosfilos/application';

/**
 * El planificador expositivo abierto desde un proyecto (etapa 3 de ADR-046,
 * `docs/FASE_PROYECTO_SERIE_2026-10.md`). Reglas puras: la página solo las
 * cablea. Sin `?projectId` todas devuelven lo de siempre.
 */

/** Sin parámetros, el planificador arranca en 2 Pedro, como siempre. */
export const DEFAULT_PLANNER_BOOK: BibleBookId = '2PE';

export type ProjectEntryState = 'none' | 'loading' | 'ok' | 'unavailable';

export interface ProjectSeriesSourcesState {
    /** Las obras marcadas: las que heredan los estudios de la serie. */
    sources: AddProjectSourceInput[];
    /** Las desmarcadas, que la serie recuerda para los estudios de después. */
    excludedResourceIds: string[];
    /** Mientras la biblioteca carga, lo heredable no se sabe: no se puede crear. */
    libraryLoading: boolean;
}

export const PROJECT_SOURCES_PENDING: ProjectSeriesSourcesState = {
    sources: [],
    excludedResourceIds: [],
    libraryLoading: true,
};

/** El argumento de `createSeriesFromPlan`, tal como lo declara el servicio. */
export type SeriesPlan = Parameters<SeriesService['createSeriesFromPlan']>[1];
type PlanSermon = SeriesPlan['sermons'][number];
type Frequency = NonNullable<SeriesPlan['frequency']>;

/**
 * El libro con que arranca el selector. El de la URL manda si existe; si
 * no, el único libro del proyecto. Un proyecto con cero o con varios libros
 * obliga a elegir: abrir en 2 Pedro sería planificar el libro equivocado.
 */
export function initialBookFor(input: {
    bookParam: string | null | undefined;
    projectBooks: readonly BibleBookId[];
    allBookIds: readonly BibleBookId[];
    hasProject: boolean;
}): { bookId: BibleBookId; mustChoose: boolean } {
    const { bookParam, projectBooks, allBookIds, hasProject } = input;
    const delParam = allBookIds.find((id) => id === bookParam);
    if (delParam) return { bookId: delParam, mustChoose: false };
    if (projectBooks.length === 1) return { bookId: projectBooks[0]!, mustChoose: false };
    if (hasProject) return { bookId: projectBooks[0] ?? DEFAULT_PLANNER_BOOK, mustChoose: true };
    return { bookId: DEFAULT_PLANNER_BOOK, mustChoose: false };
}

/**
 * Si el borrador guardado es de esta entrada. Un borrador de otro proyecto
 * (o uno suelto cuando se entra desde un proyecto, y al revés) no se
 * restaura; tampoco uno de otro libro cuando la URL trae el libro.
 */
export function shouldRestoreDraft(
    draft: { projectId?: string | null; bookId: BibleBookId },
    entry: { projectId?: string | null; bookParam?: string | null },
): boolean {
    if ((draft.projectId ?? null) !== (entry.projectId ?? null)) return false;
    if (entry.bookParam && draft.bookId !== entry.bookParam) return false;
    return true;
}

const resourceIdOf = (s: AddProjectSourceInput): string => s.sourceLibraryResourceId ?? s.corpusId;

/** Las obras heredables que el pastor desmarcó: la serie las recuerda para los estudios de después. */
export function excludedFrom(
    all: readonly AddProjectSourceInput[],
    selected: readonly AddProjectSourceInput[],
): string[] {
    const elegidas = new Set(selected.map(resourceIdOf));
    return [...new Set(all.map(resourceIdOf))].filter((id) => !elegidas.has(id));
}

/** El proyecto de la URL, solo si sigue activo (mismo criterio que ExegesisCreatePage). */
export function activeProjectById<P extends Pick<AIProject, 'id' | 'archivedAt' | 'deletedAt'>>(
    projects: readonly P[] | null | undefined,
    projectId: string | null | undefined,
): P | null {
    if (!projectId) return null;
    return (projects ?? []).find((p) => p.id === projectId && !p.archivedAt && !p.deletedAt) ?? null;
}

export function projectEntryState(input: {
    projectIdParam: string | null | undefined;
    loading: boolean;
    project: unknown | null;
}): ProjectEntryState {
    if (!input.projectIdParam) return 'none';
    if (input.loading) return 'loading';
    return input.project ? 'ok' : 'unavailable';
}

/**
 * Las perícopas con su libro, para avisar de estudios del proyecto que se
 * solapan. El libro sale de la unidad sintáctica; si no, del libro analizado.
 */
export function pericopesForOverlap(
    preachableUnits: readonly PreachableUnit[],
    exegeticalUnits: readonly ExegeticalUnit[] | null | undefined,
    analyzedBookId: BibleBookId,
): Array<{ id: string; passage: string; bookId: BibleBookId; chapterStart: number; verseStart: number; chapterEnd: number; verseEnd: number }> {
    return preachableUnits.map((p) => {
        const primera = p.sourcedExegeticalUnitIds
            .map((id) => exegeticalUnits?.find((u) => u.id === id))
            .find((u): u is ExegeticalUnit => Boolean(u));
        return {
            id: p.id,
            passage: p.passage,
            bookId: bookIdOfUnit(primera?.syntacticUnit) ?? analyzedBookId,
            chapterStart: p.chapterStart,
            verseStart: p.verseStart,
            chapterEnd: p.chapterEnd,
            verseEnd: p.verseEnd,
        };
    });
}

/**
 * Una perícopa planificada por unidad predicable, con su unidad sintáctica
 * y el enriquecimiento expositivo.
 */
export function plannedSermonsFromPreachable(
    preachableUnits: readonly PreachableUnit[],
    exegeticalUnits: readonly ExegeticalUnit[] | null | undefined,
): PlanSermon[] {
    // Build per-sermon syntactic unit + expository enrichment by
    // looking up the first sourced exegetical unit (preserves the
    // boundary the pastor saw in Pase 4) and packaging the two
    // propositions, pastoral objective, special-case treatment,
    // and macroSection link onto the planned sermon.
    return preachableUnits.map((p, idx) => {
        const sourced = p.sourcedExegeticalUnitIds
            .map((id) => exegeticalUnits?.find((u) => u.id === id))
            .filter((u): u is ExegeticalUnit => Boolean(u));
        const firstSourced = sourced[0];
        // La unidad sintáctica se arma con las FRONTERAS DE LA PERÍCOPA,
        // no con las de la primera unidad exegética que la alimentó.
        //
        // Antes se copiaba `firstSourced.syntacticUnit` tal cual, y por eso
        // el registro quedaba viejo apenas el pastor fusionaba, partía o
        // corría una frontera en el Paso 5: la perícopa decía «Jonás 1:4-16»
        // y su unidad guardada decía 1:1-3. Medido en la serie de Jonás del
        // fundador: desincronizado en 4 de 6. Al perderse el vínculo entre
        // lo que el asistente propuso y lo que él planificó, nada podía
        // después explicarle por qué el corte iba donde iba.
        //
        // La justificación se junta de TODAS las unidades que la perícopa
        // abarca, no sólo de la primera: si fusionó dos, las dos razones
        // cuentan, y quedarse con una sería contar media historia.
        const justificaciones = sourced
            .map((u) => u.syntacticUnit.justification?.trim())
            .filter((j): j is string => Boolean(j));
        const syntactic: SyntacticUnit | undefined = firstSourced
            ? {
                book: firstSourced.syntacticUnit.book,
                chapterStart: p.chapterStart,
                verseStart: p.verseStart,
                chapterEnd: p.chapterEnd,
                verseEnd: p.verseEnd,
                ...(firstSourced.syntacticUnit.originalLanguage
                    ? { originalLanguage: firstSourced.syntacticUnit.originalLanguage }
                    : {}),
                ...(justificaciones.length
                    ? { justification: [...new Set(justificaciones)].join(' ') }
                    : {}),
            }
            : undefined;

        const enrichment: PlannedSermonExpositoryEnrichment = {
            exegeticalProposition: p.exegeticalProposition,
            homileticalProposition: p.homileticalProposition,
            pastoralObjective: p.pastoralObjective,
            ...(p.caseTreatment ? { caseTreatment: p.caseTreatment } : {}),
            sourcedExegeticalUnitIds: p.sourcedExegeticalUnitIds,
            ...(firstSourced ? { macroSectionId: firstSourced.macroSectionId } : {}),
            ...(p.fidelityNotes ? { fidelityNotes: p.fidelityNotes } : {}),
        };

        const sermon: PlanSermon = {
            title: p.title,
            description: p.exegeticalProposition,
            passage: p.passage,
            week: idx + 1,
            status: 'planned',
            expositoryEnrichment: enrichment,
        };
        if (syntactic) sermon.syntacticUnit = syntactic;
        return sermon;
    });
}

/**
 * El argumento de `createSeriesFromPlan`. Sin proyecto es idéntico al de
 * siempre. Con proyecto suma `project`; la bibliografía NO va a
 * `exegesisDefaults.sourceRefs`: la serie ligada resuelve las fuentes del
 * proyecto en vivo y solo recuerda lo desmarcado.
 */
export function buildSeriesPlan(input: {
    title: string;
    description: string;
    startDate: Date | undefined;
    frequency: Frequency;
    bookDisplay: string;
    preachableUnits: readonly PreachableUnit[];
    exegeticalUnits: readonly ExegeticalUnit[] | null | undefined;
    panorama: Pick<BookPanorama, 'genre'> | null | undefined;
    displayLanguage: 'es' | 'en';
    project?: { projectId: string; sources: AddProjectSourceInput[]; excludedResourceIds: string[] } | null;
}): SeriesPlan {
    return {
        series: {
            title: input.title.trim(),
            description: input.description,
            type: 'expository',
            startDate: input.startDate,
            metadata: {
                expository: { book: input.bookDisplay },
            },
            resourceIds: [],
        },
        sermons: plannedSermonsFromPreachable(input.preachableUnits, input.exegeticalUnits),
        frequency: input.frequency,
        expositoryAssistant: {
            version: input.panorama ? `expository-v15:${input.panorama.genre}` : 'expository-v15',
            status: 'reviewed',
        },
        // Tells createSeriesFromPlan to auto-spawn one ExegeticalPaper
        // per pericope in the user's display language. Without this
        // the pastor would land in SeriesDetail with N "Crear paper"
        // buttons to click manually.
        displayLanguage: input.displayLanguage,
        ...(input.project
            ? {
                project: {
                    projectId: input.project.projectId,
                    sources: input.project.sources,
                    excludedResourceIds: input.project.excludedResourceIds,
                },
            }
            : {}),
    };
}
