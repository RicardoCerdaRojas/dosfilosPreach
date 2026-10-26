import { BOOKS_WITH_ARAMAIC_SECTIONS } from '../../bible/aramaicSpans';
import { getBookById } from '../../bible/canon/BibleCanon';
import type { PassageReference } from '../../bible/canon/passage-reference';
import { projectWorkTypes, type AIProject, type ProjectOutputKind, type ProjectWorkType } from '../../entities/AIProject';
import type { ExegesisPaperSummary } from '../entities/ExegesisPaperSummary';
import type { ExegeticalMethod } from '../entities/ExegeticalPaper';
import { STRATEGY_ONLY_RUBRIC_PRESET_ID } from '../entities/PaperRubric';
import type { SourceType } from '../entities/SourceType';
import { projectBibleBooks } from './bibliographyCandidates';
import type { CourseScheduleEntry, CourseScheduleMode, FeedbackPatternDecision } from './courseSchedule';
import {
    bibliographyCoverage,
    measureRequirement,
    noRepeatApplies,
    projectBibliography,
    type BibliographyCoverage,
    type ProjectBibliographyEntry,
} from './projectBibliography';
import {
    currentRevisedIdea,
    framingStatus,
    isRevisionStale,
    plannedUnits,
    type FramingMovement,
    type FramingPurpose,
    type FramingStatus,
    type HypothesisEntry,
    type HypothesisVerdict,
} from './projectFraming';
import {
    isEmptySermonPlaceholder,
    projectSeriesOf,
    seriesPericopeRows,
    type PericopeSermonState,
    type SerieLike,
    type SermonProgressLike,
} from './projectSeriesLink';

/**
 * El escritorio del proyecto (`docs/FASE_ESCRITORIO_PROYECTO_2026-10.md`):
 * un modelo de vista puro que la web arma con lo que ya tiene en caché
 * (proyecto, resúmenes de estudios, series, sermones, material, biblioteca),
 * sin lecturas nuevas.
 *
 * Tres reglas mandan (§2 y decisiones del fundador):
 *   - ninguna acción de una fase completa otra; cada fase tiene tres estados
 *     honestos (por empezar · en curso · lista) con su evidencia;
 *   - «Ahora» es un solo botón: en el Exegético la continuidad va antes que
 *     el método; en el Curso el plazo gobierna;
 *   - lo que falte del método va como nota secundaria, nunca como botón.
 *
 * Los textos salen como claves i18n bajo `desk.*` con sus parámetros: la web
 * los traduce. La lista completa está en `DESK_TEXT_KEYS` (al final).
 *
 * Tipos:
 *   - `exegetical` y `course`: recorrido y mesa propios.
 *   - `general`: sin modelo, como un estudio en blanco: sin fases; «Ahora» es
 *     lo último que se tocó.
 *   - el resto (Investigación, Consejería, Sermón y Serie heredados) sale
 *     como `other` SIN fases: la web conserva su recorrido de hoy hasta su
 *     propia fase. No se recalcula nada para no cambiar lo que ven.
 */

// ── Tipos del modelo ───────────────────────────────────────────────────

export type DeskProjectType = 'exegetical' | 'course' | 'general' | 'other';
export type DeskPhaseStatus = 'todo' | 'doing' | 'ready';

/** Un texto para la web: una clave bajo `desk.*` y sus valores. */
export interface DeskText {
    key: string;
    params?: Record<string, string | number>;
}

/** Las fases del Exegético, en el orden del trabajo (mismos ids que el recorrido de hoy). */
export type ExegeticalDeskPhaseId = 'passage' | 'sources' | 'division' | 'pericopes' | 'synthesis';
/** Las fases del Curso (§9.1). */
export type CourseDeskPhaseId = 'charge' | 'sources' | 'calendar' | 'works' | 'feedback';

export interface DeskPhase {
    id: ExegeticalDeskPhaseId | CourseDeskPhaseId;
    status: DeskPhaseStatus;
    evidence: DeskText;
    /** Las fases que se miden en proporción: «4 de 12». */
    progress?: { done: number; total: number };
    /** Lo que conviene tener antes (informativo: no bloquea ni cambia el estado). */
    dependsOn?: string[];
}

export type DeskTargetType =
    | 'study' | 'scheduleEntry' | 'createScheduled' | 'phase' | 'framing' | 'stateOfArt'
    | 'planSeries' | 'reviseIdea' | 'recordFeedback'
    /** General: un material del proyecto. */
    | 'output';

/** Adónde lleva un botón o una nota. La web decide la ruta. */
export interface DeskTarget {
    type: DeskTargetType;
    /** El estudio, la entrada del calendario o el material. */
    id?: string;
    phaseId?: string;
    /** `createScheduled`: el tipo de trabajo con que nace el estudio. */
    workTypeId?: string;
    /** El rótulo: «TP #10», el pasaje de la perícopa o el título. */
    label?: string;
}

/**
 * Por qué «Ahora» es eso:
 *   - `deadline`: un trabajo del curso vence en ≤ 72 h y no está entregado;
 *   - `continuity`: el estudio en curso tocado más recientemente;
 *   - `upcoming`: una perícopa con fecha en los próximos 7 días;
 *   - `scheduled`: lo que sigue en el calendario del curso;
 *   - `phase`: la fase activa (la primera que no está lista);
 *   - `recent`: General, lo último que se tocó.
 */
export type DeskNowKind = 'deadline' | 'continuity' | 'upcoming' | 'scheduled' | 'phase' | 'recent';

export interface DeskNow {
    kind: DeskNowKind;
    text: DeskText;
    target: DeskTarget;
    /** `YYYY-MM-DD` local: la entrega o la fecha de la perícopa. */
    dueDate?: string;
    /** Horas enteras hasta el fin del día de entrega. */
    hoursLeft?: number;
}

/** Lo que falta del método: un enlace, nunca un botón lleno. */
export interface DeskNote {
    text: DeskText;
    target: DeskTarget;
    /** La fase a la que pertenece. */
    phaseId?: string;
}

export type DeskStudyState = 'none' | 'notStarted' | 'inProgress' | 'assembled';

/** El estudio en una celda de la mesa: sin estudio (`id: null`), sin empezar, k de n pasos o ensamblado. */
export interface DeskStudyCell {
    id: string | null;
    state: DeskStudyState;
    accepted: number;
    total: number;
}

/** Un estudio del proyecto, normalizado. */
export interface DeskStudy extends DeskStudyCell {
    id: string;
    title: string;
    passage: PassageReference;
    /** ISO. */
    updatedAt: string;
    /** Tocado por el pastor: en curso, o en configuración pero editado después de nacer. */
    touched: boolean;
    /** Con al menos una anotación en el registro de la hipótesis. */
    annotated: boolean;
    seriesId: string | null;
    workTypeId: string | null;
}

export type DeskLanguage = 'hebrew' | 'aramaic' | 'greek';

// ── Fuentes ────────────────────────────────────────────────────────────

export interface DeskSourcesSummary {
    /** Fichas vivas (sin las descartadas). */
    total: number;
    approved: number;
    /** Aprobadas que no están en la biblioteca. */
    toAcquire: number;
    /**
     * Aprobadas «a mano»: las `sourceIds` de antes (`legacy`) o las del
     * selector de fuentes (`selector`), sin otro origen. Ver `isManualApproval`.
     */
    manual: number;
    candidates: number;
    discarded: number;
    /**
     * Los requisitos MEDIBLES (mínimo por tipo, cantidad, fechas, enfoques,
     * variedad). `met` cuenta los cumplidos y los aceptados a propósito
     * (`done: true`); `incomplete`, los que no tienen cifra y no se aceptaron.
     * Las reglas y los «otros» no son medibles: no cuentan aquí.
     */
    requirements: { met: number; total: number; accepted: number; incomplete: number };
    /** Obligatorias aprobadas por conseguir (Curso: la fase 2 las espera). */
    requiredToAcquire: Array<{ entryId: string; title: string }>;
    /** La cobertura por tipo de trabajo, si la web pasó lo que piden las rúbricas. */
    coverage: BibliographyCoverage | null;
}

// ── Exegético ──────────────────────────────────────────────────────────

export type DeskOldNote = { source: 'contextNote' } | { source: 'output'; outputId: string };
export type DeskRevisionState = 'none' | 'current' | 'stale';

export interface DeskFraming {
    status: FramingStatus;
    /** Cuántos campos del formulario faltan. */
    missing: number;
    purpose: FramingPurpose;
    /** La idea vigente: la revisada si está vigente; si no, la original. */
    idea: string | null;
    ideaSource: 'revised' | 'original' | null;
    originalIdea: string | null;
    revisedIdea: string | null;
    revision: DeskRevisionState;
    movements: FramingMovement[];
    /** La nota vieja que se puede pasar al encuadre (solo si el encuadre no está completo). */
    oldNote: DeskOldNote | null;
    divisionWithoutSeries: boolean;
}

export type DeskReadingState = 'none' | 'pending' | 'annotated';

