import {
    computeExtractionFingerprint,
    formatPassageReference,
    type ExegeticalPaper,
    type IExcerptExtractor,
    type IExegeticalPaperRepository,
    type ProjectSource,
    type ProjectSourceExcerpt,
    type SourceRole,
    type SourceType,
} from '@dosfilos/domain';

/**
 * Caps the per-resource excerpt count even when the caller passes a
 * larger value. 30 was chosen in the v1.5 spec — beyond that becomes
 * noise both for Gemini Pro 2.5 and for the alumno reviewing the
 * results. Caller can pass anything; we floor at 1 and ceil at 30.
 */
const MIN_EXCERPTS_PER_RESOURCE = 1;
const MAX_EXCERPTS_PER_RESOURCE = 30;
const DEFAULT_EXCERPTS_PER_RESOURCE = 30;

/**
 * Per-resource selection from the UI. The user picked which library
 * resources to extract from AND assigned an exegesis-relevant
 * `sourceType` (ej. `'commentary-critical'`, `'lexicon-technical'`).
 * The `displayLabel` is what shows in the source list — usually the
 * resource title, but the UI may let the user override.
 */
export interface ExtractExcerptsSelection {
    libraryResourceId: string;
    sourceType: SourceType;
    displayLabel: string;
    citationKey?: string;
    /**
     * El rol dialéctico que eligió el autor al agregarla. Ausente: lo deduce
     * el tipo, como antes. El diálogo de extracción no dejaba elegirlo y el
     * rol sólo se veía como «· Técnica» después de agregar.
     */
    chosenRole?: SourceRole | null;
}

export interface ExtractExcerptsForPaperInput {
    ownerId: string;
    paperId: string;
    selections: ReadonlyArray<ExtractExcerptsSelection>;
    /**
     * Optional cap on excerpts per resource. Clamped to [1, 30].
     * Default 30 (the v1.5 spec ceiling).
     */
    maxExcerptsPerResource?: number;
    /**
     * When true (default) and a re-extraction overlaps an existing
     * source for the same library resource, excerpts the user touched
     * (`userEdited === true`) are preserved at the top and the fresh
     * fragments are appended after them. When false, the source's
     * excerpt list is replaced wholesale — used by callers that want
     * to discard manual edits explicitly.
     */
    preserveUserEdited?: boolean;
}

export interface ExtractExcerptsForPaperOutput {
    /** The updated paper. The UI uses this to refresh React Query cache. */
    paper: ExegeticalPaper;
    /**
     * The ProjectSource ids that were created or replaced by this run,
     * grouped by which library resource they came from. Lets the UI
     * scroll the user to the freshly-extracted sources for review.
     */
    sourceIdsByLibraryResource: Record<string, string>;
    /** The semantic query the extractor used. Useful for debugging + UI breadcrumb. */
    queryUsed: string;
}

/**
 * Pre-curated excerpt extraction — heart of the v1.5 "use my library"
 * flow.
 *
 * Given a paper + a set of library resources the user picked, query
 * the chunks store for the most relevant pieces (ranked by cosine
 * similarity to the paper's passage + brief), then attach them to
 * the paper as `ProjectSource`s with `mode: 'extracted-excerpts'`.
 *
 * Idempotency:
 *   Re-running with the same `libraryResourceId` REPLACES the
 *   existing `ProjectSource` for that resource (matched by
 *   `sourceLibraryResourceId === libraryResourceId`). This is the
 *   "I edited my brief and want fresh excerpts" workflow. Sources
 *   not in the current selection are NOT touched (other excerpted
 *   sources stay as-is, full-document sources stay as-is).
 *
 *   Note: re-extraction here REPLACES — it does NOT merge with
 *   user-edited excerpts. The roadmap memory says "preserve
 *   userEdited excerpts and append fresh ones at the end". That
 *   merge logic lives in the UI/use case once the review surface
 *   exists (commit 5). For commit 3 we ship the simple replace
 *   semantics; the UI guards re-extraction behind a confirm dialog
 *   when any existing excerpts have `userEdited: true`.
 *
 * Errors:
 *   - `Error('Paper not found')` when the paper id doesn't exist /
 *     isn't owned by the caller.
 *   - `ResourcesNotIndexedError` (re-thrown from the extractor) when
 *     any selection points at a not-yet-indexed resource.
 *   - Any error raised by the extractor or the repository propagates
 *     as-is — the use case does NOT swallow them.
 */
export class ExtractExcerptsForPaperUseCase {
    constructor(
        private paperRepository: IExegeticalPaperRepository,
        private excerptExtractor: IExcerptExtractor,
    ) { }

