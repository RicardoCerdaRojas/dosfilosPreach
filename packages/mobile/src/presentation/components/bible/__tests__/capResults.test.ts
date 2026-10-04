import { describe, expect, it } from '@jest/globals';

import { capResults } from '../BibleSearchSheet';

describe('tope de resultados de la búsqueda', () => {
    it('REGRESIÓN: exactamente el tope no es «más de»', () => {
        expect(capResults(Array.from({ length: 40 }, (_, i) => i), 40)).toMatchObject({ more: false });
    });

    it('uno más que el tope sí lo es, y se muestran sólo los del tope', () => {
        const { shown, more } = capResults(Array.from({ length: 41 }, (_, i) => i), 40);
        expect(more).toBe(true);
        expect(shown).toHaveLength(40);
    });
});
