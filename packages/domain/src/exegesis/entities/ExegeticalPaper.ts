import type { PassageReference } from '../../bible/canon/passage-reference';
import type { ProjectSource } from './ProjectSource';
import type { ExegeticalStep } from './ExegeticalStep';
import type { PaperRubric, StructuralExpectation } from './PaperRubric';
import type { StepSourcePlan } from './StepSourcePlan';
import type { StyleGuideSnapshot } from './StyleGuideSnapshot';

/**
 * Top-level entity for a single exegetical paper.
 *
 * Lifecycle (`phase`):
 *   - 'configuring' — passage + sources + style guide are being set up;
 *     no generation has run yet.
 *   - 'in-progress' — at least one step has been generated; user is
 *     iterating over verses → conclusion → introduction.
 *   - 'assembled' — the full paper has been concatenated; user may
 *     still edit `assembledMarkdown` freely before exporting.
 *   - 'archived' — soft-deleted; preserved for audit but hidden in the list.
 *
 * Why a dedicated entity (not a kind of `AIProject`):
 * Faculty's `AIProject` represents conversational sessions; exegetical papers
 * are documental, multi-step, with strict citation discipline and step-version
 * history. Forcing both into one model would require a discriminator field
 * and duplicate state machines. Confirmed with the user.
 */
export interface ExegeticalPaper {
    id: string;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;

    /**
     * The passage being studied. Validated against `BIBLE_CANON` at create time
     * via `parsePassageReference` or `buildPassageReference`. Stored canonical;
     * the picker and free-text input both normalize to this shape.
     */
    passage: PassageReference;

    /** Output language for the assembled paper (also drives prompt selection). */
    displayLanguage: 'es' | 'en';

    /**
     * Methodological framing for the paper — chosen at creation time,
     * editable from the setup page later.
     *
     * - `'dialectical'` (default for new papers): the student is
     *   building a paper around the classical dialectical method
     *   (anchor + contrast + technical per step). The corpus tab
     *   shows a role-coverage card that nudges them to balance their
     *   bibliography by role; the planner already understands roles
     *   so the corpus signal it gets is much stronger.
     *
     * - `'free'`: the student wants to pick sources freely and let
     *   the planner figure out how to use them. No role-coverage
     *   nudges in the corpus tab; the existing rubric-gap card is
     *   the only guidance. Power-user mode for users who already
     *   know what they're doing or who don't want the methodology
     *   scaffolding.
     *
     * Optional for backward compat — pre-strategy papers deserialize
     * as `'free'` so they don't suddenly bug-banner on missing
     * roles. New papers always pick a value at creation.
     */
    exegeticalStrategy?: ExegeticalStrategy;

    /** Optional human title; defaults to the formatted passage. */
    title?: string;

    /**
     * Datos de la portada que exige la guía de estilo del seminario.
     *
     * No se deducen del trabajo: el seminario, el autor y el lugar son del
     * estudiante, no del pasaje. Sin ellos el .docx sale sin portada —que
     * es lo que hacía— y el trabajo se entrega incompleto o se arma la
     * portada a mano cada vez.
     */
    cover?: PaperCover | null;

    /**
     * Free-text framing of the paper — typically a paragraph that
     * combines what the seminary professor assigned ("escribir un
     * análisis exegético del prólogo cristológico de Hebreos 1:1-4")
     * and the angle the student wants to take ("argumentar que la
     * revelación final en el Hijo establece la superioridad temática
     * de la epístola"). Treated by the orchestrator as PAPER-LEVEL
     * authoritative guidance — it appears verbatim in the system
     * prompt of every step generation so the introduction, verses,
     * and conclusion all stay aligned with the same framing.
     *
     * Different from rubric (mechanical grading criteria) and from
     * style guide (mechanical formatting rules): this is the paper's
     * narrative identity. v1 uses a single text blob; v1.5+ may
     * split into "professor brief" vs "student thesis" if the
     * pattern is worth differentiating.
     *
     * Nullable: a student may create a paper without a brief and the
     * orchestrator will fall back to neutral framing. The setup UI
     * encourages filling it but doesn't block.
     */
    assignmentBrief: string | null;

