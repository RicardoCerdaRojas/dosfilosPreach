import { describe, expect, it } from 'vitest';
import {
    isTextEditionSourceType,
    parseRunningHeader,
    textEditionSheetsForPassage,
} from '../textEditionPages';
import type { PageIndexEntry } from '../documentPageIndex';

/**
 * TP #9 (Santiago 4:11-17, B26): la sugerencia del NA28 fueron 40 hojas de
 * otros libros. Los arranques de hoja son los reales del NA28 de la biblioteca
 * (`firstLine` del índice de hojas, h. 795-806).
 */
const NA28: Array<[number, string]> = [
    [795, '13,20–25 ΠΡΟΣ ΕΒΡΑΙΟΥΣ **20** Ὁ δὲ θεὸς τῆς εἰρήνης'],
    [796, 'Ἰάκωβος θεοῦ καὶ κυρίου Ἰησοῦ Χριστοῦ δοῦλος ταῖς δώδεκα φυλαῖς'],
    [797, '1,14–25 ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ ραστός ἐστιν κακῶν, πειράζει δὲ αὐτὸς οὐδένα. **14** ἕκαστος'],
    [798, 'ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ 1,26–2,5 **26** Εἴ τις δοκεῖ θρησκὸς εἶναι'],
    [799, '2,6–15 ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ ὑμεῖς δὲ ἠτιμάσατε τὸν πτωχόν'],
    [800, 'ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ 2,16–26 **16** εἴπῃ δέ τις αὐτοῖς ἐξ ὑμῶν'],
    [801, '3,1–9 | ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ **3** Μὴ πολλοὶ διδάσκαλοι γίνεσθε'],
    [802, 'ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ | 3,10–4,2 ριον καὶ πατέρα καὶ ἐν αὐτῇ καταρώμεθα'],
    [803, '4,3–12 | ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ λεμεῖτε, ⸂οὐκ ἔχετε⸃ διὰ τὸ μὴ αἰτεῖσθαι ὑμᾶς, **3** αἰτεῖτε'],
    [804, 'ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ | 4,13–5,3 **13** Ἄγε νῦν οἱ λέγοντες· σήμερον ⸀ἢ αὔριον'],
    [805, '5,4–11 | ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ αὐτῶν εἰς μαρτύριον ὑμῖν ἔσται'],
    [806, 'ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ | 5,12–20 **12** Πρὸ πάντων δέ, ἀδελφοί μου'],
    [807, 'ΠΕΤΡΟΥ ΕΠΙΣΤΟΛΗ ΠΡΩΤΗ | 1,1–8 Πέτρος ἀπόστολος Ἰησοῦ Χριστοῦ'],
];

function index(lines: ReadonlyArray<[number, string]>): PageIndexEntry[] {
    return lines.map(([sheet, firstLine]) => ({ sheet, chunkIndices: [sheet], section: null, firstLine, charCount: 1000 }));
}

const stg = (chapter: number, verseStart: number, verseEnd: number) => ({
    bookId: 'JAS' as const, chapterStart: chapter, chapterEnd: chapter, verseStart, verseEnd,
});

