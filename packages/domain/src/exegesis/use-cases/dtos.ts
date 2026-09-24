/**
 * Input/output shapes for exegesis use cases.
 *
 * Why this file exists without the use-case implementations: the UI starts
 * calling these contracts before the orchestration layer is built. Locking
 * the input/output shapes early lets web and infrastructure progress in
 * parallel without negotiating field names ad-hoc. Implementations live
 * in `packages/application/exegesis/use-cases/` once we add them.
 *
 * Convention: each use case has `<Name>Input` (everything the use case
 * needs that isn't injected) and either `<Name>Output` (a value object) or
 * the use case returns a domain entity directly. Errors are thrown — we
 * use plain `Error` subclasses or domain-specific error types declared
 * here as needed.
 */

import type { PassageReference } from '../../bible/canon/passage-reference';
import type {
    ProjectSourceExcerpt,
    ProjectSourceMode,
} from '../entities/ProjectSource';
import type { SourceType } from '../entities/SourceType';
import type { SourceRole } from '../entities/StepSourcePlan';

// ── CreateExegeticalPaper ───────────────────────────────────────────────

export interface CreateExegeticalPaperInput {
    ownerId: string;
    /**
     * Already validated by `parsePassageReference` or `buildPassageReference`
     * before reaching the use case. The use case does not re-parse — it
     * trusts the caller (UI) to have done that.
     */
    passage: PassageReference;
    displayLanguage: 'es' | 'en';
    /**
     * Optional title; if omitted the use case falls back to the formatted
     * passage ("Hebreos 1:1-4").
     */
    title?: string;
    /**
     * Free-text assignment brief: the professor's prompt + the student's
     * focus. Threaded through to every step's system prompt so the LLM
     * keeps the paper's framing consistent. Optional at create time —
     * the student can refine it from the setup page later.
     */
    assignmentBrief?: string | null;
    /**
     * Reference to a `UserStyleGuide` already uploaded by the user. May be
     * null in v1 — the wizard's style-guide step is a v1.5 placeholder, so
     * papers are created without a guide and the orchestrator validates
     * non-null only when the user attempts to generate. The use case still
     * verifies that any provided id exists and belongs to the user.
     */
    styleGuideId: string | null;
    /**
     * Optional `UserRubric` template to apply at create time. When
     * provided, the use case copies the template's content into
     * `paper.rubric` (snapshot). When omitted, the use case auto-
     * applies the user's default template if any; otherwise falls
     * back to the system default rubric.
     */
    rubricTemplateId?: string | null;
    /**
     * Optional initial sources. May also be empty — the user can add them
     * later via `AddProjectSource` while the paper is in 'configuring'.
     */
    initialSources?: AddProjectSourceInput[];
    /**
     * Methodology mode. When omitted the use case picks `'dialectical'`
     * — the differentiator pitch defaults users into the guided method
     * and they can opt down to `'free'` from the create UI when they
     * want to skip the role scaffolding.
     */
    exegeticalStrategy?: 'free' | 'dialectical';
    /**
     * Denormalized back-reference when this paper is being auto-created
     * by a SermonSeries pericope. Stored on the paper so downstream use
     * cases (notably sermon generation) can patch the originating
     * series without an O(N) scan. Standalone paper creation leaves
     * both omitted/null.
     */
    seriesId?: string | null;
    pericopeId?: string | null;
}

// ── UpdatePaperBrief ────────────────────────────────────────────────────
//
// Tiny stand-alone DTO so the setup-page "edit framing" form can call
// the use case without re-sending all the create fields. Returns the
// updated paper for the UI to refresh.

export interface UpdatePaperBriefInput {
    ownerId: string;
    paperId: string;
    /** New brief value. Pass empty string or null to clear. */
    assignmentBrief: string | null;
}

// ── UpdateStepPlan ──────────────────────────────────────────────────────
//
// Patch the per-kind defaults of `paper.stepPlan`. v1 only edits the
// kind-level defaults (`verse` / `conclusion` / `introduction`) — the
// per-step overrides keyed by stepId are reserved for v1.5 once the
// UI surfaces "this specific verse needs different emphasis".
//
// Each field is optional: callers patch one kind at a time so the UI
// can save incrementally without sending the whole plan. Unspecified
// fields stay untouched.

