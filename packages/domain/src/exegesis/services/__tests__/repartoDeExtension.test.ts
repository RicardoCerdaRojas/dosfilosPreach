import { describe, it, expect } from 'vitest';
import { REPARTO, wordsForFramingSection, wordsPerVerseTarget } from '../paperLength';

describe('reparto de la extensión', () => {
    it('las tres partes suman el trabajo entero', () => {
        // El invariante que ata los tres números. Ajustar el de los versos y
        // dejar los otros dos donde estaban hace que el presupuesto que
        // reciben los compositores deje de sumar lo que la rúbrica pide, y eso
        // no se ve leyendo la tabla: se ve sumándola.
        const suma = REPARTO.versos + REPARTO.introduccion + REPARTO.conclusion;
        expect(suma).toBeCloseTo(1, 10);
    });

    it('el caso real: 2 páginas repartidas entre tres versículos', () => {
        // Santiago 2:1-13 con rúbrica de 2-3 páginas. El trabajo salió con
        // ~2.400 palabras por versículo.
        expect(wordsPerVerseTarget({ unit: 'pages', min: 2, max: 3 }, 3)).toBe(150);
        expect(wordsForFramingSection({ unit: 'pages', min: 2, max: 3 }, 'introduccion')).toBe(50);
        expect(wordsForFramingSection({ unit: 'pages', min: 2, max: 3 }, 'conclusion')).toBe(50);
    });

    it('sin extensión declarada no se inventa un objetivo', () => {
        expect(wordsForFramingSection(null, 'introduccion')).toBeNull();
        expect(wordsForFramingSection({ unit: 'pages', min: null, max: null }, 'conclusion')).toBeNull();
    });

    it('un presupuesto nunca baja de 50 palabras', () => {
        // Redondear a cero dejaría al compositor con la instrucción de no
        // escribir nada, que es peor que no darle ninguna.
        expect(wordsForFramingSection({ unit: 'words', min: 100, max: null }, 'introduccion')).toBe(50);
    });

    it('un trabajo largo reparte en proporción', () => {
        expect(wordsPerVerseTarget({ unit: 'pages', min: 20, max: 25 }, 10)).toBe(400);
        expect(wordsForFramingSection({ unit: 'pages', min: 20, max: 25 }, 'introduccion')).toBe(500);
    });
});
