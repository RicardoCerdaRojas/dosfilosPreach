/**
 * PassageReference — structured Bible passage with parser/validator/formatter.
 *
 * The exegesis module accepts user input from two surfaces:
 *   - free text  ("Heb 1:1-4", "Hebreos 1.1–4", "1 Cor 13:4-7")
 *   - the picker (book/chapter/verse dropdowns)
 *
 * Both produce a `PassageReference` after parsing+validation. Invalid input
 * never silently degrades — it returns an error code so the UI can show a
 * specific message.
 *
 * Book + chapter range validated against `BIBLE_CANON`. Verses are checked
 * against `VERSES_PER_CHAPTER` only with `{ strictVerses: true }`, for what
 * the student TYPES (TP #9, B1: «Santiago 4:11-19» se aceptaba y Santiago 4
 * tiene 17). The parser also reads STORED strings and headings of books
 * («Juan 1:50-2:30», «12:18–13:1» de un comentario griego): rejecting them
 * there would lose data silently, so the default stays lenient.
 */

/** `strictVerses`: rechazar versículos que no existen (solo para la entrada del usuario). */
export interface PassageParseOptions {
    strictVerses?: boolean;
}

import type { BibleBookId, BibleCanonBook } from './BibleCanon';
import { findBooksByAlias, getBookById, normalizeAlias } from './BibleCanon';
import { VERSES_PER_CHAPTER } from './versesPerChapter';

export interface PassageReference {
    bookId: BibleBookId;
    /** Lowest chapter in the range (inclusive). */
    chapterStart: number;
    /** Highest chapter in the range (inclusive). Equals `chapterStart` for single-chapter refs. */
    chapterEnd: number;
    /**
     * First verse in the range, scoped to `chapterStart`. `null` means
     * "start of chapter" — the user gave a chapter-level reference like
     * "Heb 1" or "Heb 1-2" without specifying verses.
     */
    verseStart: number | null;
    /**
     * Last verse in the range, scoped to `chapterEnd`. `null` means "end
     * of chapter" — pairs with `verseStart === null`. Mixed null states are
     * not produced by the parser (either both are null or both are numbers).
     */
    verseEnd: number | null;
}

export type ParseError =
    | 'empty'
    | 'book-not-found'
    | 'book-ambiguous'
    | 'missing-chapter'
    | 'invalid-chapter'
    | 'chapter-out-of-range'
    | 'invalid-verse'
    | 'inverted-range'
    | 'verse-out-of-range'
    | 'malformed';

export interface ParseSuccess {
    ok: true;
    ref: PassageReference;
    /** The matched book — caller often wants display data without a re-lookup. */
    book: BibleCanonBook;
}

export interface ParseFailure {
    ok: false;
    error: ParseError;
    /** Human-friendly hint, English (UI translates). */
    hint: string;
    /** When `error === 'book-ambiguous'`, the candidates that matched. */
    candidates?: BibleCanonBook[];
    /** When `error === 'verse-out-of-range'`: the chapter and how many verses it has. */
    limit?: { bookId: BibleBookId; chapter: number; verses: number; verse: number };
}

/**
 * Cuántos versículos tiene un capítulo (el mayor entre la numeración del
 * lector y la del original). `null` si el libro o el capítulo no existen.
 */
export function versesInChapter(bookId: BibleBookId, chapter: number): number | null {
    const n = VERSES_PER_CHAPTER[bookId]?.[chapter - 1];
    return typeof n === 'number' && n > 0 ? n : null;
}

/** El primer versículo que no existe en el pasaje, como error; `null` si todos existen. */
function verseBeyondChapter(book: BibleCanonBook, ref: PassageReference): ParseFailure | null {
    const pares: Array<[number, number | null]> = [[ref.chapterStart, ref.verseStart], [ref.chapterEnd, ref.verseEnd]];
    for (const [chapter, verse] of pares) {
        if (verse === null) continue;
        const max = versesInChapter(book.id, chapter);
        if (max !== null && verse > max) {
            return {
                ok: false,
                error: 'verse-out-of-range',
                hint: `${book.nameEn} ${chapter} only has ${max} verse${max === 1 ? '' : 's'} (got ${verse}).`,
                limit: { bookId: book.id, chapter, verses: max, verse },
            };
        }
    }
    return null;
}

export type ParseResult = ParseSuccess | ParseFailure;

