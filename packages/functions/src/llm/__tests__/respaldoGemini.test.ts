import { describe, it, expect, vi } from 'vitest';
import { conRespaldo } from '../runLlmPrompt';

/**
 * TP #7: tres fallas de OpenAI en un día dejaron trabado al estudiante (bucle
 * hasta max_output_tokens, filtro de uso, ECONNRESET). Cualquier falla del otro
 * proveedor cae a Gemini en silencio, con registro.
 */
describe('conRespaldo', () => {
    it('lo que responde el otro proveedor pasa tal cual', async () => {
        await expect(conRespaldo(async () => ({ text: 'ok' }), 'f (openai/luna)')).resolves.toEqual({ text: 'ok' });
    });
    it('una falla —incompleta, rechazada o de red— devuelve null y queda en el log', async () => {
        const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
        for (const err of [
            new Error('OpenAI devolvió una respuesta incompleta (max_output_tokens)'),
            new Error('OpenAI HTTP 400: Invalid prompt: your prompt was flagged'),
            new TypeError('fetch failed'),
        ]) {
            await expect(conRespaldo(async () => { throw err; }, 'exegesis.planStepCorpus (openai/gpt-6-luna)')).resolves.toBeNull();
        }
        expect(aviso).toHaveBeenCalledTimes(3);
        expect(String(aviso.mock.calls[0]![0])).toContain('exegesis.planStepCorpus (openai/gpt-6-luna) cae a Gemini');
        aviso.mockRestore();
    });
});
