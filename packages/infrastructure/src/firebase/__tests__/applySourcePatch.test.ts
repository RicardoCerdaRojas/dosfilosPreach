import { describe, it, expect } from 'vitest';
import type { ProjectSource, ProjectSourcePatch } from '@dosfilos/domain';
import { applySourcePatch, SOURCE_PATCH_KEYS } from '../FirestoreExegeticalPaperRepository';

/**
 * `updateSource` aplicaba el parche con una lista de `if` escrita a mano que
 * había olvidado `excerptRecipe` y `excerptSelectionMode`. «Ajustar páginas»
 * sobre una fuente ya adjunta llama a `updateSource` con la receta nueva: se
 * guardaba `extractedAt` y la selección se descartaba. En producción ninguna
 * de 135 fuentes quedó jamás en modo «manual», y cinco fuentes reajustadas
 * seguían con la propuesta automática.
 *
 * La prueba del caso de uso no lo veía porque usa un repositorio falso. Esta
 * prueba el merge real, desde el contrato del llamador: lo que el caso de uso
 * manda es lo que tiene que quedar.
 */
const fuente = (): ProjectSource => ({
    id: 'f1',
    paperId: 'p1',
    corpusId: 'lib1',
    sourceType: 'grammar-syntax',
    chosenRole: null,
    displayLabel: 'Arnold y Choi',
    citationKey: 'Arnold',
    order: 2,
    mode: 'extracted-excerpts',
    excerpts: [],
    excerptSelectionMode: 'semantic',
    excerptRecipe: {
        sheetRanges: [{ start: 7, end: 10 }, { start: 208, end: 219 }],
        proposedRanges: [{ start: 7, end: 10 }, { start: 208, end: 219 }],
        pinnedRanges: [],
        passageFingerprint: 'v1|salmos 23:1-3|encuadre',
    },
    sourceLibraryResourceId: 'lib1',
    extractedAt: new Date('2026-09-16T00:00:00Z'),
    extractionFingerprint: 'v1|salmos 23:1-3|encuadre',
    createdAt: new Date('2026-09-16T00:00:00Z'),
});

describe('applySourcePatch', () => {
    it('guarda la selección de páginas reajustada (el defecto)', () => {
        // Exactamente lo que manda SelectSourcePagesUseCase sobre una fuente existente.
        const receta = {
            sheetRanges: [{ start: 20, end: 27 }, { start: 55, end: 59 }],
            proposedRanges: [{ start: 7, end: 10 }, { start: 208, end: 219 }],
            pinnedRanges: [{ start: 55, end: 56 }],
            passageFingerprint: 'v1|salmos 23:1-3|encuadre',
        };
        const extractedAt = new Date('2026-09-17T00:00:00Z');
        const out = applySourcePatch(fuente(), {
            excerpts: [],
            excerptSelectionMode: 'manual',
            excerptRecipe: receta,
            extractedAt,
            extractionFingerprint: receta.passageFingerprint,
        });
        expect(out.excerptRecipe).toEqual(receta);
        expect(out.excerptSelectionMode).toBe('manual');
        expect(out.extractedAt).toBe(extractedAt);
    });

    it('aplica cada campo que el tipo del parche declara', () => {
        // Un campo que se agregue a la lista y no se aplique vuelve a romper igual.
        const valores: Required<{ [K in keyof ProjectSourcePatch]: unknown }> = {
            sourceType: 'lexicon-technical',
            chosenRole: 'anchor',
            displayLabel: 'Otro',
            citationKey: 'Otro',
            order: 9,
            excerpts: [{ text: 't', sourceLocation: 'p. 1', relevanceScore: 1, userEdited: false, editedAt: null }],
            excerptSelectionMode: 'structural',
            excerptRecipe: { sheetRanges: [{ start: 1, end: 1 }], proposedRanges: [], pinnedRanges: [], passageFingerprint: 'x' },
            extractedAt: new Date('2027-01-01T00:00:00Z'),
            extractionFingerprint: 'x',
        };
        for (const key of SOURCE_PATCH_KEYS) {
            const out = applySourcePatch(fuente(), { [key]: valores[key] } as ProjectSourcePatch);
            expect(out[key], key).toEqual(valores[key]);
        }
    });

    it('undefined no borra lo que había', () => {
        const out = applySourcePatch(fuente(), { excerptRecipe: undefined, citationKey: undefined });
        expect(out.excerptRecipe).toEqual(fuente().excerptRecipe);
        expect(out.citationKey).toBe('Arnold');
    });

    it('null sí borra: devuelve la fuente al rol que sugiera su tipo', () => {
        const base = { ...fuente(), chosenRole: 'anchor' as const };
        expect(applySourcePatch(base, { chosenRole: null }).chosenRole).toBeNull();
    });

    it('no deja que claves de más pisen la identidad de la fuente', () => {
        const conDeMas = { displayLabel: 'Nuevo', id: 'otro', paperId: 'otro', createdAt: new Date(0) };
        const out = applySourcePatch(fuente(), conDeMas as ProjectSourcePatch);
        expect(out.displayLabel).toBe('Nuevo');
        expect(out.id).toBe('f1');
        expect(out.paperId).toBe('p1');
        expect(out.createdAt).toEqual(fuente().createdAt);
    });

    it('no muta la fuente recibida', () => {
        const base = fuente();
        applySourcePatch(base, { excerptSelectionMode: 'manual' });
        expect(base.excerptSelectionMode).toBe('semantic');
    });
});