/** Una fila de la mesa de perícopas. */
export interface DeskPericopeRow {
    plannedId: string;
    /** El número de la unidad en su serie (las filas de una misma unidad lo comparten). */
    position: number;
    /** El pasaje como lo lee el pastor («Esd 3:1-13»). */
    label: string;
    title: string;
    /** `YYYY-MM-DD` local. */
    date: string | null;
    study: DeskStudyCell;
    /** `pending`: ensamblado y sin anotación en tu lectura. */
    reading: DeskReadingState;
    sermon: PericopeSermonState;
    sermonId: string | null;
}

export interface DeskTableCounts {
    /** Unidades (una unidad en varios domingos cuenta una vez) más los estudios fuera de la serie. */
    units: number;
    assembled: number;
    annotated: number;
    pendingReading: number;
    inProgress: number;
    withSermon: number;
}

export interface DeskSeriesGroup {
    seriesId: string;
    title: string;
    rows: DeskPericopeRow[];
    counts: DeskTableCounts;
}

export interface DeskSynthesis {
    /** La síntesis se abre desde la primera anotación. */
    open: boolean;
    annotations: number;
    counts: Record<HypothesisVerdict, number>;
    /** Las tres últimas, la más nueva primero. */
    latest: HypothesisEntry[];
    /** Hay idea original y al menos una anotación. */
    canRevise: boolean;
    revision: DeskRevisionState;
}

export interface ExegeticalDesk {
    framing: DeskFraming;
    sources: DeskSourcesSummary;
    series: DeskSeriesGroup[];
    /** Estudios del proyecto que no están en ningún plan. */
    looseStudies: DeskStudy[];
    counts: DeskTableCounts;
    synthesis: DeskSynthesis;
}

// ── Curso ──────────────────────────────────────────────────────────────

/**
 * De dónde sale la rúbrica de un tipo de trabajo:
 *   - `template`: una plantilla del usuario que existe;
 *   - `default`: ausente, y el usuario tiene una plantilla por defecto;
 *   - `system`: `null` a propósito (o el preset de solo estrategia);
 *   - `unset`: ausente y SIN plantilla por defecto: caería en la del sistema
 *     sin que nadie lo decidiera;
 *   - `missing`: una plantilla que ya no existe.
 * «Resuelta» = template, default o system.
 */
export type DeskRubricSource = 'template' | 'default' | 'system' | 'unset' | 'missing';

export interface DeskWorkType {
    id: string;
    label: string;
    rubric: DeskRubricSource;
    rubricResolved: boolean;
    method: ExegeticalMethod | null;
    /** La guía del tipo o, si no tiene, la del curso. */
    guideId: string | null;
    /** Entradas del calendario de este tipo. */
    entries: number;
}

export type DeskDelivery = 'notDelivered' | 'delivered' | 'returned' | 'noFeedback';
export type DeskSourceRepeat = 'noRepeat' | 'repeats' | 'n/a';

export interface DeskScheduleRow {
    entryId: string;
    workTypeId: string;
    /** El tipo existe en el proyecto. */
    workTypeKnown: boolean;
    label: string;
    passage: PassageReference | null;
    dueDate: string | null;
    /** Vencida y sin entregar. */
    overdue: boolean;
    hoursLeft: number | null;
    study: DeskStudyCell;
    /** «Sin repetir de TP #8» / «repite Moo», contra la entrega anterior del mismo tipo. */
    sources: DeskSourceRepeat;
    repeated: string[];
    /** El rótulo de la entrega con que se comparó. */
    comparedWith: string | null;
    delivery: DeskDelivery;
    imported: boolean;
}

export interface DeskScheduleGroup {
    workTypeId: string;
    label: string;
    rows: DeskScheduleRow[];
}

export interface DeskPatternRow {
    patternId: string;
    name: string;
    decision: FeedbackPatternDecision;
    corrections: number;
    entries: Array<{ entryId: string; label: string }>;
}

/** Lectura dirigida: un requisito de páginas, medido sobre fichas con `pageCount` y reseña. */
export interface DeskDirectedReading {
    requirementId: string;
    text: string;
    pages: number;
    target: number;
    /** Fichas aprobadas del tipo que todavía no suman (sin páginas o sin reseña). */
    pending: number;
}

export interface CourseDesk {
    workTypes: DeskWorkType[];
    noRepeat: boolean;
    sources: DeskSourcesSummary;
    schedule: {
        mode: CourseScheduleMode | null;
        /** En el orden del calendario: con fecha primero, por fecha; luego las sin fecha. */
        rows: DeskScheduleRow[];
        /** Agrupadas por tipo de trabajo, en el orden de los tipos. */
        groups: DeskScheduleGroup[];
    };
    /** Estudios del proyecto sin entrada en el calendario («Traer los trabajos anteriores»). */
    offCalendar: DeskStudy[];
    directedReading: DeskDirectedReading[];
    feedback: {
        /** Pendientes primero; luego por cantidad de correcciones. */
        patterns: DeskPatternRow[];
        delivered: number;
        returned: number;
        noFeedback: number;
        /** Entregadas sin devolución registrada. */
        awaiting: number;
        /** Patrones con ≥ 2 correcciones y sin decidir. */
        repeatedPending: number;
    };
}

// ── General ────────────────────────────────────────────────────────────

export interface DeskRecent {
    kind: 'study' | 'output';
    id: string;
    label: string;
    /** ISO. */
    at: string;
}

export interface ProjectDeskModel {
    type: DeskProjectType;
    phases: DeskPhase[];
    /** La primera fase que no está lista; `null` sin fases o con todas listas. */
    activePhaseId: string | null;
    now: DeskNow | null;
    notes: DeskNote[];
    /** Todos los estudios del proyecto (sin archivados), el más reciente primero. */
    studies: DeskStudy[];
    /** Las herramientas según los libros: Esdras, hebreo y arameo; Santiago, griego. */
    languages: DeskLanguage[];
    exegetical?: ExegeticalDesk;
    course?: CourseDesk;
    general?: { recent: DeskRecent | null };
}

// ── Entrada ────────────────────────────────────────────────────────────

/** Lo que el escritorio lee del proyecto. */
export type DeskProject = Pick<AIProject,
    | 'id' | 'type' | 'contextNote' | 'sourceIds' | 'bibliography' | 'bibliographyCriteria' | 'framing'
    | 'workTypes' | 'charge' | 'courseInfo' | 'courseSchedule' | 'courseScheduleMode' | 'feedbackPatterns'>;

/** El resumen del estudio (`ExegesisPaperSummary`), con lo que lee el escritorio. */
export type DeskStudyInput = Pick<ExegesisPaperSummary, 'id' | 'passage' | 'phase' | 'stepCount' | 'acceptedStepCount'> & {
    title?: string;
    archivedAt?: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    citedSourceKeys?: ReadonlyArray<string>;
    seriesId?: string | null;
    projectWorkTypeId?: string | null;
};

export type DeskSermonInput = SermonProgressLike & {
    id: string;
    status?: string;
    sourceSermonId?: string | null;
    sourcePaperId?: string | null;
    updatedAt: Date | string;
};

export interface DeskOutputInput {
    id: string;
    kind: ProjectOutputKind;
    title?: string;
    updatedAt: Date | string;
}

/** Las plantillas de rúbrica del usuario (`useUserRubrics`): qué existe y cuál es la por defecto. */
export interface DeskRubricCatalog {
    ids: ReadonlyArray<string>;
    defaultId: string | null;
}

export type DeskResourceOf = (id: string) => { title?: string; author?: string | null; exegeticalType?: SourceType | null } | null | undefined;

export interface ProjectDeskInput {
    project: DeskProject;
    /** Los estudios del proyecto, ya filtrados por pertenencia (`projectId` o `linkedProjectIds`). */
    studies: ReadonlyArray<DeskStudyInput>;
    /** Las series: se quedan las del proyecto (`series.projectId`). */
    series?: ReadonlyArray<SerieLike>;
    /**
     * Los sermones. Sirven los del usuario entero: solo se buscan por id, por
     * copia (`sourceSermonId`) y por estudio de origen (`sourcePaperId`).
     * Pasar solo los del proyecto puede dejar sin ver un marcador vacío.
     */
    sermons?: ReadonlyArray<DeskSermonInput>;
    /** El material del proyecto. */
    outputs?: ReadonlyArray<DeskOutputInput>;
    /** Conversaciones del proyecto. */
    sessionCount?: number;
    /** La biblioteca en caché: título y clasificación de un libro (fuentes viejas y requisitos por tipo). */
    resourceOf?: DeskResourceOf;
    /** Sin catálogo (todavía cargando), la rúbrica no se da por faltante. */
    rubricCatalog?: DeskRubricCatalog | null;
    /** Lo que piden las rúbricas por tipo de trabajo, para la cobertura (como el estado del arte). */
    coverageRequirements?: ReadonlyArray<{ sourceType: SourceType; minimum: number; workType: string }>;
    /** Hay un análisis del planificador a medias (borrador): la fase 3 está «en curso». */
    plannerDraft?: boolean;
    /** Lo último que se tocó, si la web lo sabe (General). */
    lastTouched?: { kind: 'study' | 'output'; id: string; label?: string; at: Date | string } | null;
}

// ── Constantes ─────────────────────────────────────────────────────────

