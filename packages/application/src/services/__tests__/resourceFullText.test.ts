import { describe, it, expect, vi } from 'vitest';
import { readResourceFullText } from '../resourceFullText';

/** Revisión adversarial de E2: el armado desde fragmentos sólo para lo cortado. */
describe('readResourceFullText', () => {
    it('textContent entero: no se consultan los fragmentos', async () => {
        const fetchFromChunks = vi.fn();
        const t = await readResourceFullText('r', {
            findResource: async () => ({ textContent: '## 4:5-6\nTexto fiel.', characterCount: 20 }),
            fetchFromChunks,
        });
        expect(t).toBe('## 4:5-6\nTexto fiel.');
        expect(fetchFromChunks).not.toHaveBeenCalled();
    });

    it('cortado: el texto desde los fragmentos', async () => {
        const t = await readResourceFullText('r', {
            findResource: async () => ({ textContent: 'principio', characterCount: 2_000_000 }),
            fetchFromChunks: async () => 'principio y el resto',
        });
        expect(t).toBe('principio y el resto');
    });

    it('cortado y la callable falla o no hay índice: el guardado', async () => {
        const deps = { findResource: async () => ({ textContent: 'principio', characterCount: 2_000_000 }) };
        expect(await readResourceFullText('r', { ...deps, fetchFromChunks: async () => { throw new Error('caída'); } })).toBe('principio');
        expect(await readResourceFullText('r', { ...deps, fetchFromChunks: async () => '  ' })).toBe('principio');
    });
});
