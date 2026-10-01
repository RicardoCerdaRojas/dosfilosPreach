import type { PassageReference } from '../../bible/canon/passage-reference';
import type { CanonicalVerseAnalysis } from '../entities/CanonicalVerseAnalysis';
import type { StyleGuideManifest } from '../entities/StyleGuideManifest';
import type { ComposerSourceMetadata } from './IAcademicComposer';

/**
 * Registro homilético del sermón ministerial.
 *
 * Vivía en `IPaperToSermonTransformer`, el port del transformador
 * paper→sermón que se retiró cuando el paper dejó de producir
 * borradores (el paper alimenta el estudio de 8 pasos; no lo saltea).
 * El único consumidor que quedaba era el composer ministerial, así que
 * el tipo se mudó aquí, con su dueño. El nombre se conserva porque está
 * persistido en `Sermon.wizardProgress.derivedContext.tone` de los
 * sermones ya generados.
 */
export type PaperToSermonTone = 'pastoral' | 'expositivo' | 'narrativo';

/**
 * Ports for the parallel ministry composers — produce non-academic
 * formats from the same `CanonicalVerseAnalysis[]` artifact the
 * academic composer consumes.
 *
 * Shared philosophy:
 *   - The exegetical work is DONE. Each composer's job is to
 *     transform the structured analyses into a format-appropriate
 *     expression. NEVER re-analyze; NEVER invent claims; NEVER cite
 *     sources that don't appear in the analyses.
 *   - The `theologicalHooks` field on each analysis is the bridge
 *     from exegesis to systematic theology — non-academic composers
 *     consume it to surface doctrinal threads explicitly. Academic
 *     composer ignores it (theology emerges inline in academic
 *     prose).
 *   - Style guide enforcement is OPTIONAL for non-academic formats.
 *     Sermon and devotional registers diverge from the seminary's
 *     citation conventions; the user's homiletic preferences guide
 *     them, not the academic style guide. Composers DO accept the
 *     guide as context but treat it advisorily, not bindingly.
 *
 * Each composer is a separate port (rather than a single
 * `IMinistryComposer` with a `format` parameter) because the
 * format-specific options differ enough that a unified interface
 * would either lose type-safety or balloon with discriminated
 * unions. Three small ports beat one fat one.
 */

// ── Shared base input ───────────────────────────────────────────────────

/**
 * Common context every ministry composer needs. Format-specific
 * inputs extend this with their own option types.
 */
export interface MinistryComposerBaseInput {
    /** Whole-paper passage range. */
    paperPassage: PassageReference;

    /** Output language. */
    language: 'es' | 'en';

    /**
     * Paper-level framing — assignment brief or pastoral context the
     * student supplied. For ministry composers this signals the
     * intended audience / situation more than the academic angle.
     */
    assignmentBrief: string | null;

    /** Accepted verse analyses in canonical order. */
    verseAnalyses: ReadonlyArray<CanonicalVerseAnalysis>;

    /**
     * Optional style guide. Ministry composers treat the guide as
     * advisory, not binding — homiletic register diverges from
     * academic-citation register. Pass through for context but the
     * composer is free to depart when the format demands.
     */
    styleGuideContent: string;
    styleGuideManifest: StyleGuideManifest | null;

    /** Source registry. */
    sources: ReadonlyArray<ComposerSourceMetadata>;

    /** Optional regeneration hint. */
    regenerationHint: string | null;
}

/**
 * Common output shape for every ministry composer.
 */
export interface MinistryComposerBaseOutput {
    /** Composed markdown. */
    markdown: string;
    /** Model id. */
    modelId: string;
    /** Token usage. */
    tokensUsed: number | null;
}

// ── Sermon composer ─────────────────────────────────────────────────────

/**
 * Port for the expository-sermon composer. Produces a sermon outline
 * + full manuscript ready for the pulpit.
 *
 * Differs from the legacy `IPaperToSermonTransformer`:
 *   - That one takes the paper's assembled markdown as raw input and
 *     transforms text → text.
 *   - This one takes structured `CanonicalVerseAnalysis[]` as input.
 *     The transformation is data → text, with full visibility into
 *     the analytical decisions (translation commitments, theological
 *     hooks, confidence flags) that shape the sermon's faithfulness.
 *
 * Both can coexist; the legacy path stays available for papers that
 * predate the canonical pipeline.
 */
export interface ISermonComposer {
    composeSermon(input: ComposeSermonInput): Promise<ComposeSermonOutput>;
}

export interface ComposeSermonInput extends MinistryComposerBaseInput {
    /**
     * Tone of the sermon. Reuses the legacy `PaperToSermonTone`
     * vocabulary (pastoral / expositivo / narrativo) so existing UI
     * affordances map without translation:
     *   - 'pastoral' — close, shepherd-like, application-rich
     *   - 'expositivo' — classic outline with clear divisions
     *   - 'narrativo' — built on the biblical narrative arc
     */
    tone: PaperToSermonTone;
}

export interface ComposeSermonOutput extends MinistryComposerBaseOutput {
    // Future: outline + manuscript as separate fields. v1 collapses
    // to a single markdown for simplicity.
}

// ── Devotional composer ─────────────────────────────────────────────────

/**
 * Audience for a devotional reflection. Drives length and depth.
 */
export type DevotionalAudience = 'general' | 'small-group' | 'individual';

/**
 * Port for devotional composer. Produces an accessible reflection
 * (1-2 pages) anchored in the analysis's findings but adapted to
 * non-academic register.
 */
export interface IDevotionalComposer {
    composeDevotional(input: ComposeDevotionalInput): Promise<ComposeDevotionalOutput>;
}

export interface ComposeDevotionalInput extends MinistryComposerBaseInput {
    audience: DevotionalAudience;
}

export interface ComposeDevotionalOutput extends MinistryComposerBaseOutput {}

// ── Study-guide composer ────────────────────────────────────────────────

/**
 * Audience for an inductive Bible study guide.
 */
export type StudyGuideAudience = 'small-group' | 'sunday-school' | 'individual';

/**
 * Port for study-guide composer. Produces an inductive Bible study
 * with observation, interpretation, and application questions
 * grounded in the analyses' findings.
 */
export interface IStudyGuideComposer {
    composeStudyGuide(input: ComposeStudyGuideInput): Promise<ComposeStudyGuideOutput>;
}

export interface ComposeStudyGuideInput extends MinistryComposerBaseInput {
    audience: StudyGuideAudience;
}

export interface ComposeStudyGuideOutput extends MinistryComposerBaseOutput {}
