import type { PassageReference } from '../../bible/canon/passage-reference';
import type { CanonicalVerseAnalysis } from '../entities/CanonicalVerseAnalysis';
import type { ExegeticalStrategy } from '../entities/ExegeticalPaper';
import type { PaperRubric } from '../entities/PaperRubric';
import type { StyleGuideManifest } from '../entities/StyleGuideManifest';
import type { ComposerSourceMetadata } from './IAcademicComposer';

/**
 * Port for the introduction composer — written LAST in the canonical
 * academic methodology, after both the verse analyses and the
 * conclusion are accepted.
 *
 * The introduction's job is to:
 *   1. Present the passage and its importance within its book.
 *   2. Articulate a precise thesis that the body actually
 *      demonstrated (NOT the thesis the author hoped to demonstrate
 *      before doing the work).
 *   3. Briefly state methodology (morphological, syntactic, lexical,
 *      intertextual, theological).
 *   4. Sketch the direction of the argument.
 *
 * Hard constraint: the introduction MUST NOT promise topics that the
 * body did not develop. By writing it last (with full visibility into
 * what the body and conclusion actually established), the composer
 * can produce an honest introduction.
 *
 * Scope: produces ONLY the introduction section markdown (typically
 * 2-3 paragraphs). Coexists with the conclusion composer; the
 * `IAcademicComposer` (full paper one-shot) remains a separate path
 * for users who want the all-in-one composition.
 */
export interface IIntroductionComposer {
    composeIntroduction(input: ComposeIntroductionInput): Promise<ComposeIntroductionOutput>;
}

export interface ComposeIntroductionInput {
    /** Whole-paper passage range. */
    paperPassage: PassageReference;
    /** Output language. */
    language: 'es' | 'en';
    /**
     * Paper-level framing. The introduction restates the assignment
     * brief in academic prose, but the THESIS it states must come
     * from what the body actually demonstrated, not from the brief
     * alone.
     */
    assignmentBrief: string | null;
    /** Accepted verse analyses in canonical order. */
    verseAnalyses: ReadonlyArray<CanonicalVerseAnalysis>;
    /**
     * Accepted conclusion markdown. The introduction reads the
     * conclusion to know what thesis to articulate at the start.
     * Written-last methodology assumes this is present and
     * meaningful.
     */
    acceptedConclusionMarkdown: string;
    /** Style guide content (verbatim). */
    styleGuideContent: string;
    /** Structured style-guide manifest. */
    styleGuideManifest: StyleGuideManifest | null;
    /** Source registry. */
    sources: ReadonlyArray<ComposerSourceMetadata>;
    /**
     * v1.7+ — sourceKeys the student's plan pinned for the introduction
     * step. Composer MUST cite each at least once. Empty when no plan
     * was set. Asymmetry rules (default 1, hard cap 2, never technical)
     * still apply per METODOLOGIA.md.
     */
    pinnedSourceKeys: ReadonlyArray<string>;
    /**
     * The paper's rubric. Threaded into the prompt so the introduction
     * matches the expected length, citation standard, and section
     * emphasis declared by the seminary. Null when no rubric is
     * attached.
     */
    paperRubric: PaperRubric | null;
    /**
     * Corpus-building strategy. See `IAcademicComposer` for rationale.
     */
    exegeticalStrategy: ExegeticalStrategy | null;
    /**
     * Muestras de la prosa del PROPIO autor, para imitar su registro.
     *
     * Vienen del mismo perfil que ya usaba el compositor de versículos. Sin
     * esto el cuerpo del trabajo salía con la voz del autor y las dos partes
     * que un profesor lee con más atención —cómo abre y cómo cierra— salían
     * con la del modelo.
     */
    voiceSamples?: ReadonlyArray<{ excerpt: string; position: number }>;
    /** Optional regeneration hint. */
    regenerationHint: string | null;
}

export interface ComposeIntroductionOutput {
    /** Composed introduction markdown (typically 2-3 paragraphs). */
    markdown: string;
    /** Model id. */
    modelId: string;
    /** Token usage. */
    tokensUsed: number | null;
    /** Formatter status. */
    formatterStatus: 'applied' | 'skipped' | 'error';
}
