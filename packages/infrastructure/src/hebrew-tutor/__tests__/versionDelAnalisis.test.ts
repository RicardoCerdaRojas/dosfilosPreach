import { describe, it, expect, vi } from 'vitest';
import { HEBREW_ANALYSIS_PROMPT_VERSION } from '@dosfilos/domain';

/** G0: el análisis de hebreo queda marcado con la versión del prompt que lo generó. */
vi.mock('../../llm/callableLlm', () => ({
    runLlmPrompt: vi.fn().mockResolvedValue(JSON.stringify({ words: [], verbTable: [], clauses: [] })),
}));
const { HebrewAnalysisService } = await import('../gemini-hebrew-service');

describe('la versión del análisis', () => {
    it('un análisis nuevo lleva la versión vigente del prompt', async () => {
        const verse = { reference: 'Ruth.1.17', displayReference: 'Rut 1:17', hebrewText: 'x', words: [] };
        const a = await new HebrewAnalysisService().analyzeVerse(verse as never, 'es', []);
        expect(a.promptVersion).toBe(HEBREW_ANALYSIS_PROMPT_VERSION);
        expect(HEBREW_ANALYSIS_PROMPT_VERSION).toBe(2);
    });
});
