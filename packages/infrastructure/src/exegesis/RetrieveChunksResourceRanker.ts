import { getFunctions, httpsCallable } from 'firebase/functions';
import {
    briefForQuery,
    formatPassageReference,
    type IResourceRanker,
    type RankResourcesInput,
    type RankResourcesResult,
    type RankedResource,
} from '@dosfilos/domain';

/**
 * Single chunk shape returned by `retrieveChunks`. Mirror of
 * `RetrievedChunkPayload` in the functions package — kept local so
 * infrastructure doesn't depend on functions package types.
 */
interface RetrievedChunkPayload {
    id: string;
    resourceId: string;
    score: number;
}

/**
 * `IResourceRanker` implementation backed by the existing `retrieveChunks`
 * cloud function with `userId` scope (Firestore findNearest under the
 * hood). Powers the v1.7 paper-corpus smart-match dialog.
 *
 * Workflow:
 *   1. Build the same passage-first query the excerpt extractor uses
 *      (consistent ranking → consistent excerpts later).
 *   2. Call `retrieveChunks` with the user's whole library scope
 *      (`userId` only, no `resourceIds` filter), `topK` defaults to 200.
 *   3. Drop chunks below `minSimilarity` (default 0.55).
 *   4. Group by `resourceId`, compute per-resource score = `count × max`.
 *   5. Sort descending by score; return the `RankedResource[]`.
 *
 * Notes:
 *   - We DON'T probe `IResourceIndexProbe` here (unlike the extractor):
 *     the ranker should silently include only what's indexed, since
 *     non-indexed resources contribute zero chunks anyway and surfacing
 *     "X is not ready" mid-ranking would derail the UX. The dialog
 *     already badges readiness on its rows.
 *   - The cloud function caps total chunks at the requested topK via
 *     a global findNearest (NOT per-resource topK); a single dominant
 *     book CAN eat half the budget. The composite score formula
 *     (count × max) corrects for this — broad+strong beats
 *     long+lucky-singletons in the final rank.
 */
export class RetrieveChunksResourceRanker implements IResourceRanker {
    async rank(input: RankResourcesInput): Promise<RankResourcesResult> {
        const language = input.language ?? 'es';
        const topKChunks = input.topKChunks ?? 200;
        const minSimilarity = input.minSimilarity ?? 0.55;

        const queryUsed = buildRankingQuery(
            formatPassageReference(input.passage, language),
            input.assignmentBrief,
        );
        if (!queryUsed.trim()) {
            return { ranked: [], queryUsed: '' };
        }

        // Cloud function call. The same callable used by the excerpt
        // extractor; no new infra needed for v1.7.
        const functions = getFunctions();
        const retrieveFn = httpsCallable<unknown, { chunks: RetrievedChunkPayload[] }>(
            functions,
            'retrieveChunks',
            { timeout: 30_000 },
        );

        let chunks: RetrievedChunkPayload[] = [];
        try {
            const response = await retrieveFn({
                query: queryUsed,
                userId: input.userId,
                topK: topKChunks,
                minSimilarity,
            });
            chunks = response.data?.chunks ?? [];
        } catch (err) {
            // Don't crash the dialog on a ranking failure — return
            // empty so the caller falls back to the unranked list.
            console.warn('[ResourceRanker] retrieveChunks failed; returning empty ranking', err);
            return { ranked: [], queryUsed };
        }

        const grouped = groupByResource(chunks);
        const ranked = Array.from(grouped.values())
            .map(toRankedResource)
            .sort((a, b) => b.score - a.score);

        return { ranked, queryUsed };
    }
}

interface ChunkBucket {
    resourceId: string;
    matchedChunkCount: number;
    maxScore: number;
}

function groupByResource(chunks: RetrievedChunkPayload[]): Map<string, ChunkBucket> {
    const out = new Map<string, ChunkBucket>();
    for (const chunk of chunks) {
        if (!chunk.resourceId) continue;
        const existing = out.get(chunk.resourceId);
        if (existing) {
            existing.matchedChunkCount += 1;
            if (chunk.score > existing.maxScore) existing.maxScore = chunk.score;
        } else {
            out.set(chunk.resourceId, {
                resourceId: chunk.resourceId,
                matchedChunkCount: 1,
                maxScore: chunk.score,
            });
        }
    }
    return out;
}

function toRankedResource(bucket: ChunkBucket): RankedResource {
    return {
        resourceId: bucket.resourceId,
        matchedChunkCount: bucket.matchedChunkCount,
        maxScore: bucket.maxScore,
        score: bucket.matchedChunkCount * bucket.maxScore,
    };
}

/**
 * Mirrors the extractor's query format so the ranking and the
 * subsequent extraction agree on what "relevant to this paper" means.
 * Passage label dominates (commentary chunks anchor on `[1:1]`-style
 * tokens); brief biases the angle and is truncated to keep embedding
 * quality high.
 */
function buildRankingQuery(passageLabel: string, assignmentBrief: string | null): string {
    // El comentario de arriba prometía reflejar el formato del extractor y no
    // era verdad: acá se recortaba a 800 caracteres y el extractor a 500, así
    // que en 4 de los 13 trabajos con encuadre los dos rankeaban y extraían
    // contra textos distintos. Ahora comparten `BRIEF_QUERY_CHARS`.
    const briefSlice = briefForQuery(assignmentBrief);
    if (briefSlice.length === 0) return passageLabel;
    return `${passageLabel} — ${briefSlice}`;
}
