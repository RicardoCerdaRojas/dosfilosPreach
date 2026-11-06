import { describe, it, expect } from 'vitest';
import type { ComposeVerseInput } from '@dosfilos/domain';
import { buildEmptyCanonicalVerseAnalysis } from '@dosfilos/domain';
import { buildVerseProsePrompt } from '../verseProsePrompt';

/**
 * TP #10 (Santiago 5:6): el profesor corrigió que no se apoyara en 5:4–5 y 2:6,
 * y el análisis ya traía el vínculo; la regla «NUNCA escribas sobre versículos
 * vecinos» lo callaba. Compuerta R: con esta regla y la de argumentar, 3 de 3.
 */
const REF = { bookId: 'JAS', chapterStart: 5, chapterEnd: 5, verseStart: 6, verseEnd: 6 };
const entrada = (language: 'es' | 'en', sectionQuestions?: ReadonlyArray<{ number: number; text: string }>) => ({
    paperPassage: { ...REF, verseStart: 1 },
    verseRef: REF,
    language,
    verseAnalysis: buildEmptyCanonicalVerseAnalysis(REF as never),
    glossary: [],
    assignmentBrief: null,
    sources: [],
    styleGuideContent: '',
    sectionQuestions,
} as unknown as ComposeVerseInput);
const PREGUNTA = [{ number: 6, text: '¿Quién es «el justo» (Stg. 5:6)?' }];

describe('versículos vecinos', () => {
    it('con preguntas, se mencionan cuando el análisis los vincula', () => {
        const { systemInstruction } = buildVerseProsePrompt(entrada('es', PREGUNTA));
        expect(systemInstruction).toContain('Menciona un versículo vecino cuando el análisis lo vincule');
        expect(systemInstruction).not.toContain('NUNCA escribas sobre versículos vecinos');
    });

    it('en inglés, igual', () => {
        const { systemInstruction } = buildVerseProsePrompt(entrada('en', PREGUNTA));
        expect(systemInstruction).toContain('Mention a neighboring verse when the analysis links it');
        expect(systemInstruction).not.toContain('NEVER write about adjacent verses');
    });

    it('sin preguntas sigue la prohibición: no se midió en secciones largas', () => {
        expect(buildVerseProsePrompt(entrada('es')).systemInstruction).toContain('NUNCA escribas sobre versículos vecinos. Solo este versículo.');
        expect(buildVerseProsePrompt(entrada('en')).systemInstruction).toContain('NEVER write about adjacent verses. This verse only.');
    });
});
