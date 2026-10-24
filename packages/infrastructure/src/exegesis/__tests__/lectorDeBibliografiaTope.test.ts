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
        expect(llamar).toHaveBeenCalledWith(expect.objectContaining({ feature: 'exegesis.extractBibliography', maxOutputTokens: 65536, thinking: 'low' }), { timeoutMs: LONG_GENERATION_TIMEOUT_MS });
    });
});

describe('una respuesta cortada no pierde toda la lectura (prueba del fundador: sílabo de NT785)', () => {
    it('se pide JSON compacto sin nulls', async () => {
        const { buildBibliographyPrompt } = await import('../GeminiCourseBibliographyExtractor');
        const { prompt } = buildBibliographyPrompt({ text: 'x'.repeat(20), language: 'es' });
        expect(prompt).toContain('JSON compacto');
        expect(prompt).toContain('Omite las claves cuyo valor sería null');
    });

    it('se rescatan las obras completas hasta el corte, y se dice dónde se cortó', async () => {
        const { parseBibliographyJson } = await import('../GeminiCourseBibliographyExtractor');
        const cortado = '{"documentKind":"assignment","entries":['
            + '{"title":"La epístola de Santiago","author":"Davids, Peter H.","requirement":"required"},'
            + '{"title":"Does Scripture Speak in Vain? A Reconsideration of James IV. 5 {sic}","author":"Laws, Sophie","note":"dice \\"NTS\\""},'
            // Una comilla escapada suelta y una llave suelta dentro del texto no pueden mover la cuenta.
            + '{"title":"Formato 5\\" x 8 } y { sueltas","author":"X"},'
            + '{"title":"Commentary } on Ja';
        const r = parseBibliographyJson(cortado);
        expect(r.entries.map(e => e.title)).toEqual(['La epístola de Santiago', 'Does Scripture Speak in Vain? A Reconsideration of James IV. 5 {sic}', 'Formato 5" x 8 } y { sueltas']);
        expect(r).toMatchObject({ truncated: true, truncatedAfter: 'Formato 5" x 8 } y { sueltas', documentKind: 'assignment' });
    });

    it('sin ninguna obra completa, o un JSON roto que no está cortado, sigue siendo un error', async () => {
        const { parseBibliographyJson } = await import('../GeminiCourseBibliographyExtractor');
        expect(() => parseBibliographyJson('{"documentKind":"assignment","entries":[{"title":"Comm')).toThrow(expect.objectContaining({ code: 'truncated' }));
        expect(() => parseBibliographyJson('{"entries": [}')).toThrow();
        // Una respuesta completa no se marca como cortada.
        expect(parseBibliographyJson('{"entries":[{"title":"A"}]}').truncated).toBeUndefined();
    });
});
