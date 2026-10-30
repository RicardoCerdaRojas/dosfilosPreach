import { describe, expect, it } from 'vitest';
import { formatReferenceShortNote, referenceAbbreviationOf, referenceKindOfSourceType, sourceTypeWithoutIbid } from '../referenceWorks';

/** Guía de TMS 2024–2025, «Léxicos y gramáticas» (hoja 50) y nota 31. Cursivas medidas en su PDF. */
describe('referenceAbbreviationOf — las ocho obras de la guía, por el título', () => {
    it('REGRESIÓN TI #2 (B66): Waltke y O’Connor es *IBHS*, gramática, en cursiva', () => {
        expect(referenceAbbreviationOf({ author: 'Bruce K. Waltke y M. O’Connor', title: 'An Introduction to Biblical Hebrew Syntax' }))
            .toEqual({ abbreviation: 'IBHS', italic: true, kind: 'grammar' });
    });

    it('cursiva las de título (HALOT, BHRG); redonda las de autor (BDAG, BDB, GKC)', () => {
        expect(referenceAbbreviationOf({ title: 'The Hebrew and Aramaic Lexicon of the Old Testament' })).toEqual({ abbreviation: 'HALOT', italic: true, kind: 'lexicon' });
        expect(referenceAbbreviationOf({ title: 'A Biblical Hebrew Reference Grammar' })!.italic).toBe(true);
        expect(referenceAbbreviationOf({ title: 'A Greek-English Lexicon of the New Testament and Other Early Christian Literature' })).toEqual({ abbreviation: 'BDAG', italic: false, kind: 'lexicon' });
        expect(referenceAbbreviationOf({ title: 'The New Brown, Driver, and Briggs Hebrew and English Lexicon of the Old Testament' })!.abbreviation).toBe('BDB');
        expect(referenceAbbreviationOf({ title: 'Gesenius’ Hebrew Grammar' })).toEqual({ abbreviation: 'GKC', italic: false, kind: 'grammar' });
    });

    it('«A Grammar of Biblical Hebrew» es Joüon solo si el autor lo es', () => {
        expect(referenceAbbreviationOf({ author: 'Paul Joüon y Takamitsu Muraoka', title: 'A Grammar of Biblical Hebrew' })!.abbreviation).toBe('Joüon');
        expect(referenceAbbreviationOf({ author: 'Otro Autor', title: 'A Grammar of Biblical Hebrew' })).toBeNull();
    });

    it('un comentario no es obra de referencia; la abreviatura escrita manda', () => {
        expect(referenceAbbreviationOf({ title: 'A Commentary on the Psalms' })).toBeNull();
        expect(referenceAbbreviationOf({ title: 'Lo que sea', abbreviation: 'ibhs' })).toEqual({ abbreviation: 'IBHS', italic: true, kind: 'grammar' });
        expect(referenceAbbreviationOf({ title: 'Theological Wordbook', abbreviation: 'TWOT' })).toEqual({ abbreviation: 'TWOT', italic: false, kind: null });
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
