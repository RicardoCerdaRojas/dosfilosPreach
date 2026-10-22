import { describe, it, expect } from 'vitest';
import type { AnalyzeVerseInput } from '@dosfilos/domain';
import { buildAnalyzerPrompt } from '../analyzerPrompts';
import { canonicalVerseAnalysisSchema } from '../responseSchema';
import { mapToCanonicalVerseAnalysis } from '../mapAnalyzerResponse';
import { voiceFor } from '../../testamentVoice';

/**
 * TP #8 (Santiago 4:1-10, 2026-10-21, fase 8b, C1): el analizador veía el
 * encuadre entero y no tenía dónde poner la respuesta a cada pregunta ni el
 * criterio que decide entre lecturas. En 4:5 («¿Qué pasaje está citando
 * Jacobo?») faltó el catálogo de hipótesis; en 4:3 el criterio se perdió.
 */
const REF = { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 5, verseEnd: 5 } as const;

const entrada = (over: Partial<AnalyzeVerseInput> = {}): AnalyzeVerseInput => ({
    paperPassage: { ...REF, verseStart: 1, verseEnd: 10 },
    verseRef: REF,
    language: 'es',
    originalLanguageText: null,
    pericopeContext: null,
    assignmentBrief: null,
    stepEmphasis: null,
    styleGuideContent: '',
    sources: [],
    priorAcceptedAnalyses: [],
    regenerationHint: null,
    missingSourceTypes: [],
    ...over,
} as unknown as AnalyzeVerseInput);

const preguntas = [{ number: 4, text: '¿Qué pasaje está citando Jacobo (Stg. 4:5)?', kinds: ['identify' as const] }];

describe('las preguntas del versículo llegan como tarea', () => {
    it('el prompt las lista con la regla de su tipo', () => {
        const { systemInstruction } = buildAnalyzerPrompt(entrada({ sectionQuestions: preguntas }));
        expect(systemInstruction).toContain('## Lo que este versículo tiene que responder');
        expect(systemInstruction).toContain('4. ¿Qué pasaje está citando Jacobo (Stg. 4:5)?');
        expect(systemInstruction).toMatch(/IDENTIFICAR: abre con el estado de la cuestión/);
        expect(systemInstruction).toContain('"questionAnswers"');
    });

    it('sin preguntas, el bloque no aparece', () => {
        expect(buildAnalyzerPrompt(entrada()).systemInstruction).not.toContain('Lo que este versículo tiene que responder');
    });

    it('el esquema exige questionAnswers sólo cuando hay preguntas', () => {
        const con = canonicalVerseAnalysisSchema(voiceFor('JAS'), { withQuestions: true });
        const sin = canonicalVerseAnalysisSchema(voiceFor('JAS'));
        expect(con.required).toContain('questionAnswers');
        expect(con.properties).toHaveProperty('questionAnswers');
        expect(sin.required).not.toContain('questionAnswers');
        expect(sin.properties).not.toHaveProperty('questionAnswers');
    });
});

describe('mapToCanonicalVerseAnalysis — questionAnswers', () => {
    const base = {
        originalText: 'x', textualCriticism: {}, syntacticAnalysis: {}, lexicalAnalyses: [], argumentativeRole: '',
        historicalContext: [], oldTestamentLinks: [], commentatorEngagement: [], translationCruxes: [],
        initialTranslation: '', finalTranslation: '', verseThesis: '', theologicalHooks: [], confidenceFlags: [], footnoteExtensions: [],
    };

    it('normaliza la forma y descarta respuestas a preguntas que no son de este versículo', () => {
        const a = mapToCanonicalVerseAnalysis({
            ...base,
            questionAnswers: [
                {
                    questionNumber: 4, directAnswer: 'Ninguna cita conocida', decision: 'paráfrasis',
                    options: [{ reading: 'Gn 6:3', argument: 'espíritu', defenders: [{ sourceKey: 'Mayor', page: 135 }, 'basura'] }, 'basura'],
                    decisiveCriterion: { text: 'nadie lo identifica', whyThisOverThat: 'totally unknown' },
                },
                { questionNumber: 9, directAnswer: 'otra', options: [], decisiveCriterion: {}, decision: '' },
            ],
        }, entrada({ sectionQuestions: preguntas }));
        expect(a.questionAnswers).toEqual([{
            questionNumber: 4, directAnswer: 'Ninguna cita conocida', decision: 'paráfrasis',
            options: [{ reading: 'Gn 6:3', argument: 'espíritu', defenders: [{ sourceKey: 'Mayor', page: 135 }] }],
            decisiveCriterion: { text: 'nadie lo identifica', whyThisOverThat: 'totally unknown', sources: [] },
        }]);
    });

    it('sin preguntas no agrega el campo', () => {
        expect(mapToCanonicalVerseAnalysis(base, entrada())).not.toHaveProperty('questionAnswers');
    });
});

/** TP #8 (8b, C2): el método que hubo que escribir a mano, de serie. */
describe('el método para responder, de serie', () => {
    it('con preguntas, la disciplina de citación trae los cinco puntos del método', () => {
        const { systemInstruction } = buildAnalyzerPrompt(entrada({ sectionQuestions: preguntas }));
        const disciplina = systemInstruction.slice(systemInstruction.indexOf('## Disciplina de citación'));
        expect(disciplina).toContain('Busca un criterio que DISTINGA entre las lecturas');
        expect(disciplina).toContain('las CONCESIONES que un autor hace contra su propia tesis');
        expect(disciplina).toContain('Nunca uses la clasificación de un elemento para decidir otro');
    });

    it('sin preguntas, no', () => {
        expect(buildAnalyzerPrompt(entrada()).systemInstruction).not.toContain('Cómo responder las preguntas');
    });

    it('también en inglés', () => {
        expect(buildAnalyzerPrompt(entrada({ sectionQuestions: preguntas, language: 'en' })).systemInstruction)
            .toContain('Find a criterion that DISTINGUISHES between the readings');
    });
});
