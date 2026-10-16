import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Las reglas de `document_chunks` dejan LEER lo propio y la biblioteca común
 * (`__system__`) y BORRAR sólo lo propio, y Firestore rechaza ENTERA una
 * consulta que no garantice la regla. Cada consulta del cliente tiene que
 * filtrar por dueño: si una lo pierde, una pantalla deja de funcionar (el
 * planificador, la insignia de indexado, «Leer del libro», el borrado de un
 * recurso) sin que nada más lo avise.
 */
type Filtro = [string, string, unknown];
const consultas: Filtro[][] = [];
const sesion: { currentUser: { uid: string } | null } = { currentUser: { uid: 'yo' } };

vi.mock('../../config/firebase', () => ({ db: {}, auth: sesion }));
vi.mock('firebase/firestore', () => ({
    collection: () => ({}),
    doc: () => ({}),
    where: (campo: string, op: string, valor: unknown) => ({ filtro: [campo, op, valor] }),
    limit: (n: number) => ({ filtro: ['__limit', '==', n] }),
    query: (_c: unknown, ...partes: Array<{ filtro?: Filtro }>) => partes.flatMap(p => (p.filtro ? [p.filtro] : [])),
    getDocs: async (filtros: Filtro[]) => { consultas.push(filtros); return { docs: [], empty: true }; },
    writeBatch: () => ({ delete: () => undefined, set: () => undefined, commit: async () => undefined }),
    setDoc: async () => undefined,
}));

const { FirestoreVectorRepository } = await import('../FirestoreVectorRepository');
const { FirebaseChunkRepository } = await import('../FirebaseChunkRepository');

beforeEach(() => { consultas.length = 0; sesion.currentUser = { uid: 'yo' }; });

const LEER: Filtro = ['userId', 'in', ['yo', '__system__']];
const BORRAR: Filtro = ['userId', '==', 'yo'];

describe('las consultas del cliente a document_chunks filtran por dueño', () => {
    it('leer: hasIndex, hasIndexBatch, findByResourceIds y firstChunksText, con lo propio y la biblioteca común', async () => {
        await new FirestoreVectorRepository().hasIndex('r1');
        await new FirestoreVectorRepository().hasIndexBatch(['r1', 'r2']);
        await new FirebaseChunkRepository().findByResourceIds(Array.from({ length: 12 }, (_, i) => `r${i}`));
        await new FirebaseChunkRepository().firstChunksText('r1');
        expect(consultas.length).toBe(1 + 2 + 2 + 1);
        for (const c of consultas) expect(c).toContainEqual(LEER);
    });

    it('borrar: deleteByResourceId de los dos repositorios, sólo lo propio', async () => {
        await new FirestoreVectorRepository().deleteByResourceId('r1');
        await new FirebaseChunkRepository().deleteByResourceId('r1');
        expect(consultas).toHaveLength(2);
        for (const c of consultas) expect(c).toContainEqual(BORRAR);
    });

    it('hasIndexBatch: una consulta de UN documento por recurso, sin repetir', async () => {
        await new FirestoreVectorRepository().hasIndexBatch(['r1', 'r2', 'r1']);
        expect(consultas.map(c => c.find(f => f[0] === 'resourceId')?.[2])).toEqual(['r1', 'r2']);
        for (const c of consultas) expect(c).toContainEqual(['__limit', '==', 1]);
    });

    it('los métodos que reciben un userId usan igual el de la sesión', async () => {
        await new FirebaseChunkRepository().findByUserId('otro');
        await new FirestoreVectorRepository().search([0.1], 5, { userId: 'otro' } as never);
        for (const c of consultas) expect(c).toContainEqual(['userId', '==', 'yo']);
    });

    it('sin sesión no se consulta nada', async () => {
        sesion.currentUser = null;
        await expect(new FirebaseChunkRepository().firstChunksText('r1')).rejects.toThrow(/sesión/);
        await expect(new FirestoreVectorRepository().deleteByResourceId('r1')).rejects.toThrow(/sesión/);
        expect(consultas).toHaveLength(0);
    });
});
