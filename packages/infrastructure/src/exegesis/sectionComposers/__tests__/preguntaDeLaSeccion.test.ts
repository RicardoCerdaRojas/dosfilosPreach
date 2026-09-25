import { describe, it, expect } from 'vitest';
import type { ComposeVerseInput } from '@dosfilos/domain';
import { buildEmptyCanonicalVerseAnalysis } from '@dosfilos/domain';
import { buildVerseProsePrompt } from '../verseProsePrompt';

const VACIO = buildEmptyCanonicalVerseAnalysis({ bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 2, verseEnd: 2 });

/**
 * El encuadre llegaba al compositor rotulado «BRIEF DEL PAPER (contexto, no lo
 * repitas)»: como trasfondo que debía ignorar, que es lo contrario de una
 * tarea.
 *
 * Medido sobre Santiago 2:2: el análisis decía «los verbos principales de la
 * oración completa (la apódosis) se encuentran en los versículos 3 y 4», y la
 * prosa compuesta no lo mencionaba. El dato existía y se recortó, porque nada
 * decía que esa frase era justamente lo que el profesor preguntaba.
 */
const PREGUNTA = { number: 2, text: '¿Cómo funciona ἐὰν (Stg. 2:2)? ¿Qué relación tiene con el versículo 4?' };

const entrada = (sectionQuestions?: ReadonlyArray<{ number: number; text: string }>) => ({
    paperPassage: { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 1, verseEnd: 13 },
    verseRef: { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 2, verseEnd: 2 },
    language: 'es' as const,
    verseAnalysis: { ...VACIO, reference: { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 2, verseEnd: 2 },
        syntacticAnalysis: { keyConstructions: [], discourseParticles: [] },
        lexicalAnalyses: [], commentatorEngagement: [], translationCruxes: [],
        historicalContext: [], oldTestamentLinks: [], footnoteExtensions: [],
        confidenceFlags: [], theologicalHooks: [] },
    glossary: [],
    assignmentBrief: 'Trabajo práctico semanal.',
    sources: [],
    styleGuideContent: '',
    sectionQuestions,
} as unknown as ComposeVerseInput);

describe('la sección sabe qué pregunta responde', () => {
    it('la pregunta entra a la instrucción del modelo', () => {
        const { systemInstruction } = buildVerseProsePrompt(entrada([PREGUNTA]));
        expect(systemInstruction).toContain('¿Qué relación tiene con el versículo 4?');
    });

    it('se le dice que es el encargo y no trasfondo', () => {
        // El encuadre completo seguía llegando como «no lo repitas». El
        // problema no era que faltara: era que ése fuera el único sitio donde
        // aparecían las preguntas.
        const { systemInstruction } = buildVerseProsePrompt(entrada([PREGUNTA]));
        expect(systemInstruction).toContain('Esto es el encargo, no trasfondo');
    });

    it('se le prohíbe recortar la respuesta por extensión', () => {
        // Es exactamente lo que pasó: con 295 palabras de presupuesto, el
        // compositor cortó la frase que contestaba la pregunta.
        const { systemInstruction } = buildVerseProsePrompt(entrada([PREGUNTA]));
        expect(systemInstruction).toContain('recortar por extensión nunca recorta la respuesta');
    });

    it('sin pregunta asignada, la instrucción no cambia', () => {
        expect(buildVerseProsePrompt(entrada([])).systemInstruction)
            .toBe(buildVerseProsePrompt(entrada(undefined)).systemInstruction);
    });

    it('la pregunta va en la instrucción de sistema, no mezclada con el análisis', () => {
        const { userMessage } = buildVerseProsePrompt(entrada([PREGUNTA]));
        expect(userMessage).not.toContain('Esto es el encargo');
    });
});