    async execute(input: ExtractExcerptsForPaperInput): Promise<ExtractExcerptsForPaperOutput> {
        if (!input.ownerId || !input.paperId) {
            throw new Error('ExtractExcerptsForPaperUseCase: ownerId and paperId required');
        }
        if (input.selections.length === 0) {
            throw new Error('ExtractExcerptsForPaperUseCase: at least one selection required');
        }

        const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        if (!paper) throw new Error(`Paper ${input.paperId} not found`);

        const cap = clampExcerptsPerResource(input.maxExcerptsPerResource);

        // Run extraction. The extractor itself raises
        // ResourcesNotIndexedError if any resource isn't ready.
        const extraction = await this.excerptExtractor.extract({
            userId: input.ownerId,
            passage: paper.passage,
            assignmentBrief: paper.assignmentBrief,
            libraryResourceIds: input.selections.map(s => s.libraryResourceId),
            maxExcerptsPerResource: cap,
            language: paper.displayLanguage,
        });

        // Idempotency: for each selection, find any existing source
        // pointing at the same library resource and replace it. The
        // identity is `sourceLibraryResourceId === libraryResourceId`
        // — we don't match by displayLabel or citationKey because
        // those are user-editable.
        const sourceIdsByLibraryResource: Record<string, string> = {};
        const existingByLibraryResource = new Map<string, ProjectSource>();
        for (const source of paper.sources) {
            if (source.sourceLibraryResourceId) {
                existingByLibraryResource.set(source.sourceLibraryResourceId, source);
            }
        }

        // Stale tracking: every source extracted in this run carries
        // the same fingerprint of (passage + brief). The UI uses it to
        // detect when the user later edits the brief or passage and
        // surfaces a "re-extract" banner per source.
        const passageRef = formatPassageReference(paper.passage, paper.displayLanguage);
        const fingerprint = computeExtractionFingerprint(passageRef, paper.assignmentBrief);
        const extractedAt = new Date();

        const preserveUserEdited = input.preserveUserEdited ?? true;

        for (const selection of input.selections) {
            const fresh = extraction.excerptsByResource[selection.libraryResourceId] ?? [];
            const existing = existingByLibraryResource.get(selection.libraryResourceId);
            // Cómo se eligieron ESTOS fragmentos. Se persiste por fuente
            // porque una misma extracción mezcla los dos caminos según la
            // calidad de extracción de cada documento.
            const selectionMode = extraction.modeByResource?.[selection.libraryResourceId] ?? null;

            if (existing) {
                // Merge or replace based on the caller's intent. With
                // `preserveUserEdited` (default), we keep every excerpt
                // the user has edited at the top and append fresh ones
                // after. Same-text duplicates between user-edited and
                // fresh would be cosmetically annoying; we drop fresh
                // entries that exactly match an existing user-edited
                // text so the user never sees their edit alongside the
                // pre-edit version.
                const excerpts = preserveUserEdited
                    ? mergePreservingUserEdited(existing.excerpts, fresh)
                    : fresh;

                // REPLACE in place — preserves order and id, swaps
                // sourceType/label/excerpts. citationKey only updated
                // when the caller supplied one (allows the UI to keep
                // a manual key the user typed before).
                await this.paperRepository.updateSource(
                    input.ownerId,
                    input.paperId,
                    existing.id,
                    {
                        sourceType: selection.sourceType,
                        displayLabel: selection.displayLabel,
                        ...(selection.citationKey !== undefined ? { citationKey: selection.citationKey } : {}),
                        ...(selection.chosenRole !== undefined ? { chosenRole: selection.chosenRole } : {}),
                        excerpts,
                        excerptSelectionMode: selectionMode,
                        extractedAt,
                        extractionFingerprint: fingerprint,
                    },
                );
                sourceIdsByLibraryResource[selection.libraryResourceId] = existing.id;
            } else {
                // CREATE new. The repo's addSource auto-assigns id +
                // order; we only contribute the content fields.
                const created = await this.paperRepository.addSource(
                    input.ownerId,
                    input.paperId,
                    {
                        corpusId: selection.libraryResourceId,
                        sourceType: selection.sourceType,
                        displayLabel: selection.displayLabel,
                        citationKey: selection.citationKey ?? null,
                        ...(selection.chosenRole ? { chosenRole: selection.chosenRole } : {}),
                        order: paper.sources.length + Object.keys(sourceIdsByLibraryResource).length,
                        mode: 'extracted-excerpts',
                        excerpts: fresh,
                        excerptSelectionMode: selectionMode,
                        // Esta ruta no pasa por el selector de páginas: no hay
                        // receta que guardar.
                        excerptRecipe: null,
                        sourceLibraryResourceId: selection.libraryResourceId,
                        extractedAt,
                        extractionFingerprint: fingerprint,
                    },
                );
                sourceIdsByLibraryResource[selection.libraryResourceId] = created.id;
            }
        }

        // Re-fetch the paper so the caller gets the merged state with
        // all the new/updated sources visible. Cheaper than building
        // it locally and risking drift from the repo's serialization.
        const fresh = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        if (!fresh) throw new Error(`Paper ${input.paperId} not found after extraction`);

        return {
            paper: fresh,
            sourceIdsByLibraryResource,
            queryUsed: extraction.queryUsed,
        };
    }
}

function clampExcerptsPerResource(value?: number): number {
    if (value === undefined) return DEFAULT_EXCERPTS_PER_RESOURCE;
    if (!Number.isFinite(value)) return DEFAULT_EXCERPTS_PER_RESOURCE;
    return Math.max(MIN_EXCERPTS_PER_RESOURCE, Math.min(MAX_EXCERPTS_PER_RESOURCE, Math.floor(value)));
}

/**
 * Returns `[...userEditedExisting, ...freshExceptDuplicates]`. Fresh
 * entries whose text exactly matches a user-edited entry are dropped
 * — the user already curated that fragment and we don't want a
 * duplicate row appearing alongside their edit.
 *
 * Order matters for the UI: user-edited entries lead so the user sees
 * their work first; fresh entries follow with the highest-ranked at
 * the top of the fresh group (the extractor already returns them in
 * relevance-desc order).
 */
function mergePreservingUserEdited(
    existing: ReadonlyArray<ProjectSourceExcerpt>,
    fresh: ReadonlyArray<ProjectSourceExcerpt>,
): ReadonlyArray<ProjectSourceExcerpt> {
    const userEdited = existing.filter(e => e.userEdited);
    if (userEdited.length === 0) return fresh;
    const editedTexts = new Set(userEdited.map(e => e.text));
    const dedupedFresh = fresh.filter(f => !editedTexts.has(f.text));
    return [...userEdited, ...dedupedFresh];
}

// Re-export for callers that want to construct excerpt entries by
// hand (rare; mostly the UI will pass through what the use case
// returns). Avoids forcing them to import from the domain.
export type { ProjectSourceExcerpt };