import type { StepEmphasis } from '../entities/StepSourcePlan';
import type {
    PaperRubric,
    QualityCriterion,
    SourceRequirement,
    StructuralExpectation,
} from '../entities/PaperRubric';

export interface UpdateStepPlanInput {
    ownerId: string;
    paperId: string;
    /** Override the rubric default for the introduction step kind. */
    introduction?: StepEmphasis;
    /** Override the rubric default for verse-level steps. */
    verse?: StepEmphasis;
    /** Override the rubric default for the conclusion step kind. */
    conclusion?: StepEmphasis;
}

// ── UpdateRubric ────────────────────────────────────────────────────────
//
// Patches paper.rubric. Caller passes only the fields they're
// changing; the use case merges with the persisted rubric. Marks
// provenance as 'user-edited' so the UI surfaces "you've customized
// this from the {original} default/extracted form" — important
// pedagogically so the student knows what came from the seminary vs.
// what they touched.

export interface UpdateRubricInput {
    ownerId: string;
    paperId: string;
    description?: string | null;
    citationStandard?: string | null;
    expectedLength?: PaperRubric['expectedLength'];
    sourceRequirements?: ReadonlyArray<SourceRequirement>;
    structuralExpectations?: ReadonlyArray<StructuralExpectation>;
    qualityCriteria?: ReadonlyArray<QualityCriterion>;
    formatting?: PaperRubric['formatting'];
}

// ── ResetRubric ────────────────────────────────────────────────────────
//
// Discards the user's edits and re-applies the system default
// rubric. Loses any source requirements the student added or
// removed — confirmation lives in the UI, not in the use case
// (the use case is the action, not the warning).

export interface ResetRubricInput {
    ownerId: string;
    paperId: string;
}

// ── ExtractStyleGuideManifest ──────────────────────────────────────────
//
// Reads the corpus text of a UserStyleGuide and extracts the
// structured `StyleGuideManifest` via the configured
// `IStyleGuideManifestExtractor`. The resulting manifest is saved
// on the guide so the orchestrator can read it on every paper that
// pins the guide.
//
// One-shot: re-running overwrites the previous manifest. The UI
// confirms before re-extraction so the student doesn't lose any
// manual tweaks (provenance flips back to 'extracted', losing
// 'user-edited' state).

export interface ExtractStyleGuideManifestInput {
    ownerId: string;
    guideId: string;
    /** Optional language override; defaults to 'es' when omitted. */
    language?: 'es' | 'en';
}

export interface ExtractStyleGuideManifestOutput {
    /** The updated guide carrying the new manifest. */
    guide: import('../entities/UserStyleGuide').UserStyleGuide;
    /** Tokens consumed for cost attribution. Null when unavailable. */
    tokensUsed: number | null;
}

// ── ExtractRubricFromText ──────────────────────────────────────────────
//
// Hands the rubric extractor (`IPaperRubricExtractor`) raw text the
// student pasted (typically the assignment description / rubric the
// professor sent). The extractor returns a structured PaperRubric
// which the use case persists on `paper.rubric`. PDF/EPUB upload
// goes through a separate use case once Phase 3b wires that flow.

export interface ExtractRubricFromTextInput {
    ownerId: string;
    paperId: string;
    /** Raw text the student pasted. Trimmed by the use case. */
    rawText: string;
    /**
     * Override for the extraction language. Defaults to the paper's
     * `displayLanguage`. Allows the student to paste a Spanish
     * rubric for an English paper (or vice versa) and get
     * justifications in the paper's language.
     */
    language?: 'es' | 'en';
}

export interface ExtractRubricFromTextOutput {
    /** The updated paper, ready for the UI to refresh. */
    paper: import('../entities/ExegeticalPaper').ExegeticalPaper;
    /** Extractor confidence — surfaced as a "review your rubric" nudge. */
    confidence: 'high' | 'medium' | 'low';
    /** Notes from the extractor about ambiguities. Localized to `language`. */
    reviewNotes: ReadonlyArray<string>;
}