describe('parseRunningHeader', () => {
    it('lee el libro y el tramo del encabezado corrido, con el tramo antes o después del título', () => {
        expect(parseRunningHeader('4,3–12 | ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ λεμεῖτε')).toMatchObject({ bookId: 'JAS', start: 4003, end: 4012, continues: true });
        expect(parseRunningHeader('ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ | 4,13–5,3 **13** Ἄγε')).toMatchObject({ bookId: 'JAS', start: 4013, end: 5003, continues: false });
        expect(parseRunningHeader('1,14–25 ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ ραστός')).toMatchObject({ bookId: 'JAS', start: 1014, end: 1025 });
    });

    it('distingue libros que comparten nombre y numerales con keraia', () => {
        expect(parseRunningHeader('ΑΠΟΚΑΛΥΨΙΣ ΙΩΑΝΝΟΥ | 1,13–20')?.bookId).toBe('REV');
        expect(parseRunningHeader('ΙΩΑΝΝΟΥ ΕΠΙΣΤΟΛΗ ΠΡΩΤΗ 2,1–13')?.bookId).toBe('1JN');
        expect(parseRunningHeader('ΠΡΟΣ ΚΟΡΙΝΘΙΟΥΣ Βʹ | 4,1–9')?.bookId).toBe('2CO');
        expect(parseRunningHeader('ΠΡΟΣ ΚΟΡΙΝΘΙΟΥΣ Α′ | 13,1–13')?.bookId).toBe('1CO');
        // Letras latinas en lugar de las griegas, como las deja el extractor.
        expect(parseRunningHeader('KATA MAΘΘAION | 5,1–12')?.bookId).toBe('MAT');
    });

    it('un libro de un capítulo lleva sólo versículos; la hoja que abre con el libro anterior', () => {
        expect(parseRunningHeader('ΙΟΥΔΑ ΕΠΙΣΤΟΛΗ | 3–9')).toMatchObject({ bookId: 'JUD', start: 1003, end: 1009 });
        expect(parseRunningHeader('11–15. 1–2 | ΙΟΥΔΑ ΕΠΙΣΤΟΛΗ')).toMatchObject({ bookId: 'JUD', start: 1001, end: 1002 });
        expect(parseRunningHeader('ΙΩΑΝΝΟΥ ΕΠΙΣΤΟΛΗ ΠΡΩΤΗ 3,16–1,2')).toMatchObject({ bookId: '1JN', start: 1001, end: 1002 });
    });

    it('no toma por encabezado una referencia cruzada ni el texto', () => {
        expect(parseRunningHeader('Jas 4,11 · Mt 7,1! · R 2,1')).toBeNull();
        expect(parseRunningHeader('Ἰάκωβος θεοῦ καὶ κυρίου Ἰησοῦ Χριστοῦ δοῦλος')).toBeNull();
        // Un libro de varios capítulos no se lee con versículos sueltos.
        expect(parseRunningHeader('ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ | 3–9')).toBeNull();
        // El encabezado abre la hoja: un título con cifras más adentro no cuenta.
        expect(parseRunningHeader('ὁ δὲ λόγος ἐγένετο πρὸς αὐτοὺς καὶ εἶπεν ΙΑΚΩΒΟΥ 4,11')).toBeNull();
    });
});

describe('textEditionSheetsForPassage (B26)', () => {
    it('Santiago 4:11-17 en el NA28: sólo las hojas 803 y 804', () => {
        expect(textEditionSheetsForPassage(index(NA28), stg(4, 11, 17))).toEqual([{ start: 803, end: 804 }]);
    });

    it('no propone hojas de otros libros aunque su tramo de versículos coincida', () => {
        const otros: Array<[number, string]> = [
            [600, 'ΠΡΟΣ ΡΩΜΑΙΟΥΣ | 4,9–17 **9** ὁ μακαρισμὸς οὖν οὗτος'],
            [700, 'ΚΑΤΑ ΛΟΥΚΑΝ | 4,11–20 **11** καὶ ὅτι ἐπὶ χειρῶν'],
            ...NA28,
        ];
        expect(textEditionSheetsForPassage(index(otros), stg(4, 11, 17))).toEqual([{ start: 803, end: 804 }]);
    });

    it('suma la hoja que empieza a mitad del último versículo del pasaje', () => {
        // 4:2 sigue en la 803 («λεμεῖτε, …» antes del **3**).
        expect(textEditionSheetsForPassage(index(NA28), stg(4, 1, 2))).toEqual([{ start: 802, end: 803 }]);
    });

    it('la portadilla del libro, que no trae encabezado, cuenta para el comienzo', () => {
        expect(textEditionSheetsForPassage(index(NA28), stg(1, 1, 12))).toEqual([{ start: 796, end: 796 }]);
        // Pero no para un pasaje que empieza después de ella.
        expect(textEditionSheetsForPassage(index(NA28), stg(1, 26, 27))).toEqual([{ start: 798, end: 798 }]);
    });

    it('una hoja sin encabezado entre dos del libro entra si el pasaje cae ahí', () => {
        const conHueco = NA28.map(([sheet, line]): [number, string] => (sheet === 803 ? [803, 'λεμεῖτε, ⸂οὐκ ἔχετε⸃'] : [sheet, line]));
        expect(textEditionSheetsForPassage(index(conHueco), stg(4, 5, 8))).toEqual([{ start: 803, end: 803 }]);
    });

    it('sin encabezados del libro, no propone nada', () => {
        expect(textEditionSheetsForPassage(index(NA28.filter(([s]) => s < 796 || s > 806)), stg(4, 11, 17))).toEqual([]);
    });
});

describe('isTextEditionSourceType', () => {
    it('el texto y su aparato, no un comentario textual ni un comentario', () => {
        expect(isTextEditionSourceType('biblical-text-edition')).toBe(true);
        expect(isTextEditionSourceType('critical-apparatus')).toBe(true);
        expect(isTextEditionSourceType('textual-commentary')).toBe(false);
        expect(isTextEditionSourceType('commentary-critical')).toBe(false);
        expect(isTextEditionSourceType(undefined)).toBe(false);
    });
});
