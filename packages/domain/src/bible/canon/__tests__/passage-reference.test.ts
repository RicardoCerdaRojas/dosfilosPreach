import { describe, it, expect } from 'vitest';
import {
    parsePassageReference,
    buildPassageReference,
    formatPassageReference,
    normalizeAlias,
    wholeBookPassage,
} from '../passage-reference';
import { findBooksByAlias, getBookById, BIBLE_CANON } from '../BibleCanon';

describe('BIBLE_CANON', () => {
    it('contains exactly 66 books in canonical order', () => {
        expect(BIBLE_CANON).toHaveLength(66);
        for (let i = 0; i < BIBLE_CANON.length; i++) {
            expect(BIBLE_CANON[i].canonicalOrder).toBe(i + 1);
        }
    });

    it('splits 39 OT + 27 NT', () => {
        const ot = BIBLE_CANON.filter(b => b.testament === 'OT');
        const nt = BIBLE_CANON.filter(b => b.testament === 'NT');
        expect(ot).toHaveLength(39);
        expect(nt).toHaveLength(27);
    });

    it('has unique book ids', () => {
        const ids = new Set(BIBLE_CANON.map(b => b.id));
        expect(ids.size).toBe(BIBLE_CANON.length);
    });

    it('has positive chapter counts', () => {
        for (const b of BIBLE_CANON) {
            expect(b.chapterCount).toBeGreaterThan(0);
        }
    });
});

describe('normalizeAlias', () => {
    it('lowercases and strips diacritics', () => {
        expect(normalizeAlias('Génesis')).toBe('genesis');
        expect(normalizeAlias('Éxodo')).toBe('exodo');
        expect(normalizeAlias('Salmos')).toBe('salmos');
    });

    it('drops trailing dots and collapses whitespace', () => {
        expect(normalizeAlias('Heb.')).toBe('heb');
        expect(normalizeAlias('  1   Cor  ')).toBe('1 cor');
    });
});

describe('findBooksByAlias', () => {
    it('finds Hebrews by Spanish full name', () => {
        const r = findBooksByAlias('Hebreos');
        expect(r.map(b => b.id)).toEqual(['HEB']);
    });

    it('finds Hebrews by English full name', () => {
        const r = findBooksByAlias('Hebrews');
        expect(r.map(b => b.id)).toEqual(['HEB']);
    });

    it('finds Hebrews by short abbreviations', () => {
        expect(findBooksByAlias('heb').map(b => b.id)).toEqual(['HEB']);
        expect(findBooksByAlias('he').map(b => b.id)).toEqual(['HEB']);
    });

    it('returns multiple candidates for ambiguous "jn" (Jonah + John)', () => {
        const r = findBooksByAlias('jn');
        const ids = r.map(b => b.id).sort();
        expect(ids).toEqual(['JHN', 'JON']);
    });

    it('handles 1 Corinthians with various forms', () => {
        for (const alias of ['1 Corintios', '1 corinthians', '1Co', '1 co', '1cor', 'I Corintios']) {
            const r = findBooksByAlias(alias);
            expect(r.map(b => b.id)).toEqual(['1CO']);
        }
    });

    it('returns empty for unknown alias', () => {
        expect(findBooksByAlias('zzznotabook')).toEqual([]);
    });
});

