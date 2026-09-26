import {
    parseMorphGntParsing,
    parseMorphGntPos,
    transliterateGreek,
    type BibleBookId,
    type GreekVerseTokens,
    type GreekWordToken,
    type IOriginalLanguageBibleProvider,
} from '@dosfilos/domain';

/**
 * MorphGNT-derived SBLGNT (Society of Biblical Literature Greek New
 * Testament) provider for the v1.6 expository assistant.
 *
 * Source: https://github.com/morphgnt/sblgnt — CC BY-SA 4.0,
 * attribution surfaced via the Credits page added in this v1.6
 * series.
 *
 * Delivery: fetched from the jsDelivr CDN that mirrors the
 * morphgnt/sblgnt GitHub repo. One file per NT book (~50-300 KB
 * each); lazy-loaded the first time a given book is requested in
 * a session, then cached in memory for the lifetime of the page
 * load. The web client never bundles the data — keeps the app
 * shell light.
 *
 * MorphGNT format (one Greek word per line):
 *   `<ref> <pos> <parsing> <text> <word> <normalized> <lemma>`
 *   - ref: 6-digit `BBCCVV` (book-chapter-verse, all 2-digit)
 *   - text: surface form WITH diacritics and punctuation — what
 *     the model actually sees.
 *
 * Parsing strategy: split each line by whitespace, take ref's
 * positions 2-3 as chapter and 4-5 as verse, accumulate the
 * `text` column words into per-verse strings separated by single
 * spaces. Punctuation is preserved.
 */
export class SBLGNTBibleProvider implements IOriginalLanguageBibleProvider {
    private static readonly CDN_BASE = 'https://cdn.jsdelivr.net/gh/morphgnt/sblgnt@master';
    private cache = new Map<BibleBookId, ParsedBook>();
    private inFlight = new Map<BibleBookId, Promise<ParsedBook>>();

    getSourceId(): string {
        return 'sblgnt';
    }

    getLanguage(): 'greek' | 'hebrew' {
        return 'greek';
    }

    supports(bookId: BibleBookId): boolean {
        return Object.prototype.hasOwnProperty.call(SBLGNT_FILE_BY_BOOK, bookId);
    }

    async getChapterContent(bookId: BibleBookId, chapter: number): Promise<string[]> {
        const book = await this.loadBook(bookId);
        const chapterMap = book.get(chapter);
        if (!chapterMap) return [];
        // Verses come back in document order. Map keys are verse
        // numbers; we materialise them densely (1..max) so a missing
        // verse appears as an empty string at its index — same shape
        // the translation repos return for missing verses, which the
        // upstream `loadBookVerses` filter then drops.
        const max = Math.max(...chapterMap.keys());
        const out: string[] = [];
        for (let v = 1; v <= max; v++) {
            out.push(chapterMap.get(v)?.text ?? '');
        }
        return out;
    }

    /**
     * Un versículo con sus TOKENS morfológicos — el dato que este provider
     * descargaba y tiraba. MorphGNT trae por palabra: lema, categoría y el
     * código de parsing completo; el analizador griego los muestra sin pasar
     * por ningún modelo. La transliteración se deriva acá, también por código.
     *
     * ATENCIÓN LICENCIA: el TEXTO del SBLGNT es CC BY 4.0; la MORFOLOGÍA de
     * MorphGNT es CC BY-SA 4.0. Quien muestre estos tokens en pantalla debe
     * declarar `morphologyRendered` en las atribuciones (bloque BY-SA latente
     * en `aggregateRequiredAttributions`).
     */
    /**
     * El mismo dato que `getVerseTokens`, con el nombre que declara el puerto.
     *
     * MorphGNT trae la morfología tabulada, así que acá es un cálculo y no una
     * deducción: el analizador recibía sólo el texto corrido y tenía que
     * contar de memoria. Medido en Santiago 2:2-3, contó cuatro subjuntivos
     * donde hay cinco.
     */
    async getVerseMorphology(
        bookId: BibleBookId,
        chapter: number,
        verse: number,
    ): Promise<GreekVerseTokens | null> {
        return this.getVerseTokens(bookId, chapter, verse);
    }

    async getVerseTokens(
        bookId: BibleBookId,
        chapter: number,
        verse: number,
    ): Promise<GreekVerseTokens | null> {
        const book = await this.loadBook(bookId);
        const entry = book.get(chapter)?.get(verse);
        if (!entry) return null;
        return { reference: { chapter, verse }, text: entry.text, tokens: entry.tokens };
    }

    /**
     * Cuántas veces aparece un lema EN ESTE LIBRO. Derivado del archivo ya
     * cargado — runtime y gratis. El conteo NT-completo vive precomputado en
     * `ntLemmaFrequency.json` (scripts/build-greek-lemma-index.mjs): el texto
     * es fijo y esa respuesta no cambia.
     */
    async getLemmaCountInBook(bookId: BibleBookId, lemma: string): Promise<number> {
        const book = await this.loadBook(bookId);
        let n = 0;
        for (const chapter of book.values()) {
            for (const verse of chapter.values()) {
                for (const tok of verse.tokens) if (tok.lemma === lemma) n++;
            }
        }
        return n;
    }

