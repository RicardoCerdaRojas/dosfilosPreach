import type { HebrewVerseMorphology } from '@dosfilos/domain';
import type {
    BibleBookId,
    IOriginalLanguageBibleProvider,
} from '@dosfilos/domain';
import { MorphhbBibleProvider } from '../../hebrew-tutor/morphhb/morphhb-bible-provider';

/**
 * Adapter that exposes the existing `MorphhbBibleProvider` (used by
 * the Hebrew tutor) as an `IOriginalLanguageBibleProvider` for the
 * v1.6 expository assistant.
 *
 * Source: openscriptures/morphhb (Westminster Leningrad Codex with
 * morphological tagging), public domain. Attribution surfaced via
 * the Credits page added in this v1.6 series.
 *
 * Why an adapter and not a parallel implementation:
 *   - The morphhb provider already loads the WLC XML from CDN with
 *     in-memory caching, parses Unicode Hebrew text correctly, and
 *     handles all the Tanakh's structural quirks (Psalms, Esther,
 *     Daniel etc.). Re-implementing would duplicate hundreds of
 *     lines of XML parsing for zero correctness gain.
 *   - The expository assistant cares about per-verse Hebrew text;
 *     the morphhb provider's `getVerse(...).hebrewText` is exactly
 *     that. The adapter just calls into it and reshapes the output.
 *
 * BibleBookId → morphhbKey mapping covers all 39 OT books (Joel
 * and Obadiah were added to the morphhb catalog in this same v1.6
 * series — they were missing from the original Hebrew-tutor scope).
 */
export class MorphhbOriginalLanguageProvider implements IOriginalLanguageBibleProvider {
    constructor(private morphhb: MorphhbBibleProvider = new MorphhbBibleProvider()) {}

    getSourceId(): string {
        return 'morphhb';
    }

    getLanguage(): 'greek' | 'hebrew' {
        return 'hebrew';
    }

    supports(bookId: BibleBookId): boolean {
        return Object.prototype.hasOwnProperty.call(MORPHHB_KEY_BY_BOOK, bookId);
    }

    /**
     * La morfología tabulada del versículo, con los códigos OSHB tal cual.
     *
     * NO se decodifican acá. El adaptador entrega el dato como viene y quien
     * lo lee es `oshbMorphology`, en dominio, donde las pruebas lo atan a
     * formas reales del Salmo 23 verificadas contra el análisis que el autor
     * escribió a mano. Traducir el código en el adaptador lo dejaría sin esa
     * comprobación.
     */
    async getVerseMorphology(
        bookId: BibleBookId,
        chapter: number,
        verse: number,
    ): Promise<HebrewVerseMorphology | null> {
        const morphhbKey = MORPHHB_KEY_BY_BOOK[bookId];
        if (!morphhbKey) return null;
        await this.morphhb.loadBook(morphhbKey);
        const entry = this.morphhb.getVerse(morphhbKey, chapter, verse);
        if (!entry?.words?.length) return null;
        return {
            tokens: entry.words.map(w => ({
                text: w.text,
                lemma: w.lemma,
                oshbMorphCode: w.oshbMorphCode,
            })),
        };
    }

    async getChapterContent(bookId: BibleBookId, chapter: number): Promise<string[]> {
        const morphhbKey = MORPHHB_KEY_BY_BOOK[bookId];
        if (!morphhbKey) {
            throw new Error(`morphhb does not cover book ${bookId} (OT-only source)`);
        }

        await this.morphhb.loadBook(morphhbKey);
        const verseCount = this.morphhb.getVerseCount(morphhbKey, chapter);
        if (verseCount === 0) return [];

        const out: string[] = [];
        for (let v = 1; v <= verseCount; v++) {
            try {
                const verse = this.morphhb.getVerse(morphhbKey, chapter, v);
                out.push(verse.hebrewText);
            } catch {
                // Missing verse (gaps in numbering) shows up as empty
                // — same convention SBLGNT provider uses, lets the
                // upstream loadBookVerses filter drop it cleanly.
                out.push('');
            }
        }
        return out;
    }
}

/**
 * BibleBookId (SBL canonical, used everywhere else in the app) →
 * morphhb's per-book filename key. Only OT books; NT books fail
 * `supports()` so the dispatcher routes them to the Greek provider.
 */
const MORPHHB_KEY_BY_BOOK: Partial<Record<BibleBookId, string>> = {
    GEN: 'Gen',
    EXO: 'Exod',
    LEV: 'Lev',
    NUM: 'Num',
    DEU: 'Deut',
    JOS: 'Josh',
    JDG: 'Judg',
    RUT: 'Ruth',
    '1SA': '1Sam',
    '2SA': '2Sam',
    '1KI': '1Kgs',
    '2KI': '2Kgs',
    '1CH': '1Chr',
    '2CH': '2Chr',
    EZR: 'Ezra',
    NEH: 'Neh',
    EST: 'Esth',
    JOB: 'Job',
    PSA: 'Ps',
    PRO: 'Prov',
    ECC: 'Eccl',
    SNG: 'Cant',
    ISA: 'Isa',
    JER: 'Jer',
    LAM: 'Lam',
    EZK: 'Ezek',
    DAN: 'Dan',
    HOS: 'Hos',
    JOL: 'Joel',
    AMO: 'Amos',
    OBA: 'Obad',
    JON: 'Jonah',
    MIC: 'Mic',
    NAM: 'Nah',
    HAB: 'Hab',
    ZEP: 'Zeph',
    HAG: 'Hag',
    ZEC: 'Zech',
    MAL: 'Mal',
};
