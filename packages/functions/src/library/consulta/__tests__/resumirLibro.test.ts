import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FragmentoDelLibro } from '../resumirLibro';

// ── Dobles: Firestore en memoria, cuota y asistente ──
const docs: Record<string, Record<string, unknown> | undefined> = {};
const chunks: Array<{ text: string; metadata: { page: number; sectionPath: string[] }; chunkIndex: number }> = [];
const sumadas: string[] = [];
let lecturasDelLibro = 0;
let respuestaDelAsistente = '';
const pedidos: Array<{ system: string; prompt: string }> = [];

vi.mock('firebase-functions/v2/https', async (orig) => ({ ...(await orig<object>()), onCall: (_o: unknown, h: unknown) => h }));
vi.mock('../../../shared/rateLimit', () => ({ consumeRateLimitToken: async () => true }));
vi.mock('../cuotaDeConsultas', () => ({ revisarCuota: async () => null, sumarConsulta: async (u: string) => { sumadas.push(u); } }));
vi.mock('../../../llm/clientePorRuta', () => ({
    MENSAJE_SIN_RESPUESTA: 'sin respuesta',
    clientePorRuta: async () => ({ generate: async (p: { system: string; prompt: string }) => { pedidos.push(p); return respuestaDelAsistente; } }),
}));
vi.mock('firebase-admin/firestore', () => ({
    getFirestore: () => ({
        collection: (c: string) => {
            if (c === 'document_chunks') {
                const q = { where: () => q, select: () => q, get: async () => { lecturasDelLibro++; return { docs: chunks.map(ch => ({ get: (k: string) => (ch as Record<string, unknown>)[k] })) }; } };
                return q;
            }
            return { doc: (id: string) => ({
                get: async () => ({ data: () => docs[`${c}/${id}`] }),
                set: async (d: Record<string, unknown>) => { docs[`${c}/${id}`] = d; },
            }) };
        },
    }),
}));

const { armarSecciones, tramoDeLaSeccion, leerResumen, aLoSumo, resumirEnBiblioteca, MAX_HOJAS } = await import('../resumirLibro');
const llamar = (uid: string, data: unknown) => (resumirEnBiblioteca as unknown as (r: unknown) => Promise<Record<string, unknown>>)({ auth: { uid }, data });

const frag = (hoja: number, seccion: string[], orden: number, texto = `texto ${hoja}`): FragmentoDelLibro => ({ hoja, seccion, orden, texto });

beforeEach(() => {
    for (const k of Object.keys(docs)) delete docs[k];
    chunks.length = 0; sumadas.length = 0; pedidos.length = 0; lecturasDelLibro = 0;
    docs['library_resources/libro'] = { userId: 'yo', title: 'Santiago', author: 'Varner', indexedAt: 111 };
    for (let h = 1; h <= 30; h++) chunks.push({ text: `hoja ${h}`, metadata: { page: h, sectionPath: [h <= 10 ? 'Capítulo 1' : 'Capítulo 2'] }, chunkIndex: h });
    respuestaDelAsistente = JSON.stringify({ resumen: 'De qué trata.', puntos: [{ texto: 'Una idea', refs: [2, 99] }] });
});

describe('armarSecciones', () => {
    it('una sección por encabezado, en orden, con sus hojas y su comienzo', () => {
        const s = armarSecciones([frag(1, ['A'], 1, 'inicio de A'), frag(3, ['A'], 2), frag(4, ['B', 'b1'], 3, 'inicio de B')]);
        expect(s).toEqual([
            { n: 1, titulo: 'A', desde: 1, hasta: 3, comienzo: 'inicio de A' },
            { n: 2, titulo: 'B › b1', desde: 4, hasta: 4, comienzo: 'inicio de B' },
        ]);
    });
    it('demasiadas secciones (un diccionario): se agrupan por el primer nivel', () => {
        const muchas = Array.from({ length: 10 }, (_, i) => frag(i + 1, [i < 5 ? 'Alef' : 'Bet', `entrada ${i}`], i));
        expect(armarSecciones(muchas, 5).map(s => s.titulo)).toEqual(['Alef', 'Bet']);
    });
});

describe('tramoDeLaSeccion', () => {
    const libro = [...Array.from({ length: 10 }, (_, i) => frag(i + 1, ['Cap 1'], i)), ...Array.from({ length: 100 }, (_, i) => frag(i + 11, ['Cap 2'], i + 10))];
    it('las hojas de la sección de la hoja pedida', () => {
        expect(tramoDeLaSeccion(libro, 4)).toEqual({ desde: 1, hasta: 10, titulo: 'Cap 1' });
    });
    it('más de 60 hojas: bloques FIJOS desde el comienzo del capítulo, sin salirse de él', () => {
        // Cap 2 = hojas 11–110 (100 hojas): bloque 1 = 11–70, bloque 2 = 71–110.
        expect(tramoDeLaSeccion(libro, 50)).toEqual({ desde: 11, hasta: 70, titulo: 'Cap 2 (parte 1 de 2)' });
        expect(tramoDeLaSeccion(libro, 51)).toEqual(tramoDeLaSeccion(libro, 50));
        expect(tramoDeLaSeccion(libro, 90)).toEqual({ desde: 71, hasta: 110, titulo: 'Cap 2 (parte 2 de 2)' });
    });
});

