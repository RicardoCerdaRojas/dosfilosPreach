import { describe, expect, it } from '@jest/globals';

import { unitLinesFrom } from '../SelectableParagraph';

describe('renglones de cada oración', () => {
    // Palabras: oración 0 en el renglón 0; oración 1 empieza en el renglón 0 y sigue en el 1.
    const rects = new Map([
        [0, { y: 0, height: 40 }],
        [1, { y: 0, height: 40 }],
        [2, { y: 0, height: 40 }],
        [3, { y: 40, height: 40 }],
    ]);

    it('cada oración va del renglón donde empieza al renglón donde termina', () => {
        expect(unitLinesFrom([0, 0, 1, 1], 2, rects)).toEqual([
            { top: 0, bottom: 40 },
            { top: 0, bottom: 80 },
        ]);
    });

    it('si falta medir una palabra, todavía no hay respuesta', () => {
        expect(unitLinesFrom([0, 0, 1, 1, 1], 2, rects)).toBeNull();
    });

    it('una oración sin palabras se pega al final de la anterior, sin alto', () => {
        expect(unitLinesFrom([0, 0], 2, rects)).toEqual([
            { top: 0, bottom: 40 },
            { top: 40, bottom: 40 },
        ]);
    });
});
