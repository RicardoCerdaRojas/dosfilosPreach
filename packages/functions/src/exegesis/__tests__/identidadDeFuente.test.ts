import { describe, it, expect } from 'vitest';
import { identidadDeFuente } from '../getExegesisPapersSummary';

/**
 * EL INVARIANTE: el resumen de trabajos no baja contenido.
 *
 * Ese resumen existe porque bajar los trabajos enteros cuesta 4,83 MB en la
 * cuenta real, y lo que pesa son los `excerpts`. Si un campo de contenido se
 * colara en la proyección, el resumen dejaría de ser resumen y nadie se
 * enteraría: la pantalla seguiría funcionando, sólo más lenta cada mes.
 */
describe('identidadDeFuente', () => {
    const FUENTE_GORDA = {
        sourceLibraryResourceId: 'lib-1',
        corpusId: 'lib-1',
        sourceType: 'commentary-critical',
        chosenRole: 'anchor',
        displayLabel: 'Sasson, Jonah',
        citationKey: 'Sasson1990',
        // Lo que NO puede viajar:
        excerpts: [{ text: 'x'.repeat(50_000), sourceLocation: 'p. 155' }],
        excerptRecipe: { sheets: [155, 156] },
        excerptSelectionMode: 'structural',
        mode: 'extracted-excerpts',
    };

    it('no deja pasar ningún campo de contenido', () => {
        const salida = identidadDeFuente(FUENTE_GORDA);

        expect(Object.keys(salida).sort()).toEqual([
            'chosenRole', 'citationKey', 'corpusId',
            'displayLabel', 'sourceLibraryResourceId', 'sourceType',
        ]);
        expect(JSON.stringify(salida)).not.toContain('xxxx');
    });

    it('cabe en unos cientos de bytes, no en decenas de miles', () => {
        const antes = JSON.stringify(FUENTE_GORDA).length;
        const despues = JSON.stringify(identidadDeFuente(FUENTE_GORDA)).length;

        expect(antes).toBeGreaterThan(50_000);
        expect(despues).toBeLessThan(400);
    });

    it('sobrevive a una fuente a medio escribir', () => {
        // Los documentos viejos no tienen todos los campos, y una excepción
        // acá tumbaría la lista entera de trabajos, no sólo la herencia.
        expect(identidadDeFuente({})).toEqual({
            sourceLibraryResourceId: null,
            corpusId: '',
            sourceType: 'other',
            chosenRole: null,
            displayLabel: '',
            citationKey: null,
        });
        expect(() => identidadDeFuente(undefined)).not.toThrow();
    });
});
