import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { FragmentoRecuperado } from '../armarConsulta';

/**
 * Búsqueda por pasaje (fase «buscador de la biblioteca», etapa 3): siempre
 * por el `userId` de quien pregunta, y si el índice falta, degrada a
 * vectores sin romper.
 */
type Filtro = [string, string, unknown];
const lecturas: Filtro[][] = [];
const topes: number[] = [];
let docsDelIndice: Array<{ id: string; data: Record<string, unknown> }> = [];
let fallaElIndice = false;

function doc(d: { id: string; data: Record<string, unknown> }) {
    return { id: d.id, data: () => d.data, get: (campo: string) => d.data[campo] };
}
let librosDelUsuario: string[] = [];
function consulta(filtros: Filtro[], tope = Infinity): Record<string, unknown> {
    return {
        where: (campo: string, op: string, valor: unknown) => consulta([...filtros, [campo, op, valor]], tope),
        select: () => consulta(filtros, tope),
        limit: (n: number) => consulta(filtros, n),
        get: async () => {
            lecturas.push(filtros);
            topes.push(tope);
            if (fallaElIndice) throw new Error('FAILED_PRECONDITION: The query requires an index.');
            const porRecurso = filtros.find(f => f[0] === 'resourceId')?.[2];
            const refs = (filtros.find(f => f[0] === 'refs')?.[2] as string[] | undefined) ?? [];
            // Como Firestore: en orden de id y cortado por el `limit`.
            const docs = docsDelIndice
                .filter(d => porRecurso === undefined || d.data.resourceId === porRecurso)
                .filter(d => (d.data.refs as string[]).some(r => refs.includes(r)))
                .sort((a, b) => a.id.localeCompare(b.id))
                .slice(0, tope);
            return { docs: docs.map(doc) };
        },
        findNearest: () => ({ get: async () => ({ docs: docsVectoriales.map(doc) }) }),
    };
}
const recursos = { where: () => ({ select: () => ({ get: async () => ({ docs: librosDelUsuario.map(id => ({ id })) }) }) }) };
let docsVectoriales: Array<{ id: string; data: Record<string, unknown> }> = [];
vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({ collection: (nombre: string) => (nombre === 'library_resources' ? recursos : consulta([])) }) }));
vi.mock('../../retrieveChunks', () => ({ embedQuery: async () => [0.1, 0.2] }));
const puntuados: string[][] = [];
vi.mock('../reordenar', async (orig) => ({
    ...(await orig<object>()),
    // Sin reordenador: se ve qué candidatos le llegaron y el camino de respaldo.
    puntuarCandidatos: async (_b: string, candidatos: FragmentoRecuperado[]) => { puntuados.push(candidatos.map(c => c.id!)); return null; },
}));
const { recuperarPorPasaje, elegirPorPasaje, unirCandidatos, buscarPertinentes, LECTURA_POR_LIBRO } = await import('../recuperarFragmentos');

const frag = (id: string, resourceId = 'r1'): FragmentoRecuperado => ({ id, resourceId, titulo: 't', autor: 'a', hoja: 1, seccion: '', texto: id, score: 0 });
const chunk = (id: string, resourceId: string, refs: string[]) => ({ id, data: { resourceId, resourceTitle: 'T', resourceAuthor: 'A', text: `texto ${id}`, metadata: { page: 3 }, refs } });

beforeEach(() => { lecturas.length = 0; topes.length = 0; puntuados.length = 0; docsDelIndice = []; docsVectoriales = []; fallaElIndice = false; librosDelUsuario = []; });