// ── ExtractRubricFromDocument ──────────────────────────────────────────
//
// Sibling of `ExtractRubricFromText` for uploaded PDFs/images. The UI
// uploads the file via `LibraryService.uploadResource` first (which
// drives the existing LlamaParse extraction pipeline), then calls this
// use case with the resulting `libraryResourceId`. The use case fetches
// the extracted text via `IResourceContentReader` and runs the same
// extractor pipeline as the text path, but with `source: 'document'`
// and `sourceCorpusId` set so the rubric's provenance reflects its
// origin.

export interface ExtractRubricFromDocumentInput {
    ownerId: string;
    paperId: string;
    /**
     * The library resource id whose extracted text will feed the
     * rubric extractor. Must be a resource the user owns AND whose
     * extraction has finished (caller polls upstream — the use case
     * fails fast when the text isn't available yet).
     */
    libraryResourceId: string;
    /** Override for the extraction language. Defaults to paper.displayLanguage. */
    language?: 'es' | 'en';
}

export type ExtractRubricFromDocumentOutput = ExtractRubricFromTextOutput;

// ── ExtractRubricFromImage ─────────────────────────────────────────────
//
// Inline image path that bypasses the library upload pipeline. Used
// when the student pastes a screenshot from the clipboard or uploads
// a PNG/JPEG of the syllabus directly. Sends the image to Gemini
// Vision multimodally so no PDF text-extraction step is required —
// the image IS the source.

export interface ExtractRubricFromImageInput {
    ownerId: string;
    paperId: string;
    /** MIME type of the image (e.g. `image/png`, `image/jpeg`, `image/webp`). */
    mimeType: string;
    /** Base64-encoded image bytes, no `data:...;base64,` prefix. */
    imageBase64: string;
    /** Override for the extraction language. Defaults to paper.displayLanguage. */
    language?: 'es' | 'en';
}

export type ExtractRubricFromImageOutput = ExtractRubricFromTextOutput;

// ── ExtractRubricPreviewFromImage ──────────────────────────────────────
//
// Same Gemini Vision call as `ExtractRubricFromImage` but the result
// is RETURNED to the caller without persisting on `paper.rubric`.
// Used by the qualitative-criteria editor to let the student pull
// criteria from a fresh image WITHOUT replacing the prescriptive
// section of the rubric they already configured. The client cherry-
// picks `qualityCriteria` from the response, merges into local state,
// and persists via `UpdateRubric` on the editor's Save action.

export interface ExtractRubricPreviewFromImageInput {
    ownerId: string;
    paperId: string;
    /** MIME type of the image (e.g. `image/png`, `image/jpeg`, `image/webp`). */
    mimeType: string;
    /** Base64-encoded image bytes, no `data:...;base64,` prefix. */
    imageBase64: string;
    /** Override for the extraction language. Defaults to paper.displayLanguage. */
    language?: 'es' | 'en';
}

export interface ExtractRubricPreviewFromImageOutput {
    /** Full extracted rubric — caller decides which fields to consume. */
    rubric: import('../entities/PaperRubric').PaperRubric;
    /** Extractor confidence. */
    confidence: 'high' | 'medium' | 'low';
    /** Notes from the extractor about ambiguities. Localized to `language`. */
    reviewNotes: ReadonlyArray<string>;
}

// ── AddProjectSource ────────────────────────────────────────────────────

export interface AddProjectSourceInput {
    /**
     * The corpus already produced by ingestion. The UI uploads + waits for
     * processing first; this use case only attaches the result to the paper.
     */
    corpusId: string;
    sourceType: SourceType;
    /**
     * Rol dialéctico elegido por el pastor. Lo manda el botón desde el
     * que abrió el diálogo («Elegir el ancla» → `'anchor'`). Omitirlo
     * deja que el rol se deduzca del tipo, como antes.
     */
    chosenRole?: SourceRole | null;
    displayLabel: string;
    citationKey?: string;
    /**
     * Optional. Defaults to `'full-document'` to keep the direct-upload
     * flow (Caso 3) working without changes. Pass `'extracted-excerpts'`
     * with a populated `excerpts` array when creating a source via the
     * v1.5 library-extraction flow.
     */
    mode?: ProjectSourceMode;
    /**
     * Optional. Required (and non-empty in practice, but allowed empty as
     * a transient state) when `mode === 'extracted-excerpts'`. Ignored
     * when `mode === 'full-document'`.
     */
    excerpts?: ReadonlyArray<ProjectSourceExcerpt>;
    /**
     * Optional. Backref to the originating `library_resources/{id}`. Set
     * when the source comes from the library-extraction flow; null
     * otherwise.
     */
    sourceLibraryResourceId?: string | null;
}

