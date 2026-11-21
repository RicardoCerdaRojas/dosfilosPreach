import { describe, it, expect } from 'vitest';
import type { AnalyzeVerseInput } from '@dosfilos/domain';
import { buildAnalyzerPrompt } from '../analyzerPrompts';

/**
 * A5: las categorías que el curso marca «IGNORA» llegan al análisis como
 * prohibición de decisión (TP #11: «genitivo de producción»). Sin lista, el
 * prompt de siempre.
 */
const REF = { bookId: 'JAS', chapterStart: 5, chapterEnd: 5, verseStart: 7, verseEnd: 7 } as const;
const entrada = (over: Partial<AnalyzeVerseInput> = {}): AnalyzeVerseInput => ({
    paperPassage: { ...REF, verseEnd: 11 }, verseRef: REF, language: 'es', originalLanguageText: null, pericopeContext: null,
    assignmentBrief: null, stepEmphasis: null, styleGuideContent: '', sources: [], priorAcceptedAnalyses: [],
    regenerationHint: null, missingSourceTypes: [], ...over,
} as unknown as AnalyzeVerseInput);
const prompt = (over: Partial<AnalyzeVerseInput> = {}) => {
    const p = buildAnalyzerPrompt(entrada(over));
    return `${p.systemInstruction}\n${p.userMessage}`;
};

describe('categorías que el curso no acepta como final', () => {
    it('sin lista, o vacía, el prompt es idéntico', () => {
        const deSiempre = prompt();
        expect(prompt({ ignoredGrammarCategories: [] })).toBe(deSiempre);
        expect(prompt({ ignoredGrammarCategories: null })).toBe(deSiempre);
    });
    it('con lista: se nombran y se prohíben como decisión, en los dos idiomas', () => {
        const es = prompt({ ignoredGrammarCategories: ['genitivo de producción', 'genitivo de contenido'] });
        expect(es).toContain('genitivo de producción; genitivo de contenido');
        expect(es).toContain('nunca como la decisión');
        const en = prompt({ language: 'en', ignoredGrammarCategories: ['genitive of production'] });
        expect(en).toContain('never as the decision');
    });
});
