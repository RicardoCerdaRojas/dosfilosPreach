import { describe, expect, it } from 'vitest';
import { censusOf, contarDireccionHebrea } from '../scriptCensus';

/**
 * Un libro puede traer todo su hebreo y traerlo al revés. El léxico de
 * Ortiz extrajo 79.687 caracteres hebreos —sano según el censo— con las
 * palabras invertidas letra a letra.
 */
describe('contarDireccionHebrea', () => {
    it('el hebreo correcto no tiene letras finales al principio', () => {
        // «אֲגָם» (estanque) y «נַפְשִׁי» (mi ser), bien escritas.
        const r = contarDireccionHebrea('אֲגָם נַפְשִׁי יְשׁוֹבֵב');
        expect(r.hebrewWords).toBe(3);
        expect(r.hebrewFinalAtStart).toBe(0);
    });

    it('la misma palabra invertida se delata: «םָגֲא» empieza por mem final', () => {
        const r = contarDireccionHebrea('םָגֲא');
        expect(r.hebrewWords).toBe(1);
        expect(r.hebrewFinalAtStart).toBe(1);
    });

    it('una consonante sola no cuenta: primera y última son la misma posición', () => {
        expect(contarDireccionHebrea('ם ב ל')).toEqual({ hebrewWords: 0, hebrewFinalAtStart: 0 });
    });

    it('un texto sin hebreo no aporta palabras', () => {
        expect(contarDireccionHebrea('The Hiphil stem, p. 440')).toEqual({ hebrewWords: 0, hebrewFinalAtStart: 0 });
    });

    it('el censo lleva los dos números, para que el dominio juzgue', () => {
        const c = censusOf('אֲגָם םָגֲא');
        expect(c.hebrewWords).toBe(2);
        expect(c.hebrewFinalAtStart).toBe(1);
    });
});
