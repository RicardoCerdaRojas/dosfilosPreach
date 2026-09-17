import type { CitationReview, VerifiedCitation } from '../entities/CitationVerification';
import type { CanonicalVerseAnalysis } from '../entities/CanonicalVerseAnalysis';
import type { CitationCorrection } from '../services/citationCorrection';
import type {
    ExegeticalPaper,
    ExegeticalPaperDraft,
    ExegeticalPaperPhase,
} from '../entities/ExegeticalPaper';
import type { ExegesisPaperSummary } from '../entities/ExegesisPaperSummary';
import type {
    ExegeticalStep,
    ExegeticalStepState,
    ExegeticalStepVersion,
    VerificationSummary,
} from '../entities/ExegeticalStep';
import type { PaperRubric } from '../entities/PaperRubric';
import type { ProjectSource } from '../entities/ProjectSource';
import type { StepSourcePlan } from '../entities/StepSourcePlan';

/**
 * Campos de una fuente que `updateSource` puede cambiar. Vive como tipo
 * propio para que la interfaz y la implementación hablen de la MISMA lista:
 * el repositorio la aplicaba con una lista blanca a mano que había olvidado
 * `excerptRecipe` y `excerptSelectionMode`, así que «Ajustar páginas» sobre
 * una fuente ya adjunta no guardaba nada y nadie se enteraba.
 */
export type ProjectSourcePatch = Partial<Pick<
    ProjectSource,
    | 'sourceType'
    | 'chosenRole'
    | 'displayLabel'
    | 'citationKey'
    | 'order'
    | 'excerpts'
    | 'excerptSelectionMode'
    | 'excerptRecipe'
    | 'extractedAt'
    | 'extractionFingerprint'
>>;

/**
 * Persistence contract for `ExegeticalPaper` and its child entities (steps
 * and project sources). Modeled as a single repository because the entities
 * are tightly coupled — a paper without its steps is meaningless — and
 * Firestore's nested-collection model lets us implement this efficiently
 * with subcollections (`exegeticalPapers/{paperId}/steps/{stepId}`).
 *
 * The implementation is expected to enforce ownership: every method that
 * accepts an `ownerId` must reject access to documents the user doesn't
 * own. Methods that don't take an `ownerId` are scoped by the `paperId`
 * which the caller already authorized via a prior `getPaper(...)` call.
 *
 * Concurrency: step updates should be transactional when multiple fields
 * mutate together (e.g. accepting a new version flips state, sets
 * `accepted`, and updates `updatedAt`). The interface doesn't prescribe
 * a transaction primitive — implementations choose.
 */
export interface IExegeticalPaperRepository {
    // ── Papers ────────────────────────────────────────────────────────────

    /** All papers owned by the user, ordered by `updatedAt` desc. Excludes archived. */
    listPapers(ownerId: string): Promise<ExegeticalPaper[]>;

    /**
     * Lightweight list projection for the dashboard — returns
     * `ExegesisPaperSummary` (headline fields + counts) WITHOUT the heavy
     * `steps`/`assembledMarkdown`/`sources`. Includes archived (the list
     * filters client-side). Reads server-side so full papers don't cross the
     * wire just to draw the list.
     */
    listPaperSummaries(ownerId: string): Promise<ExegesisPaperSummary[]>;

    /** Includes archived papers. Used by the "Trash" view. */
    listAllPapers(ownerId: string): Promise<ExegeticalPaper[]>;

    /** Returns null when the paper doesn't exist or doesn't belong to the user. */
    getPaper(ownerId: string, paperId: string): Promise<ExegeticalPaper | null>;

    /**
     * Creates a paper in `phase: 'configuring'` with an empty `steps` array.
     * Steps are spawned by `seedStepsForPassage` once the user finalizes
     * configuration, not at create time — keeping create cheap and letting
     * the user adjust the passage before commitment.
     */
    createPaper(draft: ExegeticalPaperDraft): Promise<ExegeticalPaper>;

    /**
     * Patch a subset of paper fields. The interface is intentionally
     * narrow — most state changes go through dedicated methods (sources,
     * steps) so the implementation can keep the model consistent.
     */
    updatePaper(
        ownerId: string,
        paperId: string,
        patch: Partial<Pick<ExegeticalPaper, 'title' | 'displayLanguage' | 'styleGuideId' | 'styleGuideSnapshot' | 'currentStepId' | 'assembledMarkdown' | 'assignmentBrief' | 'cover'>>
    ): Promise<ExegeticalPaper>;

    /** Transitions phase. Implementations validate legal transitions. */
    setPhase(ownerId: string, paperId: string, phase: ExegeticalPaperPhase): Promise<ExegeticalPaper>;

    /**
     * Replaces the paper's `stepPlan` wholesale. The use case constructs
     * the merged plan (existing perStep entries + new defaults) before
     * calling — keeping the repo dumb. Updates `updatedAt` on the paper
     * and on the plan itself. Owner-scoped; rejects on missing or
     * not-owned papers.
     */
    setStepPlan(ownerId: string, paperId: string, plan: StepSourcePlan): Promise<ExegeticalPaper>;

    /**
     * Replaces the paper's `rubric` wholesale. Pass null to clear it
     * (the UI never does this in v1; the create flow always seeds the
     * default). Use cases that patch a subset of fields construct the
     * merged rubric and call this — same dumb-repo pattern as
     * `setStepPlan`.
     */
    setRubric(ownerId: string, paperId: string, rubric: PaperRubric | null): Promise<ExegeticalPaper>;

    /** Soft-delete (sets `archivedAt`). Reversible via `unarchivePaper`. */
    archivePaper(ownerId: string, paperId: string): Promise<ExegeticalPaper>;
    unarchivePaper(ownerId: string, paperId: string): Promise<ExegeticalPaper>;

