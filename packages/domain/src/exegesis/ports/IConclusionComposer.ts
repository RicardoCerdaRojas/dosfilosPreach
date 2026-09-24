import type { PassageReference } from '../../bible/canon/passage-reference';
import type { CanonicalVerseAnalysis } from '../entities/CanonicalVerseAnalysis';
import type { ExegeticalStrategy } from '../entities/ExegeticalPaper';
import type { PaperRubric } from '../entities/PaperRubric';
import type { StyleGuideManifest } from '../entities/StyleGuideManifest';
import type { ComposerSourceMetadata } from './IAcademicComposer';

/**
 * Port for the conclusion composer — synthesizes the body's accepted
 * verse analyses into the paper's conclusion section.
 *
 * Academic methodology: the conclusion is written FROM the body's
 * findings, not from a pre-imagined plan. It restates the thesis
 * that the verse-by-verse analysis actually demonstrated, integrates
 * the main translation commitments and verse theses, and connects
 * them to the broader argument of the book/passage.
 *
 * It does NOT introduce new arguments. It does NOT cite new sources
 * beyond what the body engaged with. It does NOT expand the analytic
 * frame.
 *
 * Scope: this composer produces ONLY the conclusion section markdown
 * (typically 2-3 paragraphs). It does NOT produce the whole paper —
 * that's `IAcademicComposer`'s job.
 *
 * Style guide enforcement is mandatory and lives at two layers
 * (prompt + deterministic post-formatter), same architecture as
 * `IAcademicComposer`.
 */
export interface IConclusionComposer {
    composeConclusion(input: ComposeConclusionInput): Promise<ComposeConclusionOutput>;
}

export interface ComposeConclusionInput {
    /** Whole-paper passage range. */
    paperPassage: PassageReference;
    /** Output language. */
    language: 'es' | 'en';
    /**
     * Paper-level framing (assignment brief + chosen angle). Threaded
     * so the conclusion's restatement of the thesis aligns with the
     * paper's identity.
     */
    assignmentBrief: string | null;
    /**
     * Accepted verse analyses in canonical order. The conclusion
     * synthesizes from these — they are the body the conclusion is
     * concluding ABOUT.
     */
    verseAnalyses: ReadonlyArray<CanonicalVerseAnalysis>;
    /** Style guide content (verbatim). */
    styleGuideContent: string;
    /** Structured style-guide manifest. Drives the post-formatter. */
    styleGuideManifest: StyleGuideManifest | null;
    /** Source registry — for citation lookup if the conclusion cites sparingly. */
    sources: ReadonlyArray<ComposerSourceMetadata>;
    /**
     * v1.7+ — sourceKeys the student's plan pinned for the conclusion
     * step. The composer MUST cite each at least once (paraphrase or
     * verbatim). Empty when no plan was set or the conclusion step had
     * no pinned sources. Asymmetry rules (default 1, hard cap 2,
     * never technical) still apply per METODOLOGIA.md.
     */
    pinnedSourceKeys: ReadonlyArray<string>;
    /**
     * The paper's rubric. Threaded into the prompt so the conclusion
     * matches the expected length, citation standard, and per-section
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
    /**
     * Cuántas palabras le tocan a esta sección, derivadas de la extensión que
     * exige la rúbrica. `null` o ausente cuando el curso no la declara.
     *
     * Llega hasta acá porque el número existía y no salía de la pantalla: lo
     * calculaba `wordsPerVerseTarget` y su único llamador era la interfaz. Un
     * trabajo que pedía 2-3 páginas salió de 16.
     */
    wordBudget?: number | null;

    /**
     * Optional regeneration hint provided by the user when re-running
     * the composer (e.g. "más énfasis en la cristología", "menos
     * referencia a contexto histórico").
     */
    regenerationHint: string | null;
}

export interface ComposeConclusionOutput {
    /**
     * Composed conclusion markdown (typically 2-3 paragraphs).
     * Suitable as the value of an `ExegeticalStepVersion.markdown`
     * for the conclusion-kind step.
     */
    markdown: string;
    /** Model id that produced this composition. */
    modelId: string;
    /** Token usage. Null when not reported. */
    tokensUsed: number | null;
    /**
     * Whether the deterministic style formatter ran. Same semantics
     * as `IAcademicComposer`: 'applied' / 'skipped' / 'error'. The
     * adapter itself returns 'skipped' — the use case may upgrade to
     * 'applied' / 'error' depending on whether and how the formatter
     * runs.
     */
    formatterStatus: 'applied' | 'skipped' | 'error';
}
