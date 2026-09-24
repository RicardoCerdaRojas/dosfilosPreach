import type { PassageReference } from '../../bible/canon/passage-reference';
import type { CanonicalVerseAnalysis } from '../entities/CanonicalVerseAnalysis';
import type { StepEmphasis } from '../entities/StepSourcePlan';
import type {
    ExegesisPriorStep,
    ExegesisSourceContext,
    MissingSourceTypeRequirement,
} from './IExegesisOrchestrator';

/**
 * Port for the canonical verse analyzer — the analysis stage of the
 * two-stage architecture (analysis → composition).
 *
 * The analyzer produces a `CanonicalVerseAnalysis` populated with the
 * eleven canonical exegetical steps plus the platform's five
 * differentiators (see `docs/exegesis/METODOLOGIA.md`). It does NOT
 * produce prose — composers downstream consume the structured
 * artifact and emit format-specific markdown (academic paper, sermon,
 * devotional, study guide).
 *
 * Implementations live in infrastructure. The Gemini implementation
 * uses structured-output prompting to constrain the model to the
 * schema; future implementations (OpenAI, Claude, local models) plug
 * in by satisfying this same port.
 *
 * Coexists with `IExegesisOrchestrator` during the migration:
 *   - `IExegesisOrchestrator.generateStep` returns markdown — the
 *     legacy / interim path that the current UI consumes.
 *   - `ICanonicalVerseAnalyzer.analyzeVerse` returns
 *     `CanonicalVerseAnalysis` — the target path. Once composers and
 *     the new study/paper UI ship, the orchestrator port retires for
 *     the verse kind (intro/conclusion may stay markdown-first
 *     longer).
 */
export interface ICanonicalVerseAnalyzer {
    analyzeVerse(input: AnalyzeVerseInput): Promise<AnalyzeVerseOutput>;
}

export interface AnalyzeVerseInput {
    /**
     * Whole-paper passage range. Provides context: every verse step
     * is part of a larger argument, and the analyzer references that
     * scope when articulating `argumentativeRole`.
     */
    paperPassage: PassageReference;

    /**
     * The specific verse this analysis covers. Always a single verse
     * or a tight contiguous range within one chapter.
     */
    verseRef: PassageReference;

    /**
     * Output language for prose-bearing fields. Drives both the
     * prompt's natural-language sections (justifications,
     * descriptions, theses) and the language of the methodology
     * vocabulary (caso/género/número vs case/gender/number).
     */
    language: 'es' | 'en';

    /**
     * Original-language text for this verse (Greek for NT, Hebrew
     * for OT). Loaded by the use case from
     * `IOriginalLanguageBibleProvider` (e.g. SBL GNT for NT, WLC
     * for OT) and surfaced to the analyzer as authoritative base
     * text — every grammatical / lexical / syntactic decision the
     * analyzer documents must square with this text.
     *
     * Null when the provider doesn't support the verse's book or
     * the fetch failed (network, CDN outage); the analyzer falls
     * back to whatever Greek/Hebrew it knows from training, with
     * a note in confidenceFlags acknowledging the gap.
     */
    originalLanguageText: string | null;

    /**
     * El texto original de los versículos VECINOS, con el analizado señalado.
     *
     * Existe porque la sintaxis griega no respeta los versículos y el
     * analizador veía sólo el suyo. El caso testigo es Santiago 2:2: una
     * prótasis condicional cuya apódosis está en 2:4. Sin el entorno no se
     * puede decir qué clase de condición es, porque la evidencia está dos
     * versículos más adelante y el sistema la recortaba.
     *
     * NO es texto para analizar: es para ver antecedentes y consecuentes. Lo
     * que se analiza sigue siendo `originalLanguageText`, y el contexto lleva
     * el versículo marcado para que no haya duda de cuál es.
     *
     * Null cuando no hay vecinos que ofrecer —un trabajo de un solo
     * versículo— o cuando el proveedor no responde.
     */
    pericopeContext: string | null;

    /**
     * Free-text framing of the paper — typically the assignment
     * brief + the student's chosen angle. Threaded into the analyzer
     * so the verse's `argumentativeRole` and `verseThesis` align with
     * the paper-level identity. Null when the student didn't supply
     * one.
     */
    assignmentBrief: string | null;

    /**
     * Per-step emphasis the student saved (or accepted from the
     * rubric default). Drives source-budget weights and primes the
     * analyzer toward types the rubric/strategy considers central
     * for this step kind.
     */
    stepEmphasis: StepEmphasis | null;

    /**
     * Style guide content (TMS or equivalent) verbatim. Less
     * relevant for the analyzer than for the composer (style guides
     * govern presentation), but kept here so the analyzer can
     * surface any analytical choices the guide pre-determines (e.g.,
     * "always cite from the LXX edition specified in §3.2").
     */
    styleGuideContent: string;

    /**
     * Project sources with role + extracted content. The analyzer
     * uses these to populate `commentatorEngagement`,
     * `lexicalAnalyses.sources`, etc.
     */
    sources: ExegesisSourceContext[];

    /**
     * Prior accepted verse analyses in canonical structured form.
     * Used for inter-verse continuity:
     *   - avoid redoing lexical analyses for terms already analyzed
     *   - build on prior translation commitments
     *   - recognize argumentative flow across verses
     *
     * Empty when this is the first verse of the pericope.
     */
    priorAcceptedAnalyses: ReadonlyArray<CanonicalVerseAnalysis>;

    /**
     * Optional fallback to legacy markdown prior steps when the
     * paper hasn't been fully migrated to canonical analyses yet.
     * The analyzer reads these as additional context but doesn't
     * structure-derive from them — they're hint, not source of
     * truth.
     */
    priorAcceptedSteps?: ReadonlyArray<ExegesisPriorStep>;

    /**
     * Optional regeneration hint provided by the user when asking
     * for a redo (e.g., "más profundidad sintáctica", "menos
     * contraste, más ancla").
     */
    regenerationHint: string | null;

    /**
     * Rubric requirements the corpus doesn't meet. Same semantics as
     * in `IExegesisOrchestrator`: when `critical-apparatus` is
     * missing, the analyzer must mark textual-variant claims as
     * tentative; when `lexicon-technical` is missing, lexical
     * decisions get hedged. Maps directly to the
     * `confidenceFlags` field of the produced analysis.
     */
    missingSourceTypes: ReadonlyArray<MissingSourceTypeRequirement>;
}

export interface AnalyzeVerseOutput {
    /** The structured analysis populated according to the schema. */
    analysis: CanonicalVerseAnalysis;

    /**
     * Identifier of the model that produced this analysis. Persisted
     * on the step version for audit (cost tracking, post-hoc quality
     * comparison across model versions).
     */
    modelId: string;

    /**
     * Total tokens consumed for this generation (prompt +
     * completion). Null when the model did not report usage.
     */
    tokensUsed: number | null;
}
