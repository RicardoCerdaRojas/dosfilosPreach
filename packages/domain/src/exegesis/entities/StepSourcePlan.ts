import type { SourceType } from './SourceType';
import type { ExegeticalStepKind } from './ExegeticalStep';

/**
 * Per-step source-emphasis plan — the "how should the orchestrator
 * use my corpus for this specific step" decision.
 *
 * Why this entity exists: the user explicitly raised concern that
 * leaving the orchestrator to silently decide which sources to lean
 * on per step deprives the student of a learning moment. The plan
 * makes that decision visible and editable BEFORE generation runs:
 *
 *   - The student sees, per step, which source TYPES will be
 *     emphasized and which specific SOURCES are pinned to the step.
 *   - For novices, the plan is pre-filled from the rubric's
 *     `structuralExpectations` with a justification ("for verse-level
 *     analysis the rubric prioritizes lexicons + technical
 *     commentaries because…").
 *   - For experts, the same defaults appear and a single "accept all
 *     suggestions" button collapses the step to a confirmation.
 *
 * The plan is mutable until the step transitions to 'generating'.
 * Once generation runs against a plan, that plan version is
 * snapshotted onto the resulting `ExegeticalStepVersion` so we can
 * later answer "what plan produced this output?".
 *
 * Storage: lives on `ExegeticalPaper.stepPlan` as a single object
 * keyed by `stepId`. One plan entry per step. Plans for kinds the
 * orchestrator doesn't drive (`assembly`) are intentionally absent.
 */
export interface StepSourcePlan {
    /**
     * Per-step entries. Keys are `ExegeticalStep.id`. Steps without
     * an entry inherit the rubric default at generation time.
     */
    perStep: Readonly<Record<string, StepSourcePlanEntry>>;
    /**
     * Global default applied to any step without an explicit entry.
     * Built from the rubric's `structuralExpectations` and the
     * student's overrides.
     */
    defaults: StepKindDefaults;
    /** Last time the student edited the plan. */
    updatedAt: Date;
    /**
     * v1.7 — When the LLM-driven corpus planner last proposed
     * allocations into `perStep[*].pinnedSources`. Null when the user
     * has only edited the plan manually (or the planner has never run
     * for this paper). Set by `ProposeStepCorpusAllocationsUseCase`.
     */
    proposedAt?: Date | null;
    /**
     * v1.7 — Snapshot of the paper's `ProjectSource.id` set at the
     * moment the planner proposed `pinnedSources`. Used for
     * stale-detection: if the current corpus has source IDs that
     * weren't in the snapshot (or vice-versa), the plan is "stale" —
     * the UI surfaces a non-blocking banner suggesting regeneration.
     *
     * Empty array (NOT undefined) means "snapshot recorded with zero
     * sources" — distinct from "no snapshot ever taken". Helper
     * `isStepPlanStale` honors that distinction.
     */
    proposalCorpusSourceIds?: ReadonlyArray<string>;
}

/**
 * Default emphasis per step KIND (not per individual step). Used as
 * a fallback so the student doesn't have to set every verse step
 * individually — they configure the kind once and it propagates.
 */
export interface StepKindDefaults {
    verse: StepEmphasis;
    conclusion: StepEmphasis;
    introduction: StepEmphasis;
}

