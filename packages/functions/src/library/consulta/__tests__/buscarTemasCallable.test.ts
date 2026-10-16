import { describe, expect, it, vi, beforeEach } from 'vitest';

/** «Buscar temas» queda en el historial (fundador, 2026-10-16). */
vi.mock('firebase-functions/v2/https', async (orig) => ({ ...(await orig<object>()), onCall: (_o: unknown, h: unknown) => h }));
const guardados = new Map<string, Record<string, unknown>>();
let fallaGuardar = false;
function docsDe(filtros: Array<[string, unknown]>) {
    return [...guardados.entries()]
        .filter(([, d]) => filtros.every(([c, v]) => d[c] === v))
        .map(([id, d]) => ({ id, data: () => d, ref: { update: async (u: Record<string, unknown>) => { guardados.set(id, { ...d, ...u }); actualizaciones++; } } }));
}
function consulta(filtros: Array<[string, unknown]>): unknown {
    return {
        where: (c: string, _op: string, v: unknown) => consulta([...filtros, [c, v]]),
        limit: () => consulta(filtros),
        get: async () => ({ docs: docsDe(filtros) }),
        doc: () => ({ id: `nueva${guardados.size}`, set: async (d: Record<string, unknown>) => { if (fallaGuardar) throw new Error('UNAVAILABLE'); guardados.set(`nueva${guardados.size}`, d); } }),
    };
}
let actualizaciones = 0;
vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({ collection: () => consulta([]) }) }));
vi.mock('../../../shared/rateLimit', () => ({ consumeRateLimitToken: async () => true }));
const frag = { id: 'v190', resourceId: 'v', titulo: 'Varner', autor: 'Varner', hoja: 190, seccion: 'Paragraph 22', texto: '| P | S |\n| :---: | :---: |\n| texto |', score: 0.8, pertinencia: 9 };
vi.mock('../recuperarFragmentos', () => ({ buscarPertinentes: async () => ({ fragmentos: [frag], reordenado: true }) }));
const { buscarTemasEnBiblioteca } = await import('../buscarTemas');
const llamar = (data: unknown) => (buscarTemasEnBiblioteca as unknown as (r: unknown) => Promise<{ consultaId: string | null; libros: unknown[] }>)({ auth: { uid: 'yo' }, data });

beforeEach(() => { guardados.clear(); fallaGuardar = false; actualizaciones = 0; process.env.GEMINI_API_KEY = 'k'; });

describe('buscarTemasEnBiblioteca — historial', () => {
    it('guarda la búsqueda con su resultado y devuelve su id', async () => {
        const r = await llamar({ consulta: 'la oración por los enfermos', alcance: { tipo: 'todo' } });
        expect(r.consultaId).toBe('nueva0');
        expect(guardados.get('nueva0')).toMatchObject({
            userId: 'yo', tipo: 'temas', titulo: 'la oración por los enfermos',
            temas: { consulta: 'la oración por los enfermos', reordenado: true, libros: [{ resourceId: 'v', hojas: [{ hoja: 190, extracto: 'P S texto' }] }] },
        });
    });
    it('si guardar falla, el resultado igual se muestra', async () => {
        fallaGuardar = true;
        const r = await llamar({ consulta: 'la oración', alcance: { tipo: 'todo' } });
        expect(r.consultaId).toBeNull();
        expect(r.libros).toHaveLength(1);
    });
    it('repetir la misma búsqueda actualiza la guardada en vez de duplicarla; otro alcance es otra búsqueda', async () => {
        const a = await llamar({ consulta: 'la oración', alcance: { tipo: 'todo' } });
        const b = await llamar({ consulta: 'la oración', alcance: { tipo: 'todo' } });
        expect(b.consultaId).toBe(a.consultaId);
        expect(guardados.size).toBe(1);
        expect(actualizaciones).toBe(1);
        const c = await llamar({ consulta: 'la oración', alcance: { tipo: 'libros', ids: ['v'] } });
        expect(c.consultaId).not.toBe(a.consultaId);
        expect(guardados.size).toBe(2);
    });
});

