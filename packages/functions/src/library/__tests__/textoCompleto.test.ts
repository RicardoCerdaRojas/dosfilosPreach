import { describe, it, expect } from 'vitest';
import { textFromChunks } from '../documentPageIndex';

/** `textContent` se corta en 1 MB; el texto completo se arma desde los fragmentos. */
describe('textFromChunks', () => {
    it('en el orden de los fragmentos, no en el de llegada', () => {
        expect(textFromChunks([{ chunkIndex: 2, text: 'tres' }, { chunkIndex: 0, text: 'uno' }, { chunkIndex: 1, text: 'dos' }]))
            .toBe('uno\n\ndos\n\ntres');
    });
    it('sin fragmentos vacíos ni texto que no sea texto', () => {
        expect(textFromChunks([{ chunkIndex: 0, text: '  ' }, { chunkIndex: 1, text: 5 }, { chunkIndex: 2, text: 'ok' }])).toBe('ok');
    });
    it('saneado como en la recuperación: sin invisibles de fragmentos viejos', () => {
        expect(textFromChunks([{ chunkIndex: 0, text: 'pa\u200Blabra' }])).toBe('palabra');
    });
});
