import type { PaperRubric } from '../entities/PaperRubric';

/**
 * Port the setup UI uses to turn a raw rubric document (PDF, EPUB,
 * pasted text) into a structured `PaperRubric`.
 *
 * Implementations live in infrastructure (Gemini, OpenAI, etc.). The
 * extractor receives ALREADY-EXTRACTED text — the file → text step is
 * the existing LlamaParse pipeline that produces the corpusId. Keeping
 * this port pure-text means the extractor doesn't need to know about
 * file storage, MIME types, or chunking.
 *
 * The implementation is responsible for:
 *   - Parsing the text into the `PaperRubric` structured form,
 *     mapping the rubric's vocabulary onto our `SourceType` catalog
 *     (the rubric likely says "comentario crítico técnico" — the
 *     extractor maps that to `commentary-critical`).
 *   - Producing localized `justification` strings in the requested
 *     `language`.
 *   - Filling in conservative defaults for fields the rubric doesn't
 *     mention (e.g. if the rubric is silent on `expectedLength`,
 *     return null rather than guessing).
 *   - Setting `provenance` to `'extracted-from-document'` or
 *     `'extracted-from-text'` based on `input.source`.
 *
 * Failures: throw — let the use case decide whether to fall back to
 * the default rubric or surface the error to the user.
 */
export interface IPaperRubricExtractor {
    extract(input: ExtractRubricInput): Promise<ExtractedRubric>;
}

export interface ExtractRubricInput {
    /**
     * The raw text of the rubric. The use case fetches this from the
     * library content reader (for uploaded documents) or passes the
     * pasted text directly. Whitespace-trimmed; the extractor MAY
     * normalize further if needed. May be empty when `inlineImage` is
     * present — image-only extraction relies on Gemini Vision.
     */
    rawText: string;
    /**
     * `true` cuando la extracción es GRATIS para el pastor (crear una rúbrica
     * propia a partir de un texto, `CreateUserRubricFromText`): el adaptador
     * usa una etiqueta del proxy que no cobra (`exegesis.createUserRubric`).
     * Sin esto, la etiqueta de siempre exige una reserva de saldo.
     */
    gratuita?: boolean;
    /**
     * Inline image data when the rubric was uploaded / pasted as an
     * image (PNG / JPEG / WEBP) instead of a PDF or text. The extractor
     * sends this to Gemini Vision multimodally so the rubric is parsed
     * directly from the image — no PDF text-extraction step required.
     * `rawText` may be empty in that case (the image is the source).
     */
    inlineImage?: {
        mimeType: string;
        /** Base64-encoded image bytes, no `data:...;base64,` prefix. */
        base64: string;
    };
    /**
     * 'document' for uploaded PDFs/EPUBs (corpusId-backed),
     * 'text' for pasted-text rubrics, 'image' for image uploads or
     * clipboard pastes (handled inline via Gemini Vision). The
     * extractor uses this to set the provenance on the returned
     * rubric.
     */
    source: 'document' | 'text' | 'image';
    /** If `source === 'document'`, the corpus id to record on the rubric. */
    sourceCorpusId: string | null;
    /** Output language for `justification` strings. */
    language: 'es' | 'en';
}

/**
 * Result of a rubric extraction.
 *
 * Returned as a partial `PaperRubric` (without `createdAt`/`updatedAt`,
 * which the use case stamps) plus a `confidence` flag the UI uses to
 * nudge the student to review extracted requirements before
 * accepting. Low confidence happens when the rubric document is
 * thin, ambiguous, or written in a vocabulary the extractor doesn't
 * recognize.
 */
export interface ExtractedRubric {
    rubric: Omit<PaperRubric, 'createdAt' | 'updatedAt'>;
    /**
     * 'high' — every section was clearly stated; 'medium' — most
     * fields filled but some inferred; 'low' — significant gaps,
     * student review strongly recommended.
     */
    confidence: 'high' | 'medium' | 'low';
    /**
     * Optional notes about what the extractor was unsure about, shown
     * in a collapsible "review" panel in the setup UI. Localized to
     * `input.language`. Empty array when there's nothing to flag.
     */
    reviewNotes: ReadonlyArray<string>;
    /** Token consumption for cost attribution. Null if the implementation can't report. */
    tokensUsed: number | null;
    /** Identifier of the model used (audit trail). */
    modelId: string;
}
