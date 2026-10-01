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
