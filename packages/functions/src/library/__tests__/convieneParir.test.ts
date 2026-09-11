import { describe, it, expect } from 'vitest';
import { convieneParir, MIN_PAGINAS_POR_TANDA } from '../partirTanda';

/**
 * Caso real: una gramática hebrea de 170 páginas se parte en tandas de 60 y la
 * primera vuelve con `finishReason=MAX_TOKENS`. Sesenta páginas de hebreo
 * vocalizado con su aparato no caben en una respuesta —y el razonamiento del
 * modelo sale del mismo presupuesto—. La extracción entera fallaba por eso.
 *
 * Un tamaño fijo no sirve para los dos extremos: una novela entra de a sesenta
 * páginas y una gramática hebrea no.
 */
describe('convieneParir', () => {
    it('parte cuando la respuesta no entró', () => {
        expect(convieneParir(new Error('Gemini stopped early (finishReason=MAX_TOKENS); response truncated'), 60))
            .toBe(true);
    });

    it('NO parte por otros fallos: tandas más chicas no los arreglan', () => {
        // Un PDF corrupto o la API caída fallan igual con la mitad, y
        // reintentar gasta páginas del usuario para volver a fallar.
        expect(convieneParir(new Error('Failed to parse Gemini response as JSON'), 60)).toBe(false);
        expect(convieneParir(new Error('ECONNRESET'), 60)).toBe(false);
        expect(convieneParir(new Error('Gemini returned no pages'), 60)).toBe(false);
    });

    it('deja de partir cuando ya no queda nada que partir', () => {
        // Si ocho páginas no entran, el problema es otro.
        expect(convieneParir(new Error('MAX_TOKENS'), MIN_PAGINAS_POR_TANDA * 2 - 1)).toBe(false);
        expect(convieneParir(new Error('MAX_TOKENS'), MIN_PAGINAS_POR_TANDA * 2)).toBe(true);
    });

    it('reconoce el mensaje venga como venga', () => {
        expect(convieneParir(new Error('response truncated'), 60)).toBe(true);
        expect(convieneParir('finishReason=max_tokens', 60)).toBe(true);
    });

    it('no explota con lo que no es un error', () => {
        expect(convieneParir(null, 60)).toBe(false);
        expect(convieneParir(undefined, 60)).toBe(false);
    });
});