/**
 * Single regex that captures the trailing "ch:v[-...]" part of a passage
 * string. The book name is everything before the matched group. We anchor
 * to end-of-string and require whitespace before the leading digit so that
 * numbered-book prefixes (`1 Juan 3:16`) are not mis-eaten as the chapter.
 *
 * Capture groups:
 *   1: chapter (start)
 *   2: verseStart  (only when `:`/`.` separator is used)
 *   3: endChapter  (when range crosses chapters: "1:1-2:5")
 *   4: endVerse    (paired with endChapter)
 *   5: endVerseSameChapter ("1:1-4")
 *   6: endChapterOnly ("1-2", chapter range without verses)
 *
 * Range separators: hyphen, en-dash (U+2013), em-dash (U+2014).
 * Chapter:verse separator: ":" or ".".
 */
const TAIL_REGEX = /\s+(\d+)(?:[:.](\d+)(?:[-–—](?:(\d+)[:.](\d+)|(\d+)))?|[-–—](\d+))?\s*$/;

/**
 * Parses a free-text passage reference into a structured form, validating
 * against the canon. Examples that succeed:
 *
 *   "Heb 1:1-4"          → HEB 1:1-1:4
 *   "Hebreos 1:1–4"      → HEB 1:1-1:4   (en-dash ok)
 *   "Heb 1.1-4"          → HEB 1:1-1:4   (dot separator ok)
 *   "1 Cor 13:4-7"       → 1CO 13:4-13:7
 *   "Sal 23"             → PSA 23 (whole chapter, verses null)
 *   "Heb 1:1-2:5"        → HEB 1:1-2:5  (multi-chapter range)
 *   "Heb 1-2"            → HEB 1-2 (chapter range, verses null)
 *   "JN 3:16"            → JHN 3:16 (alias 'jn' matches Jonah and John;
 *                                    Jonah only has 4 chapters → JHN wins)
 *
 * Returns `{ ok: false, error, hint }` for unparseable or invalid input.
 */
export function parsePassageReference(input: string, options: PassageParseOptions = {}): ParseResult {
    const cleaned = input.normalize('NFC').trim();
    if (!cleaned) {
        return fail('empty', 'Empty passage reference.');
    }

    const tailMatch = cleaned.match(TAIL_REGEX);
    if (!tailMatch) {
        // No trailing chapter:verse — v1 requires at least a chapter.
        return fail('missing-chapter', 'Specify at least a chapter, e.g. "Heb 1" or "Heb 1:1-4".');
    }

    const bookPart = cleaned.slice(0, tailMatch.index!).trim();
    if (!bookPart) {
        return fail('book-not-found', 'No book name detected.');
    }

    const [, chStr, vStartStr, endChStr, endVStr, endVSameChStr, endChOnlyStr] = tailMatch;
    const chapter = parseInt(chStr, 10);
    if (!Number.isFinite(chapter) || chapter < 1) {
        return fail('invalid-chapter', `Chapter must be a positive integer (got "${chStr}").`);
    }

    const candidates = findBooksByAlias(bookPart);
    if (candidates.length === 0) {
        return fail('book-not-found', `Book "${bookPart}" not recognized.`);
    }

    // Disambiguate by chapter range when alias matches multiple books.
    // Drop candidates whose chapterCount can't accommodate the requested
    // chapter; if exactly one survives, that's the answer. Otherwise, ask.
    const viable = candidates.filter(b => chapter <= b.chapterCount);
    let book: BibleCanonBook;
    if (viable.length === 0) {
        // All candidates exist, but none has enough chapters — chapter is OOB.
        // Surface the best-known book in the message (the first candidate)
        // so the user sees its chapter count.
        const first = candidates[0];
        return fail(
            'chapter-out-of-range',
            `${first.nameEn} only has ${first.chapterCount} chapter${first.chapterCount === 1 ? '' : 's'} (got ${chapter}).`
        );
    } else if (viable.length === 1) {
        book = viable[0];
    } else {
        return {
            ok: false,
            error: 'book-ambiguous',
            hint: `Alias "${bookPart}" matches multiple books — pick one.`,
            candidates: viable,
        };
    }

    // Resolve verse boundaries.
    let verseStart: number | null = null;
    let verseEnd: number | null = null;
    let chapterEnd = chapter;

    if (vStartStr !== undefined) {
        verseStart = parseInt(vStartStr, 10);
        if (!Number.isFinite(verseStart) || verseStart < 1) {
            return fail('invalid-verse', `Verse must be a positive integer (got "${vStartStr}").`);
        }

        if (endChStr !== undefined && endVStr !== undefined) {
            // "1:1-2:5" — range crosses chapters.
            chapterEnd = parseInt(endChStr, 10);
            verseEnd = parseInt(endVStr, 10);
            if (!Number.isFinite(chapterEnd) || chapterEnd < 1 || chapterEnd > book.chapterCount) {
                return fail(
                    'chapter-out-of-range',
                    `${book.nameEn} only has ${book.chapterCount} chapter${book.chapterCount === 1 ? '' : 's'} (got end chapter ${chapterEnd}).`
                );
            }
            if (chapterEnd < chapter) {
                return fail('inverted-range', 'End chapter precedes start chapter.');
            }
            if (!Number.isFinite(verseEnd) || verseEnd < 1) {
                return fail('invalid-verse', `End verse must be a positive integer (got "${endVStr}").`);
            }
        } else if (endVSameChStr !== undefined) {
            // "1:1-4" — same-chapter verse range.
            verseEnd = parseInt(endVSameChStr, 10);
            if (!Number.isFinite(verseEnd) || verseEnd < 1) {
                return fail('invalid-verse', `End verse must be a positive integer (got "${endVSameChStr}").`);
            }
            if (verseEnd < verseStart) {
                return fail('inverted-range', 'End verse precedes start verse.');
            }
        } else {
            // "1:1" — single verse.
            verseEnd = verseStart;
        }
    } else if (endChOnlyStr !== undefined) {
        // "1-2" — chapter range, no verses.
        chapterEnd = parseInt(endChOnlyStr, 10);
        if (!Number.isFinite(chapterEnd) || chapterEnd < 1 || chapterEnd > book.chapterCount) {
            return fail(
                'chapter-out-of-range',
                `${book.nameEn} only has ${book.chapterCount} chapter${book.chapterCount === 1 ? '' : 's'} (got end chapter ${chapterEnd}).`
            );
        }
        if (chapterEnd < chapter) {
            return fail('inverted-range', 'End chapter precedes start chapter.');
        }
    }
    // else: chapter-only reference (e.g. "Heb 1"). verses remain null.

    const ref = { bookId: book.id, chapterStart: chapter, chapterEnd, verseStart, verseEnd };
    const fuera = options.strictVerses ? verseBeyondChapter(book, ref) : null;
    if (fuera) return fuera;
    return { ok: true, book, ref };
}

