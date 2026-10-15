import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Las 8 funciones del servidor llamaban a Claude Sonnet directo: sin
 * respaldo y sin poder cambiar de modelo sin deploy (2026-10-15: la cuenta de
 * Anthropic se quedó sin saldo y nada lo avisó).
 */
const rutaPropiaPara = vi.fn();
vi.mock('../ruteoDeModelos', () => ({ rutaPropiaPara: (f: string) => rutaPropiaPara(f) }));
vi.mock('../llmUsageRecorder', () => ({ recordLlmUsage: vi.fn() }));
const { ClienteConRespaldo, clientePorRuta } = await import('../clientePorRuta');
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

describe('ClienteConRespaldo', () => {
    const ok = (t: string) => ({ generate: vi.fn().mockResolvedValue(t) });
    const falla = () => ({ generate: vi.fn().mockRejectedValue(new Error('credit balance is too low')) });

    it('si el proveedor falla con tiempo, responde Gemini', async () => {
        const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(new ClienteConRespaldo(falla(), ok('de gemini'), 'f', 30_000).generate({ prompt: 'x' })).resolves.toBe('de gemini');
        expect(String(aviso.mock.calls[0]![0])).toContain('cae a Gemini');
        aviso.mockRestore();
    });
    it('si falla tarde, el error sube: Gemini no alcanzaría', async () => {
        let t = 0;
        const lento = { generate: vi.fn(async () => { t = 40_000; throw new Error('timeout'); }) };
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        await expect(new ClienteConRespaldo(lento, ok('x'), 'f', 30_000, () => t).generate({ prompt: 'x' })).rejects.toThrow('timeout');
        error.mockRestore();
    });
    it('sin clave del proveedor, va directo a Gemini', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(new ClienteConRespaldo(null, ok('de gemini'), 'f', 30_000).generate({ prompt: 'x' })).resolves.toBe('de gemini');
    });
});