describe('parsePassageReference — happy paths', () => {
    it('parses single verse "Juan 3:16"', () => {
        const r = parsePassageReference('Juan 3:16');
        expect(r.ok).toBe(true);
        if (r.ok === false) throw new Error(`expected ok, got ${r.error}: ${r.hint}`);
        expect(r.ref).toEqual({
            bookId: 'JHN',
            chapterStart: 3,
            chapterEnd: 3,
            verseStart: 16,
            verseEnd: 16,
        });
    });

    it('parses verse range "Heb 1:1-4"', () => {
        const r = parsePassageReference('Heb 1:1-4');
        expect(r.ok).toBe(true);
        if (r.ok === false) throw new Error(`expected ok, got ${r.error}: ${r.hint}`);
        expect(r.ref).toEqual({
            bookId: 'HEB',
            chapterStart: 1,
            chapterEnd: 1,
            verseStart: 1,
            verseEnd: 4,
        });
    });

    it('accepts en-dash range "Hebreos 1:1–4"', () => {
        const r = parsePassageReference('Hebreos 1:1–4');
        expect(r.ok).toBe(true);
        if (r.ok === false) throw new Error(`expected ok, got ${r.error}: ${r.hint}`);
        expect(r.ref.verseEnd).toBe(4);
    });

    it('accepts em-dash range "Heb 1:1—4"', () => {
        const r = parsePassageReference('Heb 1:1—4');
        expect(r.ok).toBe(true);
        if (r.ok === false) throw new Error(`expected ok, got ${r.error}: ${r.hint}`);
        expect(r.ref.verseEnd).toBe(4);
    });

    it('accepts dot separator "Heb 1.1-4"', () => {
        const r = parsePassageReference('Heb 1.1-4');
        expect(r.ok).toBe(true);
        if (r.ok === false) throw new Error(`expected ok, got ${r.error}: ${r.hint}`);
        expect(r.ref).toMatchObject({ chapterStart: 1, verseStart: 1, verseEnd: 4 });
    });

    it('parses multi-chapter verse range "Heb 1:1-2:5"', () => {
        const r = parsePassageReference('Heb 1:1-2:5');
        expect(r.ok).toBe(true);
        if (r.ok === false) throw new Error(`expected ok, got ${r.error}: ${r.hint}`);
        expect(r.ref).toEqual({
            bookId: 'HEB',
            chapterStart: 1,
            chapterEnd: 2,
            verseStart: 1,
            verseEnd: 5,
        });
    });

    it('parses chapter-only "Sal 23"', () => {
        const r = parsePassageReference('Sal 23');
        expect(r.ok).toBe(true);
        if (r.ok === false) throw new Error(`expected ok, got ${r.error}: ${r.hint}`);
        expect(r.ref).toEqual({
            bookId: 'PSA',
            chapterStart: 23,
            chapterEnd: 23,
            verseStart: null,
            verseEnd: null,
        });
    });

    it('parses chapter range "Heb 1-2"', () => {
        const r = parsePassageReference('Heb 1-2');
        expect(r.ok).toBe(true);
        if (r.ok === false) throw new Error(`expected ok, got ${r.error}: ${r.hint}`);
        expect(r.ref).toEqual({
            bookId: 'HEB',
            chapterStart: 1,
            chapterEnd: 2,
            verseStart: null,
            verseEnd: null,
        });
    });

    it('parses numbered books "1 Corintios 13:4-7"', () => {
        const r = parsePassageReference('1 Corintios 13:4-7');
        expect(r.ok).toBe(true);
        if (r.ok === false) throw new Error(`expected ok, got ${r.error}: ${r.hint}`);
        expect(r.ref).toMatchObject({ bookId: '1CO', chapterStart: 13, verseStart: 4, verseEnd: 7 });
    });

    it('parses Roman numeral numbered books "II Timoteo 3:16"', () => {
        const r = parsePassageReference('II Timoteo 3:16');
        expect(r.ok).toBe(true);
        if (r.ok === false) throw new Error(`expected ok, got ${r.error}: ${r.hint}`);
        expect(r.ref.bookId).toBe('2TI');
    });

    it('disambiguates "jn 3:16" to John (Jonah only has 4 chapters)', () => {
        // Both Jonah (4 ch) and John (21 ch) have alias "jn"; ch 3 fits both,
        // so this is intentionally ambiguous and should error.
        const r = parsePassageReference('jn 3:16');
        expect(r.ok).toBe(false);
        if (r.ok === true) throw new Error('expected failure, got ok');
        expect(r.error).toBe('book-ambiguous');
    });

    it('disambiguates "jn 5:1" to John (Jonah has only 4 chapters)', () => {
        const r = parsePassageReference('jn 5:1');
        expect(r.ok).toBe(true);
        if (r.ok === false) throw new Error(`expected ok, got ${r.error}: ${r.hint}`);
        expect(r.ref.bookId).toBe('JHN');
    });

    it('handles trailing/leading whitespace', () => {
        const r = parsePassageReference('   Hebreos 1:1-4   ');
        expect(r.ok).toBe(true);
        if (r.ok === false) throw new Error(`expected ok, got ${r.error}: ${r.hint}`);
        expect(r.ref.bookId).toBe('HEB');
    });

    it('handles abbreviation with trailing dot "Mat. 5:3"', () => {
        const r = parsePassageReference('Mat. 5:3');
        expect(r.ok).toBe(true);
        if (r.ok === false) throw new Error(`expected ok, got ${r.error}: ${r.hint}`);
        expect(r.ref.bookId).toBe('MAT');
    });
});

