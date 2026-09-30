import { describe, expect, it, vi } from 'vitest';
import { OpenAiLlmClient } from '../OpenAiLlmClient';

vi.mock('../llmUsageRecorder', () => ({ recordLlmUsage: vi.fn() }));

function respuesta(status: number, cuerpo: unknown): Response {
    return new Response(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo), { status });
}

describe('OpenAiLlmClient', () => {
    it('manda instrucciones, razonamiento y JSON, y devuelve el texto', async () => {
        const fetchImpl = vi.fn(async () => respuesta(200, {
            status: 'completed',
            output: [{ content: [{ type: 'output_text', text: '{"ok":true}' }] }],
            usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15, output_tokens_details: { reasoning_tokens: 0 } },
        }));
        const c = new OpenAiLlmClient('k', 'gpt-6-luna', { feature: 'x' }, 'none', fetchImpl as unknown as typeof fetch);
        const texto = await c.generate({ system: 'Eres tutor.', prompt: 'hola', responseMimeType: 'application/json' });
        expect(texto).toBe('{"ok":true}');
        expect(c.lastTotalTokens).toBe(15);
        const cuerpo = JSON.parse((fetchImpl.mock.calls[0] as unknown[])[1] ? ((fetchImpl.mock.calls[0] as unknown[])[1] as RequestInit).body as string : '{}');
        expect(cuerpo.reasoning).toEqual({ effort: 'none' });
        expect(cuerpo.text).toEqual({ format: { type: 'json_object' } });
        // json_object exige la palabra JSON en la ENTRADA: en las
        // instrucciones la API la rechaza con un 400.
        expect(cuerpo.input).toMatch(/JSON/);
        expect(cuerpo.instructions).toBe('Eres tutor.');
    });

    it('una respuesta incompleta es un error, no media respuesta', async () => {
        const fetchImpl = vi.fn(async () => respuesta(200, { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output_text: 'medio' }));
        const c = new OpenAiLlmClient('k', 'gpt-6-luna', undefined, 'none', fetchImpl as unknown as typeof fetch);
        await expect(c.generate({ prompt: 'x' })).rejects.toThrow(/incompleta.*max_output_tokens/);
    });

    it('sin saldo no reintenta; un 503 sí', async () => {
        const sinSaldo = vi.fn(async () => respuesta(429, '{"error":{"code":"billing_not_active"}}'));
        await expect(new OpenAiLlmClient('k', 'm', undefined, 'none', sinSaldo as unknown as typeof fetch).generate({ prompt: 'x' })).rejects.toThrow(/429/);
        expect(sinSaldo).toHaveBeenCalledTimes(1);

        let n = 0;
        const caido = vi.fn(async () => (++n < 2 ? respuesta(503, 'down') : respuesta(200, { status: 'completed', output_text: 'ok' })));
        await expect(new OpenAiLlmClient('k', 'm', undefined, 'none', caido as unknown as typeof fetch).generate({ prompt: 'x' })).resolves.toBe('ok');
        expect(caido).toHaveBeenCalledTimes(2);
    }, 10_000);
});
