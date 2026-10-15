import { describe, expect, it, vi, beforeEach } from 'vitest';

/** El invariante de seguridad: la búsqueda SIEMPRE va por el `userId` de quien pregunta. */
const consultas: Array<Array<[string, string, unknown]>> = [];
function consulta(filtros: Array<[string, string, unknown]>) {
    return {
        where: (campo: string, op: string, valor: unknown) => consulta([...filtros, [campo, op, valor]]),
        findNearest: () => ({ get: async () => { consultas.push(filtros); return { docs: [] }; } }),
    };
}
vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({ collection: () => consulta([]) }) }));
vi.mock('../../retrieveChunks', () => ({ embedQuery: async () => [0.1, 0.2] }));
const { recuperarFragmentos, enTandas } = await import('../recuperarFragmentos');

beforeEach(() => { consultas.length = 0; });

describe('recuperarFragmentos — sólo la biblioteca de quien pregunta', () => {
    it('toda la biblioteca: filtra por userId', async () => {
        await recuperarFragmentos('p', 'yo', { tipo: 'todo' }, 'k');
        expect(consultas).toEqual([[['userId', '==', 'yo']]]);
    });
    it('libros ajenos en el alcance: igual filtra por userId (no trae los del otro)', async () => {
        await recuperarFragmentos('p', 'yo', { tipo: 'libros', ids: ['de-otro'] }, 'k');
        expect(consultas).toEqual([[['userId', '==', 'yo'], ['resourceId', 'in', ['de-otro']]]]);
    });
    it('más de 30 libros: una búsqueda por tanda de 30, todas por userId', async () => {
        const ids = Array.from({ length: 70 }, (_, i) => `r${i}`);
        await recuperarFragmentos('p', 'yo', { tipo: 'libros', ids }, 'k');
        expect(consultas).toHaveLength(3);
        for (const c of consultas) expect(c[0]).toEqual(['userId', '==', 'yo']);
        expect(consultas.flatMap(c => c[1]![2] as string[])).toEqual(ids);
    });
    it('enTandas parte sin perder ni repetir', () => {
        expect(enTandas([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });
});
