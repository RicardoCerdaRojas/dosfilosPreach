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

/**
 * TP #8 (Santiago 4:1-10, 2026-10-21, fase 8a, B2): el planificador nunca veía
 * una hoja, y las reglas de un paper largo («máximo 4 por paso», «van en ese
 * paso y no en otro», «todas las fuentes en algún paso») dejaron a Tuggy en un
 * solo paso.
 */
describe('buildPlannerPrompt — modo preguntas y evidencia', () => {
    const base = {
        passage: { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 1, verseEnd: 10 },
        assignmentBrief: null, language: 'es', paperPhase: 'configuring',
        sources: [
            { id: 'tuggy', sourceType: 'lexicon-technical', displayLabel: 'Léxico', citationKey: 'Tuggy' },
            { id: 'kittel', sourceType: 'theological-dictionary', displayLabel: 'Diccionario', citationKey: 'Kittel', chosenRole: 'contrast' },
        ],
        steps: [{
            id: 'v1', kind: 'verse', label: 'Santiago 4:1', questions: ['¿Qué significa μέλεσιν?'],
            evidence: [
                { sourceId: 'tuggy', sheets: [584, 585], via: 'lemma', term: 'μέλεσιν' },
                { sourceId: 'kittel', sheets: [239], via: 'verse', line: 'ἡδονή … Jas 4:1   en los miembros' },
            ],
        }],
    };

    it('la evidencia va bajo su paso, con la hoja, la palabra y el renglón', () => {
        const { userMessage } = buildPlannerPrompt(base as never);
        expect(userMessage).toContain('· evidencia en el corpus: id="tuggy" (Tuggy) h. 584, 585 — entrada de μέλεσιν');
        expect(userMessage).toContain('· evidencia en el corpus: id="kittel" (Kittel) h. 239 — «ἡδονή … Jas 4:1 en los miembros»');
        expect(userMessage).toContain('se nombra: Kittel · rol en el corpus: contrast');
    });

    it('en modo preguntas no hay tope por paso, una fuente va en varios pasos y no se exige cubrir todo', () => {
        const { userMessage, systemInstruction } = buildPlannerPrompt({ ...base, questionsMode: true } as never);
        expect(userMessage).not.toContain('Máximo 4 fuentes por paso');
        expect(userMessage).not.toContain('Esas fuentes van en ese paso y no en otro');
        expect(userMessage).not.toContain('TODAS las fuentes deben aparecer');
        expect(userMessage).toContain('Una fuente puede ir en VARIOS pasos');
        expect(userMessage).toContain('DEBE ir en ese paso');
        expect(systemInstruction).toContain('MODO PREGUNTAS');
    });

    it('un paper largo conserva sus reglas', () => {
        const { userMessage } = buildPlannerPrompt({ ...base, questionsMode: false } as never);
        expect(userMessage).toContain('Máximo 4 fuentes por paso');
        expect(userMessage).toContain('TODAS las fuentes deben aparecer');
    });
});