    /**
     * Reference to the user-level style guide active for this paper. The
     * guide is uploaded once per user and reused across papers; we store
     * the id (not a snapshot) so seminary updates flow through automatically
     * unless the user pins a specific version on a per-paper basis later.
     *
     * Nullable during the 'configuring' phase: the v1 setup wizard does NOT
     * collect a guide (that step is v1.5 placeholder). Phase transition to
     * 'in-progress' must enforce non-null before any generation runs — the
     * orchestrator needs an actual guide to inject into prompts.
     */
    /**
     * Copia de la guía de estilo TAL COMO ESTABA al adjuntarla.
     *
     * La rúbrica y el encuadre se copian al trabajo; la guía sólo se
     * referenciaba por id, así que editarla alcanzaba a todos los
     * papers que la apuntaran —incluidos los ya entregados—. Un trabajo
     * entregado no puede cambiar de reglas porque alguien corrigió su
     * plantilla tres meses después.
     *
     * Se copia el MANIFIESTO, que es lo que gobierna la composición y el
     * formateador determinista, y la identidad de la guía para poder
     * decir de cuál salió. NO se copia el texto crudo: son cientos de
     * kilobytes por guía y el documento del paper ya carga los análisis
     * canónicos de cada verso. El texto se sigue leyendo por
     * `styleGuideId`, así que volver a subir el archivo de la guía sí
     * alcanza a los papers viejos — queda dicho, no escondido.
     *
     * Ausente en los papers anteriores a esta copia: ahí se resuelve
     * contra la guía viva, que es como venía.
     */
    styleGuideSnapshot?: StyleGuideSnapshot | null;

    styleGuideId: string | null;

    /**
     * Project-scoped corpus — extracts of commentaries, lexicons, and the
     * critical apparatus uploaded specifically for this paper. Ephemeral by
     * design: when the paper is archived, these go with it (unless the user
     * promotes one to their library, a v1.5 feature).
     */
    sources: ProjectSource[];

    /**
     * Rubric the student is working against — either uploaded from the
     * seminary's grading sheet or the system default. Drives gap detection
     * (which source types are missing) and seeds the structural plan.
     *
     * Nullable during the very first moment after `createPaper` runs; the
     * setup UI's first sub-step always populates it (uploading or applying
     * the default) before letting the user proceed. Generation must reject
     * a null rubric.
     */
    rubric: PaperRubric | null;

    /**
     * Per-section emphasis (which source types lead the introduction,
     * the verse body, the conclusion). Conceptually part of the
     * student's exegetical strategy — what method they use to build
     * the corpus — NOT part of the seminary's grading rubric.
     *
     * Today the same data also lives on `paper.rubric.structuralExpectations`
     * for back-compat with documents persisted before this field was
     * introduced. `getEffectiveStructuralExpectations(paper)` is the
     * canonical chokepoint for resolving the effective value: it
     * prefers the paper-level field when populated and falls back to
     * the rubric field, then the system default. Writers should now
     * dual-write to both locations until a future cleanup PR purges
     * the rubric field entirely.
     *
     * Optional + may be empty: legacy papers won't carry this field
     * until the next save, and freshly-created papers seed from the
     * default rubric so the field is rarely empty in practice.
     */
    structuralExpectations?: ReadonlyArray<StructuralExpectation>;

    /**
     * Per-step source-emphasis plan the student configured (or accepted
     * from defaults). Drives prompt weights at generation time. May be
     * the empty plan if the student hasn't visited the structural-plan
     * sub-step yet — the orchestrator falls back to rubric defaults in
     * that case.
     */
    stepPlan: StepSourcePlan;

    phase: ExegeticalPaperPhase;

    /**
     * Steps in display order: verses (one per verse in the passage range),
     * then conclusion, then introduction, then assembly. The introduction
     * step appears last in the wizard but the assembled output places it
     * first — a TMS convention the user explicitly asked us to honor.
     */
    steps: ExegeticalStep[];

    /**
     * Pointer to the step the user is currently working on. May be null when
     * the paper is in 'configuring' phase or fully assembled.
     */
    currentStepId: string | null;

    /**
     * The full paper after the assembly step runs (or after the user edits
     * the assembled output manually). Source of truth for export. Null
     * before assembly. Edits made here AFTER assembly do not propagate back
     * to individual steps — that's intentional (final-pass edits are the
     * author's prerogative and shouldn't be re-validated).
     */
    assembledMarkdown: string | null;

    /** Soft-delete marker. */
    archivedAt: Date | null;

    /**
     * Denormalized back-reference when the paper was auto-created by a
     * `SermonSeries` pericope (planner pipeline). Lets downstream use
     * cases — notably `StartStudyFromPaperUseCase` — patch the
     * originating series so the planner's `plannedSermons[].draftId`
     * stays in sync after a sermon is generated from the paper.
     *
     * Source of truth remains `PlannedSermon.paperId` on the series;
     * this is a denormalized lookup index, intentionally optional so
     * standalone (non-series) papers and pre-existing papers stay
     * valid. A future backfill callable can populate it for legacy
     * papers.
     *
     * Both fields are populated together (or both null) — a partial
     * link makes no semantic sense.
     */
    seriesId?: string | null;
    pericopeId?: string | null;
}

