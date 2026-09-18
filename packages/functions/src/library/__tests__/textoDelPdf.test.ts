import { describe, expect, it } from 'vitest';
import { renglonesDePagina } from '../textoDelPdf';

/** Fragmento de la capa de texto, como los entrega pdfjs. */
const item = (str: string, y: number, hasEOL = false) => ({ str, hasEOL, transform: [1, 0, 0, 1, 0, y] });

describe('renglonesDePagina', () => {
    it('separa renglones por su posición vertical', () => {
        const texto = renglonesDePagina([
            item('4488', 700), item('מנה', 700), item('Mina, unidad de peso', 700),
            item('4491', 686), item('מנהג', 686), item('Manera de conducir', 686),
        ]);
        expect(texto.split('\n')).toEqual([
            '4488 מנה Mina, unidad de peso',
            '4491 מנהג Manera de conducir',
        ]);
    });

    it('lo que cae en el mismo renglón no se parte por diferencias mínimas', () => {
        // Los superíndices y las vocales se desvían un punto o dos.
        const texto = renglonesDePagina([item('נֶפֶשׁ', 500), item('Ser,', 501.4), item('vida', 499.2)]);
        expect(texto).toBe('נֶפֶשׁ Ser, vida');
    });

    it('respeta el orden en que el documento declara los fragmentos', () => {
        // No reordena: una línea hebrea ya viene en orden lógico.
        expect(renglonesDePagina([item('שׁוּב', 300), item('Volver', 300)])).toBe('שׁוּב Volver');
    });

    it('un renglón vacío no deja una línea en blanco', () => {
        expect(renglonesDePagina([item('', 200), item('texto', 180)])).toBe('texto');
    });

    it('sin fragmentos, no hay texto', () => {
        expect(renglonesDePagina([])).toBe('');
    });
});
