import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Las 8 funciones del servidor llamaban a Claude Sonnet directo: sin
 * respaldo y sin poder cambiar de modelo sin deploy (2026-10-15: la cuenta de
 * Anthropic se quedó sin saldo y nada lo avisó).
 */
const rutaPropiaPara = vi.fn();
vi.mock('../ruteoDeModelos', () => ({ rutaPropiaPara: (f: string) => rutaPropiaPara(f) }));
vi.mock('../llmUsageRecorder', () => ({ recordLlmUsage: vi.fn() }));
const { ClienteConRespaldo, clientePorRuta, MENSAJE_SIN_RESPUESTA } = await import('../clientePorRuta');
const { AnthropicLlmClient } = await import('../AnthropicLlmClient');
const { OpenAiLlmClient } = await import('../OpenAiLlmClient');

const usage = { feature: 'adjudicateAnchorRefutes' as const, userId: 'u' };

beforeEach(() => {
    rutaPropiaPara.mockReset();
    process.env.ANTHROPIC_API_KEY = 'a';
    process.env.OPENAI_API_KEY = 'o';
    process.env.GEMINI_API_KEY = 'g';
});

describe('clientePorRuta', () => {
    it('sin ruta propia sigue con Sonnet, como antes (no con la de por defecto)', async () => {
        rutaPropiaPara.mockResolvedValue(null);
        const c = await clientePorRuta({ usage, timeoutSeconds: 60 }) as unknown as { principal: unknown };
        expect(c.principal).toBeInstanceOf(AnthropicLlmClient);
    });
    it('con ruta a OpenAI, usa OpenAI', async () => {
        rutaPropiaPara.mockResolvedValue({ provider: 'openai', model: 'gpt-6.1-sol', reasoning: 'low' });
        const c = await clientePorRuta({ usage, timeoutSeconds: 60 }) as unknown as { principal: unknown };
        expect(c.principal).toBeInstanceOf(OpenAiLlmClient);
    });
});

describe('ClienteConRespaldo — plazo de la función, no de cada llamada', () => {
    const ok = (t: string) => ({ generate: vi.fn().mockResolvedValue(t) });
    const falla = () => ({ generate: vi.fn().mockRejectedValue(new Error('OpenAI HTTP 429: insufficient_quota')) });
    beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {}); });

    it('si el proveedor falla con tiempo, responde Gemini con un tope de salida holgado', async () => {
        const gemini = ok('de gemini');
        await expect(new ClienteConRespaldo(falla(), gemini, 'f', 60_000).generate({ prompt: 'x', maxOutputTokens: 1024 })).resolves.toBe('de gemini');
        expect(gemini.generate.mock.calls[0]![0].maxOutputTokens).toBe(8192);
    });

    it('el pedido al principal se corta antes de invadir la reserva del respaldo', async () => {
        const principal = ok('ok');
        await new ClienteConRespaldo(principal, ok('x'), 'f', 60_000).generate({ prompt: 'x' });
        expect(principal.generate.mock.calls[0]![0].signal).toBeInstanceOf(AbortSignal);
    });

    it('caído una vez, el resto de la función va directo a Gemini', async () => {
        const principal = falla();
        const c = new ClienteConRespaldo(principal, ok('g'), 'f', 120_000);
        for (let i = 0; i < 5; i++) await c.generate({ prompt: 'x' });
        expect(principal.generate).toHaveBeenCalledTimes(1);
    });

    it('si ya no queda tiempo, no intenta Gemini; el mensaje no nombra proveedores', async () => {
        let t = 0;
        const lento = { generate: vi.fn(async () => { t = 50_000; throw new Error('OpenAI HTTP 500'); }) };
        const gemini = ok('x');
        const p = new ClienteConRespaldo(lento, gemini, 'f', 60_000, () => t).generate({ prompt: 'x' });
        await expect(p).rejects.toThrow(MENSAJE_SIN_RESPUESTA);
        expect(gemini.generate).not.toHaveBeenCalled();
    });

    it('sin clave del proveedor, va directo a Gemini', async () => {
        await expect(new ClienteConRespaldo(null, ok('de gemini'), 'f', 60_000).generate({ prompt: 'x' })).resolves.toBe('de gemini');
    });
});
