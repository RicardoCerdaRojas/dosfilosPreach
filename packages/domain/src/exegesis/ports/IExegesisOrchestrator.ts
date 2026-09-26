import type { SourceRole } from '../entities/StepSourcePlan';
import type { PassageReference } from '../../bible/canon/passage-reference';
import type { ExegeticalStepKind } from '../entities/ExegeticalStep';
import type { SourceType } from '../entities/SourceType';
import type { StepEmphasis } from '../entities/StepSourcePlan';

/**
 * Port for the LLM-driven generation step.
 *
 * Implementations live in infrastructure (Gemini, OpenAI, etc.). The use
 * case in `application/` resolves all the context (style guide text,
 * source extracts, accepted prior steps) and hands it to the orchestrator
 * pre-assembled — the orchestrator itself stays dumb and only handles
 * "given this context, produce markdown for this step kind".
 *
 * The 'assembly' kind is intentionally NOT served here — the use case
 * concatenates accepted markdown directly, no LLM call needed.
 */
export interface IExegesisOrchestrator {
    generateStep(input: ExegesisGenerationInput): Promise<ExegesisGenerationOutput>;
}

export interface ExegesisGenerationInput {
    /** Always one of the LLM-driven kinds: 'verse' | 'conclusion' | 'introduction'. */
    kind: Exclude<ExegeticalStepKind, 'assembly'>;
    /** The whole-paper passage range (for context — even verse steps reference the surrounding scope). */
    paperPassage: PassageReference;
    /** For verse steps, the specific verse this generation covers. Null for conclusion/introduction. */
    verseRef: PassageReference | null;
    /** Output language (drives prompt + defense-in-depth language directive). */
    language: 'es' | 'en';
    /**
     * Free-text framing of the paper — typically the assignment brief
     * the professor gave plus the angle the student wants to take.
     * Injected verbatim near the top of the system prompt so the LLM
     * keeps every step (intro, verses, conclusion) aligned with the
     * same paper-level identity. Null when the student didn't supply
     * one — the prompt falls back to neutral framing.
     */
    assignmentBrief: string | null;
    /**
     * Per-step emphasis the student saved (or accepted from the
     * rubric default) — drives source-budget weights and a "priority
     * directive" block in the user message. Null means "use the
     * type catalog's static weights alone" (the orchestrator still
     * works, it just doesn't bias toward the student's plan).
     */
    stepEmphasis: StepEmphasis | null;
    /**
     * Style guide content (TMS or equivalent) verbatim. Injected into the
     * system prompt as authoritative formatting rules. Empty string is
     * tolerated — the use case decides whether to surface "no guide" as
     * an error before reaching here.
     */
    styleGuideContent: string;
    /**
     * Project sources, each with role + extracted text content. The
     * orchestrator weights/filters per role (primary-commentary first
     * for verses, lexicon for term meanings, etc.). 'model-paper' role
     * is consumed for STYLE imitation only — the prompt explicitly
     * instructs the model not to cite from it.
     */
    sources: ExegesisSourceContext[];
    /**
     * Accepted prior-step markdown, only relevant for 'conclusion' and
     * 'introduction'. For 'verse' kind this is empty.
     *   - conclusion sees: all accepted verses
     *   - introduction sees: all accepted verses + accepted conclusion
     */
    priorAcceptedSteps: ExegesisPriorStep[];
    /** Optional regeneration hint provided by the user. */
    regenerationHint: string | null;
    /**
     * Rubric requirements the user's corpus does NOT meet. Computed
     * by the use case via `computeRubricCompliance` and passed
     * through so the orchestrator can warn the LLM not to make
     * confident claims that would require a missing source type.
     *
     * Example: when `critical-apparatus` is missing, the orchestrator
     * injects a "do not make confident claims about textual variants
     * without marking them tentative" instruction. Same generalizes
     * to every type — lexical claims need a lexicon, syntactic
     * claims need a grammar, etc.
     *
     * Empty array when the corpus fully satisfies the rubric (or
     * when the paper has no rubric set).
     */
    missingSourceTypes: ReadonlyArray<MissingSourceTypeRequirement>;
}