describe('recuperarPorPasaje — sólo la biblioteca de quien pregunta', () => {
    it('toda la biblioteca: un libro por vez, todas las lecturas por userId', async () => {
        librosDelUsuario = ['a', 'b'];
        await recuperarPorPasaje(['JAS.5.14'], 'yo', { tipo: 'todo' });
        expect(lecturas).toEqual([
            [['userId', '==', 'yo'], ['resourceId', '==', 'a'], ['refs', 'array-contains-any', ['JAS.5.14']]],
            [['userId', '==', 'yo'], ['resourceId', '==', 'b'], ['refs', 'array-contains-any', ['JAS.5.14']]],
        ]);
    });

    it('libros elegidos: sólo esos, todas por userId', async () => {
        await recuperarPorPasaje(['JAS.5.14'], 'yo', { tipo: 'libros', ids: ['a', 'b', 'a'] });
        expect(lecturas.map(l => l.slice(0, 2))).toEqual([
            [['userId', '==', 'yo'], ['resourceId', '==', 'a']],
            [['userId', '==', 'yo'], ['resourceId', '==', 'b']],
        ]);
    });

    it('un libro con muchas citas no deja afuera a los que vienen después en el abecedario', async () => {
        librosDelUsuario = ['aaa', 'zzz'];
        docsDelIndice = [
            ...Array.from({ length: 200 }, (_, i) => chunk(`aaa_chunk_${i}`, 'aaa', ['JAS.5.14'])),
            chunk('zzz_chunk_0', 'zzz', ['JAS.5.14']),
        ];
        const r = await recuperarPorPasaje(['JAS.5.14'], 'yo', { tipo: 'todo' });
        expect(r.map(f => f.id)).toContain('zzz_chunk_0');
        // Y de cada libro se lee poco: el costo no crece con las citas del libro.
        expect(topes).toEqual([LECTURA_POR_LIBRO, LECTURA_POR_LIBRO]);
        expect(LECTURA_POR_LIBRO).toBeLessThanOrEqual(20);
    });

    it('sin pasaje no lee nada', async () => {
        expect(await recuperarPorPasaje([], 'yo', { tipo: 'todo' })).toEqual([]);
        expect(lecturas).toHaveLength(0);
    });

    it('si el índice falta, devuelve vacío en vez de romper', async () => {
        librosDelUsuario = ['a'];
        fallaElIndice = true;
        expect(await recuperarPorPasaje(['JAS.5.14'], 'yo', { tipo: 'todo' })).toEqual([]);
    });
});

describe('elegirPorPasaje', () => {
    it('primero los que nombran más versículos pedidos', () => {
        const docs = [
            { fragmento: frag('uno'), refs: ['JAS.5', 'JAS.5.14'] },
            { fragmento: frag('tres'), refs: ['JAS.5.14', 'JAS.5.15', 'JAS.5.16'] },
            { fragmento: frag('nada'), refs: ['GEN.1.1'] },
        ];
        expect(elegirPorPasaje(docs, ['JAS.5.14', 'JAS.5.15', 'JAS.5.16'], 10).map(f => f.id)).toEqual(['tres', 'uno']);
    });

    it('un versículo pedido pesa más que su capítulo; a igualdad, la hoja más temprana', () => {
        const conHoja = (id: string, hoja: number) => ({ ...frag(id), hoja });
        const docs = [
            { fragmento: conHoja('capitulo', 1), refs: ['JAS.5'] },
            { fragmento: conHoja('versiculo-tarde', 9), refs: ['JAS.5.14'] },
            { fragmento: conHoja('versiculo-temprano', 2), refs: ['JAS.5.14'] },
        ];
        expect(elegirPorPasaje(docs, ['JAS.5.14', 'JAS.5'], 10).map(f => f.id)).toEqual(['versiculo-temprano', 'versiculo-tarde', 'capitulo']);
    });

    it('con tope por libro, para que un comentario no ocupe todo el cupo', () => {
        const docs = Array.from({ length: 10 }, (_, i) => ({ fragmento: frag(`a${i}`, 'comentario'), refs: ['JAS.5.14'] }))
            .concat([{ fragmento: frag('b0', 'otro'), refs: ['JAS.5.14'] }]);
        const elegidos = elegirPorPasaje(docs, ['JAS.5.14'], 6);
        expect(elegidos.filter(f => f.resourceId === 'comentario')).toHaveLength(4);
        expect(elegidos.map(f => f.id)).toContain('b0');
    });
});

