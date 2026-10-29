import { describe, it, expect } from 'vitest';
import { hebrewSessionTarget } from '../sessionTarget';

/**
 * Los enlaces de sesión del escritorio del proyecto llevan `?sessionId=` y el
 * tutor de hebreo abría vacío (TP #9). La sesión guarda el pasaje como se
 * mostró: «Jonás 3:4», «1 Samuel 22:17» (leído en producción, 2026-10-28).
 */
const CATALOGO = [
    { morphhbKey: 'Gen', nameSpanish: 'Génesis', nameEnglish: 'Genesis' },
    { morphhbKey: '1Sam', nameSpanish: '1 Samuel', nameEnglish: '1 Samuel' },
    { morphhbKey: '2Sam', nameSpanish: '2 Samuel', nameEnglish: '2 Samuel' },
    { morphhbKey: 'Jonah', nameSpanish: 'Jonás', nameEnglish: 'Jonah' },
];

describe('hebrewSessionTarget', () => {
    it('el nombre en español, con tildes y números', () => {
        expect(hebrewSessionTarget('Jonás 3:4', CATALOGO)).toEqual({ book: 'Jonah', chapter: 3, verse: 4 });
        expect(hebrewSessionTarget('1 Samuel 22:17', CATALOGO)).toEqual({ book: '1Sam', chapter: 22, verse: 17 });
        expect(hebrewSessionTarget('  génesis 1:1 ', CATALOGO)).toEqual({ book: 'Gen', chapter: 1, verse: 1 });
    });

    it('también la clave de morphhb o el nombre en inglés', () => {
        expect(hebrewSessionTarget('Jonah 1:1', CATALOGO)).toEqual({ book: 'Jonah', chapter: 1, verse: 1 });
        expect(hebrewSessionTarget('2Sam 7:12', CATALOGO)).toEqual({ book: '2Sam', chapter: 7, verse: 12 });
    });

    it('lo que no se reconoce no abre nada', () => {
        expect(hebrewSessionTarget('Samuel 1:1', CATALOGO)).toBeNull();
        // El nombre entero, no una parte: «Libro de Jonás» no es Jonás.
        expect(hebrewSessionTarget('Libro de Jonás 3:4', CATALOGO)).toBeNull();
        expect(hebrewSessionTarget('Jonás 3', CATALOGO)).toBeNull();
        expect(hebrewSessionTarget('Jonás 0:4', CATALOGO)).toBeNull();
        expect(hebrewSessionTarget('', CATALOGO)).toBeNull();
        expect(hebrewSessionTarget(undefined, CATALOGO)).toBeNull();
    });
});
