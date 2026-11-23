import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * A8c: la biblioteca compartida entra en la búsqueda, pero solo los libros
 * cuyo texto se puede leer (dominio público, `publiclyCitable`). Un libro
 * compartido protegido no se pide nunca, y uno ajeno sigue sin traer nada.
 */
const consultas: Array<{ coleccion: string; filtros: Array<[string, string, unknown]> }> = [];
const fragmentoDe = (resourceId: string, page: number) => ({
    id: `${resourceId}_chunk_0`,
    data: () => ({ resourceId, resourceTitle: resourceId, resourceAuthor: 'x', text: 't', metadata: { page, section: 'GEN 1:1' }, _distance: 0.2 }),
    get: () => [] as string[],
});
function consulta(coleccion: string, filtros: Array<[string, string, unknown]>) {
    const docs = () => {
        consultas.push({ coleccion, filtros });
        const rid = filtros.find(f => f[0] === 'resourceId');
        const ids = rid ? (Array.isArray(rid[2]) ? rid[2] as string[] : [rid[2] as string]) : ['mio'];
        return { docs: coleccion === 'library_resources' ? [{ id: 'mio' }] : ids.map(id => fragmentoDe(id, 7)) };
    };
    const q = {
        where: (campo: string, op: string, valor: unknown) => consulta(coleccion, [...filtros, [campo, op, valor]]),
        select: () => q,
        limit: () => q,
        get: async () => docs(),
        findNearest: () => ({ get: async () => docs() }),
    };
    return q;
}
vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({ collection: (c: string) => consulta(c, []) }) }));
vi.mock('../../retrieveChunks', () => ({ embedQuery: async () => [0.1, 0.2] }));
vi.mock('../../bibliotecaCompartida', async (orig) => ({
    ...(await orig<object>()),
    recursosCompartidos: async () => new Map([
        ['jfb', { id: 'jfb', textoLegible: true, citaPorSeccion: true }],
        ['protegido', { id: 'protegido', textoLegible: false, citaPorSeccion: false }],
    ]),
}));
const { recuperarCandidatos, recuperarPorPasaje, duenoDe } = await import('../recuperarFragmentos');

const deChunks = () => consultas.filter(c => c.coleccion === 'document_chunks').map(c => c.filtros);
beforeEach(() => { consultas.length = 0; });

describe('recuperarFragmentos — biblioteca compartida (A8c)', () => {
    it('toda la biblioteca: la propia y los compartidos legibles, nunca el protegido', async () => {
        const out = await recuperarCandidatos('p', 'yo', { tipo: 'todo' }, 'k', 40);
        expect(deChunks()).toEqual([
            [['userId', '==', 'yo']],
            [['userId', '==', '__system__'], ['resourceId', 'in', ['jfb']]],
        ]);
        // JFB se cita por sección: su «hoja» no se muestra; la propia sí.
        expect(out.find(f => f.resourceId === 'jfb')?.hoja).toBeNull();
        expect(out.find(f => f.resourceId === 'mio')?.hoja).toBe(7);
    });

    it('libros elegidos: cada uno con su dueño; el protegido no se pide y el ajeno va por el userId propio', async () => {
        await recuperarCandidatos('p', 'yo', { tipo: 'libros', ids: ['mio', 'jfb', 'protegido', 'de-otro'] }, 'k', 40);
        expect(deChunks()).toEqual([
            [['userId', '==', 'yo'], ['resourceId', 'in', ['mio', 'de-otro']]],
            [['userId', '==', '__system__'], ['resourceId', 'in', ['jfb']]],
        ]);
    });

    it('por pasaje: los libros propios y los compartidos legibles; el protegido nunca', async () => {
        await recuperarPorPasaje(['JAS.1.1'], 'yo', { tipo: 'todo' });
        expect(deChunks().map(f => [f[0]![2], f[1]![2]])).toEqual([['yo', 'mio'], ['__system__', 'jfb']]);
        consultas.length = 0;
        await recuperarPorPasaje(['JAS.1.1'], 'yo', { tipo: 'libros', ids: ['protegido', 'de-otro'] });
        expect(deChunks().map(f => [f[0]![2], f[1]![2]])).toEqual([['yo', 'de-otro']]);
    });

    it('duenoDe', () => {
        const m = new Map([['jfb', { id: 'jfb', textoLegible: true, citaPorSeccion: true }], ['p', { id: 'p', textoLegible: false, citaPorSeccion: false }]]);
        expect(duenoDe('jfb', 'yo', m)).toBe('__system__');
        expect(duenoDe('p', 'yo', m)).toBeNull();
        expect(duenoDe('cualquiera', 'yo', m)).toBe('yo');
    });
});
