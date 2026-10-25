import { describe, expect, it } from 'vitest';
import { passageHasAramaic } from '../aramaicSpans';
import type { PassageReference } from '../canon/passage-reference';

function ref(
    bookId: string, chapterStart: number, verseStart: number | null,
    chapterEnd = chapterStart, verseEnd: number | null = verseStart,
): PassageReference {
    return { bookId: bookId as PassageReference['bookId'], chapterStart, chapterEnd, verseStart, verseEnd };
}

describe('passageHasAramaic', () => {
    it('Esd 4:8-24 es arameo', () => {
        expect(passageHasAramaic(ref('EZR', 4, 8, 4, 24))).toBe(true);
    });

    it('Esd 4:6-24 empieza en hebreo pero toca arameo', () => {
        expect(passageHasAramaic(ref('EZR', 4, 6, 4, 24))).toBe(true);
    });

    it('Esd 1:1-4 y 4:1-7 son hebreo', () => {
        expect(passageHasAramaic(ref('EZR', 1, 1, 1, 4))).toBe(false);
        expect(passageHasAramaic(ref('EZR', 4, 1, 4, 7))).toBe(false);
    });

    it('el hueco hebreo de Esdras (6:19–7:11) no es arameo; sus bordes sí', () => {
        expect(passageHasAramaic(ref('EZR', 6, 19, 7, 11))).toBe(false);
        expect(passageHasAramaic(ref('EZR', 6, 18, 6, 22))).toBe(true);
        expect(passageHasAramaic(ref('EZR', 7, 1, 7, 12))).toBe(true);
        expect(passageHasAramaic(ref('EZR', 7, 27, 7, 28))).toBe(false);
    });

    it('un capítulo entero sin versículos cuenta', () => {
        expect(passageHasAramaic(ref('EZR', 5, null))).toBe(true);
        expect(passageHasAramaic(ref('DAN', 2, null))).toBe(true);
        expect(passageHasAramaic(ref('DAN', 8, null))).toBe(false);
        expect(passageHasAramaic(ref('EZR', 1, null, 10, null))).toBe(true);
    });

    it('los versículos sueltos de Génesis y Jeremías', () => {
        expect(passageHasAramaic(ref('GEN', 31, 47))).toBe(true);
        expect(passageHasAramaic(ref('GEN', 31, 46))).toBe(false);
        expect(passageHasAramaic(ref('JER', 10, 1, 10, 16))).toBe(true);
        expect(passageHasAramaic(ref('JER', 10, 12, 10, 16))).toBe(false);
    });

    it('Daniel: 2:1-3 es hebreo, 2:4 ya es arameo', () => {
        expect(passageHasAramaic(ref('DAN', 2, 1, 2, 3))).toBe(false);
        expect(passageHasAramaic(ref('DAN', 2, 1, 2, 4))).toBe(true);
    });

    it('otro libro con los mismos números no', () => {
        expect(passageHasAramaic(ref('NEH', 4, 8, 4, 24))).toBe(false);
        expect(passageHasAramaic(ref('JAS', 4, 8))).toBe(false);
    });
});
