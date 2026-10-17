import { describe, expect, it, vi, beforeEach } from 'vitest';

/** El callable: de quién es la consulta, y cuándo se cuenta (revisión adversarial, U2). */
vi.mock('firebase-functions/v2/https', async (orig) => ({ ...(await orig<object>()), onCall: (_o: unknown, h: unknown) => h }));
const docs = new Map<string, Record<string, unknown>>();
const sistemas: string[] = [];
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
const opcionesDeBusqueda: Array<Record<string, unknown>> = [];
vi.mock('../recuperarFragmentos', () => ({ FRAGMENTOS_POR_CONSULTA: 14, buscarPertinentes: async (_b: string, _u: string, _a: unknown, _k: string, o: Record<string, unknown>) => { opcionesDeBusqueda.push(o); return { fragmentos, reordenado: true }; } }));
vi.mock('../../../llm/clientePorRuta', () => ({
    MENSAJE_SIN_RESPUESTA: 'sin respuesta',
    clientePorRuta: async () => ({ generate: async (p: { system: string }) => { sistemas.push(p.system); return 'Respuesta [F1].'; } }),
}));
const { consultarBiblioteca } = await import('../consultarBiblioteca');
const llamar = (data: unknown, uid = 'yo') => (consultarBiblioteca as unknown as (r: unknown) => Promise<{ consultaId: string }>)({ auth: { uid }, data });
const frag = { resourceId: 'v', titulo: 'V', autor: 'Varner', hoja: 190, seccion: '', texto: 'texto', score: 0.9 };

beforeEach(() => {
    docs.clear(); sumar.mockReset(); fallaGuardar = false; fragmentos = [frag]; opcionesDeBusqueda.length = 0; sistemas.length = 0;
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
    it('una búsqueda de temas guardada no admite preguntas de seguimiento', async () => {
        docs.set('tema', { userId: 'yo', tipo: 'temas', alcance: { tipo: 'todo' }, turnos: [] });
        await expect(llamar({ pregunta: '¿Y?', consultaId: 'tema' })).rejects.toMatchObject({ code: 'failed-precondition' });
        expect(sumar).not.toHaveBeenCalled();
    });

    it('U6: una pregunta sobre un pasaje entra en modo pasaje, pide la respuesta por autor y guarda el pasaje', async () => {
        const r = await llamar({ pregunta: '¿Qué dicen mis libros sobre santiago 3:13?', alcance: { tipo: 'todo' } });
        expect(opcionesDeBusqueda[0]).toMatchObject({ modoPasaje: true });
        expect(sistemas[0]).toContain('Santiago 3:13');
        expect(sistemas[0]).toContain('POR AUTOR');
        expect((docs.get(r.consultaId)!.turnos as Array<Record<string, unknown>>)[0]).toMatchObject({ pasaje: 'Santiago 3:13' });
    });

    it('U6: una pregunta sin pasaje sigue como siempre', async () => {
        const r = await llamar({ pregunta: '¿Qué es la oración de fe?', alcance: { tipo: 'todo' } });
        expect(opcionesDeBusqueda[0]).toMatchObject({ modoPasaje: false });
        expect(sistemas[0]).not.toContain('POR AUTOR');
        expect((docs.get(r.consultaId)!.turnos as Array<Record<string, unknown>>)[0]!.pasaje).toBeUndefined();
    });

    it('U6: con un solo libro (el visor) no hay modo pasaje ni regla por autor', async () => {
        await llamar({ pregunta: '¿Qué dice de santiago 3:13?', alcance: { tipo: 'libros', ids: ['v'] } });
        expect(opcionesDeBusqueda[0]).toMatchObject({ modoPasaje: false });
        expect(sistemas[0]).not.toContain('POR AUTOR');
    });

    it('U6: «¿y Moo?» hereda las claves del pasaje anterior para buscar (sin modo pasaje)', async () => {
        docs.set('mia', { userId: 'yo', alcance: { tipo: 'todo' }, turnos: [{ pregunta: 'stg 3:13', respuesta: 'r', fuentes: [], pasaje: 'Stg 3:13' }] });
        await llamar({ pregunta: '¿y Moo?', consultaId: 'mia' });
        expect(opcionesDeBusqueda[0]).toMatchObject({ modoPasaje: false, refsHeredadas: ['JAS.3.13', 'JAS.3'] });
    });

    it('U6: sin fragmentos no se guarda el pasaje (no se muestra «Lo que dicen tus libros…» sobre nada)', async () => {
        fragmentos = [];
        const r = await llamar({ pregunta: '¿Qué dicen sobre santiago 3:13?', alcance: { tipo: 'todo' } });
        expect((docs.get(r.consultaId)!.turnos as Array<Record<string, unknown>>)[0]!.pasaje).toBeUndefined();
    });
});
