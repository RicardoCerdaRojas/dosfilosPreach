import type { PassageReference } from '../../bible/canon/passage-reference';
import type { CanonicalVerseAnalysis, CitationPageKind } from '../entities/CanonicalVerseAnalysis';
import type { ExegeticalStrategy } from '../entities/ExegeticalPaper';
import type { PaperRubric } from '../entities/PaperRubric';
import type { StyleGuideManifest } from '../entities/StyleGuideManifest';

/**
 * Port for the academic-paper composer — the composition stage of
 * the two-stage architecture (analysis → composition).
 *
 * Consumes a sequence of `CanonicalVerseAnalysis` (the full pericope
 * analyzed verse by verse) plus optional intro/conclusion structured
 * data, and emits academic prose in TMS-style rigor: continuous
 * paragraphs (no numbered checklist), morphology integrated into
 * prose, citations distributed inline, footnotes for argument
 * extension, closing synthesis paragraphs per verse with translation
 * commitments + verse thesis.
 *
 * Style guide enforcement is mandatory and lives at two layers:
 *
 *   1. **Prompt layer** — `styleGuideContent` (raw text the user
 *      uploaded) and `styleGuideManifest` (structured rules: citation
 *      templates, ibid handling, quotation marks, italics
 *      conventions, etc.) are embedded in the composer's system
 *      prompt as authoritative formatting rules. Gemini composes
 *      prose that respects them from the start.
 *
 *   2. **Post-process layer** — the use case feeds the composer's
 *      output through the existing `DeterministicStyleFormatter`,
 *      which rewrites inline citations per the manifest's templates
 *      (full vs short, ibid for consecutive same-source, paginación,
 *      etc.). The formatter is mechanical and idempotent: same
 *      manifest + same markdown → same output.
 *
 * Fallback policy: when no style guide is configured, the composer
 * declares the fallback explicitly in the prompt ("no guide attached,
 * apply TMS / Turabian conventions") and the deterministic formatter
 * is bypassed (no manifest to drive it). Never silently ignore the
 * absence — log it.
 */
export interface IAcademicComposer {
    composeAcademicPaper(input: ComposeAcademicPaperInput): Promise<ComposeAcademicPaperOutput>;
}

export interface ComposeAcademicPaperInput {
    /** Whole-paper passage. Used for the title and global framing. */
    paperPassage: PassageReference;

    /** Optional explicit paper title; falls back to the passage when absent. */
    paperTitle?: string | null;

    /** Output language for prose-bearing content. */
    language: 'es' | 'en';

    /**
     * The student's paper-level framing — assignment brief + chosen
     * angle. Threaded into intro/conclusion composition so they align
     * with the paper's identity. Null when not supplied.
     */
    assignmentBrief: string | null;

    /**
     * The structured analyses for every verse in the pericope, in
     * canonical order (by `reference.verseStart`). The composer
     * weaves these into the body of the paper.
     */
    verseAnalyses: ReadonlyArray<CanonicalVerseAnalysis>;
    /**
     * Cómo rotular el número de cada fuente citada.
     *
     * El análisis guarda la HOJA del archivo; el paper lo lee alguien con
     * el libro de papel delante. Cuando el desfase de ese documento se
     * pudo medir, esto devuelve la página impresa; cuando no, devuelve
     * «hoja N» para que el lector sepa qué número está viendo.
     *
     * Omitido: se cita la hoja rotulada «p.», que es como venía.
     */
    pageLabel?: (sourceKey: string, page: number, kind: CitationPageKind) => string;

    /**
     * Style guide content (TMS or equivalent) verbatim. Embedded in
     * the prompt as authoritative formatting rules. Empty string
     * acceptable — the composer falls back to TMS defaults explicitly.
     */
    styleGuideContent: string;

    /**
     * Structured style-guide manifest. When present, drives the
     * deterministic post-formatter. When null, the formatter is
     * bypassed and the composer relies exclusively on the prompt
     * layer for style adherence.
     */
    styleGuideManifest: StyleGuideManifest | null;

