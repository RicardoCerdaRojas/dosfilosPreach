import { describe, it, expect, vi } from 'vitest';

/**
 * Etapa 0 (2026-10-22): el extractor de rúbricas pedía al modelo la
 * bibliografía del curso y la maquetación, y `mapToDomain` sabía leerlas,
 * pero el lector de JSON no las copiaba: llegaban siempre vacías.
 */
const runLlmPromptWithUsage = vi.fn();
vi.mock('../../llm/callableLlm', () => ({ runLlmPromptWithUsage }));
const { GeminiPaperRubricExtractor } = await import('../GeminiPaperRubricExtractor');

const respuesta = {
    description: 'TP semanal', citationStandard: 'Turabian', expectedLength: { unit: 'pages', min: 2, max: 3 },
    formatting: { lineSpacing: 'single', blankLineBetweenParagraphs: true, citationForm: 'parenthetical', pageLabel: 'bare' },
    sourceRequirements: [], structuralExpectations: [], qualityCriteria: [], extractionNotes: [],
    courseBibliography: [
        { title: 'Greek Grammar Beyond the Basics', author: 'Daniel B. Wallace', requirement: 'required' },
        { title: 'The Epistle of St. James', author: 'Joseph B. Mayor', requirement: 'recommended', note: 'para crítica textual' },
    ],
};

describe('GeminiPaperRubricExtractor', () => {
    it('conserva la bibliografía del curso y la maquetación que dice el sílabo', async () => {
        runLlmPromptWithUsage.mockResolvedValue({ text: JSON.stringify(respuesta), tokensUsed: 10 });
        const { rubric } = await new GeminiPaperRubricExtractor().extract({
            rawText: 'Sílabo del curso…', source: 'text', sourceCorpusId: null, language: 'es',
        } as never);
        expect(rubric.courseBibliography).toEqual([
            expect.objectContaining({ title: 'Greek Grammar Beyond the Basics', author: 'Daniel B. Wallace', requirement: 'required' }),
            expect.objectContaining({ title: 'The Epistle of St. James', requirement: 'recommended', note: 'para crítica textual' }),
        ]);
        expect(rubric.formatting).toMatchObject({ lineSpacing: 'single', citationForm: 'parenthetical', pageLabel: 'bare' });
    });

    it('un sílabo sin bibliografía deja la lista vacía', async () => {
        runLlmPromptWithUsage.mockResolvedValue({ text: JSON.stringify({ ...respuesta, courseBibliography: undefined, formatting: null }), tokensUsed: 10 });
        const { rubric } = await new GeminiPaperRubricExtractor().extract({ rawText: 'x', source: 'text', sourceCorpusId: null, language: 'es' } as never);
        expect(rubric.courseBibliography).toEqual([]);
        expect(rubric.formatting).toBeNull();
    });
});
