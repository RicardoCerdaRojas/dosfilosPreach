import { describe, expect, it } from 'vitest';
import { sheetPagesFromMarkers, sheetPagesLabel } from '../pageMarkers';

describe('sheetPagesFromMarkers — páginas de Kittel leídas de «[p N]» (A8b)', () => {
    it('una hoja empieza en la página que venía de la anterior y termina en su última marca', () => {
        // Hoja 525 de Kittel: ὀλολύζω sigue de la p. 666 y la 667 abre con ὅλος.
        const out = sheetPagesFromMarkers([
            { sheet: 524, text: 'ὀλίγος … [p 666] … quede' },
            { sheet: 525, text: 'poco de la cosecha … [H. W. Heidland] → ἀλαλάζω\n\n[p 667] ὅλος [entero]' },
            { sheet: 526, text: 'ὅλος sigue sin marca' },
            { sheet: 527, text: '… [p 668] …' },
        ]);
        expect(out['525']).toEqual({ from: 666, to: 667 });
        expect(out['526']).toEqual({ from: 667, to: 667 });
        // Antes de la primera marca no se sabe la página: sin rango.
        expect(out['524']).toBeUndefined();
    });

    it('una hoja que abre con su marca empieza en esa página', () => {
        const out = sheetPagesFromMarkers([
            { sheet: 10, text: '[p 11] ἀγαθός' },
            { sheet: 11, text: '  \n[p 12] ἀγαπάω … [p 13] …' },
        ]);
        expect(out['10']).toEqual({ from: 11, to: 11 });
        expect(out['11']).toEqual({ from: 12, to: 13 });
    });

    it('un salto de la cuenta queda dentro del rango; una marca que retrocede no cuenta', () => {
        // Medido: la marca de la p. 13 no sobrevivió (12 → 14); lo que va antes de [p 14] es 12 o 13.
        const out = sheetPagesFromMarkers([
            { sheet: 11, text: '[p 12] …' },
            { sheet: 12, text: '… [p 14] … véase [p 3] …' },
        ]);
        expect(out['12']).toEqual({ from: 12, to: 14 });
    });

    it('los fragmentos de una misma hoja se leen juntos, en el orden dado', () => {
        const out = sheetPagesFromMarkers([
            { sheet: 5, text: '[p 7] uno' },
            { sheet: 6, text: 'sigue la 7' },
            { sheet: 6, text: '[p 8] dos' },
        ]);
        expect(out['6']).toEqual({ from: 7, to: 8 });
    });

    it('una hoja sin marca entre dos saltadas lleva la página perdida (medido: hoja 364, entre la 460 y la 462)', () => {
        const out = sheetPagesFromMarkers([
            { sheet: 363, text: '[p 460] …' },
            { sheet: 364, text: 'sin marca: la 461 se perdió' },
            { sheet: 365, text: '… [p 462] …' },
        ]);
        expect(out['364']).toEqual({ from: 460, to: 461 });
        // La 461 perdida puede estar en la 364 o al principio de la 365: la 365 la incluye.
        expect(out['365']).toEqual({ from: 460, to: 462 });
    });

    it('lo que no se puede acotar queda como hoja: una racha larga sin marcas, la hoja que la sigue y el final del libro', () => {
        // Medido: hojas 501–520 de Kittel, de la p. 635 a la [p 662].
        const out = sheetPagesFromMarkers([
            { sheet: 500, text: '[p 635] …' },
            ...Array.from({ length: 20 }, (_, i) => ({ sheet: 501 + i, text: 'sin marca' })),
            { sheet: 521, text: '… [p 662] …' },
            { sheet: 522, text: '[p 663] …' },
            { sheet: 523, text: 'índice: estrella 90' },
        ]);
        expect(out['501']).toBeUndefined();
        expect(out['520']).toBeUndefined();
        expect(out['521']).toBeUndefined();
        expect(out['522']).toEqual({ from: 663, to: 663 });
        // Después de la última marca no hay con qué acotar.
        expect(out['523']).toBeUndefined();
    });

    it('una hoja de hasta cuatro páginas vale', () => {
        const out = sheetPagesFromMarkers([
            { sheet: 1, text: '[p 10] …' },
            { sheet: 2, text: '… [p 11] … [p 12] … [p 13]' },
        ]);
        expect(out['2']).toEqual({ from: 10, to: 13 });
    });

    it('sin marcas no hay páginas', () => {
        expect(sheetPagesFromMarkers([{ sheet: 1, text: 'Prólogo' }, { sheet: 2, text: 'p. 3 en prosa' }])).toEqual({});
    });

    it('rótulo de una o varias páginas', () => {
        expect(sheetPagesLabel({ from: 667, to: 667 })).toBe('667');
        expect(sheetPagesLabel({ from: 666, to: 667 })).toBe('666–667');
    });
});
