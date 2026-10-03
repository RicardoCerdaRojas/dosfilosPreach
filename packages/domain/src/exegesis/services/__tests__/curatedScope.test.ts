import { describe, it, expect } from 'vitest';
import { hasCuratedScope, isPickedByPages, isSourceWithoutScope } from '../curatedScope';

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

describe('isSourceWithoutScope — una fuente citable que no dice qué leer', () => {
    const receta = { sheetRanges: [{ start: 1, end: 3 }], proposedRanges: [], pinnedRanges: [], passageFingerprint: '' };
    const base = { sourceType: 'commentary-expository' as const, mode: 'full-document' as const, excerpts: [], excerptRecipe: null };

    it('heredada de la serie, sin páginas ni fragmentos: sí', () => {
        expect(isSourceWithoutScope(base)).toBe(true);
    });
    it('con páginas elegidas: no', () => {
        expect(isSourceWithoutScope({ ...base, excerptRecipe: receta })).toBe(false);
    });
    it('con fragmentos: no', () => {
        expect(isSourceWithoutScope({ ...base, mode: 'extracted-excerpts', excerpts: [{ text: 'x' }] as never })).toBe(false);
    });
    it('una plantilla de estilo no es citable: no', () => {
        expect(isSourceWithoutScope({ ...base, sourceType: 'style-template-paper' })).toBe(false);
    });
});

describe('isPickedByPages', () => {
    it('léxicos, diccionarios y gramáticas se eligen por páginas; comentarios no', () => {
        expect(isPickedByPages({ sourceType: 'lexicon-technical' })).toBe(true);
        expect(isPickedByPages({ sourceType: 'theological-dictionary' })).toBe(true);
        expect(isPickedByPages({ sourceType: 'grammar-syntax' })).toBe(true);
        expect(isPickedByPages({ sourceType: 'commentary-critical' })).toBe(false);
    });
});
