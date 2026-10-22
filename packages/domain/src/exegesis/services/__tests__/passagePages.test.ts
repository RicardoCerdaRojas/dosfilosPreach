import { describe, expect, it } from 'vitest';
import { passageReferenceQuery, proposePassageSheets, questionVerseNumbers, rankPassageSheets, verseInPassage, type PassagePageHit } from '../passagePages';

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

/**
 * TP #8 (2026-10-21, fase 8a, A1). Los datos son los de producción ese día:
 * las hojas de Wallace (Greek Grammar Beyond the Basics) que nombran Stg 4.
 */
describe('proposePassageSheets · las hojas de los versículos con pregunta', () => {
    const hit = (sheet: number, verses: number[], count = verses.length): PassagePageHit =>
        ({ sheet, verses, count, snippet: '', section: null });
    const wallace = [hit(569, [5, 6]), hit(633, [2]), hit(698, [2]), hit(900, [7])];

    it('propone las tres hojas de Wallace que nombran 4:2 y 4:5, y no la de 4:7', () => {
        expect(proposePassageSheets(wallace, [1, 2, 3, 5])).toEqual([
            { start: 569, end: 569 }, { start: 633, end: 633 }, { start: 698, end: 698 },
        ]);
    });

    it('cubre primero cada versículo con pregunta aunque otra hoja nombre más veces otro', () => {
        const hits = [hit(10, [2], 9), hit(11, [2], 8), hit(12, [2], 7), hit(50, [5], 1)];
        expect(proposePassageSheets(hits, [2, 5], 2)).toEqual([{ start: 10, end: 10 }, { start: 50, end: 50 }]);
    });

    it('sin versículos con pregunta sirve cualquier hoja del pasaje', () => {
        expect(proposePassageSheets(wallace, null)).toHaveLength(4);
    });

    it('funde hojas contiguas en un tramo', () => {
        expect(proposePassageSheets([hit(584, [1]), hit(585, [1])], [1])).toEqual([{ start: 584, end: 585 }]);
    });
});

describe('questionVerseNumbers', () => {
    const preguntas = [
        { verses: [{ chapter: 4, verse: 1 }] },
        { verses: [{ chapter: 4, verse: 3 }, { chapter: 4, verse: 2 }] },
        { verses: [{ chapter: 4, verse: 5 }] },
    ];

    it('junta los versículos que nombran las preguntas, también los de evidencia', () => {
        expect(questionVerseNumbers(preguntas, { chapterStart: 4, chapterEnd: 4 })).toEqual([1, 2, 3, 5]);
    });

    it('con varios capítulos no filtra: las hojas traen el versículo sin capítulo', () => {
        expect(questionVerseNumbers(preguntas, { chapterStart: 3, chapterEnd: 4 })).toBeNull();
    });

    it('sin preguntas no filtra', () => {
        expect(questionVerseNumbers([], { chapterStart: 4, chapterEnd: 4 })).toBeNull();
    });
});
