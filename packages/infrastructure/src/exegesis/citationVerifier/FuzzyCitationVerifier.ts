import type {
    CitationStatus,
    CitationVerifierInput,
    CitationVerifierOutput,
    ICitationVerifier,
    ParsedCitation,
    VerifiedCitation,
    VerifierSource,
    VerifierSourceChunk,
} from '@dosfilos/domain';
import {
    CITATION_FUZZY_LOW_THRESHOLD,
    CITATION_VERIFY_THRESHOLD,
    pagesOverlap,
} from '@dosfilos/domain';
import { parseCitations } from './citationParser';
import {
    bestSlidingJaccard,
    normalizeText,
    tokenize,
} from './textSimilarity';

/**
 * Token-overlap citation verifier. Three-stage pipeline per citation:
 *
 *   1. **Source match** — find the `VerifierSource` that the cite is
 *      pointing at, using citation-key, surname, then title-fragment
 *      heuristics (mirrors `DeterministicStyleFormatter.SourceLookup`).
 *   2. **Text match** — sliding-window Jaccard between the citation's
 *      `evidence` (preceding quote or containing sentence) and the
 *      source's chunks. Best score across all chunks wins.
 *   3. **Page check** — when the matched chunk has a `pageHint`
 *      (extracted-excerpts mode) and the citation provides pages,
 *      compare numerically. Mismatch downgrades from `verified` to
 *      `page-mismatch`. For full-document mode the page check is
 *      skipped (no per-chunk page anchoring).
 *
 * Verdicts are conservative — when in doubt, the verifier marks
 * `fuzzy-low` rather than `verified`. The user is the final arbiter:
 * the dialog surfaces the mismatch, they decide whether to edit.
 */
export class FuzzyCitationVerifier implements ICitationVerifier {
    async verify(input: CitationVerifierInput): Promise<CitationVerifierOutput> {
        const lookup = new SourceMatcher(input.sources);
        const sourceTokensCache = new Map<string, string[]>();

        const source = input.citations ? [...input.citations] : parseCitations(input.markdown);
        const citations: VerifiedCitation[] = source.map(parsed => {
            return this.verifyOne(parsed, lookup, sourceTokensCache);
        });

        return { citations };
    }

    private verifyOne(
        parsed: ParsedCitation,
        lookup: SourceMatcher,
        sourceTokensCache: Map<string, string[]>,
    ): VerifiedCitation {
        const matched = lookup.match(parsed.author, parsed.title);
        if (!matched) {
            return {
                ...parsed,
                status: 'not-found',
                matchedCorpusId: null,
                matchedSourceLabel: null,
                similarityScore: null,
                matchedPage: null,
                note: 'No source matched the author/title in this citation.',
            };
        }

        if (!parsed.evidence) {
            // Citation present but no surrounding text to verify
            // against. Should be rare — a footnote on its own line
            // could trip this. Leave for manual review rather than
            // silently passing.
            return {
                ...parsed,
                status: 'manual-pending',
                matchedCorpusId: matched.corpusId,
                matchedSourceLabel: matched.displayLabel,
                similarityScore: null,
                matchedPage: null,
                note: 'No surrounding claim text could be extracted; please review manually.',
            };
        }

        const needleTokens = tokenize(parsed.evidence);
        if (needleTokens.length === 0) {
            return {
                ...parsed,
                status: 'manual-pending',
                matchedCorpusId: matched.corpusId,
                matchedSourceLabel: matched.displayLabel,
                similarityScore: null,
                matchedPage: null,
                note: 'Claim text reduced to no content tokens after normalization.',
            };
        }

        let bestScore = 0;
        let bestChunk: VerifierSourceChunk | null = null;
        for (const chunk of matched.chunks) {
            const cacheKey = `${matched.corpusId}::${chunk.pageHint ?? '__'}::${chunk.text.length}`;
            let chunkTokens = sourceTokensCache.get(cacheKey);
            if (!chunkTokens) {
                chunkTokens = tokenize(chunk.text);
                sourceTokensCache.set(cacheKey, chunkTokens);
            }
            const score = bestSlidingJaccard(needleTokens, chunkTokens);
            if (score > bestScore) {
                bestScore = score;
                bestChunk = chunk;
            }
        }

        const status = decideStatus(bestScore);
        const matchedPage = bestChunk ? extractPageFromHint(bestChunk.pageHint) : null;

        // Page-mismatch override: only meaningful when we DID find the
        // text (verified) AND both sides have a parseable page number.
        // Anything else (no page on either side, fuzzy-low, not-found)
        // skips the page check.
        let finalStatus: CitationStatus = status;
        let note: string | null = buildBaseNote(status, parsed.evidenceIsQuoted);
        if (status === 'verified' && parsed.pages && matchedPage) {
            if (!pagesOverlap(parsed.pages, matchedPage)) {
                finalStatus = 'page-mismatch';
                note = `Cited p. ${parsed.pages} but the matching excerpt is at ${matchedPage}.`;
            }
        }

        return {
            ...parsed,
            status: finalStatus,
            matchedCorpusId: matched.corpusId,
            matchedSourceLabel: matched.displayLabel,
            similarityScore: bestScore,
            matchedPage,
            note,
        };
    }
}