    /**
     * Hard-delete: removes the paper, all steps, and all project sources.
     * The corpus chunks remain (they may belong to the user's library if
     * promoted). Irreversible — guard at the use-case level.
     */
    hardDeletePaper(ownerId: string, paperId: string): Promise<void>;

    // ── Sources ───────────────────────────────────────────────────────────

    addSource(
        ownerId: string,
        paperId: string,
        source: Omit<ProjectSource, 'id' | 'paperId' | 'createdAt'>
    ): Promise<ProjectSource>;

    updateSource(
        ownerId: string,
        paperId: string,
        sourceId: string,
        patch: ProjectSourcePatch
    ): Promise<ProjectSource>;

    removeSource(ownerId: string, paperId: string, sourceId: string): Promise<void>;

    // ── Steps ─────────────────────────────────────────────────────────────

    /**
     * Creates the initial step list for the paper from its `passage`:
     * one step per verse in range, plus conclusion, introduction, and
     * assembly. Idempotent — calling twice on the same paper does NOT
     * duplicate steps; if any step already exists, this is a no-op.
     *
     * Returns the resulting step list (existing or newly seeded) so the
     * caller can navigate the user to step #1.
     */
    seedStepsForPassage(ownerId: string, paperId: string): Promise<ExegeticalStep[]>;

    setStepState(
        ownerId: string,
        paperId: string,
        stepId: string,
        state: ExegeticalStepState
    ): Promise<ExegeticalStep>;

    /**
     * Appends a new version to the step's history and sets `current` to
     * point at it. Does NOT change `accepted` — that requires explicit
     * acceptance via `acceptStepVersion`.
     */
    appendStepVersion(
        ownerId: string,
        paperId: string,
        stepId: string,
        version: Omit<ExegeticalStepVersion, 'id' | 'createdAt'>
    ): Promise<ExegeticalStepVersion>;

    /**
     * Marks a previously-appended version as the accepted one. Sets
     * `state: 'accepted'` and points `accepted` at the version.
     */
    acceptStepVersion(
        ownerId: string,
        paperId: string,
        stepId: string,
        versionId: string
    ): Promise<ExegeticalStep>;

    /**
     * Reabre un paso aceptado para volver a trabajarlo.
     *
     * NO borra las versiones: el análisis aceptado queda en el historial y el
     * paso vuelve a revisión. Borrarlo convertiría "rehacer" en una decisión
     * irreversible tomada con un click, y lo que el usuario quiere al rehacer
     * es comparar, no destruir.
     */
    reopenStep(ownerId: string, paperId: string, stepId: string): Promise<ExegeticalStep>;

    /**
     * Records a manual edit by the user. Internally creates a version
     * with `origin: 'edited'`, parented to whatever was previously
     * accepted, and sets that as the new `accepted`. Does not change
     * `state` (stays 'accepted') and does not re-run verification — the
     * UI must re-trigger that explicitly per the user's request.
     */
    saveManualEdit(
        ownerId: string,
        paperId: string,
        stepId: string,
        markdown: string
    ): Promise<ExegeticalStep>;

    /**
     * Replaces the `verifications` summary on a specific step version.
     * Used by the citation verifier use case after running over an
     * accepted version. Both `current` and `accepted` references on the
     * step are kept in sync if either one points at the target version
     * — the UI reads from whichever is set, so divergence would silently
     * surface stale counts.
     *
     * Throws when the version doesn't belong to the step.
     */
    setStepVersionVerifications(
        ownerId: string,
        paperId: string,
        stepId: string,
        versionId: string,
        verifications: VerificationSummary,
        /**
         * Veredicto por cita, cuando el llamador quiere que la interfaz los
         * muestre sin volver a verificar. Ausente = no se tocan los guardados.
         */
        verdicts?: ReadonlyArray<VerifiedCitation>,
    ): Promise<ExegeticalStepVersion>;

    /**
     * Guarda (o reemplaza, por ruta) la revisión manual de una cita de la
     * versión. Con `review.note` vacía se quita la marca.
     */
    /**
     * Guarda la corrección de UNA cita: el análisis con la cita cambiada,
     * las marcas realineadas y el rastro de qué se corrigió.
     *
     * Va en una sola escritura porque las cuatro cosas son la misma
     * corrección: un análisis nuevo con veredictos viejos apunta marcas a
     * citas que se movieron, y ese estado no debe existir ni un instante.
     */
    applyCitationCorrection(
        ownerId: string,
        paperId: string,
        stepId: string,
        versionId: string,
        payload: {
            analysis: CanonicalVerseAnalysis;
            verdicts: ReadonlyArray<VerifiedCitation>;
            reviews: ReadonlyArray<CitationReview>;
            verifications: VerificationSummary;
            correction: CitationCorrection;
        },
    ): Promise<ExegeticalStepVersion>;

    setCitationReview(
        ownerId: string,
        paperId: string,
        stepId: string,
        versionId: string,
        review: CitationReview,
    ): Promise<ExegeticalStepVersion>;

    /**
     * Sets the `markdown` field of a specific step version. Used by the
     * per-verse academic composer to persist its output without
     * appending a new version (recomposing prose over the same
     * canonicalAnalysis is idempotent — no point growing the history
     * for it). Both `current` and `accepted` references on the step
     * are kept in sync if either points at the target version.
     *
     * Throws when the version doesn't belong to the step.
     */
    setStepVersionMarkdown(
        ownerId: string,
        paperId: string,
        stepId: string,
        versionId: string,
        markdown: string
    ): Promise<ExegeticalStepVersion>;
}
