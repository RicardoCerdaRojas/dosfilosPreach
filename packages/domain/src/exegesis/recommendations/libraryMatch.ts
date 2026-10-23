import type { SourceRecommendation } from './types';

/**
 * v1.7.1 — Heuristic matcher for "is this curated recommendation
 * already in the user's library?"
 *
 * Two consumers:
 *   - The recommendation card UI: shows a green "En tu biblioteca"
 *     badge + open-in-library action when the user already owns
 *     the work, replacing the "Ya la tengo" personal flag.
 *   - Future: the corpus picker can pre-select matched works.
 *
 * Match is deliberately CONSERVATIVE — false positives confuse the
 * user ("why is the system saying I have this?"), false negatives
 * just leave the "Ya la tengo" affordance visible (no harm). Three
 * priorities:
 *
 *   1. **ISBN exact** — when both have it (rare on user side, but
 *      gold standard).
 *   2. **Series acronym** — "BDAG", "HALOT", "WBC 47A". Distinctive
 *      enough that a substring match in the user's title is high
 *      signal.
 *   3. **Author + title token overlap** — last fallback, requires
 *      strong overlap (≥70%) of significant tokens.
 *
 * Implementations of `LibraryResourceLike` only need the fields the
 * matcher reads — keeps this helper independent of the domain
 * `LibraryResource` entity definition (which lives in a different
 * module and pulls in extraction status, etc. that we don't need).
 */
export interface LibraryResourceLike {
    id: string;
    title: string;
    author?: string | null;
}

/**
 * True when `resource` is a plausible match for `recommendation`.
 * See class comment for the matching strategy.
 */
export function matchRecommendationToResource(
    recommendation: SourceRecommendation,
    resource: LibraryResourceLike,
): boolean {
    // 1. ISBN exact match (gold standard). Library uploads rarely
    // include ISBN today, but check anyway — when present it's
    // unambiguous.
    if (recommendation.isbn) {
        // Resources don't carry ISBN as a top-level field today.
        // Reserved for future when the upload form parses it from
        // the metadata extraction. Skipped for now.
    }

    // 2. Series acronym — distinctive 3-5-letter abbreviations like
    // "BDAG", "HALOT", "WBC", "NICNT", "BHQ", "TDNT". Substring match
    // in a normalized version of the resource's title.
    if (recommendation.series) {
        const acronym = extractSeriesAcronym(recommendation.series);
        // Solo una sigla de verdad (WBC, NICNT, BHQ): la primera palabra de
        // «The Gospel according to…» o «Two Horizons…» ligaba la obra a
        // cualquier libro con «the» o «two» en el título (revisión de la 2c).
        const esSigla = /^[A-Z]{3,6}$/.test(acronym);
        if (acronym && (esSigla || acronym.length >= 4)) {
            const normalizedTitle = normalizeForMatch(resource.title);
            const normalizedAcronym = normalizeForMatch(acronym);
            // Use word boundary so "WBC" matches "WBC 47A" / "Hebrews WBC"
            // but doesn't match "AWBC" or random substrings.
            if (containsAsToken(normalizedTitle, normalizedAcronym)) {
                // La sigla es de la serie, no del volumen: el WBC de Lane no es
                // el de Williamson. Con autor en el recurso, tiene que coincidir.
                // Una palabra que no es sigla («Anchor», «Interpretation») solo
                // vale con el mismo apellido.
                const mismoAutor = !!resource.author && !!recommendation.author && sharesAuthorSurname(recommendation.author, resource.author);
                if (mismoAutor || (esSigla && (!resource.author || !recommendation.author))) return true;
            }
        }
    }

    // 3. Title token overlap. Cheap version: normalize both,
    // tokenize on whitespace, compare significant tokens (length ≥ 4
    // to skip stopwords like "the", "of", "and"). High threshold so
    // we don't false-positive on shared generic words.
    const recTokens = significantTokens(recommendation.title);
    const resTokens = significantTokens(resource.title);
    if (recTokens.length >= 2 && resTokens.length >= 2) {
        const overlap = countOverlap(recTokens, resTokens);
        const minSize = Math.min(recTokens.length, resTokens.length);
        const ratio = overlap / minSize;
        if (ratio >= 0.7) {
            // Bonus check: surname overlap as a sanity gate so we
            // don't merge "Hebrews" by Cockerill with "Hebrews" by
            // Lane just because the title is identical.
            if (resource.author && recommendation.author) {
                if (sharesAuthorSurname(recommendation.author, resource.author)) {
                    return true;
                }
                // Title fully overlapping but no shared surname →
                // probably different works. Skip.
                return false;
            }
            // Sin autor en el recurso, solo el título decide: 70 % de
            // palabras en común ligaba «The Significance of Parallels…
            // Early Christian Literature» (Gilmour) con «The Two Ways in
            // Early Christian Literature». Sin autor se exige casi todo.
            return ratio >= 0.9;
        }
    }

    return false;
}

