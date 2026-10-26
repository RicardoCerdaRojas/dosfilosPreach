import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Las fuentes de un proyecto se leían bajando TODA la biblioteca del usuario
 * (cada recurso pesa hasta 800 KB) y filtrando en el navegador. Ahora se piden
 * por id: en lotes de 30 (el tope de `in`), siempre con el filtro por dueño
 * (sin él, las reglas rechazan la consulta entera) y sin pedir dos veces el
 * mismo id.
 */
type Filtro = [string, string, unknown];
const consultas: Filtro[][] = [];
/** Lo que «hay» en Firestore: id → datos. */
let enLaBase: Record<string, Record<string, unknown>> = {};

vi.mock('../../config/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
    collection: () => ({}),
    doc: () => ({}),
    documentId: () => '__name__',
    where: (campo: string, op: string, valor: unknown) => ({ filtro: [campo, op, valor] }),
    orderBy: () => ({}),
    limit: () => ({}),
    query: (_c: unknown, ...partes: Array<{ filtro?: Filtro }>) => partes.flatMap(p => (p.filtro ? [p.filtro] : [])),
    getDocs: async (filtros: Filtro[]) => {
        consultas.push(filtros);
        const dueno = filtros.find(f => f[0] === 'userId')?.[2];
        const ids = (filtros.find(f => f[0] === '__name__')?.[2] ?? []) as string[];
        const docs = ids
            .filter(id => enLaBase[id] && enLaBase[id]!.userId === dueno)
            .map(id => ({ id, data: () => enLaBase[id]! }));
        return { docs, empty: docs.length === 0 };
    },
    Timestamp: { fromDate: (d: Date) => d },
}));

const { FirebaseLibraryRepository } = await import('../FirebaseLibraryRepository');
const repo = new FirebaseLibraryRepository();

const recurso = (userId: string, title: string) => ({
    userId, title, author: 'A', type: 'commentary', storageUrl: 'gs://x', mimeType: 'application/pdf', sizeBytes: 1,
    textExtractionStatus: 'ready', indexingStatus: 'ready', extractionVersion: '3.0-llamaparse',
});

beforeEach(() => {
    consultas.length = 0;
    enLaBase = {};
});

describe('FirebaseLibraryRepository.getResourcesByIds', () => {
    it('pide por id y con el filtro por dueño, no la biblioteca entera', async () => {
        enLaBase = { f1: recurso('yo', 'Uno'), f2: recurso('yo', 'Dos'), otro: recurso('yo', 'Sin pedir') };
        const r = await repo.getResourcesByIds('yo', ['f2', 'f1']);
        expect(r.map(x => x.title)).toEqual(['Dos', 'Uno']);
        expect(consultas).toHaveLength(1);
        expect(consultas[0]).toContainEqual(['userId', '==', 'yo']);
        expect(consultas[0]).toContainEqual(['__name__', 'in', ['f2', 'f1']]);
    });

    it('en lotes de 30, sin repetir ids y en el orden pedido', async () => {
        const ids = Array.from({ length: 65 }, (_, i) => `r${i}`);
        for (const id of ids) enLaBase[id] = recurso('yo', `Recurso ${id}`);
        const r = await repo.getResourcesByIds('yo', [...ids, 'r3', 'r3']);
        const lotes = consultas.map(c => (c.find(f => f[0] === '__name__')![2] as string[]).length);
        expect(lotes).toEqual([30, 30, 5]);
        for (const c of consultas) expect(c).toContainEqual(['userId', '==', 'yo']);
        expect(r.map(x => x.id)).toEqual(ids);
    });

    it('un id ajeno, borrado o vacío no vuelve', async () => {
        enLaBase = { mio: recurso('yo', 'Mío'), ajeno: recurso('otro', 'Ajeno') };
        const r = await repo.getResourcesByIds('yo', ['mio', 'ajeno', 'borrado', '']);
        expect(r.map(x => x.id)).toEqual(['mio']);
    });

    it('un documento que la entidad rechaza no tumba los demás', async () => {
        enLaBase = { bueno: recurso('yo', 'Bueno'), roto: { ...recurso('yo', 'x'), storageUrl: '' } };
        const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const r = await repo.getResourcesByIds('yo', ['roto', 'bueno']);
        expect(r.map(x => x.id)).toEqual(['bueno']);
        expect(aviso).toHaveBeenCalled();
        aviso.mockRestore();
    });

    it('sin ids o sin usuario no consulta', async () => {
        expect(await repo.getResourcesByIds('yo', [])).toEqual([]);
        expect(await repo.getResourcesByIds('', ['f1'])).toEqual([]);
        expect(consultas).toHaveLength(0);
    });

    it('lleva el estado de extracción e indexado a la entidad', async () => {
        enLaBase = { f1: recurso('yo', 'Uno') };
        const [r] = await repo.getResourcesByIds('yo', ['f1']);
        expect(r).toMatchObject({ indexingStatus: 'ready', extractionVersion: '3.0-llamaparse', author: 'A' });
    });
});
