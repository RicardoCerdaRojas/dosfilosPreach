import { describe, it, expect, vi } from 'vitest';

/**
 * Prueba del fundador (2026-10-23): leer el sílabo de NT785 fallaba con
 * «deadline-exceeded». El lector pide 16k tokens de salida y el SDK de
 * callables corta a los 70 s si no se le pasa otro tope (llmTimeouts.ts).
 */
const llamar = vi.fn(async (_opciones: unknown, _transporte?: unknown) => ({ text: '{"documentKind":"bibliography","entries":[],"requirementItems":[]}', tokensUsed: 10 }));
vi.mock('../../llm/callableLlm', () => ({ runLlmPromptWithUsage: (o: unknown, t?: unknown) => llamar(o, t) }));
const { GeminiCourseBibliographyExtractor } = await import('../GeminiCourseBibliographyExtractor');
const { LONG_GENERATION_TIMEOUT_MS } = await import('../../llm/llmTimeouts');

describe('el lector de bibliografía espera lo que tarda una lectura larga', () => {
    it('pasa el tope largo al transporte, no el de 70 s del SDK', async () => {
        await new GeminiCourseBibliographyExtractor().extract({ text: 'Bibliografía: Davids, La epístola de Santiago…', image: null, language: 'es' });
        expect(llamar).toHaveBeenCalledWith(expect.objectContaining({ feature: 'exegesis.extractBibliography', maxOutputTokens: 16384 }), { timeoutMs: LONG_GENERATION_TIMEOUT_MS });
    });
});