/**
 * Returns the first library resource matching the recommendation, or
 * null. When multiple resources match (rare — e.g. user uploaded BDAG
 * twice), returns the first by `resources` array order.
 */
export function findLibraryResourceForRecommendation<R extends LibraryResourceLike>(
    recommendation: SourceRecommendation,
    resources: ReadonlyArray<R>,
): R | null {
    for (const resource of resources) {
        if (matchRecommendationToResource(recommendation, resource)) {
            return resource;
        }
    }
    return null;
}

// ── Internals ───────────────────────────────────────────────────────────

/**
 * Pull the leading acronym from a series string: "WBC 47A" → "WBC",
 * "NICNT" → "NICNT", "Anchor Yale Bible 36" → "Anchor".
 *
 * Stops at the first space or digit. Returns the empty string when no
 * meaningful acronym is found (caller should skip in that case).
 */
function extractSeriesAcronym(series: string): string {
    const trimmed = series.trim();
    if (trimmed.length === 0) return '';
    // Read up to the first space, digit, or non-alpha character.
    const match = /^[A-Za-zÁ-ú]+/.exec(trimmed);
    return match ? match[0] : '';
}

/**
 * Normalize a string for fuzzy matching: lowercase, strip diacritics,
 * collapse runs of whitespace, drop punctuation. The same normalization
 * is applied to both sides of a comparison.
 */
function normalizeForMatch(s: string): string {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // strip combining diacritics
        .replace(/[^a-z0-9 ]/g, ' ') // drop punctuation
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * True when `needle` appears in `haystack` as a whole word
 * (preceded and followed by either a word boundary or end of string).
 * Both inputs assumed already normalized.
 */
function containsAsToken(haystack: string, needle: string): boolean {
    if (needle.length === 0) return false;
    const padded = ` ${haystack} `;
    return padded.includes(` ${needle} `);
}

/**
 * Tokenize and keep tokens of length ≥ 4 — drops English/Spanish
 * stopwords ("the", "of", "and", "el", "la", "de") and short
 * articles. Returned tokens are normalized.
 */
function significantTokens(s: string): string[] {
    return normalizeForMatch(s)
        .split(' ')
        .filter(t => t.length >= 4);
}

function countOverlap(a: ReadonlyArray<string>, b: ReadonlyArray<string>): number {
    const setB = new Set(b);
    let count = 0;
    for (const tok of a) {
        if (setB.has(tok)) count++;
    }
    return count;
}

/**
 * True when `recAuthor` and `resAuthor` share at least one surname-
 * length token (≥ 4 chars). Naive but works for the common case where
 * the user uploads with "Cockerill" or "Gareth Cockerill" and the
 * recommendation has "Cockerill, Gareth Lee".
 */
function sharesAuthorSurname(recAuthor: string, resAuthor: string): boolean {
    const recSurnames = significantTokens(recAuthor);
    const resSurnames = significantTokens(resAuthor);
    if (recSurnames.length === 0 || resSurnames.length === 0) return false;
    const setRes = new Set(resSurnames);
    for (const surname of recSurnames) {
        if (setRes.has(surname)) return true;
    }
    return false;
}
