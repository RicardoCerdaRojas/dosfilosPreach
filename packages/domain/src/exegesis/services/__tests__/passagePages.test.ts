import { describe, expect, it } from 'vitest';
import { passageReferenceQuery, rankPassageSheets, verseInPassage, type PassagePageHit } from '../passagePages';

const SANTIAGO = { bookId: 'JAS' as const, chapterStart: 2, chapterEnd: 2, verseStart: 1, verseEnd: 13 };

describe('passageReferenceQuery — cómo puede estar escrito el libro', () => {
    it('trae las grafías del canon, que son las que los libros usan', () => {
        const q = passageReferenceQuery(SANTIAGO)!;
        // Wallace escribe «Santiago 2:9»; Porter, «Jas. 5:2-3»; Tuggy, «Stg. 2:8».
        expect(q.names).toEqual(expect.arrayContaining(['santiago', 'james', 'stg', 'jas']));
    });

    it('descarta las grafías de menos de tres letras', () => {
        // «sg» por Santiago cae dentro de cualquier palabra: el pasaje que
        // devuelve es ruido.
        expect(passageReferenceQuery(SANTIAGO)!.names).not.toContain('sg');
        expect(passageReferenceQuery({ ...SANTIAGO, bookId: 'HEB' })!.names).not.toContain('he');
    });

    it('no repite una grafía que el canon nombra dos veces', () => {
        const names = passageReferenceQuery(SANTIAGO)!.names;
        expect(new Set(names).size).toBe(names.length);
    });
});

describe('verseInPassage — qué versículo citado cuenta', () => {
    const q = passageReferenceQuery(SANTIAGO)!;

    it('dentro del rango, sí; fuera, no', () => {
        expect(verseInPassage(q, 2, 9)).toBe(true);
        expect(verseInPassage(q, 2, 1)).toBe(true);
        expect(verseInPassage(q, 2, 13)).toBe(true);
        expect(verseInPassage(q, 2, 14)).toBe(false);
        expect(verseInPassage(q, 5, 2)).toBe(false);
    });

    it('un pasaje de varios capítulos sólo acota los extremos', () => {
        // «Juan 9:13—10:5»: el 9 desde el 13, el 10 hasta el 5, y lo del
        // medio entero.
        const juan = passageReferenceQuery({ bookId: 'JHN', chapterStart: 9, chapterEnd: 10, verseStart: 13, verseEnd: 5 })!;
        expect(verseInPassage(juan, 9, 12)).toBe(false);
        expect(verseInPassage(juan, 9, 40)).toBe(true);
        expect(verseInPassage(juan, 10, 5)).toBe(true);
        expect(verseInPassage(juan, 10, 6)).toBe(false);
    });

    it('una referencia de capítulo entero admite cualquier versículo', () => {
        const cap = passageReferenceQuery({ bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: null, verseEnd: null })!;
        expect(verseInPassage(cap, 2, 1)).toBe(true);
        expect(verseInPassage(cap, 2, 26)).toBe(true);
        expect(verseInPassage(cap, 3, 1)).toBe(false);
    });
});

describe('rankPassageSheets — qué hoja se propone primero', () => {
    const hoja = (sheet: number, verses: number[], count: number): PassagePageHit =>
        ({ sheet, verses, count, snippet: '', section: null });

    it('manda cuántos versículos DISTINTOS nombra, no cuántas veces', () => {
        // Una hoja que discute 2:2 y 2:4 juntos habla del pasaje; otra que
        // repite «Stg. 2:8» en una lista de apariciones lo usa de ejemplo.
        const [primera] = rankPassageSheets([hoja(586, [8], 5), hoja(272, [2, 4], 2)]);
        expect(primera!.sheet).toBe(272);
    });

    it('a igual cantidad de versículos manda la cantidad de apariciones', () => {
        const [primera] = rankPassageSheets([hoja(10, [9], 1), hoja(20, [9], 4)]);
        expect(primera!.sheet).toBe(20);
    });

    it('con todo igual, la hoja más temprana: la lista no baila entre llamadas', () => {
        expect(rankPassageSheets([hoja(90, [9], 1), hoja(15, [9], 1)])[0]!.sheet).toBe(15);
    });

    it('se corta en el tope, porque más allá nadie revisa', () => {
        const muchas = Array.from({ length: 65 }, (_, i) => hoja(i + 1, [9], 1));
        expect(rankPassageSheets(muchas)).toHaveLength(40);
    });
});
