import { describe, it, expect, vi } from 'vitest';
import { readMissingBibliographies } from '../readMissingBibliographies';

const fila = (id: string, extra: Record<string, unknown> = {}) => ({
    sourceId: id, resourceId: `r-${id}`, citationKey: id, displayLabel: id,
    data: { author: 'Autor' }, missing: ['city'], editable: true, ...extra,
}) as never;

/** #9: once libros sin datos para citar, leídos y guardados uno por uno. */
describe('readMissingBibliographies', () => {
    it('lee todas las portadas que faltan y deja lo propuesto para revisar', async () => {
        const read = vi.fn(async () => ({ hasText: true, data: { city: 'Grand Rapids', author: 'Otro' } }));
        const r = await readMissingBibliographies([fila('a'), fila('b')], read);
        expect(r.map(x => x.status)).toEqual(['proposal', 'proposal']);
        // Lo ya escrito gana: el autor no se pisa.
        expect(r[0]!.merged).toEqual({ author: 'Autor', city: 'Grand Rapids' });
        expect(r[0]!.filled).toEqual(['city']);
    });

    it('no lee las completas ni las que no se pueden escribir', async () => {
        const read = vi.fn(async () => ({ hasText: true, data: {} }));
        await readMissingBibliographies([fila('a', { missing: [] }), fila('b', { editable: false })], read);
        expect(read).not.toHaveBeenCalled();
    });

    it('distingue sin texto, nada nuevo y error', async () => {
        const read = vi.fn(async (id: string) => {
            if (id === 'r-a') return { hasText: false, data: {} };
            if (id === 'r-b') return { hasText: true, data: { author: 'Otro' } };
            throw new Error('caída');
        });
        const r = await readMissingBibliographies([fila('a'), fila('b'), fila('c')], read);
        expect(r.map(x => x.status)).toEqual(['no-text', 'nothing-new', 'error']);
    });

    it('nunca más de `concurrencia` lecturas a la vez', async () => {
        let enVuelo = 0;
        let maximo = 0;
        const read = async () => {
            enVuelo++; maximo = Math.max(maximo, enVuelo);
            await new Promise(r => setTimeout(r, 5));
            enVuelo--;
            return { hasText: true, data: { city: 'X' } };
        };
        await readMissingBibliographies(['a', 'b', 'c', 'd', 'e'].map(id => fila(id)), read, { concurrencia: 2 });
        expect(maximo).toBe(2);
    });
});
