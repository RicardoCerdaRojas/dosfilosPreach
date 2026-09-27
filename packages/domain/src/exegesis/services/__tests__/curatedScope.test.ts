import { describe, it, expect } from 'vitest';
import { hasCuratedScope } from '../curatedScope';

describe('hasCuratedScope — de dónde sale el texto de una fuente', () => {
    const conTramos = (n: number) => ({
        excerptRecipe: {
            sheetRanges: Array.from({ length: n }, (_, i) => ({ start: i + 1, end: i + 1 })),
            proposedRanges: [],
            pinnedRanges: [],
            passageFingerprint: 'fp',
        },
    } as Parameters<typeof hasCuratedScope>[0]);

    it('con tramos elegidos, el trabajo ya declaró qué hojas admitió', () => {
        expect(hasCuratedScope(conTramos(3))).toBe(true);
    });

    it('sin receta, el documento entero ES la curaduría', () => {
        // La carga directa de un extracto acotado nunca tuvo receta.
        expect(hasCuratedScope({ excerptRecipe: null } as Parameters<typeof hasCuratedScope>[0])).toBe(false);
    });

    it('una receta con cero tramos no admite nada', () => {
        expect(hasCuratedScope(conTramos(0))).toBe(false);
    });
});
