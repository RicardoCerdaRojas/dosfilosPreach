import { describe, expect, it } from 'vitest';
import { formatReferenceShortNote, lexiconEntryOf, referenceAbbreviationOf, referenceKindOfSourceType, sourceTypeWithoutIbid } from '../referenceWorks';

/** Guía de TMS 2024–2025, «Léxicos y gramáticas» (hoja 50) y nota 31. Cursivas medidas en su PDF. */
describe('referenceAbbreviationOf — las ocho obras de la guía, por el título', () => {
    it('REGRESIÓN TI #2 (B66): Waltke y O’Connor es *IBHS*, gramática, en cursiva', () => {
        expect(referenceAbbreviationOf({ author: 'Bruce K. Waltke y M. O’Connor', title: 'An Introduction to Biblical Hebrew Syntax' }))
            .toEqual({ abbreviation: 'IBHS', italic: true, kind: 'grammar' });
    });

    it('cursiva las de título (HALOT, BHRG); redonda las de autor (BDAG, BDB, GKC)', () => {
        expect(referenceAbbreviationOf({ author: 'Ludwig Koehler y Walter Baumgartner', title: 'The Hebrew and Aramaic Lexicon of the Old Testament' })).toEqual({ abbreviation: 'HALOT', italic: true, kind: 'lexicon' });
        expect(referenceAbbreviationOf({ author: 'Christo H. J. van der Merwe', title: 'A Biblical Hebrew Reference Grammar' })!.italic).toBe(true);
        expect(referenceAbbreviationOf({ author: 'Walter Bauer', title: 'A Greek-English Lexicon of the New Testament and Other Early Christian Literature' })).toEqual({ abbreviation: 'BDAG', italic: false, kind: 'lexicon' });
        expect(referenceAbbreviationOf({ author: 'Francis Brown, S. R. Driver y Charles A. Briggs', title: 'The New Brown, Driver, and Briggs Hebrew and English Lexicon of the Old Testament' })!.abbreviation).toBe('BDB');
        expect(referenceAbbreviationOf({ author: 'Wilhelm Gesenius', title: 'Gesenius’ Hebrew Grammar' })).toEqual({ abbreviation: 'GKC', italic: false, kind: 'grammar' });
        expect(referenceAbbreviationOf({ author: 'Wilhelm Gesenius', title: "Gesenius's Hebrew Grammar" })!.abbreviation).toBe('GKC');
    });

    it('REVISIÓN: obras con el mismo título y otro autor no se confunden (Louw–Nida, Thayer, Holladay)', () => {
        expect(referenceAbbreviationOf({ author: 'Johannes P. Louw y Eugene A. Nida', title: 'Greek-English Lexicon of the New Testament: Based on Semantic Domains' })).toBeNull();
        expect(referenceAbbreviationOf({ author: 'Joseph Henry Thayer', title: 'A Greek-English Lexicon of the New Testament' })).toBeNull();
        expect(referenceAbbreviationOf({ author: 'William L. Holladay', title: 'A Concise Hebrew and Aramaic Lexicon of the Old Testament' })).toBeNull();
    });

    it('«A Grammar of Biblical Hebrew» es Joüon solo si el autor lo es', () => {
        expect(referenceAbbreviationOf({ author: 'Paul Joüon y Takamitsu Muraoka', title: 'A Grammar of Biblical Hebrew' })!.abbreviation).toBe('Joüon');
        expect(referenceAbbreviationOf({ author: 'Otro Autor', title: 'A Grammar of Biblical Hebrew' })).toBeNull();
    });

    it('un comentario no es obra de referencia; la abreviatura escrita manda', () => {
        expect(referenceAbbreviationOf({ title: 'A Commentary on the Psalms' })).toBeNull();
        expect(referenceAbbreviationOf({ title: 'Lo que sea', abbreviation: 'ibhs' })).toEqual({ abbreviation: 'IBHS', italic: true, kind: 'grammar' });
        expect(referenceAbbreviationOf({ title: 'Theological Wordbook', abbreviation: 'BDAG' })).toEqual({ abbreviation: 'BDAG', italic: false, kind: 'lexicon' });
        // Fuera de la tabla, la cursiva la decide quien la escribe: entre asteriscos.
        expect(referenceAbbreviationOf({ title: 'Theological Wordbook', abbreviation: '*TWOT*' })).toEqual({ abbreviation: 'TWOT', italic: true, kind: null });
        expect(referenceAbbreviationOf({ title: 'Otra', abbreviation: 'ABC' })!.italic).toBe(false);
    });
});

describe('formatReferenceShortNote — las formas abreviadas de la guía', () => {
    it('léxico: «entrada», abreviatura, tomo y página', () => {
        expect(formatReferenceShortNote({ abbreviation: 'HALOT', italic: true }, 'lexicon', 'כָּבוֹד', '2:457')).toBe('«כָּבוֹד», *HALOT*, 2:457');
        expect(formatReferenceShortNote({ abbreviation: 'BDAG', italic: false }, 'lexicon', 'ἔλεος', 'p. 316')).toBe('«ἔλεος», BDAG, 316');
        expect(formatReferenceShortNote({ abbreviation: 'HALOT', italic: true }, 'lexicon', null, '457')).toBe('*HALOT*, 457');
    });

    it('gramática: la sección sin coma (GKC §18); la página con coma', () => {
        expect(formatReferenceShortNote({ abbreviation: 'GKC', italic: false }, 'grammar', null, '§18')).toBe('GKC §18');
        expect(formatReferenceShortNote({ abbreviation: 'IBHS', italic: true }, 'grammar', null, 'p. 436')).toBe('*IBHS*, 436');
        expect(formatReferenceShortNote({ abbreviation: 'IBHS', italic: true }, 'grammar', null, null)).toBe('*IBHS*');
    });
});

describe('el tipo de fuente', () => {
    it('nota 31: léxicos, diccionarios y artículos no usan «Ibid.»; una gramática o un comentario, sí', () => {
        expect(sourceTypeWithoutIbid('lexicon-technical')).toBe(true);
        expect(sourceTypeWithoutIbid('theological-dictionary')).toBe(true);
        expect(sourceTypeWithoutIbid('journal-article')).toBe(true);
        expect(sourceTypeWithoutIbid('grammar-syntax')).toBe(false);
        expect(sourceTypeWithoutIbid('commentary-critical')).toBe(false);
        expect(referenceKindOfSourceType('grammar-syntax')).toBe('grammar');
        expect(referenceKindOfSourceType('commentary-critical')).toBeNull();
    });
});

describe('lexiconEntryOf — la entrada solo cuando la cita la dice con «s.v.»', () => {
    it('lee la entrada, con o sin comillas', () => {
        expect(lexiconEntryOf('BDAG, s.v. σοφία')).toBe('σοφία');
        expect(lexiconEntryOf('Koehler, s.v. "רעה", p. 1258')).toBe('רעה');
    });
    it('REVISIÓN: el título de la cita (el nombre de la obra) no es una entrada', () => {
        expect(lexiconEntryOf('Brown, "Brown-Driver-Briggs Hebrew Lexicon", p. 945')).toBeNull();
    });
});