export type ExegeticalPaperPhase =
    | 'configuring'
    | 'in-progress'
    | 'assembled'
    | 'archived';

/**
 * Methodology mode picked by the student. See the
 * `ExegeticalPaper.exegeticalStrategy` field doc for what each mode
 * implies in the UI.
 */
export type ExegeticalStrategy = 'free' | 'dialectical';

/**
 * Shape used by `CreatePaper` use cases — id and timestamps are assigned
 * by the repository; phase always starts as 'configuring' even if sources
 * are provided up front (wizard may collect them later).
 *
 * `rubric` and `stepPlan` are also omitted at draft time — the create
 * use case applies the system default rubric and the empty plan, and the
 * setup UI's later sub-steps overwrite them with the student's choices.
 */
export type ExegeticalPaperDraft = Omit<
    ExegeticalPaper,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'phase'
    | 'steps'
    | 'currentStepId'
    | 'assembledMarkdown'
    | 'archivedAt'
    | 'rubric'
    | 'stepPlan'
>;

/**
 * Lo que va en la portada, tal como lo escribe el estudiante.
 *
 * Todo opcional: una portada a medias es mejor que ninguna, y el
 * exportador omite lo que falte en vez de inventarlo. El texto se guarda
 * como se escribió; la mayúscula de la portada la pone el exportador,
 * porque es decisión de formato y no del dato.
 */
export interface PaperCover {
    /** «The Master's Seminary». */
    institution?: string;
    /**
     * Lo que va impreso ENCIMA del pasaje: «Trabajo práctico #3».
     *
     * Es distinto del título del trabajo dentro de la aplicación: eso es
     * cómo lo encuentras tú, y esto es cómo lo nombra el profesor en el
     * documento que recibe. Sin este renglón la portada abría con el
     * pasaje y el trabajo llegaba sin identificarse.
     */
    assignmentTitle?: string;
    /** Nombre del estudiante que firma el trabajo. */
    author?: string;
    /** Ciudad, como la pide la guía: «Chiguayante, Concepción». */
    place?: string;
    /** Fecha de entrega en el formato del seminario: «Septiembre 2026». */
    date?: string;
    /**
     * Curso o sigla. OPCIONAL: solo se imprime cuando está escrito.
     *
     * La portada del seminario no lo lleva, y el formulario lo pedía como
     * si fuera obligatorio.
     */
    course?: string;
}

/**
 * Los campos de la portada, en el orden en que se imprimen.
 *
 * Vive acá porque la lista estaba escrita TRES veces —la interfaz, el
 * formulario y el normalizador que guarda— y se desincronizaron: al
 * agregar el título del trabajo, el normalizador lo descartaba antes de
 * escribirlo. La pantalla decía «Portada guardada», el campo desaparecía
 * y no había ni un error.
 *
 * LA GUARDA ES `satisfies Record<keyof PaperCover, number>` Y ESTÁ AQUÍ
 * A PROPÓSITO. Un campo nuevo en la interfaz que no entre en este objeto
 * no compila, con un mensaje que nombra el objeto, y en un archivo que
 * sí entra en el control de tipos que bloquea. La misma comprobación
 * escrita en un archivo de pruebas solo la veía `expectTypeOf`, que no
 * corre en esta configuración.
 */
const ORDEN_DE_LA_PORTADA = {
    institution: 0,
    assignmentTitle: 1,
    author: 2,
    place: 3,
    date: 4,
    course: 5,
} as const satisfies Record<keyof PaperCover, number>;

export type PaperCoverField = keyof typeof ORDEN_DE_LA_PORTADA;

export const PAPER_COVER_FIELDS: ReadonlyArray<PaperCoverField> = (
    Object.keys(ORDEN_DE_LA_PORTADA) as PaperCoverField[]
).sort((a, b) => ORDEN_DE_LA_PORTADA[a] - ORDEN_DE_LA_PORTADA[b]);

/**
 * Lo que NO se hereda al guardar la configuración como perfil de trabajo.
 *
 * El seminario, el autor, el lugar y el curso no cambian entre entregas
 * del mismo curso; el título del trabajo sí, y sin esto cada trabajo
 * nuevo nacería llamándose como el anterior.
 */
export const PAPER_COVER_FIELDS_POR_ENTREGA: ReadonlyArray<PaperCoverField> = ['assignmentTitle'];