/**
 * One unsatisfied rubric requirement. The orchestrator uses
 * `sourceType` to look up its prompt-time warning copy; `minimum`
 * and `have` give context (e.g. "0 de 2 críticos faltantes" lands
 * differently than "0 de 1").
 */
export interface MissingSourceTypeRequirement {
    sourceType: SourceType;
    minimum: number;
    have: number;
}

export interface ExegesisSourceContext {
    /** library_resources doc id — for traceability + future verifier. */
    corpusId: string;
    sourceType: SourceType;
    /** Display label shown to the user, e.g. "Lane WBC 47a, pp. 1-30". */
    displayLabel: string;
    /** Author key for inline citations, e.g. "Lane". May be null. */
    citationKey: string | null;

    /**
     * El rol que el PLAN DE CORPUS le asignó a esta fuente en este paso.
     *
     * El plan decide, fuente por fuente, cuál ancla el paso, cuál aporta
     * contraste y cuál entra como técnica; lo persiste en
     * `StepSourcePlanEntry.pinnedSourceRoles` y hasta acá sólo lo leía la
     * interfaz para pintar insignias. Mientras tanto al analizador se le pedía
     * clasificar a cada comentarista en esos MISMOS tres roles desde cero, o
     * sea rehacer una decisión ya tomada. Medido en producción: 79 pasos
     * llevan roles asignados, 168 asignaciones en total —79 anclas, 56
     * contrastes, 33 técnicas—, y ninguna llegaba a la generación.
     *
     * Ausente cuando el plan no clasificó esa fuente; ahí el analizador sí
     * decide, que es lo que hacía siempre.
     */
    plannedRole?: SourceRole;
    /**
     * Source body the orchestrator inlines into the prompt. For
     * `'full-document'` sources this is the entire textContent. For
     * `'extracted-excerpts'` sources, the use case pre-concatenates
     * the curated chunks with `--- ${sourceLocation} ---` separators
     * — same string slot, different upstream provenance. The
     * orchestrator doesn't branch on the difference; it just
     * inlines the text and trusts the caller's curation.
     */
    textContent: string;
    /**
     * Set when the source is in `'extracted-excerpts'` mode. Lists
     * the per-excerpt anchors (`"p. 47, § 3.2"`) so the prompt
     * template can ask Gemini to cite using these stable labels —
     * crucial for the v1.5 visibility promise (the user reviewed
     * specific excerpts; the model cites those, not the full doc).
     * Undefined for full-document sources, which cite by author +
     * label as before.
     */
    excerptAnchors?: ReadonlyArray<string>;
    /**
     * v1.7 corpus-usage planning — `'primary'` when this source is
     * pinned to the current step via `paper.stepPlan.perStep[stepId].pinnedSources`.
     * `'secondary'` when not pinned (still passed to the LLM but
     * ranked below primaries in the prompt). The orchestrator should
     * sort sources primary-first and instruct the model to prefer
     * primaries unless something in the secondaries is clearly more
     * relevant ("flexible" mode per the v1.7 spec).
     *
     * Undefined for callers / paths that haven't adopted the
     * planning-aware load yet — same effective behavior as
     * `'secondary'` (no priority signal in the prompt).
     */
    priority?: 'primary' | 'secondary';
}

export interface ExegesisPriorStep {
    kind: ExegeticalStepKind;
    /** For 'verse' steps, the verse reference; otherwise null. */
    verseRef: PassageReference | null;
    /** The accepted markdown of the prior step. */
    markdown: string;
}

export interface ExegesisGenerationOutput {
    markdown: string;
    /** Identifier of the model that produced this. Stored on the version for audit. */
    modelId: string;
    /** Total tokens consumed (prompt + completion). Null if the model didn't report. */
    tokensUsed: number | null;
}
