import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `runLlmPrompt` tiene que pasar por el cobro de exégesis ANTES de llamar al
 * modelo (fase «el cobro de la exégesis pasa al servidor», 2026-10-17). Si
 * alguien mueve o quita esa línea, la exégesis vuelve a ser gratis para un
 * navegador modificado sin que nada falle.
 */
const cobros: Array<[string, string, string]> = [];
const modelo = vi.fn();

vi.mock('firebase-functions/v2/https', async (orig) => ({ ...(await orig<object>()), onCall: (_o: unknown, h: unknown) => h }));
vi.mock('firebase-admin', () => ({ firestore: () => ({}) }));
vi.mock('../../shared/rateLimit', () => ({ consumeRateLimitToken: async () => true }));
vi.mock('../llmBudget', () => ({ readBudgetConfig: async () => ({ proxyMaxCallsPerHourPerUser: 120, cobroExegesis: 'obligatorio' }) }));
vi.mock('../ruteoDeModelos', () => ({ rutaPara: async () => null, rutaCompatible: () => true }));
vi.mock('../GeminiLlmClient', () => ({ GeminiLlmClient: class { generate = modelo; } }));
vi.mock('../../exegesis/cobroDeExegesis', () => ({
    cobrarLlamadaDeExegesis: async (uid: string, feature: string, modo: string) => {
        cobros.push([uid, feature, modo]);
        if (feature === 'exegesis.analyzeVerse') throw Object.assign(new Error('sin reserva'), { code: 'failed-precondition' });
    },
}));

process.env.GEMINI_API_KEY = 'x';
const { runLlmPrompt } = await import('../runLlmPrompt');
const llamar = (feature: string) => (runLlmPrompt as unknown as (r: unknown) => Promise<unknown>)({
    auth: { uid: 'pastor' },
    data: { feature, prompt: 'hola' },
});

beforeEach(() => { cobros.length = 0; modelo.mockReset(); modelo.mockResolvedValue('respuesta'); });

describe('runLlmPrompt — cobro de exégesis', () => {
    it('una llamada que cobra sin reserva se corta ANTES del modelo', async () => {
        await expect(llamar('exegesis.analyzeVerse')).rejects.toMatchObject({ code: 'failed-precondition' });
        expect(cobros).toEqual([['pastor', 'exegesis.analyzeVerse', 'obligatorio']]);
        expect(modelo).not.toHaveBeenCalled();
    });

    it('toda llamada pasa por el cobro con su etiqueta y el modo de la configuración', async () => {
        await llamar('sermon.consult').catch(() => undefined);
        expect(cobros).toEqual([['pastor', 'sermon.consult', 'obligatorio']]);
    });

    it('una imagen inválida se rechaza ANTES del cobro (no gasta la reserva)', async () => {
        await expect((runLlmPrompt as unknown as (r: unknown) => Promise<unknown>)({
            auth: { uid: 'pastor' },
            data: { feature: 'exegesis.extractRubric', prompt: 'hola', inlineImage: { mimeType: 'application/pdf', base64: 'x' } },
        })).rejects.toMatchObject({ code: 'invalid-argument' });
        expect(cobros).toEqual([]);
    });
});