/**
 * Builds a `PassageReference` from picker dropdowns. Same validation rules
 * as the parser — returns the same error shape so UI can share handling.
 *
 * `verseStart` and `verseEnd` may both be null (chapter-level reference)
 * or both be numbers (verse range). Mixed states are rejected.
 */
export function buildPassageReference(input: {
    bookId: BibleBookId;
    chapterStart: number;
    chapterEnd?: number;
    verseStart?: number | null;
    verseEnd?: number | null;
}, options: PassageParseOptions = {}): ParseResult {
    const book = getBookById(input.bookId);
    if (!book) {
        return fail('book-not-found', `Unknown book id "${input.bookId}".`);
    }

    const chapterStart = input.chapterStart;
    const chapterEnd = input.chapterEnd ?? chapterStart;

    if (!Number.isInteger(chapterStart) || chapterStart < 1) {
        return fail('invalid-chapter', 'chapterStart must be a positive integer.');
    }
    if (chapterStart > book.chapterCount) {
        return fail(
            'chapter-out-of-range',
            `${book.nameEn} only has ${book.chapterCount} chapter${book.chapterCount === 1 ? '' : 's'} (got ${chapterStart}).`
        );
    }
    if (!Number.isInteger(chapterEnd) || chapterEnd < chapterStart || chapterEnd > book.chapterCount) {
        return fail('chapter-out-of-range', 'chapterEnd is invalid or out of book range.');
    }

    const verseStart = input.verseStart ?? null;
    const verseEnd = input.verseEnd ?? null;

    if ((verseStart === null) !== (verseEnd === null)) {
        return fail('invalid-verse', 'verseStart and verseEnd must both be set or both null.');
    }
    if (verseStart !== null && verseEnd !== null) {
        if (!Number.isInteger(verseStart) || verseStart < 1) {
            return fail('invalid-verse', 'verseStart must be a positive integer.');
        }
        if (!Number.isInteger(verseEnd) || verseEnd < 1) {
            return fail('invalid-verse', 'verseEnd must be a positive integer.');
        }
        if (chapterStart === chapterEnd && verseEnd < verseStart) {
            return fail('inverted-range', 'verseEnd precedes verseStart.');
        }
    }

    const ref = { bookId: book.id, chapterStart, chapterEnd, verseStart, verseEnd };
    const fuera = options.strictVerses ? verseBeyondChapter(book, ref) : null;
    if (fuera) return fuera;
    return { ok: true, book, ref };
}

