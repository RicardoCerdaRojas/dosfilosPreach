import { getFunctions, httpsCallable } from 'firebase/functions';
import {
    ResourcesNotIndexedError,
    formatPassageReference,
    type ExtractExcerptsInput,
    type ExtractExcerptsResult,
    type IExcerptExtractor,
    type IResourceIndexProbe,
    type ProjectSourceExcerpt,
} from '@dosfilos/domain';

/**
 * Single chunk shape returned by the `retrieveChunks` cloud function.
 * Mirror of `RetrievedChunkPayload` in
 * `packages/functions/src/library/retrieveChunks.ts` — kept local so
 * the infrastructure package doesn't depend on functions package types.
 */
interface RetrievedChunkPayload {
    id: string;
    resourceId: string;
    resourceTitle: string;
    resourceAuthor: string;
    chunkIndex: number;
    text: string;
    metadata: {
        page?: number;
        section?: string;
        sectionPath?: string[];
        chunkType?: string;
    };
    score: number;
    sectionBreadcrumb: string;
    publiclyCitable?: boolean;
}

/**
 * `IExcerptExtractor` implementation that delegates to the existing
 * `retrieveChunks` cloud function (Faculty + CoreLibraryRAGService
 * also use it). The implementation is intentionally thin — it only:
 *
 *   1. Validates that every requested resource is `indexed` (raises
 *      `ResourcesNotIndexedError` otherwise so the UI can surface a
 *      precise prepare-these-first message).
 *   2. Builds a single embedding query from the passage reference +
 *      the assignment brief slice (no LLM-based query expansion in
 *      v1.5; deferred to v1.6 per the roadmap memory).
 *   3. Calls `retrieveChunks` with `perResourceTopK` so each
 *      resource contributes its own top-K — guarantees no source
 *      gets starved by a more dominant one.
 *   4. Maps each chunk to a `ProjectSourceExcerpt`, deriving
 *      `sourceLocation` from the chunk's page/section metadata so
 *      the orchestrator can later cite using a stable anchor.
 *
 * Constructor receives an `IResourceIndexProbe` adapter (typically
 * provided by the composition root and backed by
 * `LibraryService.getResourceIndexStatus()`). Decoupling the probe
 * from the library repo keeps the extractor unaware of how the
 * readiness state is stored or computed — it just asks "is this
 * resource ready?" per id.
 */
export class RetrieveChunksExcerptExtractor implements IExcerptExtractor {
    constructor(private indexProbe: IResourceIndexProbe) { }

    async extract(input: ExtractExcerptsInput): Promise<ExtractExcerptsResult> {
        if (input.libraryResourceIds.length === 0) {
            return { excerptsByResource: {}, queryUsed: '' };
        }

        // 1. Verify indexing readiness in parallel. Cheap (one
        //    Firestore read per id; selections expected in the 1-10
        //    range). Failing fast here lets the UI render a precise
        //    "prepare these first" panel instead of returning empty
        //    excerpts and confusing the user.
        const readinessFlags = await Promise.all(
            input.libraryResourceIds.map(id => this.indexProbe.isReady(id)),
        );
        const notIndexedIds = input.libraryResourceIds.filter((_, idx) => !readinessFlags[idx]);
        if (notIndexedIds.length > 0) {
            throw new ResourcesNotIndexedError(notIndexedIds);
        }

        // 2. Build the query. Passage reference + brief slice. The
        //    embedding model is task=RETRIEVAL_QUERY on the server
        //    side, which expects a question-like string — we
        //    concatenate naturally instead of throwing magic tokens.
        const language = input.language ?? 'es';
        const queryUsed = buildExtractionQuery(
            formatPassageReference(input.passage, language),
            input.assignmentBrief,
        );

        // 3. Dispatch to the cloud function. `userId` lets it scope
        //    chunks to the user's personal library (admin-impersonation
        //    is rejected at the callable level). `resourceIds` +
        //    `perResourceTopK` together produce the per-source mode.
        const functions = getFunctions();
        const retrieveFn = httpsCallable<unknown, { chunks: RetrievedChunkPayload[] }>(
            functions,
            'retrieveChunks',
            { timeout: 30_000 },
        );
        const response = await retrieveFn({
            query: queryUsed,
            userId: input.userId,
            resourceIds: [...input.libraryResourceIds],
            perResourceTopK: input.maxExcerptsPerResource,
        });
        const chunks = response.data?.chunks ?? [];

        // 4. Group + map. Pre-seed the result so every requested
        //    resource appears as a key even when retrieval returned
        //    zero chunks for it (the UI surfaces "no relevant excerpts
        //    for this source — try another source or refine the brief").
        const excerptsByResource: Record<string, ProjectSourceExcerpt[]> = {};
        for (const id of input.libraryResourceIds) {
            excerptsByResource[id] = [];
        }
        for (const chunk of chunks) {
            const target = excerptsByResource[chunk.resourceId];
            if (!target) continue; // safety: shouldn't happen given resourceIds filter
            target.push(chunkToExcerpt(chunk));
        }

        return {
            excerptsByResource,
            queryUsed,
        };
    }
}

/**
 * Builds the embedding query. Format chosen to match what
 * `task=RETRIEVAL_QUERY` expects — natural prose, not keywords. The
 * passage reference goes first because it dominates relevance for
 * commentary chunks (which already contain `[1:1]`-style anchors in
 * their text). The brief, when present, biases retrieval toward the
 * angle the student wants — it's truncated because long briefs hurt
 * embedding quality (the model collapses to the dominant term).
 */
function buildExtractionQuery(passageLabel: string, assignmentBrief: string | null): string {
    const briefSlice = assignmentBrief?.trim().slice(0, 500) ?? '';
    if (briefSlice.length === 0) return passageLabel;
    return `${passageLabel} — ${briefSlice}`;
}

/**
 * Chunk → excerpt mapper. The chunk's `text` becomes the excerpt body
 * verbatim (the user can edit it later, which flips `userEdited`). The
 * `sourceLocation` derives from the structured metadata in this order
 * of preference:
 *   1. `[p. N, § Section]` when both page and section exist
 *   2. `p. N` when only page exists
 *   3. `§ Section` when only section exists (rare for PDFs but happens for EPUBs)
 *   4. The chunk's `sectionBreadcrumb` as a last resort
 *   5. Empty string when nothing is available — the orchestrator will
 *      cite by `displayLabel + citationKey` instead.
 */
function chunkToExcerpt(chunk: RetrievedChunkPayload): ProjectSourceExcerpt {
    const page = chunk.metadata?.page;
    const section = chunk.metadata?.section;
    let sourceLocation = '';
    if (page && section) sourceLocation = `p. ${page}, § ${section}`;
    else if (page) sourceLocation = `p. ${page}`;
    else if (section) sourceLocation = `§ ${section}`;
    else if (chunk.sectionBreadcrumb) sourceLocation = chunk.sectionBreadcrumb;

    return {
        text: chunk.text,
        sourceLocation,
        // Aparte del rótulo: quien cite necesita el número, no la cadena.
        ...(typeof page === 'number' ? { sheet: page } : {}),
        ...(section ? { section } : {}),
        // `score` from findNearest is already cosine similarity in
        // [0, 1] range. Clamp defensively in case future versions
        // return raw distances.
        relevanceScore: clamp01(chunk.score),
        userEdited: false,
        editedAt: null,
    };
}

function clamp01(n: number): number {
    if (Number.isNaN(n)) return 0;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
}
