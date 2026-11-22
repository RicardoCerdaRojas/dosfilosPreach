import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * A8c: el corpus curado de un trabajo lee un libro de la biblioteca
 * compartida con su dueño (`__system__`) si su texto se puede leer, y no lo
 * lee si está protegido. Un libro de otro usuario sigue sin traer nada.
 */
vi.mock('firebase-functions/v2/https', async (orig) => ({ ...(await orig<object>()), onCall: (_o: unknown, h: unknown) => h }));
vi.mock('../../config/appCheckOptions', () => ({ appCheckCallableOptions: () => ({}) }));
vi.mock('../retrieveChunks', () => ({ embedQuery: async () => [1, 0] }));
vi.mock('../bibliotecaCompartida', async (orig) => ({
    ...(await orig<object>()),
    recursosCompartidos: async () => new Map([
        ['jfb', { id: 'jfb', textoLegible: true, citaPorSeccion: true }],
        ['protegido', { id: 'protegido', textoLegible: false, citaPorSeccion: false }],
    ]),
}));
const consultas: Array<Array<[string, string, unknown]>> = [];
function consulta(filtros: Array<[string, string, unknown]>) {
    const filas = () => {
        consultas.push(filtros);
        const dueno = filtros.find(f => f[0] === 'userId')?.[2];
        const rid = filtros.find(f => f[0] === 'resourceId')?.[2];
        // Solo hay fragmentos del dueño verdadero de cada libro.
        const duenoReal = rid === 'jfb' || rid === 'protegido' ? '__system__' : rid === 'mio' ? 'yo' : 'otro';
        if (dueno !== duenoReal) return [];
        return [{ data: () => ({ chunkIndex: 0, text: `texto de ${rid}`, userId: duenoReal, metadata: { page: 1, section: 'GEN 1:1' }, _distance: 0.1 }) }];
    };
    return {
        where: (c: string, op: string, v: unknown) => consulta([...filtros, [c, op, v]]),
        findNearest: () => ({ get: async () => { const docs = filas(); return { docs, size: docs.length }; } }),
        select: () => ({ limit: () => ({ get: async () => ({ docs: filas() }) }) }),
    };
}
let porClave: Array<Record<string, unknown>> = [];
vi.mock('firebase-admin/firestore', () => ({
    FieldValue: { vector: (v: number[]) => v },
    getFirestore: () => ({
        collection: () => ({ ...consulta([]), doc: (id: string) => ({ id }) }),
        getAll: async () => porClave.map(d => ({ exists: true, data: () => d })),
    }),
}));
const { retrieveCuratedCorpus } = await import('../retrieveCuratedCorpus');
type Respuesta = { chunks: Array<{ resourceId: string; text: string; sheet: number | null }>; protectedSources: string[]; emptySources: string[] };
const llamar = (ids: string[]) => (retrieveCuratedCorpus as unknown as (r: unknown) => Promise<Respuesta>)({
    auth: { uid: 'yo' },
    data: { query: 'q', sources: ids.map(resourceId => ({ resourceId, sheetRanges: [{ start: 1, end: 5 }] })) },
});

beforeEach(() => { consultas.length = 0; porClave = []; process.env.GEMINI_API_KEY = 'k'; });

describe('retrieveCuratedCorpus — biblioteca compartida (A8c)', () => {
    it('JFB se lee con su dueño y sin hoja; el protegido no se pide; el ajeno no trae nada', async () => {
        const r = await llamar(['mio', 'jfb', 'protegido', 'de-otro']);
        expect(r.chunks.map(c => c.resourceId).sort()).toEqual(['jfb', 'mio']);
        expect(r.chunks.find(c => c.resourceId === 'jfb')?.sheet).toBeNull();
        expect(r.chunks.find(c => c.resourceId === 'mio')?.sheet).toBe(1);
        expect(r.protectedSources).toEqual(['protegido']);
        // El protegido vuelve vacío también, para quien solo lee `emptySources`.
        expect(r.emptySources.sort()).toEqual(['de-otro', 'protegido']);
        // Ninguna consulta pidió el libro protegido.
        expect(consultas.some(f => f.some(x => x[0] === 'resourceId' && x[2] === 'protegido'))).toBe(false);
        // El ajeno se pidió con el userId de quien pregunta.
        expect(consultas.filter(f => f.some(x => x[2] === 'de-otro')).every(f => f.some(x => x[0] === 'userId' && x[2] === 'yo'))).toBe(true);
    });

    it('por clave (la receta trae sus fragmentos): un fragmento compartido de un libro que no está entre los legibles no sale', async () => {
        // Un compartido protegido creado después de llenar la caché: no está en el mapa,
        // su dueño se toma como el usuario y se lee por clave. Sus fragmentos llevan `stores`.
        const fila = (userId: string) => ({ chunkIndex: 0, text: 'texto', userId, stores: ['exegesis'], metadata: { page: 2, section: null }, embedding: [1, 0] });
        porClave = [fila('__system__')];
        const pedir = (resourceId: string) => (retrieveCuratedCorpus as unknown as (r: unknown) => Promise<Respuesta>)({
            auth: { uid: 'yo' },
            data: { query: 'q', sources: [{ resourceId, sheetRanges: [{ start: 1, end: 5 }], chunkRanges: [{ start: 0, end: 0 }] }] },
        });
        expect((await pedir('nuevo-protegido')).chunks).toEqual([]);
        // JFB, legible, sí; y sin hoja.
        const jfb = await pedir('jfb');
        expect(jfb.chunks).toHaveLength(1);
        expect(jfb.chunks[0]!.sheet).toBeNull();
        // Un fragmento propio por clave, como siempre.
        porClave = [fila('yo')];
        expect((await pedir('mio')).chunks).toHaveLength(1);
    });
});