describe('parsePassageReference — failures', () => {
    it('rejects empty input', () => {
        const r = parsePassageReference('');
        expect(r.ok).toBe(false);
        if (r.ok === true) throw new Error('expected failure, got ok');
        expect(r.error).toBe('empty');
    });

    it('rejects book-only references (chapter required)', () => {
        const r = parsePassageReference('Hebreos');
        expect(r.ok).toBe(false);
        if (r.ok === true) throw new Error('expected failure, got ok');
        expect(r.error).toBe('missing-chapter');
    });

    it('rejects unknown book name', () => {
        const r = parsePassageReference('Zzznotabook 1:1');
        expect(r.ok).toBe(false);
        if (r.ok === true) throw new Error('expected failure, got ok');
        expect(r.error).toBe('book-not-found');
    });

    it('rejects out-of-range chapter "Heb 50"', () => {
        const r = parsePassageReference('Heb 50');
        expect(r.ok).toBe(false);
        if (r.ok === true) throw new Error('expected failure, got ok');
        expect(r.error).toBe('chapter-out-of-range');
    });

    it('rejects inverted verse range "Heb 1:5-2"', () => {
        const r = parsePassageReference('Heb 1:5-2');
        expect(r.ok).toBe(false);
        if (r.ok === true) throw new Error('expected failure, got ok');
        expect(r.error).toBe('inverted-range');
    });

    it('rejects inverted chapter range "Heb 5-2"', () => {
        const r = parsePassageReference('Heb 5-2');
        expect(r.ok).toBe(false);
        if (r.ok === true) throw new Error('expected failure, got ok');
        expect(r.error).toBe('inverted-range');
    });

    it('reports candidates on ambiguous alias', () => {
        const r = parsePassageReference('jud 1');
        expect(r.ok).toBe(false);
        if (r.ok === true) throw new Error('expected failure, got ok');
        expect(r.error).toBe('book-ambiguous');
        expect(r.candidates?.map(b => b.id).sort()).toEqual(['JDG', 'JUD']);
    });
});

describe('buildPassageReference (picker path)', () => {
    it('builds a valid single-chapter reference', () => {
        const r = buildPassageReference({
            bookId: 'HEB',
            chapterStart: 1,
            verseStart: 1,
            verseEnd: 4,
        });
        expect(r.ok).toBe(true);
        if (r.ok === false) throw new Error(`expected ok, got ${r.error}: ${r.hint}`);
        expect(r.ref).toEqual({
            bookId: 'HEB',
            chapterStart: 1,
            chapterEnd: 1,
            verseStart: 1,
            verseEnd: 4,
        });
    });

    it('rejects mixed null/number verse states', () => {
        const r = buildPassageReference({
            bookId: 'HEB',
            chapterStart: 1,
            verseStart: 1,
            verseEnd: null,
        });
        expect(r.ok).toBe(false);
        if (r.ok === true) throw new Error('expected failure, got ok');
        expect(r.error).toBe('invalid-verse');
    });

    it('rejects out-of-range chapter', () => {
        const r = buildPassageReference({ bookId: 'HEB', chapterStart: 99 });
        expect(r.ok).toBe(false);
        if (r.ok === true) throw new Error('expected failure, got ok');
        expect(r.error).toBe('chapter-out-of-range');
    });
});