describe('leerResumen', () => {
    it('pone las hojas desde los números citados y descarta los que no existen', () => {
        const r = leerResumen(JSON.stringify({ resumen: 'x', puntos: [{ texto: 'a', refs: [1, 7] }] }), n => (n === 1 ? [12] : []), 300);
        expect(r).toEqual({ resumen: 'x', puntos: [{ texto: 'a', hojas: [12] }] });
    });
    it('respuesta ilegible o vacía: null', () => {
        expect(leerResumen('no es json', () => [], 300)).toBeNull();
        expect(leerResumen(JSON.stringify({ resumen: ' ', puntos: [] }), () => [], 300)).toBeNull();
    });
    it('acepta «S3»/«F2» como referencia (el respaldo a veces copia la marca)', () => {
        const r = leerResumen(JSON.stringify({ resumen: 'x', puntos: [{ texto: 'a', refs: ['S1', '[F2]', 3] }] }), n => [n * 10], 300);
        expect(r?.puntos[0]!.hojas).toEqual([10, 20, 30]);
    });
    it('corta el resumen al tope de palabras', () => {
        expect(aLoSumo('uno dos tres cuatro', 2)).toBe('uno dos…');
    });
});

describe('resumirEnBiblioteca', () => {
    it('el mapa: lee sólo el comienzo de cada sección, cuenta una consulta y lo guarda', async () => {
        const r = await llamar('yo', { resourceId: 'libro', tipo: 'mapa' });
        expect(r).toMatchObject({ tipo: 'mapa', resumen: 'De qué trata.', guardado: false });
        expect(r.puntos).toEqual([{ texto: 'Una idea', hojas: [11] }]); // [S2] = Capítulo 2, hoja 11; [S99] no existe
        expect(pedidos[0]!.prompt).toContain('[S1] Capítulo 1');
        expect(sumadas).toEqual(['yo']);
        expect(docs['library_summaries/libro_mapa']).toMatchObject({ userId: 'yo', version: 111 });
    });

    it('pedirlo otra vez no llama al asistente, no cuenta y NO lee el libro', async () => {
        await llamar('yo', { resourceId: 'libro', tipo: 'mapa' });
        const r = await llamar('yo', { resourceId: 'libro', tipo: 'mapa' });
        expect(r.guardado).toBe(true);
        expect(pedidos).toHaveLength(1);
        expect(sumadas).toEqual(['yo']);
        expect(lecturasDelLibro).toBe(1);
    });

    it('«este capítulo» otra vez desde la misma hoja: el alias evita leer el libro; desde otra hoja del mismo capítulo, no cobra', async () => {
        await llamar('yo', { resourceId: 'libro', tipo: 'seccion', hoja: 15 });
        const r = await llamar('yo', { resourceId: 'libro', tipo: 'seccion', hoja: 15 });
        expect(r.guardado).toBe(true);
        expect(lecturasDelLibro).toBe(1);
        const otra = await llamar('yo', { resourceId: 'libro', tipo: 'seccion', hoja: 20 });
        expect(otra.guardado).toBe(true);
        expect(pedidos).toHaveLength(1);
        expect(sumadas).toEqual(['yo']);
    });

    it('si el libro se reindexó, el guardado ya no vale', async () => {
        await llamar('yo', { resourceId: 'libro', tipo: 'mapa' });
        docs['library_resources/libro']!.indexedAt = 222;
        const r = await llamar('yo', { resourceId: 'libro', tipo: 'mapa' });
        expect(r.guardado).toBe(false);
        expect(pedidos).toHaveLength(2);
    });

    it('«este capítulo»: el servidor halla la sección de la hoja y resume sólo esas hojas', async () => {
        const r = await llamar('yo', { resourceId: 'libro', tipo: 'seccion', hoja: 15 });
        expect(r).toMatchObject({ tipo: 'seccion', desde: 11, hasta: 30, titulo: 'Capítulo 2' });
        expect(pedidos[0]!.prompt).toContain('(hoja 11)');
        expect(pedidos[0]!.prompt).not.toContain('(hoja 10)');
        expect(r.puntos).toEqual([{ texto: 'Una idea', hojas: [12] }]); // [F2] = la segunda hoja del tramo
    });

    it('el libro de otro usuario no se resume (ni se revela)', async () => {
        await expect(llamar('otro', { resourceId: 'libro', tipo: 'mapa' })).rejects.toMatchObject({ code: 'not-found' });
        expect(pedidos).toHaveLength(0);
    });

    it('un libro de la biblioteca común sí', async () => {
        docs['library_resources/libro']!.userId = '__system__';
        await expect(llamar('cualquiera', { resourceId: 'libro', tipo: 'mapa' })).resolves.toMatchObject({ tipo: 'mapa' });
    });

    it('más de 60 páginas: se rechaza antes de leer', async () => {
        await expect(llamar('yo', { resourceId: 'libro', tipo: 'paginas', desde: 1, hasta: 61 })).rejects.toMatchObject({ code: 'invalid-argument' });
        expect(pedidos).toHaveLength(0);
    });
});