    /**
     * Capítulos del libro y versículos por capítulo, para la navegación del
     * analizador. Derivado del archivo ya cargado: ninguna fuente aparte que
     * pueda divergir del texto.
     */
    async getNavigation(bookId: BibleBookId): Promise<{ chapter: number; verses: number }[]> {
        const book = await this.loadBook(bookId);
        return [...book.entries()]
            .map(([chapter, verses]) => ({ chapter, verses: Math.max(...verses.keys()) }))
            .sort((a, b) => a.chapter - b.chapter);
    }

    private async loadBook(bookId: BibleBookId): Promise<ParsedBook> {
        const cached = this.cache.get(bookId);
        if (cached) return cached;

        // Coalesce concurrent requests for the same book — the
        // wizard hits `loadBook` 1+N times during a pipeline run
        // (panorama loads it once, but a re-run before the cache
        // settles could race). Single in-flight promise is the
        // simplest dedupe.
        const inFlight = this.inFlight.get(bookId);
        if (inFlight) return inFlight;

        const filename = SBLGNT_FILE_BY_BOOK[bookId];
        if (!filename) {
            throw new Error(`SBLGNT does not cover book ${bookId} (NT-only source)`);
        }

        const promise = this.fetchAndParse(filename, bookId);
        this.inFlight.set(bookId, promise);
        try {
            const parsed = await promise;
            this.cache.set(bookId, parsed);
            return parsed;
        } finally {
            this.inFlight.delete(bookId);
        }
    }

    private async fetchAndParse(filename: string, bookId: BibleBookId): Promise<ParsedBook> {
        const url = `${SBLGNTBibleProvider.CDN_BASE}/${filename}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(
                `SBLGNT fetch failed for ${bookId}: HTTP ${response.status} ${response.statusText}`,
            );
        }
        const raw = await response.text();
        return parseMorphgntText(raw);
    }
}

interface ParsedVerse {
    text: string;
    tokens: GreekWordToken[];
}
type ParsedBook = Map<number, Map<number, ParsedVerse>>; // chapter → verse

function parseMorphgntText(raw: string): ParsedBook {
    const result: ParsedBook = new Map();
    const lines = raw.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        // MorphGNT: `ref pos parsing text word normalized lemma`. Para el
        // texto bastan 4 columnas; el token completo pide las 7 — las líneas
        // cortas conservan el texto y quedan sin análisis, nunca al revés.
        const cols = trimmed.split(/\s+/);
        if (cols.length < 4) continue;

        const ref = cols[0];
        if (!ref || ref.length !== 6) continue;

        const chapter = Number(ref.slice(2, 4));
        const verse = Number(ref.slice(4, 6));
        const text = cols[3];
        if (!Number.isFinite(chapter) || !Number.isFinite(verse) || !text) continue;

        let chapterMap = result.get(chapter);
        if (!chapterMap) {
            chapterMap = new Map();
            result.set(chapter, chapterMap);
        }
        let entry = chapterMap.get(verse);
        if (!entry) {
            entry = { text: '', tokens: [] };
            chapterMap.set(verse, entry);
        }
        entry.text = entry.text ? `${entry.text} ${text}` : text;

        const pos = parseMorphGntPos(cols[1] ?? '');
        const lemma = cols[6];
        if (pos && lemma) {
            entry.tokens.push({
                text,
                lemma,
                pos,
                tag: parseMorphGntParsing(cols[2] ?? ''),
                transliteration: transliterateGreek(text),
            });
        }
    }

    return result;
}

/**
 * BibleBookId → morphgnt filename. Only NT books are present (SBLGNT
 * covers only the New Testament). Books absent from this map fail
 * `supports()` and the dispatcher falls back to the translation
 * source for them.
 */
const SBLGNT_FILE_BY_BOOK: Partial<Record<BibleBookId, string>> = {
    MAT: '61-Mt-morphgnt.txt',
    MRK: '62-Mk-morphgnt.txt',
    LUK: '63-Lk-morphgnt.txt',
    JHN: '64-Jn-morphgnt.txt',
    ACT: '65-Ac-morphgnt.txt',
    ROM: '66-Ro-morphgnt.txt',
    '1CO': '67-1Co-morphgnt.txt',
    '2CO': '68-2Co-morphgnt.txt',
    GAL: '69-Ga-morphgnt.txt',
    EPH: '70-Eph-morphgnt.txt',
    PHP: '71-Php-morphgnt.txt',
    COL: '72-Col-morphgnt.txt',
    '1TH': '73-1Th-morphgnt.txt',
    '2TH': '74-2Th-morphgnt.txt',
    '1TI': '75-1Ti-morphgnt.txt',
    '2TI': '76-2Ti-morphgnt.txt',
    TIT: '77-Tit-morphgnt.txt',
    PHM: '78-Phm-morphgnt.txt',
    HEB: '79-Heb-morphgnt.txt',
    JAS: '80-Jas-morphgnt.txt',
    '1PE': '81-1Pe-morphgnt.txt',
    '2PE': '82-2Pe-morphgnt.txt',
    '1JN': '83-1Jn-morphgnt.txt',
    '2JN': '84-2Jn-morphgnt.txt',
    '3JN': '85-3Jn-morphgnt.txt',
    JUD: '86-Jud-morphgnt.txt',
    REV: '87-Re-morphgnt.txt',
};