describe('unirCandidatos', () => {
    it('los del pasaje primero y sin repetir', () => {
        expect(unirCandidatos([frag('p1'), frag('x')], [frag('x'), frag('v1')]).map(f => f.id)).toEqual(['p1', 'x', 'v1']);
    });
});

describe('buscarPertinentes con un pasaje en la búsqueda', () => {
    it('los fragmentos que lo citan llegan al reordenador aunque los vectores no los vean', async () => {
        docsVectoriales = [chunk('v1', 'r1', []), chunk('v2', 'r1', [])];
        docsDelIndice = [chunk('cita', 'r2', ['JAS.5', 'JAS.5.14'])];
        librosDelUsuario = ['r1', 'r2'];
        const r = await buscarPertinentes('santiago 5:14 aceite', 'yo', { tipo: 'todo' }, 'k', { total: 10, timeoutSeconds: 5 });
        expect(puntuados[0]).toEqual(['cita', 'v1', 'v2']);
        // Sin reordenador nadie juzgó la cita: manda el orden de los vectores.
        expect(r.fragmentos.map(f => f.id)).toEqual(['v1', 'v2', 'cita']);
    });

    it('sin pasaje en la búsqueda no consulta el índice', async () => {
        docsVectoriales = [chunk('v1', 'r1', [])];
        await buscarPertinentes('la oración por los enfermos', 'yo', { tipo: 'todo' }, 'k', { total: 10, timeoutSeconds: 5 });
        expect(lecturas).toHaveLength(0);
        expect(puntuados[0]).toEqual(['v1']);
    });

    it('el total de candidatos no pasa de 40 + 8', async () => {
        docsVectoriales = Array.from({ length: 40 }, (_, i) => chunk(`v${i}`, `r${i % 5}`, []));
        docsDelIndice = Array.from({ length: 30 }, (_, i) => chunk(`p${i}`, `q${i % 6}`, ['JAS.5.14']));
        librosDelUsuario = ['q0', 'q1', 'q2', 'q3', 'q4', 'q5'];
        await buscarPertinentes('Stg 5:14', 'yo', { tipo: 'todo' }, 'k', { total: 10, timeoutSeconds: 5 });
        expect(puntuados[0]).toHaveLength(48);
        expect(puntuados[0]!.filter(id => id.startsWith('p'))).toHaveLength(16);
    });

    it('U6, modo pasaje: a lo sumo 3 por libro, para que hablen varios autores', async () => {
        docsVectoriales = [];
        docsDelIndice = Array.from({ length: 12 }, (_, i) => chunk(`a${String(i).padStart(2, '0')}`, 'unLibro', ['JAS.3.13']))
            .concat(Array.from({ length: 4 }, (_, i) => chunk(`b${i}`, 'otroLibro', ['JAS.3.13'])));
        librosDelUsuario = ['unLibro', 'otroLibro'];
        const r = await buscarPertinentes('santiago 3:13', 'yo', { tipo: 'todo' }, 'k', { total: 14, timeoutSeconds: 5, modoPasaje: true });
        const porLibro = (id: string) => r.fragmentos.filter(f => f.resourceId === id).length;
        expect(porLibro('unLibro')).toBeLessThanOrEqual(3);
        expect(porLibro('otroLibro')).toBeGreaterThan(0);
    });

    it('U6, modo pasaje con libros ELEGIDOS: no se recorta a 3 por libro', async () => {
        docsVectoriales = [];
        docsDelIndice = Array.from({ length: 10 }, (_, i) => chunk(`a${String(i).padStart(2, '0')}`, 'unLibro', ['JAS.3.13']));
        const r = await buscarPertinentes('santiago 3:13', 'yo', { tipo: 'libros', ids: ['unLibro', 'otroLibro'] }, 'k', { total: 14, timeoutSeconds: 5, modoPasaje: true });
        expect(r.fragmentos.filter(f => f.resourceId === 'unLibro').length).toBeGreaterThan(3);
    });
});
