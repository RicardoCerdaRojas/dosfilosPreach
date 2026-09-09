import type { PassageReference } from '../../bible/canon/passage-reference';
import type { CanonicalVerseAnalysis, CitationPageKind } from '../entities/CanonicalVerseAnalysis';
import type { StyleGuideManifest } from '../entities/StyleGuideManifest';
import type { ComposerSourceMetadata } from './IAcademicComposer';

/**
 * Per-verse academic composer. Sibling of `IAcademicComposer` but
 * scoped to a SINGLE verse: composes 1-3 paragraphs of academic prose
 * over that verse's `CanonicalVerseAnalysis`, ready to slot into the
 * paper's body OR to display in the per-verse "preview as prose"
 * surface.
 *
 * Why a separate port (vs reusing the whole-paper composer with a
 * single-verse array):
 *   - The prompt differs: no intro/conclusion framing, no transitions
 *     to other verses, no bibliography. Composer should focus on the
 *     verse's own argument.
 *   - The output is shorter, so a tighter token cap is appropriate.
 *   - Persistence target differs: per-verse prose lives on the verse
 *     step's accepted version's `markdown` field; whole-paper prose
 *     goes into `paper.assembledMarkdown`.
 *
 * Style guide enforcement matches the whole-paper composer (prompt
 * layer + deterministic post-formatter when a manifest is available).
 */
export interface IVerseAcademicComposer {
    composeVerse(input: ComposeVerseInput): Promise<ComposeVerseOutput>;
}

export interface ComposeVerseInput {
    /** The verse's structured analysis. The only authoritative content source. */
    verseAnalysis: CanonicalVerseAnalysis;

    /**
     * The whole-paper passage. Surfaces in the prompt only as orienting
     * context ("this verse belongs to the pericope X:N-M") so the
     * composer's prose situates the verse without writing about other
     * verses.
     */
    paperPassage: PassageReference;

    /** Output language. */
    language: 'es' | 'en';

    /**
     * Cómo rotular el número de cada cita. Opcional: sin él se rotula según
     * el `pageKind` que guardó el análisis, que es correcto para todo lo
     * analizado con la numeración del recurso a la vista.
     *
     * Se pasa para rescatar los análisis anteriores a la calibración, que
     * guardaron la hoja del archivo: con la numeración del recurso, esos
     * números se convierten al recomponer en vez de quedar como «hoja N».
     */
    pageLabel?: (sourceKey: string, page: number, kind: CitationPageKind) => string;

    /**
     * Optional paper-level brief — the student's framing. Threaded into
     * the prompt as background; composer must not re-state it.
     */
    assignmentBrief: string | null;

    /** Style guide content (verbatim) when configured. */
    styleGuideContent: string;

    /** Manifest for the deterministic post-formatter. */
    styleGuideManifest: StyleGuideManifest | null;

    /**
     * Citation key → metadata table for citations inline. Same shape as
     * the whole-paper composer; the use case projects from `paper.sources`
     * + library metadata exactly like that one.
     */
    sources: ReadonlyArray<ComposerSourceMetadata>;
}

export interface ComposeVerseOutput {
    /**
     * Composed prose for the verse. Markdown. Inline citations follow
     * the style guide (or TMS defaults when no guide attached).
     */
    markdown: string;

    /** Audit trail. */
    modelId: string;

    /** Token usage; null when not reported. */
    tokensUsed: number | null;

    /** Formatter status — same semantics as `IAcademicComposer`. */
    formatterStatus: 'applied' | 'skipped' | 'error';
}
