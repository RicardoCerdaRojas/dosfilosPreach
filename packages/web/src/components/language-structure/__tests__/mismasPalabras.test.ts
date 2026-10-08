import { describe, it, expect } from 'vitest';
import { mismasPalabras } from '../mismasPalabras';

const datos = (...ts: string[]) => ts.map((t, i) => ({ r: `9!${i + 1}`, t, l: t })) as never;

describe('¿mismo versículo, palabra por palabra?', () => {
    it('iguales salvo puntuación y marcas del aparato', () => {
        expect(mismasPalabras(datos('εἰ', 'δὲ', 'προσωπολημπτεῖτε,'), [{ text: 'εἰ' }, { text: 'δὲ' }, { text: '⸀προσωπολημπτεῖτε' }])).toBe(true);
    });
    it('misma cantidad, otras palabras (el versículo anterior mientras carga): no', () => {
        expect(mismasPalabras(datos('εἰ', 'δὲ', 'προσωπολημπτεῖτε'), [{ text: 'καὶ' }, { text: 'ὁ' }, { text: 'λόγος' }])).toBe(false);
    });
    it('sin tokens o con otra cantidad: no', () => {
        expect(mismasPalabras(datos('εἰ'), undefined)).toBe(false);
        expect(mismasPalabras(datos('εἰ', 'δὲ'), [{ text: 'εἰ' }])).toBe(false);
    });
});
