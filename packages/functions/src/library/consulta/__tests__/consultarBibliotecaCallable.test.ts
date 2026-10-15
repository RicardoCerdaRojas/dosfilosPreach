import { describe, expect, it, vi, beforeEach } from 'vitest';

/** El callable: de quién es la consulta, y cuándo se cuenta (revisión adversarial, U2). */
vi.mock('firebase-functions/v2/https', async (orig) => ({ ...(await orig<object>()), onCall: (_o: unknown, h: unknown) => h }));
const docs = new Map<string, Record<string, unknown>>();
let fallaGuardar = false;
vi.mock('firebase-admin/firestore', () => ({
    FieldValue: { arrayUnion: (x: unknown) => ({ arrayUnion: x }) },
    getFirestore: () => ({
        collection: () => ({
            doc: (id = 'nueva') => ({
                id,
                get: async () => ({ exists: docs.has(id), data: () => docs.get(id) }),
                update: async () => { if (fallaGuardar) throw new Error('NOT_FOUND'); },
                set: async (d: Record<string, unknown>) => { docs.set(id, d); },
            }),
        }),
    }),
}));
const sumar = vi.fn();
vi.mock('../cuotaDeConsultas', () => ({ revisarCuota: async () => null, sumarConsulta: (...a: unknown[]) => sumar(...a) }));
vi.mock('../../../shared/rateLimit', () => ({ consumeRateLimitToken: async () => true }));
let fragmentos: unknown[] = [];
vi.mock('../recuperarFragmentos', () => ({ recuperarFragmentos: async () => fragmentos }));
vi.mock('../../../llm/clientePorRuta', () => ({
    MENSAJE_SIN_RESPUESTA: 'sin respuesta',
    clientePorRuta: async () => ({ generate: async () => 'Respuesta [F1].' }),
}));
const { consultarBiblioteca } = await import('../consultarBiblioteca');
const llamar = (data: unknown, uid = 'yo') => (consultarBiblioteca as unknown as (r: unknown) => Promise<{ consultaId: string }>)({ auth: { uid }, data });
const frag = { resourceId: 'v', titulo: 'V', autor: 'Varner', hoja: 190, seccion: '', texto: 'texto', score: 0.9 };

beforeEach(() => {
    docs.clear(); sumar.mockReset(); fallaGuardar = false; fragmentos = [frag];
    process.env.GEMINI_API_KEY = 'k';
});

describe('consultarBiblioteca', () => {
    it('una consulta de otro usuario: no encontrada', async () => {
        docs.set('ajena', { userId: 'otro', alcance: { tipo: 'todo' }, turnos: [] });
        await expect(llamar({ pregunta: '¿?', consultaId: 'ajena' })).rejects.toMatchObject({ code: 'not-found' });
        expect(sumar).not.toHaveBeenCalled();
    });
    it('responde, guarda y DESPUÉS cuenta una consulta', async () => {
        const r = await llamar({ pregunta: '¿Qué dice?', alcance: { tipo: 'todo' } });
        expect(docs.get(r.consultaId)).toMatchObject({ userId: 'yo', titulo: '¿Qué dice?' });
        expect(sumar).toHaveBeenCalledTimes(1);
    });
    it('sin fragmentos: no llama al asistente ni cuenta', async () => {
        fragmentos = [];
        await llamar({ pregunta: '¿Qué dice?', alcance: { tipo: 'todo' } });
        expect(sumar).not.toHaveBeenCalled();
    });
    it('si guardar el turno falla (la consulta se borró), no se cobra', async () => {
        docs.set('mia', { userId: 'yo', alcance: { tipo: 'todo' }, turnos: [] });
        fallaGuardar = true;
        await expect(llamar({ pregunta: '¿Y?', consultaId: 'mia' })).rejects.toMatchObject({ code: 'not-found' });
        expect(sumar).not.toHaveBeenCalled();
    });
    it('una consulta demasiado grande pide empezar otra', async () => {
        docs.set('grande', { userId: 'yo', alcance: { tipo: 'todo' }, turnos: [{ pregunta: 'x', respuesta: 'y'.repeat(800_000) }] });
        await expect(llamar({ pregunta: '¿Y?', consultaId: 'grande' })).rejects.toMatchObject({ code: 'failed-precondition' });
    });
});
