import { getBookById, type BibleBookId } from '../../bible/canon/BibleCanon';
import type { SourceType } from '../entities/SourceType';
import { INVARIANT_RECOMMENDATIONS } from './invariant';
import { HEBREWS_RECOMMENDATIONS } from './nt/hebrews';
import { ROMANS_RECOMMENDATIONS } from './nt/romans';
import { GENESIS_RECOMMENDATIONS } from './ot/genesis';
import { GROUP_CATALOG } from './groups/catalog';
import { BOOK_TO_GROUPS } from './groups/types';
import type { BookRecommendations, SourceRecommendation } from './types';

export type { BookRecommendations, SourceRecommendation } from './types';
export type { BibleBookGroup } from './groups/types';
export {
    matchRecommendationToResource,
    findLibraryResourceForRecommendation,
    type LibraryResourceLike,
} from './libraryMatch';

/**
 * Master catalog indexed by `BibleBookId`. v1.7 launch covers three
 * hero books with full per-source-type curation:
 *   - Hebreos (NT epistolary/homily, frequent expository series)
 *   - Romanos (NT, most commented-on epistle in the canon)
 *   - Génesis (OT, most preached OT book — covers both testaments at launch)
 *
 * The remaining ~50 prioritized books from the spec are added
 * incrementally — telemetry from `recommendation_gap_no_suggestions`
 * tells us which to curate next (Salmos and Isaías are the natural
 * follow-ups for OT coverage).
 *
 * Books NOT in this map fall through to invariant-only recommendations
 * (lexicons, grammars, dictionaries) — still useful, just not as rich
 * as a curated hero book.
 */
const RECOMMENDATIONS_BY_BOOK: Partial<Record<BibleBookId, BookRecommendations>> = {
    HEB: HEBREWS_RECOMMENDATIONS,
    ROM: ROMANS_RECOMMENDATIONS,
    GEN: GENESIS_RECOMMENDATIONS,
};

/**
 * Returns recommendations for `(bookId × sourceType)`, sorted with the
 * most relevant entries first.
 *
 * Three merge layers (most-specific → most-general):
 *   1. **Book-specific** — hero-book curation (Cockerill for Hebreos).
 *   2. **Group-level** — works that span a corpus (Sanders PPJ for any
 *      Pauline epistle; Murphy on wisdom; Smith WBC on the Twelve).
 *      A book may belong to multiple groups (Daniel = major-prophets +
 *      apocalyptic) — entries from all matching groups are merged.
 *   3. **Invariant** — book-agnostic references (BDAG, Wallace, ABD).
 *
 * Within each layer, entries are sorted by language fit (the user's
 * language wins) then academic tier (essential > recommended > standard).
 * Stable sort preserves the curator-chosen order when entries tie.
 *
 * Cross-layer dedup: if the same recommendation (matched by author +
 * title hash) appears in multiple layers, the higher-priority layer
 * wins and lower-priority duplicates are dropped. This lets a Pauline
 * group entry coexist with a Romans-specific entry without the user
 * seeing the same book twice.
 *
 * Returns an empty array when no layer has anything — caller surfaces
 * a "no curation yet, give us feedback" empty state and emits a
 * telemetry event so we know what to curate next.
 */
export function getSourceRecommendations(
    bookId: BibleBookId,
    sourceType: SourceType,
    language: 'es' | 'en' = 'es',
): ReadonlyArray<SourceRecommendation> {
    const bookSpecific = RECOMMENDATIONS_BY_BOOK[bookId]?.bySourceType[sourceType] ?? [];
    const groups = BOOK_TO_GROUPS[bookId] ?? [];
    const groupEntries = groups
        .flatMap(g => GROUP_CATALOG[g]?.bySourceType[sourceType] ?? [])
        // Un comentario de otro libro del grupo no sirve para éste.
        .filter(rec => !rec.covers || rec.covers.includes(bookId));
    const invariantRaw = INVARIANT_RECOMMENDATIONS[sourceType] ?? [];

    // v1.7.1: filter invariants by the paper's testament so OT lexicons
    // don't surface for NT papers and vice-versa. Entries without a
    // `testament` flag (or `'whole-bible'`) pass through. Book-specific
    // and group entries are NOT filtered here — they're already inherently
    // testament-bound by the lookup key.
    const paperTestament = getBookById(bookId)?.testament ?? null;
    const invariant = paperTestament === null
        ? invariantRaw
        : invariantRaw.filter(rec => {
            if (!rec.testament) return true; // legacy / unmarked
            if (rec.testament === 'whole-bible') return true;
            return rec.testament === paperTestament;
        });

    if (bookSpecific.length === 0 && groupEntries.length === 0 && invariant.length === 0) {
        return [];
    }

    const tierOrder: Record<SourceRecommendation['tier'], number> = {
        essential: 0,
        recommended: 1,
        standard: 2,
    };
    const sorter = (a: SourceRecommendation, b: SourceRecommendation): number => {
        const aLang = a.languages.includes(language) ? 0 : 1;
        const bLang = b.languages.includes(language) ? 0 : 1;
        if (aLang !== bLang) return aLang - bLang;
        return tierOrder[a.tier] - tierOrder[b.tier];
    };

    // Concatenate book → group → invariant, then de-dupe in place
    // preserving the first occurrence (which is always from the
    // higher-priority layer because of order).
    const merged: SourceRecommendation[] = [
        ...[...bookSpecific].sort(sorter),
        ...dedupeWithin(groupEntries).sort(sorter),
        ...[...invariant].sort(sorter),
    ];
    return dedupeAcrossLayers(merged);
}

/**
 * True when the catalog has at least one curated entry (book-specific,
 * group-level, OR invariant) for the given combination. Cheap helper
 * for the UI to decide whether to render the toggle at all vs. show
 * "no curation".
 */
export function hasSourceRecommendations(bookId: BibleBookId, sourceType: SourceType): boolean {
    // Derivada de `getSourceRecommendations` y no de una copia de sus
    // filtros: dos copias ya se desincronizaron una vez (el filtro por
    // testamento) y el interruptor prometía sugerencias que no aparecían.
    return getSourceRecommendations(bookId, sourceType).length > 0;
}

/**
 * Within a single layer (e.g. multi-group accumulation), drop entries
 * that hash to the same id as one we already kept. Used to handle the
 * case where two groups a book belongs to both list the same work
 * (rare but possible — would otherwise show the recommendation twice).
 */
function dedupeWithin(entries: ReadonlyArray<SourceRecommendation>): SourceRecommendation[] {
    const seen = new Set<string>();
    const out: SourceRecommendation[] = [];
    for (const e of entries) {
        const id = getRecommendationId(e);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(e);
    }
    return out;
}

/**
 * Drop entries from lower-priority layers that already appeared in a
 * higher-priority one. Operates on the already-concatenated array; the
 * first occurrence (highest layer) wins.
 */
function dedupeAcrossLayers(entries: ReadonlyArray<SourceRecommendation>): SourceRecommendation[] {
    return dedupeWithin(entries);
}

/**
 * Stable id for a recommendation. Used for "ya la tengo" persistence
 * and telemetry. We hash author + title (case-insensitive, normalized)
 * so editing the rationale or fixing a typo doesn't lose the user's
 * "ya la tengo" flag. ISBN would be ideal but many entries don't have one.
 */
export function getRecommendationId(rec: SourceRecommendation): string {
    const author = rec.author.toLowerCase().replace(/[^a-z0-9]/g, '');
    const title = rec.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${author}__${title}`;
}
