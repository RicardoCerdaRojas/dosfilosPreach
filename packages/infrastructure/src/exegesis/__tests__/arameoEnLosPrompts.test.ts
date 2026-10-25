import { describe, expect, it } from 'vitest';
import type { AnalyzeVerseInput, ExegesisGenerationInput, PassageReference } from '@dosfilos/domain';
import { buildAnalyzerPrompt } from '../canonicalAnalyzer/analyzerPrompts';
import { canonicalVerseAnalysisSchema } from '../canonicalAnalyzer/responseSchema';
import { buildPrompt } from '../prompts';
import { voiceFor } from '../testamentVoice';

/**
 * Esd 4:8 es arameo. Los llamadores de `voiceFor` ahora le pasan el pasaje:
 * el analizador el versículo que analiza, el orquestador el del trabajo (y el
 * del versículo en el paso de un versículo).
 */
const ref = (c: number, v1: number, v2 = v1): PassageReference =>
    ({ bookId: 'EZR' as PassageReference['bookId'], chapterStart: c, chapterEnd: c, verseStart: v1, verseEnd: v2 });

const analizador = (verso: number, lang: 'es' | 'en' = 'es') => ({
    paperPassage: ref(4, 6, 24),
    verseRef: ref(4, verso),
    language: lang,
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

const orquestador = (verso: number) => ({
    kind: 'verse',
    verseRef: ref(4, verso),
    paperPassage: ref(4, 6, 24),
    language: 'es',
    sources: [],
    priorAcceptedSteps: [],
    styleGuideContent: '',
    assignmentBrief: null,
    missingSourceTypes: [],
    stepEmphasis: null,
    regenerationHint: null,
} as unknown as ExegesisGenerationInput);

describe('el analizador de un versículo arameo', () => {
    it('Esd 4:8 se analiza como hebreo y arameo bíblicos, con Rosenthal', () => {
        const { systemInstruction, userMessage } = buildAnalyzerPrompt(analizador(8));
        expect(systemInstruction).toContain('hebreo y arameo bíblicos');
        expect(systemInstruction).toContain('Rosenthal');
        expect(systemInstruction).toContain('Vogt');
        expect(userMessage).toContain('peal');
    });

    it('en inglés también', () => {
        expect(buildAnalyzerPrompt(analizador(8, 'en')).systemInstruction).toContain('Biblical Hebrew and Aramaic');
    });

    it('Esd 4:7 sigue siendo hebreo aunque el trabajo toque arameo', () => {
        const { systemInstruction } = buildAnalyzerPrompt(analizador(7));
        expect(systemInstruction).toContain('hebreo bíblico');
        expect(systemInstruction).not.toMatch(/arame/);
    });

    it('el esquema de respuesta del versículo arameo nombra las dos lenguas', () => {
        const s = JSON.stringify(canonicalVerseAnalysisSchema(voiceFor('EZR', ref(4, 8))));
        expect(s).toContain('hebreo y arameo');
    });
});

describe('el orquestador de pasos', () => {
    it('la instrucción del trabajo Esd 4:6-24 dice hebreo y arameo', () => {
        expect(buildPrompt(orquestador(8)).systemInstruction).toContain('hebreo y arameo bíblicos');
    });

    it('el paso del versículo 4:8 pide el texto en hebreo y arameo; el de 4:7, en hebreo', () => {
        expect(buildPrompt(orquestador(8)).userMessage).toContain('Presenta el texto hebreo y arameo de');
        const v7 = buildPrompt(orquestador(7)).userMessage;
        expect(v7).toContain('Presenta el texto hebreo de');
        expect(v7).not.toContain('arameo');
    });
});
