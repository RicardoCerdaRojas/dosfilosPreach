import { describe, it, expect, vi } from 'vitest';
import { HEBREW_ANALYSIS_PROMPT_VERSION } from '@dosfilos/domain';

/** G0: el análisis de hebreo queda marcado con la versión del prompt que lo generó. */
vi.mock('../../llm/callableLlm', () => ({
    runLlmPrompt: vi.fn().mockResolvedValue(JSON.stringify({ words: [], verbTable: [], clauses: [] })),
}));
const { HebrewAnalysisService } = await import('../gemini-hebrew-service');

describe('la versión del análisis', () => {
    const verse = { reference: 'Ruth.1.17', displayReference: 'Rut 1:17', hebrewText: 'x', words: [] };
    const fila = { index: 0, depth: 0, words: [{ r: '17!1', t: 'x', role: '' as const }], connector: null, relation: 'main' as const, isApodosis: false, verbless: true, fronted: [] };

    it('un análisis con las filas de «Estructura» lleva la versión vigente (v3: el asistente las leyó)', async () => {
        const a = await new HebrewAnalysisService().analyzeVerse(verse as never, 'es', [], [fila]);
        expect(a.promptVersion).toBe(HEBREW_ANALYSIS_PROMPT_VERSION);
        expect(HEBREW_ANALYSIS_PROMPT_VERSION).toBe(3);
    });

    it('REGRESIÓN (revisión de G1 + G5): sin filas el prompt fue el de partir cláusulas, y se marca v2', async () => {
        const a = await new HebrewAnalysisService().analyzeVerse(verse as never, 'es', []);
        expect(a.promptVersion).toBe(2);
    });
});