// ── UpdateProjectSource ─────────────────────────────────────────────────

export interface UpdateProjectSourceInput {
    sourceId: string;
    sourceType?: SourceType;
    /**
     * Mover la fuente de rol. `null` borra la elección y devuelve la
     * fuente a lo que sugiera su tipo.
     */
    chosenRole?: SourceRole | null;
    displayLabel?: string;
    citationKey?: string | null;
    order?: number;
    /**
     * Replace the whole excerpts list — used by the review UI to commit
     * edits/deletes/additions at once. Pass undefined to leave the list
     * untouched. Only meaningful when the source is in
     * `'extracted-excerpts'` mode; ignored otherwise.
     */
    excerpts?: ReadonlyArray<ProjectSourceExcerpt>;
}

// ── FinalizeConfiguration ───────────────────────────────────────────────
//
// Transitions the paper from 'configuring' to 'in-progress'. Triggers
// `seedStepsForPassage` so the wizard can navigate the user to step #1.
// The use case rejects if: no style guide, no citable sources, or the
// passage is invalid. Idempotent (re-calling on an in-progress paper
// returns the existing step list).

export interface FinalizeConfigurationInput {
    ownerId: string;
    paperId: string;
}

// ── GenerateStep ────────────────────────────────────────────────────────
//
// Triggers an LLM generation for a specific step. The orchestration layer
// (gemini service) handles streaming. The use case spec only commits to
// the input shape — the streaming chunk callback lives in the orchestrator
// interface, NOT here, to keep this file pure-data.

export interface GenerateStepInput {
    ownerId: string;
    paperId: string;
    stepId: string;
    /**
     * Optional regeneration hint. Passed verbatim into the prompt and stored
     * on the resulting version so the UI can show "you asked for X".
     */
    regenerationHint?: string;
}

// ── AcceptStep ──────────────────────────────────────────────────────────

export interface AcceptStepInput {
    ownerId: string;
    paperId: string;
    stepId: string;
    /**
     * Which version of the step the user is accepting. Usually the
     * `current` version of the step, but specifying it explicitly lets us
     * tolerate races (a regeneration finishing right before the user
     * clicks accept on the previous version).
     */
    versionId: string;
}

// ── SaveManualEdit ──────────────────────────────────────────────────────

export interface SaveManualEditInput {
    ownerId: string;
    paperId: string;
    stepId: string;
    markdown: string;
}

// ── AssemblePaper ───────────────────────────────────────────────────────
//
// Concatenates accepted step content into `assembledMarkdown`. Order in
// the output is: introduction → verses (in canonical order) → conclusion
// → bibliography. Note: introduction is the LAST step generated but the
// FIRST in the output — TMS convention.

export interface AssemblePaperInput {
    ownerId: string;
    paperId: string;
}

// ── UploadStyleGuide ────────────────────────────────────────────────────
//
// Wraps the existing ingestion pipeline + creates the `UserStyleGuide`
// pointer. The actual file processing happens in infrastructure; this DTO
// only describes what the user supplied.

export interface UploadStyleGuideInput {
    ownerId: string;
    displayName: string;
    /**
     * The already-processed corpus id. The UI shows progress on the upload
     * step and only calls this once ingestion completes.
     */
    corpusId: string;
    version?: string;
    /**
     * Whether to mark this as the new active guide. Defaults to true if
     * the user has no active guide; otherwise the user explicitly opts in
     * (an inactive guide can still be pinned to specific papers later).
     */
    setActive?: boolean;
}
