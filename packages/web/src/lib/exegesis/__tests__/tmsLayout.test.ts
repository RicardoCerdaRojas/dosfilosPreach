import { describe, expect, it } from 'vitest';
import { isMostlyHebrew, splitHebrew, TMS } from '../tmsLayout';

describe('splitHebrew', () => {
    it('separa el hebreo del texto latino', () => {
        const s = splitHebrew('El verbo שׁוב significa volver');
        expect(s.map(x => x.hebrew)).toEqual([false, true, false]);
        expect(s[1]!.text).toBe('שׁוב');
    });

    it('una frase hebrea viaja entera, con espacios de no separación', () => {
        // Sin esto Word parte la frase entre renglones y el bidi la reordena.
        const [seg] = splitHebrew('נַפְשִׁי יְשׁוֹבֵב');
        expect(seg!.hebrew).toBe(true);
        expect(seg!.text).toContain(' ');
        expect(seg!.text).not.toContain(' ');
    });

    it('un texto sin hebreo vuelve como un solo tramo', () => {
        expect(splitHebrew('solo latín')).toEqual([{ text: 'solo latín', hebrew: false }]);
    });
});

describe('isMostlyHebrew', () => {
    it('reconoce una línea hebrea aunque traiga puntuación y números', () => {
        expect(isMostlyHebrew('יְהוָה רֹעִי לֹא אֶחְסָר׃ (23:1)')).toBe(true);
    });

    it('una frase castellana con una palabra hebrea no es hebrea', () => {
        expect(isMostlyHebrew('El término שׁוב aparece dos veces en el salmo')).toBe(false);
    });

    it('sin letras, no', () => {
        expect(isMostlyHebrew('123 — ...')).toBe(false);
    });
});

describe('TMS', () => {
    it('doble espacio y sangría de media pulgada, que es lo que pide la guía', () => {
        expect(TMS.doubleLine).toBe(480);
        expect(TMS.firstLineIndent).toBe(720);
        expect(TMS.margin).toBe(1440);
    });
});
