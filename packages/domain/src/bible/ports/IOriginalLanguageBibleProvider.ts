import type { GreekVerseTokens } from '../../greek-analyzer/morphGntToken';
import type { BibleBookId } from '../canon/BibleCanon';

/**
 * Port for biblical original-language text sources (Greek NT
 * via SBLGNT/MorphGNT, Hebrew OT via WLC/morphhb). Distinct from
 * `IBibleVersionRepository` because:
 *
 *   1. Original-language text is async (typically fetched from CDN
 *      and cached in memory per-session) — the existing repo is
 *      sync, designed around bundled translation JSON.
 *   2. The per-book identifier scheme is canonical (`BibleBookId`)
 *      rather than the per-translation aliasing each version
 *      maintains.
 *   3. Original-language consumers care about WORDS as the model
 *      sees them (with diacritics for Greek, vowel points for
 *      Hebrew), not normalized translation strings.
 *
 * Implementations live in infrastructure:
 *   - SBLGNTBibleProvider (Greek NT, MorphGNT format from
 *     biblicalhumanities/sblgnt)
 *   - MorphhbOriginalLanguageProvider (Hebrew OT, adapter wrapping
 *     the existing MorphhbBibleProvider used by the Hebrew tutor)
 *
 * Used by `loadBookVerses` in application: it dispatches by
 * testament — NT books go to a Greek provider, OT books to a
 * Hebrew provider — and falls back to the translation
 * `IBibleVersionRepository` if the original-language fetch fails
 * (network down, CDN outage, book not in the source corpus).
 */
export interface IOriginalLanguageBibleProvider {
    /** Identifier of the original-language source (e.g. 'sblgnt', 'morphhb'). */
    getSourceId(): string;

    /** 'greek' for NT sources, 'hebrew' for OT. Drives prompt selection upstream. */
    getLanguage(): 'greek' | 'hebrew';

    /**
     * Returns true when this provider has data for the given book.
     * Cheap (no fetch) — usually a static catalog lookup. Used by
     * the dispatcher to decide whether to attempt this provider or
     * fall back.
     */
    supports(bookId: BibleBookId): boolean;

    /**
     * Loads the original-language text for the requested book and
     * returns it verse by verse. Resolves with an array of strings
     * representing the chapter's verses in document order — same
     * shape `IBibleVersionRepository.getChapterContent` returns,
     * just async.
     *
     * Throws when the book is not supported or when the underlying
     * fetch fails. Callers SHOULD treat any throw as "fall back to
     * translation" rather than surfacing the error to the user.
     */
    getChapterContent(bookId: BibleBookId, chapter: number): Promise<string[]>;

    /**
     * La morfología del versículo, si la fuente la trae tabulada.
     *
     * OPCIONAL a propósito. El griego del NT viene de MorphGNT con la
     * morfología columna por columna, así que es un dato calculado; el hebreo
     * la tiene en morphhb con otro sistema de códigos que todavía no se mapeó,
     * y devolver ahí una traducción aproximada sería inventar precisión.
     *
     * Quien no la implemente deja al analizador exactamente como estaba.
     */
    getVerseMorphology?(
        bookId: BibleBookId,
        chapter: number,
        verse: number,
    ): Promise<GreekVerseTokens | null>;
}
