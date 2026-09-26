import type { GreekVerseTokens, HebrewVerseMorphology } from '@dosfilos/domain';
import type {
    BibleBookId,
    IOriginalLanguageBibleProvider,
} from '@dosfilos/domain';

/**
 * Composes two single-testament providers (SBL GNT for NT, WLC for OT)
 * into a single `IOriginalLanguageBibleProvider` that the canonical
 * analyzer use case can consume without knowing about testament
 * dispatch.
 *
 * The use case calls `supports(bookId)` first; this composite returns
 * true when EITHER underlying provider supports the book. On
 * `getChapterContent`, the composite dispatches to the right provider
 * — NT → greek, OT → hebrew — and surfaces its result unchanged.
 *
 * `getLanguage()` returns the dominant language of the most recently
 * resolved book; defaults to 'greek' when no resolution has happened
 * yet. Callers that care about per-book language should query the
 * underlying provider directly via `supports()` first.
 */
export class TestamentDispatcherOriginalLanguageProvider implements IOriginalLanguageBibleProvider {
    private lastLanguage: 'greek' | 'hebrew' = 'greek';

    constructor(
        private readonly greek: IOriginalLanguageBibleProvider,
        private readonly hebrew: IOriginalLanguageBibleProvider,
    ) { }

    getSourceId(): string {
        return `composite:${this.greek.getSourceId()}+${this.hebrew.getSourceId()}`;
    }

    getLanguage(): 'greek' | 'hebrew' {
        return this.lastLanguage;
    }

    supports(bookId: BibleBookId): boolean {
        return this.greek.supports(bookId) || this.hebrew.supports(bookId);
    }

    async getChapterContent(bookId: BibleBookId, chapter: number): Promise<string[]> {
        if (this.greek.supports(bookId)) {
            this.lastLanguage = 'greek';
            return this.greek.getChapterContent(bookId, chapter);
        }
        if (this.hebrew.supports(bookId)) {
            this.lastLanguage = 'hebrew';
            return this.hebrew.getChapterContent(bookId, chapter);
        }
        throw new Error(
            `TestamentDispatcherOriginalLanguageProvider: no provider supports book ${bookId}`,
        );
    }

    /**
     * Delega en el proveedor del libro, que sabe en qué forma viene su
     * morfología: columnas de MorphGNT para el NT, códigos OSHB para el AT.
     *
     * El `null` es para el libro que ningún proveedor cubre, y deja al
     * analizador exactamente como estaba.
     */
    async getVerseMorphology(
        bookId: BibleBookId,
        chapter: number,
        verse: number,
    ): Promise<GreekVerseTokens | HebrewVerseMorphology | null> {
        for (const provider of [this.greek, this.hebrew]) {
            if (!provider.supports(bookId)) continue;
            return provider.getVerseMorphology?.(bookId, chapter, verse) ?? null;
        }
        return null;
    }
}
