import { describe, expect, it, vi } from 'vitest';

/** P2 cuando se encienda: lo que dicen las fuentes, separado de lo que infiere el análisis. */
vi.mock('../analyzerOutputShape', () => ({ ANALYZER_WRITES_PREMISES: true }));
const { canonicalVerseAnalysisSchema } = await import('../responseSchema');
const { buildAnalyzerPrompt } = await import('../analyzerPrompts');
const { voiceFor } = await import('../../testamentVoice');

const REF = { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 12, verseEnd: 12 };
const entrada = (language: 'es' | 'en') => ({
    paperPassage: REF, verseRef: REF, originalLanguageText: null, pericopeContext: null, language, assignmentBrief: null,
    stepEmphasis: null, styleGuideContent: '', sources: [], priorAcceptedAnalyses: [], regenerationHint: null, missingSourceTypes: [],
    sectionQuestions: [{ number: 1, text: '¿Qué función tiene?', kinds: [] }],
}) as never;

describe('con el analizador escribiendo premisas', () => {
    it('el esquema pide la inferencia y las premisas', () => {
        const criterio = JSON.stringify(canonicalVerseAnalysisSchema(voiceFor('JAS'), { withQuestions: true })).match(/"decisiveCriterion":\{.*?"required":\[[^\]]*\]/)?.[0] ?? '';
        expect(criterio).toContain('"inference"');
        expect(criterio).toContain('"premises"');
    });
    it('el prompt lo pide en los dos idiomas', () => {
        const es = buildAnalyzerPrompt(entrada('es'));
        expect(es.userMessage + es.systemInstruction).toContain('separa lo que dicen las fuentes (`premises`, cada una con su cita)');
        const en = buildAnalyzerPrompt(entrada('en'));
        expect(en.userMessage + en.systemInstruction).toContain('Never hang the inference on the sources');
    });
});
