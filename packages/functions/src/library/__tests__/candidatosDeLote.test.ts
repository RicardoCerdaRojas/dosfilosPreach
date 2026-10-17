import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Fase «lote desde el panel de super admin», PR 1: el callable es sólo lectura, sólo super admin y sin texto. */
const roles: Record<string, string | undefined> = {};
const consultas: Array<{ coleccion: string; filtros: unknown[]; campos: string[] }> = [];
vi.mock('firebase-functions/v2/https', async (orig) => ({ ...(await orig<object>()), onCall: (_o: unknown, h: unknown) => h }));
vi.mock('firebase-admin', () => ({
    firestore: () => ({
        collection: (coleccion: string) => {
            const q = (filtros: unknown[]) => ({
                where: (...f: unknown[]) => q([...filtros, f]),
                select: (...campos: string[]) => ({
                    get: async () => {
                        consultas.push({ coleccion, filtros, campos });
                        if (coleccion === 'users') return { docs: [{ id: 'yo', data: () => ({ email: 'yo@x.org' }) }] };
                        return { docs: [{ id: 'lib1', data: () => ({ title: 'Sintaxis', paginasFaltantes: { total: 2, paginas: [5, 48] }, reprocesadoEnLote: { lote: 'biblioteca4', fecha: { toDate: () => new Date('2026-10-16T15:00:00Z') }, motivo: 'faltantes 2 → 2' } }) }] };
                    },
                }),
                doc: (id: string) => ({ get: async () => ({ exists: id in roles, data: () => ({ role: roles[id] }) }) }),
            });
            return q([]);
        },
    }),
}));
const { getBatchCandidates, aCandidato } = await import('../candidatosDeLote');
const llamar = (uid: string, data: unknown = {}) => (getBatchCandidates as unknown as (r: unknown) => Promise<Record<string, unknown>>)({ auth: { uid }, data });

beforeEach(() => { consultas.length = 0; for (const k of Object.keys(roles)) delete roles[k]; roles.yo = 'super_admin'; roles.pastor = 'user'; });

describe('getBatchCandidates', () => {
    it('sólo el super admin', async () => {
        await expect(llamar('pastor')).rejects.toMatchObject({ code: 'permission-denied' });
        expect(consultas).toHaveLength(0);
    });

    it('sin dueño pedido, la biblioteca propia; nunca pide el texto de los libros', async () => {
        const r = await llamar('yo');
        expect(r.dueno).toBe('yo');
        const recursos = consultas.find(c => c.coleccion === 'library_resources')!;
        expect(recursos.filtros).toEqual([['userId', '==', 'yo']]);
        expect(recursos.campos).not.toContain('textContent');
        expect(recursos.campos).not.toContain('storageUrl');
    });

    it('con dueño pedido, esa biblioteca', async () => {
        await llamar('yo', { ownerUid: 'pastor' });
        expect(consultas.find(c => c.coleccion === 'library_resources')!.filtros).toEqual([['userId', '==', 'pastor']]);
    });
});

describe('aCandidato', () => {
    it('lleva los campos de medición y la marca del lote, con la fecha en texto', () => {
        expect(aCandidato('x', { title: 'T', paginasFaltantes: { total: 3, paginas: [1, 'x', 2] }, reprocesadoEnLote: { lote: 'b1', fecha: { toDate: () => new Date('2026-10-15T00:00:00Z') } } })).toMatchObject({
            id: 'x', titulo: 'T', paginasFaltantes: { total: 3, paginas: [1, 2] },
            reprocesadoEnLote: { lote: 'b1', fecha: '2026-10-15T00:00:00.000Z', motivo: null },
            textoEstructuradoVacio: false, extractionVersion: null,
        });
    });
});
