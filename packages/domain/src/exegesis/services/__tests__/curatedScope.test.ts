import { describe, it, expect } from 'vitest';
import { WHOLE_DOCUMENT_RANGE, hasCuratedScope, isPickedByPages, isSourceWithoutScope, retrievalScopeOf } from '../curatedScope';

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

/**
 * Antes sólo lo que tenía páginas elegidas se consultaba por versículo: el
 * documento completo viajaba truncado desde la portada y los fragmentos, todos
 * en cada paso.
 */
describe('retrievalScopeOf — dónde buscar para un versículo', () => {
    const ex = (sheet: number | undefined, userEdited = false) =>
        ({ text: 't', sourceLocation: 'p. 1', relevanceScore: 1, userEdited, ...(sheet ? { sheet } : {}) }) as never;
    const base = { sourceType: 'commentary-critical' as const, mode: 'extracted-excerpts' as const, excerpts: [] as never[], excerptRecipe: null };

    it('con páginas elegidas: la receta, con sus fijadas', () => {
        const receta = { sheetRanges: [{ start: 79, end: 91 }], proposedRanges: [], pinnedRanges: [{ start: 3, end: 4 }], passageFingerprint: '' };
        expect(retrievalScopeOf({ ...base, excerptRecipe: receta })).toEqual({
            kind: 'recipe', sheetRanges: [{ start: 79, end: 91 }], pinnedRanges: [{ start: 3, end: 4 }],
        });
    });

    it('con fragmentos: sus hojas; los editados y los sin hoja van siempre', () => {
        const editado = ex(40, true);
        const sinHoja = ex(undefined);
        const scope = retrievalScopeOf({ ...base, excerpts: [ex(12), ex(13), ex(20), editado, sinHoja] });
        expect(scope?.kind).toBe('excerpt-sheets');
        expect(scope?.sheetRanges).toEqual([{ start: 12, end: 13 }, { start: 20, end: 20 }]);
        expect(scope && 'alwaysExcerpts' in scope ? scope.alwaysExcerpts : null).toEqual([editado, sinHoja]);
    });

    it('fragmentos viejos sin hoja: nada que consultar, viajan como antes', () => {
        expect(retrievalScopeOf({ ...base, excerpts: [ex(undefined), ex(undefined)] })).toBeNull();
    });

    it('citable sin páginas ni fragmentos: el libro entero', () => {
        expect(retrievalScopeOf({ ...base, mode: 'full-document' })).toEqual({
            kind: 'whole-document', sheetRanges: [WHOLE_DOCUMENT_RANGE], pinnedRanges: [],
        });
    });

    it('una plantilla de estilo: nada', () => {
        expect(retrievalScopeOf({ ...base, mode: 'full-document', sourceType: 'style-template-paper' })).toBeNull();
    });
});