    /**
     * Citation key → metadata table assembled by the use case from
     * the paper's `ProjectSource[]`. The composer uses this for
     * bibliography rendering and for resolving `sourceKey` references
     * in the analyses to readable author/title strings.
     */
    sources: ReadonlyArray<ComposerSourceMetadata>;
    /**
     * v1.7+ — UNION of sourceKeys pinned across every step of this
     * paper. The composer MUST cite each at least once across the
     * full output (intro / verses / conclusion / footnotes). Empty
     * when no plan was set. Per-step assignment is in
     * `paper.stepPlan.perStep[*].pinnedSources` — surfaced here as a
     * flat union so the composer can verify global plan honor in one
     * pass without re-walking the per-step structure.
     */
    pinnedSourceKeys: ReadonlyArray<string>;
    /**
     * The paper's rubric (seminary's grading criteria, or system
     * default). Threaded into the prompt so the composer aligns the
     * paper with expected length, citation standard, source-type
     * requirements, and per-section emphasis. Null when no rubric is
     * attached — the composer falls back to TMS / Turabian defaults.
     */
    paperRubric: PaperRubric | null;
    /**
     * Corpus-building strategy chosen by the student (`'dialectical'` or
     * `'free'`). Surfaced to the composer as methodology context — the
     * dialectical mode tells the model the corpus is balanced across
     * anchors / contrasts / technical roles, so the prose should
     * reflect that dialectical engagement rather than treating sources
     * as a flat list. Independent of the rubric: a paper can have any
     * strategy + any rubric.
     */
    exegeticalStrategy: ExegeticalStrategy | null;
}

/**
 * Per-source metadata the composer needs for prose rendering and
 * bibliography. The use case populates this from `paper.sources` +
 * the configured `library_resources` documents.
 */
export interface ComposerSourceMetadata {
    /** Citation key — matches `sourceKey` in `CanonicalVerseAnalysis` references. */
    citationKey: string;
    /** Human-readable author. e.g. "William L. Lane". */
    author: string;
    /** Work title. e.g. "Hebrews 1–8". */
    title: string;
    /** Series + volume when applicable. e.g. "Word Biblical Commentary 47a". */
    seriesVolume?: string;
    /** Publication city. e.g. "Dallas, TX". */
    city?: string;
    /** Publisher. e.g. "Word". */
    publisher?: string;
    /** Year. e.g. 1991. */
    year?: number;
    /** Edition designator when relevant. e.g. "Ed. rev." */
    edition?: string;
    /**
     * v1.7+ — full source text content. Populated by the use case
     * ONLY for sources pinned for the composer's scope (per-step for
     * intro/conclusion composers; UNION across steps for the academic
     * composer). Lets the composer cite a pinned source even when
     * the body's verse analyses didn't engage it. Absent for sources
     * the composer doesn't need to ground from text directly.
     */
    textContent?: string;
    /**
     * v1.7+ — true when this source is pinned for the composer's
     * scope. Composer prompts surface a stronger instruction near
     * the source's textContent block when set.
     */
    isPinned?: boolean;
}

export interface ComposeAcademicPaperOutput {
    /**
     * Final composed markdown — academic prose with footnote markers
     * `[^N]`, footnote bodies at the document end, citations inline
     * per the style guide, bibliography section. Ready for export to
     * .docx or PDF.
     */
    markdown: string;

    /**
     * The model id that produced the underlying composition. Persisted
     * for audit (cost tracking, post-hoc quality comparison).
     */
    modelId: string;

    /**
     * Token usage. Null when the model didn't report.
     */
    tokensUsed: number | null;

    /**
     * Style-formatter status: 'applied' when the deterministic
     * formatter ran (manifest was available); 'skipped' when no
     * manifest was attached (composer relied on prompt layer alone);
     * 'error' when the formatter ran but failed gracefully (the raw
     * composition is still returned).
     */
    formatterStatus: 'applied' | 'skipped' | 'error';

    /**
     * Qué tanto del análisis llegó a publicarse.
     *
     * El compositor es un modelo y decide qué decir: sobre un trabajo
     * real de Santiago 1:1-5 publicaba tres de los dieciocho campos y
     * no declaraba los quince restantes. El caso de uso mide verso por
     * verso y publica con el render determinista el que salió
     * incompleto; esto es lo que hizo, para que la interfaz pueda
     * decirlo en vez de que el estudiante entregue sin saberlo.
     *
     * Ausente cuando no se pudo medir (un paper sin análisis
     * estructurado detrás).
     */
    coverage?: CompositionCoverage;
}

export interface CompositionCoverage {
    /** Ítems del análisis que el paper tenía que publicar. */
    totalItems: number;
    /** Los que la prosa del modelo publicó por su cuenta. */
    composedItems: number;
    /**
     * Versos que salieron incompletos y se publicaron con el render
     * determinista del análisis, rotulados con su referencia.
     */
    renderedVerses: string[];
    /**
     * Rótulos de lo que el modelo había descartado. Es la lista que la
     * interfaz muestra: sirve para revisar el análisis, no sólo para
     * contar.
     */
    recoveredItemLabels: string[];
    /**
     * `true` cuando el paper compuesto no se pudo trocear por verso
     * —faltaban los encabezados del contrato— y se publicó el cuerpo
     * determinista entero. Sin esto, un fallo del troceo se vería como
     * una composición perfecta.
     */
    sectioningFailed: boolean;
}
