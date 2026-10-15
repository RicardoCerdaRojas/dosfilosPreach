import { describe, it, expect } from 'vitest';
import type { AnalyzeVerseInput } from '@dosfilos/domain';
import { buildAnalyzerPrompt } from '../analyzerPrompts';
import { canonicalVerseAnalysisSchema } from '../responseSchema';
import { voiceFor } from '../../testamentVoice';

/**
 * TP #7 (Santiago 3:13-18): una nota hablaba del corpus («La asignación de
 * Robertson como fuente técnica no autoriza…», #24) y las tres alarmas de
 * 3:15 eran análisis propio colgado de Varner y Robertson en las notas.
 */
const entrada = (language: 'es' | 'en'): AnalyzeVerseInput => ({
    paperPassage: { bookId: 'JAS', chapterStart: 3, chapterEnd: 3, verseStart: 13, verseEnd: 18 },
    verseRef: { bookId: 'JAS', chapterStart: 3, chapterEnd: 3, verseStart: 15, verseEnd: 15 },
    language,
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

describe('el analizador no habla del corpus ni cuelga análisis propio de un autor', () => {
    it('en español', () => {
        const { systemInstruction } = buildAnalyzerPrompt(entrada('es'));
        expect(systemInstruction).toContain('deja "sources" vacío');
        expect(systemInstruction).toContain('Nunca hables del corpus');
    });
    it('en inglés', () => {
        const { systemInstruction } = buildAnalyzerPrompt(entrada('en'));
        expect(systemInstruction).toContain('leave "sources" empty');
        expect(systemInstruction).toContain('Never write about the corpus');
    });
    it('el esquema de la nota al pie lo repite donde el modelo llena el campo', () => {
        const schema = JSON.stringify(canonicalVerseAnalysisSchema(voiceFor('JAS')));
        expect(schema).toContain('Si la nota es análisis propio, arreglo vacío');
    });
});