describe('formatPassageReference', () => {
    it('formats single verse', () => {
        const ref = { bookId: 'JHN' as const, chapterStart: 3, chapterEnd: 3, verseStart: 16, verseEnd: 16 };
        expect(formatPassageReference(ref, 'es')).toBe('Juan 3:16');
        expect(formatPassageReference(ref, 'en')).toBe('John 3:16');
    });

    it('formats same-chapter verse range', () => {
        const ref = { bookId: 'HEB' as const, chapterStart: 1, chapterEnd: 1, verseStart: 1, verseEnd: 4 };
        expect(formatPassageReference(ref, 'es')).toBe('Hebreos 1:1-4');
    });

    it('formats multi-chapter range', () => {
        const ref = { bookId: 'HEB' as const, chapterStart: 1, chapterEnd: 2, verseStart: 1, verseEnd: 5 };
        expect(formatPassageReference(ref, 'es')).toBe('Hebreos 1:1-2:5');
    });

    it('formats whole chapter', () => {
        const ref = { bookId: 'PSA' as const, chapterStart: 23, chapterEnd: 23, verseStart: null, verseEnd: null };
        expect(formatPassageReference(ref, 'es')).toBe('Salmo 23');
    });

    it('REGRESIÓN TI #2 (B68a): un solo salmo va en singular; varios, en plural', () => {
        const PSA = (cs: number, ce: number, vs: number | null, ve: number | null) =>
            ({ bookId: 'PSA' as const, chapterStart: cs, chapterEnd: ce, verseStart: vs, verseEnd: ve });
        expect(formatPassageReference(PSA(23, 23, 4, 6), 'es')).toBe('Salmo 23:4-6');
        expect(formatPassageReference(PSA(23, 23, 4, 4), 'en')).toBe('Psalm 23:4');
        expect(formatPassageReference(PSA(23, 24, null, null), 'es')).toBe('Salmos 23-24');
        expect(formatPassageReference(PSA(23, 24, 6, 1), 'en')).toBe('Psalms 23:6-24:1');
        // El singular vuelve a leerse como el mismo pasaje.
        const leido = parsePassageReference('Salmo 23:4-6');
        expect(leido.ok && leido.ref).toEqual(PSA(23, 23, 4, 6));
    });

    it('formats chapter range without verses', () => {
        const ref = { bookId: 'HEB' as const, chapterStart: 1, chapterEnd: 2, verseStart: null, verseEnd: null };
        expect(formatPassageReference(ref, 'es')).toBe('Hebreos 1-2');
    });
});

describe('round-trip: parse → format → parse', () => {
    const cases = [
        'Hebreos 1:1-4',
        'Juan 3:16',
        'Salmos 23',
        '1 Corintios 13:4-7',
        'Hebreos 1:1-2:5',
    ];
    for (const input of cases) {
        it(`stable: "${input}"`, () => {
            const first = parsePassageReference(input);
            expect(first.ok).toBe(true);
            if (!first.ok) return;
            const formatted = formatPassageReference(first.ref, 'es');
            const second = parsePassageReference(formatted);
            expect(second.ok).toBe(true);
            if (!second.ok) return;
            expect(second.ref).toEqual(first.ref);
        });
    }
});

describe('getBookById', () => {
    it('returns the book for a valid id', () => {
        expect(getBookById('HEB')?.nameEs).toBe('Hebreos');
    });

    it('returns null for unknown id', () => {
        // @ts-expect-error — purposely passing an invalid id
        expect(getBookById('XXX')).toBeNull();
    });
});

describe('wholeBookPassage', () => {
    it('returns chapter-level reference spanning the whole book', () => {
        const ref = wholeBookPassage('HEB');
        expect(ref).toEqual({
            bookId: 'HEB',
            chapterStart: 1,
            chapterEnd: 13,
            verseStart: null,
            verseEnd: null,
        });
    });

    it('handles single-chapter books (Philemon, 2 John, 3 John, Jude, Obadiah)', () => {
        expect(wholeBookPassage('PHM')).toEqual({
            bookId: 'PHM',
            chapterStart: 1,
            chapterEnd: 1,
            verseStart: null,
            verseEnd: null,
        });
    });

    it('throws for unknown book id', () => {
        // @ts-expect-error — invalid id on purpose
        expect(() => wholeBookPassage('XXX')).toThrow();
    });
});