function decideStatus(score: number): CitationStatus {
    if (score >= CITATION_VERIFY_THRESHOLD) return 'verified';
    if (score >= CITATION_FUZZY_LOW_THRESHOLD) return 'fuzzy-low';
    return 'not-found';
}

function buildBaseNote(status: CitationStatus, fromQuote: boolean): string | null {
    if (status === 'verified') {
        return fromQuote
            ? 'Quoted phrase matches the source excerpt.'
            : 'Surrounding sentence overlaps strongly with the source.';
    }
    if (status === 'fuzzy-low') {
        return fromQuote
            ? 'Quoted phrase only partially matches the source — verify wording.'
            : 'Sentence has weak overlap with the source — citation may be a paraphrase or off-target.';
    }
    if (status === 'not-found') {
        return fromQuote
            ? 'Quoted phrase was not found in the source content.'
            : 'No supporting text found in the source for this claim.';
    }
    return null;
}

/**
 * Parses a `pageHint` like `"p. 47"`, `"pp. 47-50"`, or `"comm. on
 * v.1"` into the leading numeric range. Returns null when the hint
 * doesn't carry a parseable page number — the verifier then skips the
 * page check rather than guessing.
 */
function extractPageFromHint(hint: string | null): string | null {
    if (!hint) return null;
    const match = hint.match(/(\d+(?:\s*[–\-—]\s*\d+)?)/);
    return match ? match[1]!.replace(/\s+/g, '') : null;
}

/**
 * Loose page-range overlap: cited "47" matches matched "47", "47-50",
 * "45-50". Cited "48-49" matches matched "47-50". Used for the
 * `page-mismatch` decision so a chunk that spans the cited page
 * doesn't trigger a false alarm.
 */


// ── Source matching ─────────────────────────────────────────────────

/**
 * Multi-key index over `VerifierSource[]`. Same fallback ladder as
 * `DeterministicStyleFormatter.SourceLookup`, deliberately reproduced
 * here rather than imported because the formatter's class is private
 * to that module and reaching across would couple the two surfaces.
 */
class SourceMatcher {
    private byKey = new Map<string, VerifierSource>();
    private bySurname = new Map<string, VerifierSource>();
    private all: VerifierSource[];

    constructor(sources: ReadonlyArray<VerifierSource>) {
        this.all = [...sources];
        for (const s of sources) {
            if (s.citationKey) this.byKey.set(normalizeText(s.citationKey), s);
            const surname = extractSurname(s.fullAuthor) ?? extractSurname(s.citationKey);
            if (surname) this.bySurname.set(normalizeText(surname), s);
        }
    }

    match(authorToken: string, titleToken: string): VerifierSource | null {
        const authorNorm = normalizeText(authorToken);
        const direct = this.byKey.get(authorNorm) ?? this.bySurname.get(authorNorm);
        if (direct) return direct;

        const firstWord = normalizeText(authorToken.split(/\s+/)[0] ?? '');
        if (firstWord) {
            const byFirstWord = this.byKey.get(firstWord) ?? this.bySurname.get(firstWord);
            if (byFirstWord) return byFirstWord;
        }

        const titleNorm = normalizeText(titleToken);
        if (titleNorm.length >= 4) {
            for (const candidate of this.all) {
                const labelNorm = normalizeText(candidate.displayLabel);
                if (!labelNorm) continue;
                if (labelNorm === titleNorm
                    || labelNorm.includes(titleNorm)
                    || titleNorm.includes(labelNorm)) {
                    return candidate;
                }
            }
        }
        return null;
    }
}

function extractSurname(fullAuthor: string | null | undefined): string | null {
    if (!fullAuthor) return null;
    const trimmed = fullAuthor.trim();
    if (!trimmed) return null;
    if (trimmed.includes(',')) return trimmed.split(',')[0]!.trim();
    const parts = trimmed.split(/\s+/);
    return parts[parts.length - 1] ?? null;
}