/**
 * Renders a `PassageReference` as a human-readable string in the requested
 * language. The format mirrors common conventions: book + chapter [: verse [- verseEnd]] [-chapterEnd[:verseEnd]].
 *
 *   formatPassageReference({GEN, 1, 1, 1, 1}, 'es')      → "Génesis 1:1"
 *   formatPassageReference({HEB, 1, 1, 1, 4}, 'es')      → "Hebreos 1:1-4"
 *   formatPassageReference({HEB, 1, 1, 2, 5}, 'es')      → "Hebreos 1:1-2:5"
 *   formatPassageReference({PSA, 23, 23, null, null}, 'es') → "Salmos 23"
 *   formatPassageReference({HEB, 1, 2, null, null}, 'es')  → "Hebreos 1-2"
 */
export function formatPassageReference(ref: PassageReference, language: 'es' | 'en' = 'es'): string {
    const book = getBookById(ref.bookId);
    if (!book) return `${ref.bookId} ${ref.chapterStart}`;
    const name = language === 'en' ? book.nameEn : book.nameEs;

    if (ref.verseStart === null && ref.verseEnd === null) {
        // Chapter-level.
        if (ref.chapterEnd > ref.chapterStart) {
            return `${name} ${ref.chapterStart}-${ref.chapterEnd}`;
        }
        return `${name} ${ref.chapterStart}`;
    }

    // Verse-level — verseStart/verseEnd guaranteed non-null here.
    if (ref.chapterStart === ref.chapterEnd) {
        if (ref.verseStart === ref.verseEnd) {
            return `${name} ${ref.chapterStart}:${ref.verseStart}`;
        }
        return `${name} ${ref.chapterStart}:${ref.verseStart}-${ref.verseEnd}`;
    }
    return `${name} ${ref.chapterStart}:${ref.verseStart}-${ref.chapterEnd}:${ref.verseEnd}`;
}

/**
 * Materializes the canonical "whole book" passage reference for the given
 * book — useful when callers want to pass an entire book as a
 * `PassageReference` rather than a bare `BibleBookId` (e.g. expository
 * pipelines whose scope picker can be either "whole book" or a specific
 * sub-range, and both modes need to feed downstream a single uniform type).
 *
 * Returns chapter-level reference (`verseStart` / `verseEnd` = null) spanning
 * chapter 1 through the book's last chapter. Parser intentionally rejects
 * bare book names ("Hebreos" → `missing-chapter`) so the picker UX flows
 * stay opinionated; this helper is the explicit, structural escape hatch.
 */
export function wholeBookPassage(bookId: BibleBookId): PassageReference {
    const book = getBookById(bookId);
    if (!book) {
        throw new Error(`Unknown book id: ${bookId}`);
    }
    return {
        bookId,
        chapterStart: 1,
        chapterEnd: book.chapterCount,
        verseStart: null,
        verseEnd: null,
    };
}

// ── helpers ─────────────────────────────────────────────────────────────

function fail(error: ParseError, hint: string): ParseFailure {
    return { ok: false, error, hint };
}

// Re-export the normalizer because some UIs (autocomplete) want to apply it
// to user input as they type without going through the full parser.
export { normalizeAlias };

/**
 * El primer pasaje válido nombrado dentro de un texto libre: «TP9 - Santiago
 * 4:11-17» → Santiago 4:11-17. Una entrada del calendario del curso puede
 * traer el pasaje solo en su rótulo, y crear el trabajo desde ella obligaba
 * a escribirlo otra vez (TP #9, B7). `null` si no nombra ninguno.
 */
export function findPassageInText(text: string | null | undefined): PassageReference | null {
    if (!text) return null;
    const tokens = text.normalize('NFC')
        .replace(/(\d)\s*[-–—]\s*(\d)/g, '$1-$2')
        .split(/\s+/)
        .map(t => t.replace(/^[^\p{L}\d]+/u, ''))
        .filter(Boolean);
    const cola = /^\d+(?:[:.]\d+)?(?:-\d+(?:[:.]\d+)?)?[.,;:)\]]*$/;
    for (let j = 1; j < tokens.length; j++) {
        if (!cola.test(tokens[j]!)) continue;
        const ref = tokens[j]!.replace(/[.,;:)\]]+$/, '');
        // Del nombre más largo al más corto: «1 Juan 3:1» antes que «Juan 3:1».
        for (let k = Math.min(4, j); k >= 1; k--) {
            // Estricto: lo que nombra un rótulo se va a proponer como pasaje del trabajo.
            const r = parsePassageReference([...tokens.slice(j - k, j), ref].join(' '), { strictVerses: true });
            if (r.ok) return r.ref;
        }
    }
    return null;
}
