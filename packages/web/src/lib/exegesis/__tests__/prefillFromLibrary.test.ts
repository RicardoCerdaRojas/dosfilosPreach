import { describe, it, expect } from 'vitest';
import { prefillFromLibrary } from '../prefillFromLibrary';

/** TP #6: Wallace tenía autor en la biblioteca y su ficha decía «falta autor». */
describe('la ficha parte de lo que la biblioteca ya sabe', () => {
    it('REGRESIÓN: llena el autor (y su forma ordenable) y el título que faltan', () => {
        const r = prefillFromLibrary(null, { author: 'Daniel B. Wallace', title: 'Greek Grammar Beyond the Basics' });
        expect(r.values).toEqual({ author: 'Daniel B. Wallace', authorSorted: 'Wallace, Daniel B.', title: 'Greek Grammar Beyond the Basics' });
        expect(r.fields.sort()).toEqual(['author', 'authorSorted', 'title']);
    });

    it('no pisa lo que la ficha ya tiene', () => {
        const r = prefillFromLibrary({ author: 'Wallace, D.', title: 'Gramática' }, { author: 'Daniel B. Wallace', title: 'Otro' });
        expect(r.values).toEqual({});
        expect(r.fields).toEqual([]);
    });

    it('sin datos en la biblioteca, nada', () => {
        expect(prefillFromLibrary(null, { author: '  ', title: '' }).fields).toEqual([]);
        expect(prefillFromLibrary(null, undefined).fields).toEqual([]);
    });
});
