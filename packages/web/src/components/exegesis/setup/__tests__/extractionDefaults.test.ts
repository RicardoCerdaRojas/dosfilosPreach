import { describe, it, expect } from 'vitest';
import { hasCuratedScope } from '@dosfilos/domain';
import { autoSelection, initialSelectionFor, resourceIdsOf } from '../extractionDefaults';

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

/**
 * Jonás 4:5-11: once fuentes heredadas sin páginas; el diálogo marcaba sólo el
 * top-5 del ranking y seis quedaban sin extraer.
 */
describe('autoSelection', () => {
    const recurso = (id: string, extra: Record<string, unknown> = {}) =>
        ({ id, title: id, author: id, exegeticalType: 'commentary-critical', ...extra }) as never;
    const heredada = (id: string, sourceType = 'commentary-expository') =>
        ({ id: `s-${id}`, sourceLibraryResourceId: id, corpusId: id, sourceType, displayLabel: id, mode: 'full-document', excerpts: [], excerptRecipe: null }) as never;
    const receta = { sheetRanges: [{ start: 1, end: 2 }], proposedRanges: [], pinnedRanges: [], passageFingerprint: '' };
    const rank = (ids: string[]) => ids.map((resourceId, i) => ({ resourceId, score: 1 - i / 10, matchedChunkCount: 3 })) as never;
    const todoIndexado = () => true;

    it('marca todas las heredadas sin páginas, aunque no rankeen', () => {
        const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
        const sel = autoSelection({
            sources: ids.map(id => heredada(id)), resources: ids.map(id => recurso(id)),
            ranked: rank(['x']), isIndexed: todoIndexado, topN: 5,
        });
        expect([...sel.keys()].sort()).toEqual(ids);
    });

    it('léxicos y gramáticas heredados no: van al selector de páginas', () => {
        const sel = autoSelection({
            sources: [heredada('lex', 'lexicon-technical'), heredada('gram', 'grammar-syntax')],
            resources: [recurso('lex'), recurso('gram')], ranked: [], isIndexed: todoIndexado, topN: 5,
        });
        expect(sel.size).toBe(0);
    });

    it('un libro con páginas elegidas no se marca aunque rankee primero', () => {
        const conPaginas = { ...(heredada('a') as object), excerptRecipe: receta } as never;
        const sel = autoSelection({
            sources: [conPaginas], resources: [recurso('a'), recurso('b')],
            ranked: rank(['a', 'b']), isIndexed: todoIndexado, topN: 5,
        });
        expect([...sel.keys()]).toEqual(['b']);
    });

    it('sin indexar no se marca', () => {
        const sel = autoSelection({
            sources: [heredada('a')], resources: [recurso('a')], ranked: [], isIndexed: () => false, topN: 5,
        });
        expect(sel.size).toBe(0);
    });

    it('el top del ranking sigue sumando hasta N', () => {
        const sel = autoSelection({
            sources: [], resources: ['a', 'b', 'c'].map(id => recurso(id)),
            ranked: rank(['a', 'b', 'c']), isIndexed: todoIndexado, topN: 2,
        });
        expect([...sel.keys()]).toEqual(['a', 'b']);
    });

    it('REGRESIÓN (TP #6): una excluida del trabajo no se marca, ni rankeada ni heredada; su lugar lo toma la que sigue', () => {
        const varner = (r: { id: string }) => r.id === 'varner';
        const sel = autoSelection({
            sources: [heredada('varner')], resources: ['varner', 'moo', 'davids'].map(id => recurso(id)),
            ranked: rank(['varner', 'moo', 'davids']), isIndexed: todoIndexado, topN: 2, isExcluded: varner as never,
        });
        expect([...sel.keys()]).toEqual(['moo', 'davids']);
    });
});

