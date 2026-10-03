import { describe, it, expect } from 'vitest';
import { hasCuratedScope } from '@dosfilos/domain';
import { initialSelectionFor, resourceIdsOf } from '../extractionDefaults';

const libro = { id: 'r1', title: 'Obadiah, Jonah, Micah', author: 'Thomas McComiskey', exegeticalType: 'commentary-critical' } as never;
const fuente = (extra: Record<string, unknown>) => ({
    id: 's1', sourceLibraryResourceId: 'r1', corpusId: 'r1', sourceType: 'commentary-expository',
    displayLabel: 'McComiskey', citationKey: 'McComiskey', chosenRole: 'anchor', excerpts: [], excerptRecipe: null, ...extra,
}) as never;

/** McComiskey (Jonás 4:5-11): expositivo · ancla en el corpus; el diálogo mostraba crítico · sin rol. */
describe('initialSelectionFor', () => {
    it('un libro que ya está en el corpus arranca con los datos de su fuente', () => {
        expect(initialSelectionFor(libro, [fuente({})])).toEqual({
            sourceType: 'commentary-expository', displayLabel: 'McComiskey', citationKey: 'McComiskey', chosenRole: 'anchor',
        });
    });

    it('también si la fuente es de la ruta vieja (sólo corpusId)', () => {
        const vieja = fuente({ sourceLibraryResourceId: null, chosenRole: 'contrast' });
        expect(initialSelectionFor(libro, [vieja]).chosenRole).toBe('contrast');
    });

    it('un libro nuevo arranca con el tipo de la biblioteca y sin rol', () => {
        const e = initialSelectionFor(libro, []);
        expect(e.sourceType).toBe('commentary-critical');
        expect(e.chosenRole).toBeNull();
        expect(e.displayLabel).toBe('Obadiah, Jonah, Micah');
    });
});

describe('resourceIdsOf', () => {
    it('registra el backref y el corpusId de las fuentes que cumplen', () => {
        const receta = { sheetRanges: [{ start: 1, end: 2 }], proposedRanges: [], pinnedRanges: [], passageFingerprint: '' };
        const ids = resourceIdsOf([
            fuente({ excerptRecipe: receta }),
            fuente({ id: 's2', sourceLibraryResourceId: null, corpusId: 'r2', excerptRecipe: receta }),
            fuente({ id: 's3', sourceLibraryResourceId: 'r3', corpusId: 'r3' }),
        ], hasCuratedScope);
        expect([...ids].sort()).toEqual(['r1', 'r2']);
    });
});