export interface StepSourcePlanEntry {
    stepId: string;
    /** The step's kind, denormalized for prompt-builder convenience. */
    kind: ExegeticalStepKind;
    /**
     * Emphasis at the type level. The orchestrator uses these as the
     * primary signal — types in `emphasizedTypes` get more inline-
     * context budget; types in `dempremphasizedTypes` get a small
     * mention; types unspecified follow the rubric default.
     */
    emphasis: StepEmphasis;
    /**
     * Specific sources the student explicitly wants used (or
     * forbidden) for this step. References `ProjectSource.id`.
     * Empty arrays mean "no overrides — fall through to type-level
     * emphasis".
     */
    pinnedSources: ReadonlyArray<string>;
    suppressedSources: ReadonlyArray<string>;
    /**
     * Dialectical role each pinned source plays in this step. Drives
     * the role badges in the UI ("ancla" / "contraste" / "técnica")
     * and is what makes the planner output read as a curated
     * exegetical strategy rather than a flat list. Map keys are
     * `ProjectSource.id`; entries WITHOUT a role render without a
     * badge — backward-compatible with pre-roles plans.
     */
    pinnedSourceRoles?: Readonly<Record<string, SourceRole>>;
    /**
     * The student's reason / note. Useful at generation time (the
     * note is mentioned in the prompt) and for self-reflection
     * later. Empty when the student took the default.
     */
    note: string | null;
    /**
     * El estudiante cambió las fuentes de este paso DESPUÉS de que el
     * planificador escribió la nota (TP #8, 8a, B3, #24). La nota nombra roles
     * de una lista que ya no es la del paso: la interfaz lo dice y el análisis
     * la lee con esa advertencia (`planNoteForPrompt`). Proponer de nuevo lo
     * borra.
     */
    sourcesEditedAfterNote?: boolean;
}

/**
 * La nota del plan como la lee el análisis. Si el estudiante cambió las
 * fuentes después, se antepone que la lista de fuentes manda: si no, el
 * analizador seguía el rol de una fuente que ya no estaba en el paso.
 */
export function planNoteForPrompt(
    entry: Pick<StepSourcePlanEntry, 'note' | 'sourcesEditedAfterNote'> | null | undefined,
    language: 'es' | 'en',
): string | null {
    const note = entry?.note?.trim();
    if (!note) return null;
    if (!entry?.sourcesEditedAfterNote) return note;
    return language === 'en'
        ? `(The student changed this step's sources after this note; the source list prevails.) ${note}`
        : `(El estudiante cambió las fuentes de este paso después de esta nota; manda la lista de fuentes.) ${note}`;
}

/**
 * Role a pinned source plays inside a step. Encodes the classical
 * exegetical-paper dialectic: pick an anchor reading, contrast it
 * with another commentary's voice, and (when the verse warrants it)
 * back the reading with a technical anchor.
 *
 * - `'anchor'`    — primary reading. Typically an expository or
 *                   exegetical commentary that orients the verse.
 * - `'contrast'`  — alternate voice. Different school, different
 *                   register (e.g. critical commentary opposite the
 *                   anchor expository), or simply a documented
 *                   alternate reading.
 * - `'technical'` — lexicon, grammar, or critical apparatus that
 *                   backs a specific lexical/syntactic decision.
 */
export type SourceRole = 'anchor' | 'contrast' | 'technical';

export interface StepEmphasis {
    /** Source types to weight up in this step. */
    emphasizedTypes: ReadonlyArray<SourceType>;
    /** Source types to weight down (still allowed, just minor role). */
    deemphasizedTypes: ReadonlyArray<SourceType>;
    /**
     * Citation-discipline override per type. Lets the student push
     * a normally "cite-when-relevant" type up to "cite-generously"
     * for this step (e.g. "for verse 3 I want lexicons cited very
     * generously because the lexical decisions carry the argument
     * here"). Only types listed get an override; others use the
     * catalog default.
     */
    citationOverrides: ReadonlyArray<CitationOverride>;
}

export interface CitationOverride {
    sourceType: SourceType;
    /** New discipline to apply. Same vocabulary as `SourceTypeMetadata.defaultCitationDiscipline`. */
    discipline: 'cite-generously' | 'cite-when-relevant' | 'cite-sparingly' | 'never-cite';
}

/**
 * Empty plan returned for papers that haven't been through the
 * "structural plan" sub-step yet. The orchestrator treats this as
 * "use rubric defaults everywhere" — generation can still run, just
 * without student-level customization.
 */
export const EMPTY_STEP_SOURCE_PLAN: StepSourcePlan = {
    perStep: {},
    defaults: {
        verse: { emphasizedTypes: [], deemphasizedTypes: [], citationOverrides: [] },
        conclusion: { emphasizedTypes: [], deemphasizedTypes: [], citationOverrides: [] },
        introduction: { emphasizedTypes: [], deemphasizedTypes: [], citationOverrides: [] },
    },
    updatedAt: new Date(0),
};
