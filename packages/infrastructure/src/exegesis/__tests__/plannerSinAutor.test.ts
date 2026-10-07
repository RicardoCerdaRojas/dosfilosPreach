import { describe, it, expect } from 'vitest';
import { buildPlannerPrompt } from '../GeminiStepCorpusPlanner';

/**
 * TP Santiago 2:14-26: Robertson (*Grammar of the Greek NT…*) no tenía autor
 * cargado y el planificador lo llamó «gramática de Blass-Debrunner-Funk»:
 * completó el autor por el título.
 */
describe('buildPlannerPrompt — una fuente sin autor no se bautiza', () => {
    const entrada = (citationKey: string | null) => buildPlannerPrompt({
        passage: { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 14, verseEnd: 26 },
        assignmentBrief: null, language: 'es', paperPhase: 'configuring',
        sources: [{ id: 'r1', sourceType: 'grammar-syntax', displayLabel: 'Grammar of the Greek New Testament', citationKey }],
        steps: [{ id: 's1', kind: 'verse', label: 'Santiago 2:14' }],
    } as never).userMessage;

    it('sin clave dice que no hay autor y prohíbe deducirlo', () => {
        const m = entrada(null);
        expect(m).toContain('Grammar of the Greek New Testament · SIN AUTOR CARGADO');
        expect(m).toMatch(/nunca le atribuyas un autor/);
    });

    it('con clave dice cómo nombrarla', () => {
        expect(entrada('Robertson')).toContain('se nombra: Robertson');
    });
});

/**
 * TP #6 (Santiago 3): el plan puso NA28 y Metzger en 3:11, sin pregunta, y no
 * en 3:6, cuya pregunta era de puntuación. El planificador no veía las
 * preguntas.
 */
describe('buildPlannerPrompt — las preguntas del encuadre van bajo su paso', () => {
    it('REGRESIÓN: cada paso lleva sus preguntas; uno sin preguntas, ninguna', () => {
        const { userMessage } = buildPlannerPrompt({
            passage: { bookId: 'JAS', chapterStart: 3, chapterEnd: 3, verseStart: 1, verseEnd: 12 },
            assignmentBrief: null, language: 'es', paperPhase: 'configuring',
            sources: [],
            steps: [
                { id: 's6', kind: 'verse', label: 'Santiago 3:6', questions: ['¿Cómo se puntúa 3:6?'] },
                { id: 's7', kind: 'verse', label: 'Santiago 3:7' },
            ],
        } as never);
        const linea6 = userMessage.indexOf('id="s6"');
        const linea7 = userMessage.indexOf('id="s7"');
        const pregunta = userMessage.indexOf('pregunta del encuadre: ¿Cómo se puntúa 3:6?');
        expect(pregunta).toBeGreaterThan(linea6);
        expect(pregunta).toBeLessThan(linea7);
        expect(userMessage.slice(linea7)).not.toContain('pregunta del encuadre');
    });
});
