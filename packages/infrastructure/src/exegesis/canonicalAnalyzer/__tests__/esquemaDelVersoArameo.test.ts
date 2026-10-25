import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalyzeVerseInput } from '@dosfilos/domain';

/**
 * El esquema de respuesta se arma por versículo y también nombra la lengua.
 * El analizador ahora le pasa el versículo a `voiceFor`: el esquema de Esd 4:8
 * pide «hebreo y arameo», el de 4:7 sigue pidiendo hebreo.
 */
const llamadas: Array<{ responseSchema: unknown }> = [];
vi.mock('../../../llm/callableLlm', () => ({
    runLlmPromptWithUsage: vi.fn(async (args: { responseSchema: unknown }) => {
        llamadas.push(args);
        throw new Error('fin de la prueba');
    }),
}));
vi.mock('../../geminiRetry', () => ({ withGeminiRetry: (fn: () => Promise<unknown>) => fn() }));

const { GeminiCanonicalVerseAnalyzer } = await import('../GeminiCanonicalVerseAnalyzer');

const entrada = (verso: number) => ({
    paperPassage: { bookId: 'EZR', chapterStart: 4, chapterEnd: 4, verseStart: 6, verseEnd: 24 },
    verseRef: { bookId: 'EZR', chapterStart: 4, chapterEnd: 4, verseStart: verso, verseEnd: verso },
    language: 'es',
    originalLanguageText: null,
    pericopeContext: null,
    assignmentBrief: null,
    sources: [],
    styleGuideContent: '',
    missingSourceTypes: [],
    priorAcceptedAnalyses: [],
    regenerationHint: null,
    stepEmphasis: null,
} as unknown as AnalyzeVerseInput);

describe('el esquema del analizador sigue al versículo', () => {
    beforeEach(() => { llamadas.length = 0; });

    it('Esd 4:8 pide hebreo y arameo; Esd 4:7, hebreo', async () => {
        const analizador = new GeminiCanonicalVerseAnalyzer();
        await expect(analizador.analyzeVerse(entrada(8))).rejects.toThrow('fin de la prueba');
        await expect(analizador.analyzeVerse(entrada(7))).rejects.toThrow('fin de la prueba');
        expect(JSON.stringify(llamadas[0]!.responseSchema)).toContain('hebreo y arameo');
        // La gramática del esquema sale de la misma voz: con Rosenthal.
        expect(JSON.stringify(llamadas[0]!.responseSchema)).toContain('Rosenthal');
        expect(JSON.stringify(llamadas[1]!.responseSchema)).not.toMatch(/arame/);
    });
});
