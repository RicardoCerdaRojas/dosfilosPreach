import type { PassageReference } from '../../bible/canon/passage-reference';
import type { ExegeticalPaperPhase } from '../entities/ExegeticalPaper';
import type { ExegeticalStepKind } from '../entities/ExegeticalStep';
import type { SourceType } from '../entities/SourceType';

/**
 * v1.7 — LLM proposer for the corpus-usage planning step.
 *
 * Given the paper's passage + assignment brief + corpus + the list of
 * generation steps, propose a per-step `pinnedSources` allocation that
 * gives each verse / section the most relevant subset of the corpus.
 *
 * Implementations talk to an LLM (Gemini, by composition root choice).
 * The port stays narrow on purpose — input is "what would a thoughtful
 * exegesis professor say belongs where", output is a structured
 * mapping that the use case folds into `paper.stepPlan.perStep`.
 *
 * Errors:
 *   - Network / LLM failures bubble up; the use case translates them
 *     into a domain error the UI can present.
 *   - Schema-violating output (LLM hallucinates source ids, returns
 *     empty allocations) is sanitized by the use case, not here.
 *     Callers SHOULD assume `Allocation.pinnedSources` may include
 *     ids that don't exist in `input.sources` and filter accordingly.
 */
export interface IStepCorpusPlanner {
    propose(input: ProposeStepCorpusInput): Promise<ProposeStepCorpusResult>;
}

export interface ProposeStepCorpusInput {
    /** Paper passage — drives "what belongs where" reasoning. */
    passage: PassageReference;
    /** Free-text framing the student gave when creating the paper. */
    assignmentBrief: string | null;
    /** Display language for the rationale strings. */
    language: 'es' | 'en';
    /** Phase hint — useful for the planner to know if a paper is fresh vs. mid-revision. */
    paperPhase: ExegeticalPaperPhase;
    /** Sources currently in the paper's corpus. */
    sources: ReadonlyArray<ProposeStepCorpusSourceInput>;
    /** Generation steps to allocate against. */
    steps: ReadonlyArray<ProposeStepCorpusStepInput>;
}

export interface ProposeStepCorpusSourceInput {
    /** ProjectSource.id — what the planner must use as the allocation key. */
    id: string;
    sourceType: SourceType;
    /** Human-readable label for the planner's reasoning prompt. */
    displayLabel: string;
    /** Optional citation key (author surname). */
    citationKey: string | null;
}

export interface ProposeStepCorpusStepInput {
    /** ExegeticalStep.id — what the planner must use as the allocation key. */
    id: string;
    kind: ExegeticalStepKind;
    /**
     * Human label for the planner's reasoning prompt
     * (e.g. "Versículo 1", "Introducción", "Conclusión").
     * The use case constructs this from the step before passing.
     */
    label: string;
    /** Verse-kind only: the specific verse reference. */
    verseRef?: PassageReference | null;
    /**
     * Las preguntas del encuadre que este paso responde. Sin ellas el
     * planificador repartía a ciegas: en el TP #6 puso NA28 y Metzger en
     * 3:11, que no tenía pregunta, y no en 3:6, que trataba la puntuación.
     */
    questions?: ReadonlyArray<string>;
}

export interface ProposeStepCorpusResult {
    /**
     * Per-step allocations. Keys are `ExegeticalStep.id`. Steps the
     * planner chose to skip (e.g. assembly) MAY be absent — the use
     * case handles missing entries gracefully.
     */
    allocations: Readonly<Record<string, ProposedAllocation>>;
    /** The composed prompt the planner sent (for telemetry / debugging). */
    promptUsed?: string;
}

export interface ProposedAllocation {
    /**
     * `ProjectSource.id` values the planner thinks should be pinned to
     * this step. Order matters — the first id is "most relevant".
     * Empty array = the planner explicitly chose not to pin anything
     * (the step will fall through to type-level emphasis at generation).
     */
    pinnedSources: ReadonlyArray<string>;
    /**
     * Optional role for each pinned source — `'anchor'` / `'contrast'`
     * / `'technical'`. When the planner returns roles, the use case
     * persists them on `StepSourcePlanEntry.pinnedSourceRoles` so the
     * UI can render the badges. Pre-roles planners (or sources the
     * planner couldn't classify) return without an entry; the UI
     * falls back to a plain chip.
     */
    pinnedSourceRoles?: Readonly<Record<string, 'anchor' | 'contrast' | 'technical'>>;
    /**
     * Short justification (1-2 sentences) the user can read to decide
     * whether to accept the allocation. Localized to `input.language`.
     * Empty string when the planner had nothing useful to say.
     */
    rationale: string;
}
