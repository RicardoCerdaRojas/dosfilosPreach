import { describe, it, expect } from 'vitest';
import { joinBySheet } from '../CallableBookSearch';

/** TP #8 (8b, D1): la página citada se lee ENTERA, sus fragmentos en orden. */
describe('joinBySheet', () => {
    it('junta los fragmentos de cada hoja en orden, y descarta los sin hoja', () => {
        expect(joinBySheet([
            { chunkIndex: 5, text: 'segundo', page: 411, section: 'IV 2, 3] NOTES' },
            { chunkIndex: 4, text: 'primero', page: 411, section: 'IV 2, 3] NOTES' },
            { chunkIndex: 6, text: 'otra hoja', page: 412, section: null },
            { chunkIndex: 7, text: 'sin hoja', page: null, section: null },
        ])).toEqual([
            { sheet: 411, text: 'primero\nsegundo', section: 'IV 2, 3] NOTES' },
            { sheet: 412, text: 'otra hoja', section: null },
        ]);
    });
});