/** El plazo que gobierna el «Ahora» del Curso. */
export const DESK_DEADLINE_HOURS = 72;
/** La ventana de una perícopa con fecha cercana. */
export const DESK_UPCOMING_DAYS = 7;
/**
 * Un estudio en configuración cuenta como tocado si se editó al menos esto
 * después de nacer. Supuesto: los que la serie crea en lote se escriben en
 * el acto y no llegan a este margen.
 */
export const DESK_TOUCH_MS = 2 * 60 * 1000;

const MEDIBLES = new Set(['minimum-type', 'quantity', 'date-range', 'perspectives', 'variety']);
const HORA = 3600 * 1000;

// ── Utilidades ─────────────────────────────────────────────────────────

const tiempo = (d: Date | string | null | undefined): number => {
    if (!d) return 0;
    const t = (d instanceof Date ? d : new Date(d)).getTime();
    return Number.isNaN(t) ? 0 : t;
};

const iso = (d: Date | string): string => {
    const t = tiempo(d);
    return t ? new Date(t).toISOString() : '';
};

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` en la hora local del dispositivo. */
function localDay(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

/** Una fecha (Date, ISO o `YYYY-MM-DD`) como día local; `null` si no es fecha. */
function asLocalDay(v: Date | string | null | undefined): string | null {
    if (!v) return null;
    if (typeof v === 'string' && DIA_RE.test(v.trim())) return v.trim();
    const t = tiempo(v);
    return t ? localDay(new Date(t)) : null;
}

/** Horas hasta el FIN del día de entrega (se puede entregar durante ese día). */
function hoursUntilEndOf(day: string, now: Date): number {
    const [y, m, d] = day.split('-').map(Number) as [number, number, number];
    return (new Date(y, m - 1, d, 23, 59, 59, 999).getTime() - now.getTime()) / HORA;
}

function hasText(v: unknown): v is string {
    return typeof v === 'string' && v.trim().length > 0;
}

function phaseText(key: string, params?: Record<string, string | number>): DeskText {
    return params ? { key, params } : { key };
}

// ── Estudios ───────────────────────────────────────────────────────────

function isArchived(s: DeskStudyInput): boolean {
    return !!s.archivedAt || s.phase === 'archived';
}

function stateOf(s: DeskStudyInput): DeskStudyState {
    switch (s.phase) {
        case 'assembled': return 'assembled';
        case 'in-progress': return 'inProgress';
        case 'configuring': return 'notStarted';
        default: return 'none';
    }
}

function normalizeStudies(studies: ReadonlyArray<DeskStudyInput>, annotatedIds: ReadonlySet<string>): DeskStudy[] {
    const vistos = new Set<string>();
    const out: DeskStudy[] = [];
    for (const s of studies) {
        if (!s?.id || vistos.has(s.id) || isArchived(s)) continue;
        vistos.add(s.id);
        const state = stateOf(s);
        const touched = state === 'inProgress'
            || (state === 'notStarted' && tiempo(s.updatedAt) - tiempo(s.createdAt) >= DESK_TOUCH_MS);
        out.push({
            id: s.id,
            title: s.title?.trim() ?? '',
            passage: s.passage,
            state,
            accepted: Math.max(0, s.acceptedStepCount ?? 0),
            total: Math.max(0, s.stepCount ?? 0),
            updatedAt: iso(s.updatedAt),
            touched,
            annotated: annotatedIds.has(s.id),
            seriesId: s.seriesId ?? null,
            workTypeId: s.projectWorkTypeId ?? null,
        });
    }
    return out.sort((a, b) => tiempo(b.updatedAt) - tiempo(a.updatedAt));
}

const NO_STUDY: DeskStudyCell = { id: null, state: 'none', accepted: 0, total: 0 };

function cellOf(s: DeskStudy | undefined): DeskStudyCell {
    return s ? { id: s.id, state: s.state, accepted: s.accepted, total: s.total } : { ...NO_STUDY };
}

/** El estudio no ensamblado tocado más recientemente (la continuidad). */
function continuityStudy(studies: ReadonlyArray<DeskStudy>): DeskStudy | null {
    let mejor: DeskStudy | null = null;
    for (const s of studies) {
        if (s.state === 'assembled' || !s.touched) continue;
        if (!mejor || tiempo(s.updatedAt) > tiempo(mejor.updatedAt)) mejor = s;
    }
    return mejor;
}

// ── Fuentes ────────────────────────────────────────────────────────────

const MANUAL_ORIGINS = new Set<string>(['legacy', 'selector', 'library']);

/**
 * «A mano»: una ficha aprobada sin pasar por el método. Sus orígenes son
 * solo `legacy` (las `sourceIds` de antes), `selector` (el selector de
 * fuentes) o `library`, y al menos uno es de la puerta lateral:
 *   - `legacy` o `selector`;
 *   - o una ficha del selector de ANTES del origen `selector`: solo
 *     `library` y peso «recomendada», con que el selector las creaba. Las
 *     candidatas que el estado del arte trae de la biblioteca nacen
 *     «complementarias» (`libraryCandidates`). Supuesto: si alguien les
 *     subió el peso antes de aprobarlas, cuentan como a mano.
 * Así lo de antes no retrocede (Jonás, NT785) y una candidata de la
 * biblioteca aprobada dentro del estado del arte no cuenta como atajo.
 */
export function isManualApproval(entry: Pick<ProjectBibliographyEntry, 'decision' | 'origins' | 'weight'>): boolean {
    if (entry.decision !== 'approved' || entry.origins.length === 0) return false;
    if (!entry.origins.every(o => MANUAL_ORIGINS.has(o))) return false;
    if (entry.origins.some(o => o === 'legacy' || o === 'selector')) return true;
    return entry.weight === 'recommended';
}

/**
 * El resumen de las fuentes del proyecto, con las funciones del estado del
 * arte (`projectBibliography`, `measureRequirement`, `bibliographyCoverage`).
 * «A mano»: ver `isManualApproval`.
 */
export function deskSourcesSummary(
    project: Pick<DeskProject, 'bibliography' | 'sourceIds' | 'bibliographyCriteria'>,
    resourceOf?: DeskResourceOf,
    coverageRequirements?: ReadonlyArray<{ sourceType: SourceType; minimum: number; workType: string }>,
): DeskSourcesSummary {
    const lookup = (id: string) => {
        const r = resourceOf?.(id);
        return r ? { title: r.title ?? '', author: r.author ?? null, exegeticalType: r.exegeticalType ?? null } : null;
    };
    const tipo = (id: string) => resourceOf?.(id) ?? null;
    const entries: ProjectBibliographyEntry[] = projectBibliography(project, lookup);
    const aprobadas = entries.filter(e => e.decision === 'approved');
    const requisitos = (project.bibliographyCriteria?.requirementItems ?? []).filter(r => MEDIBLES.has(r.kind));
    let met = 0;
    let accepted = 0;
    let incomplete = 0;
    for (const r of requisitos) {
        const m = measureRequirement(r, entries, tipo);
        if (m.status === 'met') met++;
        // Aceptado a propósito: quien estudia lo marcó aunque la medida no llegue.
        else if (r.done === true) { met++; accepted++; }
        else if (m.status === 'incomplete') incomplete++;
    }
    const propios = (project.bibliographyCriteria?.requirementItems ?? [])
        .filter(r => r.kind === 'minimum-type' && r.sourceType && (r.minimum ?? 0) > 0)
        .map(r => ({ sourceType: r.sourceType!, minimum: r.minimum!, workType: '' }));
    const pedidos = [...(coverageRequirements ?? []), ...propios];
    return {
        total: entries.filter(e => e.decision !== 'discarded').length,
        approved: aprobadas.length,
        toAcquire: aprobadas.filter(e => !e.resourceId).length,
        manual: aprobadas.filter(isManualApproval).length,
        candidates: entries.filter(e => e.decision === 'candidate').length,
        discarded: entries.filter(e => e.decision === 'discarded').length,
        requirements: { met, total: requisitos.length, accepted, incomplete },
        requiredToAcquire: aprobadas.filter(e => e.weight === 'required' && !e.resourceId).map(e => ({ entryId: e.id, title: e.title })),
        coverage: coverageRequirements ? bibliographyCoverage(entries, pedidos, tipo) : null,
    };
}

/**
 * La fase de las fuentes, igual en los dos tipos (§4 y §9.1):
 *   - por empezar: sin fichas;
 *   - en curso: solo candidatas, requisitos medibles sin cumplir, o (Curso)
 *     una obligatoria por conseguir;
 *   - lista: ≥ 1 aprobada y los requisitos cumplidos o aceptados. Si TODAS
 *     las aprobadas son «a mano» (Jonás, NT785 antes del estado del arte),
 *     queda lista como «N agregadas a mano»: lo de antes no retrocede.
 */
function sourcesPhase(s: DeskSourcesSummary, course: boolean): DeskPhase {
    const progress = s.requirements.total > 0 ? { done: s.requirements.met, total: s.requirements.total } : undefined;
    const base = (status: DeskPhaseStatus, evidence: DeskText): DeskPhase => ({ id: 'sources', status, evidence, ...(progress ? { progress } : {}) });
    if (s.approved === 0 && s.candidates === 0) return base('todo', phaseText('desk.sources.todo'));
    if (s.approved === 0) return base('doing', phaseText('desk.sources.candidatesOnly', { candidates: s.candidates }));
    if (course && s.requiredToAcquire.length > 0) {
        return base('doing', phaseText('desk.sources.requiredToAcquire', { approved: s.approved, count: s.requiredToAcquire.length }));
    }
    if (s.manual === s.approved) return base('ready', phaseText('desk.sources.readyManual', { count: s.approved }));
    if (s.requirements.met >= s.requirements.total) {
        return base('ready', s.requirements.total > 0
            ? phaseText('desk.sources.readyRequirements', { approved: s.approved, toAcquire: s.toAcquire, met: s.requirements.met, total: s.requirements.total })
            : phaseText('desk.sources.ready', { approved: s.approved, toAcquire: s.toAcquire }));
    }
    return base('doing', phaseText('desk.sources.requirementsPending', { approved: s.approved, met: s.requirements.met, total: s.requirements.total }));
}

// ── Lenguas ────────────────────────────────────────────────────────────

function deskLanguages(project: DeskProject, studies: ReadonlyArray<{ passage: PassageReference }>): DeskLanguage[] {
    const libros = projectBibleBooks(project.bibliographyCriteria, studies);
    const out = new Set<DeskLanguage>();
    for (const b of libros) {
        const book = getBookById(b);
        if (!book) continue;
        if (book.testament === 'NT') out.add('greek');
        else out.add('hebrew');
        if (BOOKS_WITH_ARAMAIC_SECTIONS.has(b)) out.add('aramaic');
    }
    return (['hebrew', 'aramaic', 'greek'] as const).filter(l => out.has(l));
}

// ── Exegético ──────────────────────────────────────────────────────────

function annotatedStudyIds(log: ReadonlyArray<HypothesisEntry>): Set<string> {
    return new Set(log.filter(e => e.source === 'study' && e.studyId).map(e => e.studyId!));
}

function readingOf(study: DeskStudy | undefined): DeskReadingState {
    if (!study) return 'none';
    if (study.annotated) return 'annotated';
    return study.state === 'assembled' ? 'pending' : 'none';
}

function oldNoteOf(project: DeskProject, outputs: ReadonlyArray<DeskOutputInput>, status: FramingStatus): DeskOldNote | null {
    if (status === 'complete') return null;
    if (hasText(project.contextNote)) return { source: 'contextNote' };
    const nota = [...outputs].filter(o => o.kind === 'note').sort((a, b) => tiempo(b.updatedAt) - tiempo(a.updatedAt))[0];
    return nota ? { source: 'output', outputId: nota.id } : null;
}

function emptyCounts(): DeskTableCounts {
    return { units: 0, assembled: 0, annotated: 0, pendingReading: 0, inProgress: 0, withSermon: 0 };
}

/** Suma una unidad (o un estudio suelto) a los conteos. */
function addUnit(c: DeskTableCounts, study: DeskStudy | undefined, withSermon: boolean): void {
    c.units++;
    if (study?.state === 'assembled') c.assembled++;
    if (study?.state === 'inProgress') c.inProgress++;
    if (study?.annotated) c.annotated++;
    if (readingOf(study) === 'pending') c.pendingReading++;
    if (withSermon) c.withSermon++;
}

function sumCounts(a: DeskTableCounts, b: DeskTableCounts): DeskTableCounts {
    return {
        units: a.units + b.units, assembled: a.assembled + b.assembled, annotated: a.annotated + b.annotated,
        pendingReading: a.pendingReading + b.pendingReading, inProgress: a.inProgress + b.inProgress, withSermon: a.withSermon + b.withSermon,
    };
}

/**
 * El sermón de una perícopa: el del plan (`draftId`) como lo lee
 * `seriesPericopeRows`; si el plan no lo tiene, uno nacido del estudio
 * (`sourcePaperId`), como el sermón 1 de Jonás vinculado a mano.
 */
function sermonOfRow(
    planned: { sermonId: string | null; sermonState: PericopeSermonState },
    paperId: string | null,
    sermons: ReadonlyArray<DeskSermonInput>,
): { sermonId: string | null; sermon: PericopeSermonState } {
    if (planned.sermonState !== 'none' || !paperId) return { sermonId: planned.sermonId, sermon: planned.sermonState };
    const delEstudio = sermons.filter(s => s.sourcePaperId === paperId && s.status !== 'archived' && !isEmptySermonPlaceholder(s));
    if (delEstudio.length === 0) return { sermonId: planned.sermonId, sermon: 'none' };
    const publicado = delEstudio.find(s => s.status === 'published');
    const elegido = publicado ?? [...delEstudio].sort((a, b) => tiempo(b.updatedAt) - tiempo(a.updatedAt))[0]!;
    return { sermonId: elegido.id, sermon: publicado ? 'published' : 'draft' };
}

function buildExegetical(input: ProjectDeskInput, studies: DeskStudy[]): { desk: ExegeticalDesk; phases: DeskPhase[] } {
    const { project } = input;
    const outputs = input.outputs ?? [];
    const sermons = input.sermons ?? [];
    const framing = project.framing ?? null;
    const log = framing?.hypothesisLog ?? [];
    const fs = framingStatus(project);
    const oldNote = oldNoteOf(project, outputs, fs.status);
    const revised = currentRevisedIdea(framing);
    const original = hasText(framing?.centralIdea) ? framing!.centralIdea!.trim() : null;
    const revision: DeskRevisionState = !framing?.revision ? 'none' : isRevisionStale(framing) ? 'stale' : 'current';
    const purpose: FramingPurpose = framing?.purpose ?? 'preach';
    const deskFraming: DeskFraming = {
        status: fs.status,
        missing: fs.missing.length,
        purpose,
        idea: revised ?? original,
        ideaSource: revised ? 'revised' : original ? 'original' : null,
        originalIdea: original,
        revisedIdea: revised,
        revision,
        movements: framing?.structure ?? [],
        oldNote,
        divisionWithoutSeries: framing?.divisionWithoutSeries === true,
    };

    // La mesa: una fila por perícopa planificada, agrupada por serie.
    const porId = new Map(studies.map(s => [s.id, s]));
    const series = projectSeriesOf(input.series ?? [], project.id);
    const enPlan = new Set<string>();
    const groups: DeskSeriesGroup[] = series.map(serie => {
        const planned = serie.metadata?.plannedSermons ?? [];
        // Solo se usa su lectura del sermón; el estudio se cruza aquí con `porId`.
        const filasPlan = seriesPericopeRows(serie, id => {
            const s = porId.get(id);
            return s ? { id: s.id, title: s.title, phase: s.state } : undefined;
        }, sermons);
        const unidades = plannedUnits(planned.map(p => ({ id: p.id, title: p.title ?? '', passage: p.passage ?? '', paperId: p.paperId ?? undefined })));
        const posicion = new Map<string, number>();
        unidades.forEach((u, i) => u.forEach(r => posicion.set(r.id, i + 1)));
        const rows: DeskPericopeRow[] = planned.map((p, i) => {
            const paperId = p.paperId ?? null;
            if (paperId) enPlan.add(paperId);
            const study = paperId ? porId.get(paperId) : undefined;
            const plan = filasPlan[i]!;
            const { sermonId, sermon } = sermonOfRow(plan, study ? paperId : null, sermons);
            return {
                plannedId: p.id,
                position: posicion.get(p.id) ?? i + 1,
                label: p.passage?.trim() || p.title?.trim() || '',
                title: p.title?.trim() ?? '',
                date: asLocalDay(p.scheduledDate ?? null),
                study: cellOf(study),
                reading: readingOf(study),
                sermon,
                sermonId,
            };
        });
        const counts = emptyCounts();
        // Una unidad en varios domingos cuenta una vez: su estudio y si alguna fila tiene sermón.
        for (const u of unidades) {
            const filas = u.map(r => rows.find(x => x.plannedId === r.id)!);
            const paperId = u.find(r => r.paperId)?.paperId;
            addUnit(counts, paperId ? porId.get(paperId) : undefined, filas.some(f => f.sermon !== 'none'));
        }
        return { seriesId: serie.id, title: serie.title?.trim() ?? '', rows, counts };
    });
    const looseStudies = studies.filter(s => !enPlan.has(s.id));
    const sueltos = emptyCounts();
    for (const s of looseStudies) {
        addUnit(sueltos, s, sermons.some(x => x.sourcePaperId === s.id && x.status !== 'archived' && !isEmptySermonPlaceholder(x)));
    }
    const counts = groups.reduce((acc, g) => sumCounts(acc, g.counts), sueltos);

    // La síntesis: se abre con la primera anotación.
    const porVeredicto: Record<HypothesisVerdict, number> = { confirms: 0, nuances: 0, contradicts: 0 };
    for (const e of log) porVeredicto[e.verdict] = (porVeredicto[e.verdict] ?? 0) + 1;
    const synthesis: DeskSynthesis = {
        open: log.length > 0,
        annotations: log.length,
        counts: porVeredicto,
        latest: [...log].sort((a, b) => tiempo(b.at) - tiempo(a.at)).slice(0, 3),
        canRevise: !!original && log.length > 0,
        revision,
    };
    const sources = deskSourcesSummary(project, input.resourceOf, input.coverageRequirements);

    // ── Fases (§4 y decisiones del fundador) ──
    const fase1: DeskPhase = fs.status === 'complete'
        ? { id: 'passage', status: 'ready', evidence: phaseText('desk.exegetical.passage.ready', { movements: deskFraming.movements.length }) }
        : oldNote
            // La nota vieja ya no completa: queda en curso, con «Pasar tu nota al encuadre».
            ? { id: 'passage', status: 'doing', evidence: phaseText('desk.exegetical.passage.oldNote') }
            : fs.status === 'partial'
                ? { id: 'passage', status: 'doing', evidence: phaseText('desk.exegetical.passage.partial', { missing: fs.missing.length }) }
                : { id: 'passage', status: 'todo', evidence: phaseText('desk.exegetical.passage.todo') };

    const fase2 = sourcesPhase(sources, false);

    const sinSerie = (purpose === 'teach' || purpose === 'personal') && deskFraming.divisionWithoutSeries;
    const unidadesPlan = groups.reduce((n, g) => n + g.counts.units, 0);
    const fase3: DeskPhase = series.length > 0
        ? { id: 'division', status: 'ready', evidence: phaseText('desk.exegetical.division.readySeries', { series: series.length, units: unidadesPlan }), dependsOn: ['passage'] }
        : sinSerie
            ? { id: 'division', status: 'ready', evidence: phaseText('desk.exegetical.division.readyWithoutSeries'), dependsOn: ['passage'] }
            : input.plannerDraft
                ? { id: 'division', status: 'doing', evidence: phaseText('desk.exegetical.division.draft'), dependsOn: ['passage'] }
                : { id: 'division', status: 'todo', evidence: phaseText('desk.exegetical.division.todo'), dependsOn: ['passage'] };

    // Fase 4: solo cuentan los ensamblados; la anotación no.
    const progreso = { done: counts.assembled, total: counts.units };
    const fase4: DeskPhase = counts.units === 0
        ? { id: 'pericopes', status: 'todo', evidence: phaseText('desk.exegetical.pericopes.empty'), progress: progreso, dependsOn: ['division'] }
        : counts.assembled === 0
            ? { id: 'pericopes', status: 'todo', evidence: phaseText('desk.exegetical.pericopes.todo', { total: counts.units }), progress: progreso, dependsOn: ['division'] }
            : counts.assembled < counts.units
                ? { id: 'pericopes', status: 'doing', evidence: phaseText('desk.exegetical.pericopes.progress', { done: counts.assembled, total: counts.units, annotated: counts.annotated }), progress: progreso, dependsOn: ['division'] }
                : { id: 'pericopes', status: 'ready', evidence: phaseText('desk.exegetical.pericopes.ready', { total: counts.units, annotated: counts.annotated }), progress: progreso, dependsOn: ['division'] };

    // Fase 5: lista solo con la idea revisada y vigente. La nota que se pasa al encuadre no es síntesis.
    const otrasSalidas = outputs.filter(o => !(oldNote?.source === 'output' && o.id === oldNote.outputId)).length;
    const fase5: DeskPhase = revised
        ? { id: 'synthesis', status: 'ready', evidence: phaseText('desk.exegetical.synthesis.ready'), dependsOn: ['pericopes'] }
        : revision === 'stale'
            ? { id: 'synthesis', status: 'doing', evidence: phaseText('desk.exegetical.synthesis.stale'), dependsOn: ['pericopes'] }
            : log.length > 0 || (input.sessionCount ?? 0) > 0 || otrasSalidas > 0
                ? { id: 'synthesis', status: 'doing', evidence: phaseText('desk.exegetical.synthesis.progress', { annotations: log.length }), dependsOn: ['pericopes'] }
                : { id: 'synthesis', status: 'todo', evidence: phaseText('desk.exegetical.synthesis.todo'), dependsOn: ['pericopes'] };

    return {
        desk: { framing: deskFraming, sources, series: groups, looseStudies, counts, synthesis },
        phases: [fase1, fase2, fase3, fase4, fase5],
    };
}

// ── Curso ──────────────────────────────────────────────────────────────

/** De dónde sale la rúbrica del tipo y si está resuelta (ver `DeskRubricSource`). */
export function workTypeRubric(
    workType: Pick<ProjectWorkType, 'rubricTemplateId'>,
    catalog: DeskRubricCatalog | null | undefined,
): { source: DeskRubricSource; resolved: boolean } {
    const id = workType.rubricTemplateId;
    if (id === null || id === STRATEGY_ONLY_RUBRIC_PRESET_ID) return { source: 'system', resolved: true };
    if (typeof id === 'string' && id.trim()) {
        // Sin catálogo no se sabe si existe: no se inventa un faltante mientras carga.
        if (!catalog || catalog.ids.includes(id)) return { source: 'template', resolved: true };
        return { source: 'missing', resolved: false };
    }
    if (!catalog) return { source: 'default', resolved: true };
    return catalog.defaultId ? { source: 'default', resolved: true } : { source: 'unset', resolved: false };
}

function deliveryOf(e: CourseScheduleEntry): DeskDelivery {
    if (e.feedback) return e.feedback.none ? 'noFeedback' : 'returned';
    return e.deliveredAt ? 'delivered' : 'notDelivered';
}

/** El orden del calendario: con fecha primero, por fecha; empates y sin fecha, en el orden guardado. */
function calendarOrder(entries: ReadonlyArray<CourseScheduleEntry>): CourseScheduleEntry[] {
    return entries
        .map((e, i) => ({ e, i, d: e.dueDate && DIA_RE.test(e.dueDate) ? e.dueDate : null }))
        .sort((a, b) => (a.d && b.d ? a.d.localeCompare(b.d) || a.i - b.i : a.d ? -1 : b.d ? 1 : a.i - b.i))
        .map(x => x.e);
}

const claveCita = (k: string) => k.trim().toLowerCase();

function buildCourse(input: ProjectDeskInput, studies: DeskStudy[], now: Date): { desk: CourseDesk; phases: DeskPhase[] } {
    const { project } = input;
    const porId = new Map(studies.map(s => [s.id, s]));
    const citas = new Map(input.studies.map(s => [s.id, (s.citedSourceKeys ?? []).map(claveCita).filter(Boolean)]));
    const tipos = projectWorkTypes(project);
    const tipoPorId = new Map(tipos.map(t => [t.id, t]));
    const guiaCurso = project.courseInfo?.styleGuideId ?? null;
    const noRepeat = noRepeatApplies(project);
    const entradas = calendarOrder((project.courseSchedule ?? []).filter(e => !!e?.id));
    const mode: CourseScheduleMode | null = project.courseScheduleMode ?? (entradas.length > 0 ? 'calendar' : null);
    const hoy = localDay(now);

    // Las filas, en el orden del calendario. «No repetir» compara con la
    // entrega anterior del MISMO tipo que ya tiene estudio.
    const anteriorPorTipo = new Map<string, { label: string; keys: string[] }>();
    const rows: DeskScheduleRow[] = entradas.map(e => {
        const study = e.paperId ? porId.get(e.paperId) : undefined;
        const delivery = deliveryOf(e);
        const dueDate = e.dueDate && DIA_RE.test(e.dueDate) ? e.dueDate : null;
        let sources: DeskSourceRepeat = 'n/a';
        let repeated: string[] = [];
        let comparedWith: string | null = null;
        if (noRepeat && study) {
            const keys = citas.get(study.id) ?? [];
            const previa = anteriorPorTipo.get(e.workTypeId);
            if (previa) {
                comparedWith = previa.label;
                repeated = [...new Set(keys.filter(k => previa.keys.includes(k)))];
            }
            sources = repeated.length > 0 ? 'repeats' : 'noRepeat';
            anteriorPorTipo.set(e.workTypeId, { label: e.label, keys });
        }
        return {
            entryId: e.id,
            workTypeId: e.workTypeId,
            workTypeKnown: tipoPorId.has(e.workTypeId),
            label: e.label?.trim() ?? '',
            passage: e.passage ?? null,
            dueDate,
            overdue: !!dueDate && dueDate < hoy && delivery === 'notDelivered',
            hoursLeft: dueDate ? Math.floor(hoursUntilEndOf(dueDate, now)) : null,
            study: cellOf(study),
            sources,
            repeated,
            comparedWith,
            delivery,
            imported: e.imported === true,
        };
    });
    const groups: DeskScheduleGroup[] = [
        ...tipos.map(t => ({ workTypeId: t.id, label: t.label, rows: rows.filter(r => r.workTypeId === t.id) })).filter(g => g.rows.length > 0),
        ...[...new Set(rows.filter(r => !r.workTypeKnown).map(r => r.workTypeId))].map(id => ({ workTypeId: id, label: '', rows: rows.filter(r => r.workTypeId === id) })),
    ];
    const conEntrada = new Set(entradas.map(e => e.paperId).filter((x): x is string => !!x));
    const offCalendar = studies.filter(s => !conEntrada.has(s.id));

    const workTypes: DeskWorkType[] = tipos.map(t => {
        const r = workTypeRubric(t, input.rubricCatalog);
        return {
            id: t.id, label: t.label, rubric: r.source, rubricResolved: r.resolved,
            method: t.exegeticalMethod ?? null, guideId: t.styleGuideId || guiaCurso || null,
            entries: rows.filter(x => x.workTypeId === t.id).length,
        };
    });

    const sources = deskSourcesSummary(project, input.resourceOf, input.coverageRequirements);
    // Lectura dirigida: los requisitos de páginas, medidos con las fichas reseñadas.
    const entries = projectBibliography(project, id => {
        const r = input.resourceOf?.(id);
        return r ? { title: r.title ?? '', author: r.author ?? null, exegeticalType: r.exegeticalType ?? null } : null;
    });
    const directedReading: DeskDirectedReading[] = (project.bibliographyCriteria?.requirementItems ?? [])
        .filter(r => r.kind === 'quantity' && r.unit === 'pages')
        .map(r => {
            const m = measureRequirement(r, entries, id => input.resourceOf?.(id) ?? null);
            return { requirementId: r.id, text: r.text, pages: m.value, target: m.target, pending: m.unmeasurable.length };
        });

    // El registro de devoluciones: cada patrón con sus correcciones y dónde aparece.
    const patrones = project.feedbackPatterns ?? [];
    const patterns: DeskPatternRow[] = patrones.filter(p => !!p?.id).map(p => {
        let corrections = 0;
        const donde: Array<{ entryId: string; label: string }> = [];
        for (const e of entradas) {
            if (!e.feedback || e.feedback.none) continue;
            const n = (e.feedback.corrections ?? []).filter(c => c.patternId === p.id).length;
            if (n === 0) continue;
            corrections += n;
            donde.push({ entryId: e.id, label: e.label?.trim() ?? '' });
        }
        return { patternId: p.id, name: p.name, decision: p.decision, corrections, entries: donde };
    }).sort((a, b) => Number(a.decision !== 'pending') - Number(b.decision !== 'pending') || b.corrections - a.corrections);
    const delivered = rows.filter(r => r.delivery !== 'notDelivered').length;
    const returned = rows.filter(r => r.delivery === 'returned').length;
    const noFeedback = rows.filter(r => r.delivery === 'noFeedback').length;
    const awaiting = rows.filter(r => r.delivery === 'delivered').length;
    const repeatedPending = patterns.filter(p => p.decision === 'pending' && p.corrections >= 2).length;

    // ── Fases (§9.1) ──
    const sinResolver = workTypes.filter(w => !w.rubricResolved).length;
    const fase1: DeskPhase = workTypes.length === 0
        ? { id: 'charge', status: 'todo', evidence: phaseText('desk.course.charge.todo') }
        : sinResolver > 0
            ? { id: 'charge', status: 'doing', evidence: phaseText('desk.course.charge.unresolved', { types: workTypes.length, unresolved: sinResolver }) }
            : { id: 'charge', status: 'ready', evidence: phaseText('desk.course.charge.ready', { types: workTypes.length }) };

    const fase2 = sourcesPhase(sources, true);

    const incompletas = rows.filter(r => !r.workTypeKnown || !r.dueDate).length;
    const fase3: DeskPhase = mode === 'free'
        ? { id: 'calendar', status: 'ready', evidence: phaseText('desk.course.calendar.free'), dependsOn: ['charge'] }
        : rows.length === 0
            ? { id: 'calendar', status: 'todo', evidence: phaseText('desk.course.calendar.todo'), dependsOn: ['charge'] }
            : incompletas > 0
                ? { id: 'calendar', status: 'doing', evidence: phaseText('desk.course.calendar.incomplete', { entries: rows.length, missing: incompletas }), progress: { done: rows.length - incompletas, total: rows.length }, dependsOn: ['charge'] }
                : { id: 'calendar', status: 'ready', evidence: phaseText('desk.course.calendar.ready', { entries: rows.length }), dependsOn: ['charge'] };

    // Fase 4: k de N ensamblados. Con calendario, N son sus entradas (con o
    // sin estudio); sin calendario, los estudios del proyecto.
    const conCalendario = mode !== 'free' && rows.length > 0;
    const total = conCalendario ? rows.length : studies.length;
    const hechos = conCalendario ? rows.filter(r => r.study.state === 'assembled').length : studies.filter(s => s.state === 'assembled').length;
    const progreso = { done: hechos, total };
    const fase4: DeskPhase = total === 0
        ? { id: 'works', status: 'todo', evidence: phaseText('desk.course.works.empty'), progress: progreso, dependsOn: ['calendar'] }
        : hechos === 0
            ? { id: 'works', status: 'todo', evidence: phaseText('desk.course.works.todo', { total }), progress: progreso, dependsOn: ['calendar'] }
            : hechos < total
                ? { id: 'works', status: 'doing', evidence: phaseText('desk.course.works.progress', { done: hechos, total, delivered }), progress: progreso, dependsOn: ['calendar'] }
                : { id: 'works', status: 'ready', evidence: phaseText('desk.course.works.ready', { total, delivered }), progress: progreso, dependsOn: ['calendar'] };

    // Fase 5: lista cuando cada entrega tiene su devolución (o «sin
    // devolución» a propósito) y ningún patrón repetido queda sin decidir.
    const conDevolucion = returned + noFeedback;
    const fase5: DeskPhase = conDevolucion === 0
        ? { id: 'feedback', status: 'todo', evidence: phaseText('desk.course.feedback.todo'), dependsOn: ['works'] }
        : awaiting === 0 && repeatedPending === 0
            ? { id: 'feedback', status: 'ready', evidence: phaseText('desk.course.feedback.ready', { returned: conDevolucion }), dependsOn: ['works'] }
            : { id: 'feedback', status: 'doing', evidence: phaseText('desk.course.feedback.progress', { returned: conDevolucion, delivered, pendingPatterns: repeatedPending }), dependsOn: ['works'] };

    return {
        desk: {
            workTypes, noRepeat, sources,
            schedule: { mode, rows, groups },
            offCalendar, directedReading,
            feedback: { patterns, delivered, returned, noFeedback, awaiting, repeatedPending },
        },
        phases: [fase1, fase2, fase3, fase4, fase5],
    };
}

// ── «Ahora» ────────────────────────────────────────────────────────────

/** Lo que `deskNow` y `deskNotes` leen del modelo. */
export type DeskNowBasis = Pick<ProjectDeskModel, 'type' | 'phases' | 'activePhaseId' | 'studies' | 'exegetical' | 'course' | 'general'>;

/** El rótulo de un estudio en el Exegético: el pasaje de su fila del plan, o su título. */
function exegeticalLabel(desk: ExegeticalDesk, study: DeskStudy): { label: string; position: number | null } {
    for (const g of desk.series) {
        const fila = g.rows.find(r => r.study.id === study.id);
        if (fila) return { label: fila.label, position: fila.position };
    }
    return { label: study.title, position: null };
}

/** El rótulo de un estudio en el Curso: el de su entrada del calendario, o su título. */
function courseLabel(desk: CourseDesk, studyId: string, fallback: string): string {
    return desk.schedule.rows.find(r => r.study.id === studyId)?.label || fallback;
}

function studyTarget(id: string, label: string): DeskTarget {
    return { type: 'study', id, label };
}

/** El botón de la fase activa (la regla del método, cuando no hay continuidad). */
function phaseNow(basis: DeskNowBasis, phaseId: string): DeskNow | null {
    const fase = (kind: DeskNowKind, key: string, target: DeskTarget, params?: Record<string, string | number>, extra: Partial<DeskNow> = {}): DeskNow =>
        ({ kind, text: phaseText(key, params), target, ...extra });
    const ex = basis.exegetical;
    const co = basis.course;
    if (basis.type === 'exegetical' && ex) {
        switch (phaseId) {
            case 'passage': {
                const key = ex.framing.oldNote ? 'desk.now.passageOldNote' : ex.framing.status === 'partial' ? 'desk.now.passagePartial' : 'desk.now.passage';
                return fase('phase', key, { type: 'framing', phaseId });
            }
            case 'sources': return fase('phase', 'desk.now.sources', { type: 'stateOfArt', phaseId });
            case 'division': return fase('phase', 'desk.now.division', { type: 'planSeries', phaseId });
            case 'pericopes': {
                // El siguiente estudio sin ensamblar, en el orden del plan; luego los sueltos.
                for (const g of ex.series) {
                    const fila = g.rows.find(r => r.study.id && r.study.state !== 'assembled');
                    if (fila) return fase('phase', 'desk.now.pericope', studyTarget(fila.study.id!, fila.label), { position: fila.position, label: fila.label });
                }
                const suelto = ex.looseStudies.find(s => s.state !== 'assembled');
                if (suelto) return fase('phase', 'desk.now.study', studyTarget(suelto.id, suelto.title), { label: suelto.title });
                return fase('phase', 'desk.now.newStudy', { type: 'phase', phaseId });
            }
            case 'synthesis': {
                if (ex.synthesis.canRevise) return fase('phase', 'desk.now.reviseIdea', { type: 'reviseIdea', phaseId });
                const porAnotar = basis.studies.find(s => s.state === 'assembled' && !s.annotated);
                if (porAnotar) {
                    const { label } = exegeticalLabel(ex, porAnotar);
                    return fase('phase', 'desk.now.annotate', studyTarget(porAnotar.id, label), { label });
                }
                return fase('phase', 'desk.now.synthesis', { type: 'phase', phaseId });
            }
        }
    }
    if (basis.type === 'course' && co) {
        switch (phaseId) {
            case 'charge': return fase('phase', 'desk.now.charge', { type: 'phase', phaseId });
            case 'sources': return fase('phase', 'desk.now.sources', { type: 'stateOfArt', phaseId });
            case 'calendar': return fase('phase', 'desk.now.calendar', { type: 'phase', phaseId });
            case 'works': {
                if (co.schedule.mode !== 'free') {
                    const fila = co.schedule.rows.find(r => r.study.state !== 'assembled');
                    if (fila?.study.id) return fase('phase', 'desk.now.work', studyTarget(fila.study.id, fila.label), { label: fila.label });
                    if (fila) {
                        return fase('phase', 'desk.now.workCreate', { type: 'createScheduled', id: fila.entryId, workTypeId: fila.workTypeId, label: fila.label }, { label: fila.label },
                            fila.dueDate ? { dueDate: fila.dueDate } : {});
                    }
                }
                const suelto = basis.studies.find(s => s.state !== 'assembled');
                if (suelto) {
                    const label = courseLabel(co, suelto.id, suelto.title);
                    return fase('phase', 'desk.now.work', studyTarget(suelto.id, label), { label });
                }
                return fase('phase', 'desk.now.newWork', { type: 'phase', phaseId });
            }
            case 'feedback': {
                const sin = co.schedule.rows.find(r => r.delivery === 'delivered');
                if (sin) return fase('phase', 'desk.now.recordFeedback', { type: 'recordFeedback', id: sin.entryId, label: sin.label }, { label: sin.label });
                if (co.feedback.repeatedPending > 0) return fase('phase', 'desk.now.decidePatterns', { type: 'phase', phaseId }, { count: co.feedback.repeatedPending });
                return fase('phase', 'desk.now.feedback', { type: 'phase', phaseId });
            }
        }
    }
    return null;
}

/**
 * El único botón lleno del escritorio. Reglas (tabla de pruebas en
 * `__tests__/projectDeskNow.test.ts`):
 *
 * Exegético — la continuidad antes que el método:
 *   1. el estudio no ensamblado tocado más recientemente;
 *   2. si no, la perícopa con fecha en los próximos 7 días cuyo estudio no
 *      está ensamblado (la más cercana);
 *   3. si no, la fase activa: 1 → encuadre; 2 → estado del arte;
 *      3 → planificar la serie; 4 → el siguiente estudio sin ensamblar en el
 *      orden del plan; 5 → revisar la idea si hay anotaciones.
 *
 * Curso — el plazo gobierna:
 *   1. el trabajo que vence en ≤ 72 h (hasta el fin del día de entrega) y no
 *      está entregado, el más próximo: ensamblado → «Revisar antes de
 *      entregar»; con estudio → «Continuar»; sin estudio → crearlo;
 *   2. la continuidad;
 *   3. la próxima entrada sin estudio del calendario (no vencida) → crearla
 *      con su tipo y su rótulo;
 *   4. la fase activa.
 *
 * General: lo último que se tocó (estudio o material), o nada.
 * Otros tipos: nada (la web conserva su recorrido).
 */
export function deskNow(basis: DeskNowBasis, now: Date): DeskNow | null {
    if (basis.type === 'general') {
        const r = basis.general?.recent;
        if (!r) return null;
        return {
            kind: 'recent',
            text: phaseText(r.kind === 'study' ? 'desk.now.recentStudy' : 'desk.now.recentOutput', { label: r.label }),
            target: { type: r.kind === 'study' ? 'study' : 'output', id: r.id, label: r.label },
        };
    }
    if (basis.type === 'course' && basis.course) {
        const co = basis.course;
        const urgente = co.schedule.rows
            .filter(r => r.delivery === 'notDelivered' && r.dueDate && r.hoursLeft !== null)
            .map(r => ({ r, h: hoursUntilEndOf(r.dueDate!, now) }))
            .filter(x => x.h >= 0 && x.h <= DESK_DEADLINE_HOURS)
            .sort((a, b) => a.h - b.h)[0];
        if (urgente) {
            const { r } = urgente;
            const extra = { dueDate: r.dueDate!, hoursLeft: Math.floor(urgente.h) };
            if (r.study.id) {
                const listo = r.study.state === 'assembled';
                return {
                    kind: 'deadline',
                    text: phaseText(listo ? 'desk.now.deadline.review' : 'desk.now.deadline.continue',
                        listo ? { label: r.label } : { label: r.label, done: r.study.accepted, total: r.study.total }),
                    target: studyTarget(r.study.id, r.label),
                    ...extra,
                };
            }
            return {
                kind: 'deadline',
                text: phaseText('desk.now.deadline.create', { label: r.label }),
                target: { type: 'createScheduled', id: r.entryId, workTypeId: r.workTypeId, label: r.label },
                ...extra,
            };
        }
        const sigue = continuityStudy(basis.studies);
        if (sigue) {
            const label = courseLabel(co, sigue.id, sigue.title);
            return { kind: 'continuity', text: phaseText('desk.now.continue', { label, done: sigue.accepted, total: sigue.total }), target: studyTarget(sigue.id, label) };
        }
        if (co.schedule.mode !== 'free') {
            const proxima = co.schedule.rows.find(r => !r.study.id && r.delivery === 'notDelivered' && !r.overdue);
            if (proxima) {
                return {
                    kind: 'scheduled',
                    text: phaseText('desk.now.createScheduled', { label: proxima.label }),
                    target: { type: 'createScheduled', id: proxima.entryId, workTypeId: proxima.workTypeId, label: proxima.label },
                    ...(proxima.dueDate ? { dueDate: proxima.dueDate } : {}),
                };
            }
        }
        return basis.activePhaseId ? phaseNow(basis, basis.activePhaseId) : null;
    }
    if (basis.type === 'exegetical' && basis.exegetical) {
        const ex = basis.exegetical;
        const sigue = continuityStudy(basis.studies);
        if (sigue) {
            const { label, position } = exegeticalLabel(ex, sigue);
            return position !== null
                ? { kind: 'continuity', text: phaseText('desk.now.continuePericope', { position, label, done: sigue.accepted, total: sigue.total }), target: studyTarget(sigue.id, label) }
                : { kind: 'continuity', text: phaseText('desk.now.continue', { label, done: sigue.accepted, total: sigue.total }), target: studyTarget(sigue.id, label) };
        }
        const hoy = localDay(now);
        const limite = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + DESK_UPCOMING_DAYS));
        let cercana: DeskPericopeRow | null = null;
        for (const g of ex.series) {
            for (const r of g.rows) {
                if (!r.date || !r.study.id || r.study.state === 'assembled' || r.date < hoy || r.date > limite) continue;
                if (!cercana || r.date < cercana.date!) cercana = r;
            }
        }
        if (cercana) {
            return {
                kind: 'upcoming',
                text: phaseText('desk.now.upcomingPericope', { position: cercana.position, label: cercana.label }),
                target: studyTarget(cercana.study.id!, cercana.label),
                dueDate: cercana.date!,
            };
        }
        return basis.activePhaseId ? phaseNow(basis, basis.activePhaseId) : null;
    }
    return null;
}

// ── Notas ──────────────────────────────────────────────────────────────

const mismoDestino = (a: DeskTarget, b: DeskTarget | undefined) => !!b && a.type === b.type && (a.id ?? null) === (b.id ?? null);

/**
 * Lo que falta del método, como notas secundarias:
 *   - lo concreto (Exegético: la nota vieja por pasar, estudios ensamblados
 *     por anotar, la revisión desactualizada; Curso: obligatorias por
 *     conseguir, entregas vencidas, entregas sin devolución, patrones
 *     repetidos sin decidir);
 *   - y, cuando «Ahora» no es la fase activa (ganó la continuidad o el
 *     plazo), esa fase como nota (`desk.notes.phase.<id>`), salvo que ya
 *     haya una nota concreta de la misma fase.
 * Nada repite el destino de «Ahora».
 */
export function deskNotes(basis: DeskNowBasis, current: DeskNow | null): DeskNote[] {
    const out: DeskNote[] = [];
    const add = (n: DeskNote) => { if (!mismoDestino(n.target, current?.target)) out.push(n); };
    const ex = basis.exegetical;
    const co = basis.course;
    if (basis.type === 'exegetical' && ex) {
        if (ex.framing.oldNote) add({ text: phaseText('desk.notes.oldNote'), target: { type: 'framing', phaseId: 'passage' }, phaseId: 'passage' });
        const porAnotar = basis.studies.filter(s => s.state === 'assembled' && !s.annotated);
        if (porAnotar.length > 0) {
            const primero = porAnotar[0]!;
            add({ text: phaseText('desk.notes.readingPending', { count: porAnotar.length }), target: studyTarget(primero.id, exegeticalLabel(ex, primero).label), phaseId: 'synthesis' });
        }
        if (ex.synthesis.revision === 'stale') add({ text: phaseText('desk.notes.revisionStale'), target: { type: 'reviseIdea', phaseId: 'synthesis' }, phaseId: 'synthesis' });
    }
    if (basis.type === 'course' && co) {
        for (const r of co.sources.requiredToAcquire) {
            add({ text: phaseText('desk.notes.requiredToAcquire', { title: r.title }), target: { type: 'stateOfArt', id: r.entryId, phaseId: 'sources' }, phaseId: 'sources' });
        }
        for (const r of co.schedule.rows.filter(x => x.overdue)) {
            add({
                text: phaseText('desk.notes.overdue', { label: r.label, dueDate: r.dueDate ?? '' }),
                target: r.study.id ? studyTarget(r.study.id, r.label) : { type: 'scheduleEntry', id: r.entryId, label: r.label },
                phaseId: 'works',
            });
        }
        for (const r of co.schedule.rows.filter(x => x.delivery === 'delivered')) {
            add({ text: phaseText('desk.notes.noFeedback', { label: r.label }), target: { type: 'recordFeedback', id: r.entryId, label: r.label }, phaseId: 'feedback' });
        }
        if (co.feedback.repeatedPending > 0) {
            add({ text: phaseText('desk.notes.pendingPatterns', { count: co.feedback.repeatedPending }), target: { type: 'phase', phaseId: 'feedback' }, phaseId: 'feedback' });
        }
    }
    const activa = basis.activePhaseId ? basis.phases.find(p => p.id === basis.activePhaseId) : undefined;
    if (activa && current && current.kind !== 'phase' && !out.some(n => n.phaseId === activa.id)) {
        const boton = phaseNow(basis, activa.id);
        if (boton) add({ text: phaseText(`desk.notes.phase.${activa.id}`, activa.evidence.params), target: boton.target, phaseId: activa.id });
    }
    return out;
}

// ── El constructor ─────────────────────────────────────────────────────

function deskType(type: DeskProject['type']): DeskProjectType {
    if (type === 'exegetical' || type === 'course') return type;
    // Sin tipo cuenta como General, como `getProjectTypeMeta`.
    if (!type || type === 'general') return 'general';
    return 'other';
}

function recentOf(input: ProjectDeskInput, studies: ReadonlyArray<DeskStudy>): DeskRecent | null {
    const candidatos: DeskRecent[] = [
        ...studies.map(s => ({ kind: 'study' as const, id: s.id, label: s.title, at: s.updatedAt })),
        ...(input.outputs ?? []).map(o => ({ kind: 'output' as const, id: o.id, label: o.title?.trim() ?? '', at: iso(o.updatedAt) })),
    ];
    const lt = input.lastTouched;
    if (lt?.id) candidatos.push({ kind: lt.kind, id: lt.id, label: lt.label?.trim() ?? '', at: iso(lt.at) });
    const mejor = candidatos.filter(c => tiempo(c.at) > 0).sort((a, b) => tiempo(b.at) - tiempo(a.at))[0];
    if (!mejor) return null;
    // El rótulo que falte se toma de la lista (lastTouched puede venir sin él).
    if (!mejor.label) {
        const igual = candidatos.find(c => c.kind === mejor.kind && c.id === mejor.id && c.label);
        if (igual) return { ...mejor, label: igual.label };
    }
    return mejor;
}

/**
 * El escritorio del proyecto. Puro: con los mismos datos y el mismo `now`
 * da lo mismo. `now` fija «hoy» (fecha local del dispositivo) para los
 * plazos del curso y las fechas de la serie.
 */
export function buildProjectDesk(input: ProjectDeskInput, now: Date): ProjectDeskModel {
    const type = deskType(input.project.type);
    const log = input.project.framing?.hypothesisLog ?? [];
    const studies = normalizeStudies(input.studies, annotatedStudyIds(log));
    const languages = deskLanguages(input.project, studies);
    const base = { studies, languages, notes: [] as DeskNote[] };
    if (type === 'other') return { type, phases: [], activePhaseId: null, now: null, ...base };
    if (type === 'general') {
        const general = { recent: recentOf(input, studies) };
        const basis: DeskNowBasis = { type, phases: [], activePhaseId: null, studies, general };
        return { type, phases: [], activePhaseId: null, now: deskNow(basis, now), ...base, general };
    }
    const built = type === 'exegetical' ? buildExegetical(input, studies) : buildCourse(input, studies, now);
    const activePhaseId = built.phases.find(p => p.status !== 'ready')?.id ?? null;
    const basis: DeskNowBasis = {
        type, phases: built.phases, activePhaseId, studies,
        ...(type === 'exegetical' ? { exegetical: built.desk as ExegeticalDesk } : { course: built.desk as CourseDesk }),
    };
    const current = deskNow(basis, now);
    return {
        type, phases: built.phases, activePhaseId, now: current,
        ...base,
        notes: deskNotes(basis, current),
        ...(type === 'exegetical' ? { exegetical: built.desk as ExegeticalDesk } : { course: built.desk as CourseDesk }),
    };
}

// ── Claves de texto ────────────────────────────────────────────────────

/**
 * Todas las claves que produce el escritorio, para `projects.json` (es/en
 * con paridad). Parámetros entre llaves; las fechas (`dueDate`) llegan como
 * `YYYY-MM-DD` y la web las formatea («vie 7 nov»).
 */
export const DESK_TEXT_KEYS = [
    // Fase 1 Exegético · Tu lectura del libro
    'desk.exegetical.passage.todo',
    'desk.exegetical.passage.oldNote',
    'desk.exegetical.passage.partial', // {missing}
    'desk.exegetical.passage.ready', // {movements}
    // Fase 2 (Exegético y Curso) · Fuentes
    'desk.sources.todo',
    'desk.sources.candidatesOnly', // {candidates}
    'desk.sources.requiredToAcquire', // {approved, count} (Curso)
    'desk.sources.requirementsPending', // {approved, met, total}
    'desk.sources.ready', // {approved, toAcquire}
    'desk.sources.readyRequirements', // {approved, toAcquire, met, total}
    'desk.sources.readyManual', // {count}
    // Fase 3 Exegético · División en perícopas
    'desk.exegetical.division.todo',
    'desk.exegetical.division.draft',
    'desk.exegetical.division.readySeries', // {series, units}
    'desk.exegetical.division.readyWithoutSeries',
    // Fase 4 Exegético · Estudios por perícopa
    'desk.exegetical.pericopes.empty',
    'desk.exegetical.pericopes.todo', // {total}
    'desk.exegetical.pericopes.progress', // {done, total, annotated}
    'desk.exegetical.pericopes.ready', // {total, annotated}
    // Fase 5 Exegético · Síntesis
    'desk.exegetical.synthesis.todo',
    'desk.exegetical.synthesis.progress', // {annotations}
    'desk.exegetical.synthesis.stale',
    'desk.exegetical.synthesis.ready',
    // Curso · fases 1, 3, 4 y 5
    'desk.course.charge.todo',
    'desk.course.charge.unresolved', // {types, unresolved}
    'desk.course.charge.ready', // {types}
    'desk.course.calendar.todo',
    'desk.course.calendar.incomplete', // {entries, missing}
    'desk.course.calendar.ready', // {entries}
    'desk.course.calendar.free',
    'desk.course.works.empty',
    'desk.course.works.todo', // {total}
    'desk.course.works.progress', // {done, total, delivered}
    'desk.course.works.ready', // {total, delivered}
    'desk.course.feedback.todo',
    'desk.course.feedback.progress', // {returned, delivered, pendingPatterns}
    'desk.course.feedback.ready', // {returned}
    // «Ahora»
    'desk.now.deadline.review', // {label}
    'desk.now.deadline.continue', // {label, done, total}
    'desk.now.deadline.create', // {label}
    'desk.now.continue', // {label, done, total}
    'desk.now.continuePericope', // {position, label, done, total}
    'desk.now.upcomingPericope', // {position, label} + dueDate
    'desk.now.createScheduled', // {label} + dueDate
    'desk.now.passage',
    'desk.now.passagePartial',
    'desk.now.passageOldNote',
    'desk.now.sources',
    'desk.now.division',
    'desk.now.pericope', // {position, label}
    'desk.now.study', // {label}
    'desk.now.newStudy',
    'desk.now.reviseIdea',
    'desk.now.annotate', // {label}
    'desk.now.synthesis',
    'desk.now.charge',
    'desk.now.calendar',
    'desk.now.work', // {label}
    'desk.now.workCreate', // {label} + dueDate
    'desk.now.newWork',
    'desk.now.recordFeedback', // {label}
    'desk.now.decidePatterns', // {count}
    'desk.now.feedback',
    'desk.now.recentStudy', // {label}
    'desk.now.recentOutput', // {label}
    // Notas
    'desk.notes.oldNote',
    'desk.notes.readingPending', // {count}
    'desk.notes.revisionStale',
    'desk.notes.requiredToAcquire', // {title}
    'desk.notes.overdue', // {label, dueDate}
    'desk.notes.noFeedback', // {label}
    'desk.notes.pendingPatterns', // {count}
    // La fase activa como nota, con los parámetros de su evidencia
    'desk.notes.phase.passage',
    'desk.notes.phase.sources',
    'desk.notes.phase.division',
    'desk.notes.phase.pericopes',
    'desk.notes.phase.synthesis',
    'desk.notes.phase.charge',
    'desk.notes.phase.calendar',
    'desk.notes.phase.works',
    'desk.notes.phase.feedback',
] as const;

export type DeskTextKey = typeof DESK_TEXT_KEYS[number];
