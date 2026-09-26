import { describe, it, expect } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis } from '@dosfilos/domain';
import type { ComposeConclusionInput, ComposeIntroductionInput, PassageReference } from '@dosfilos/domain';
import { buildIntroductionPrompt } from '../GeminiIntroductionComposer';
import { buildConclusionPrompt } from '../GeminiConclusionComposer';

/**
 * La introducción y la conclusión escribían su PROPIO aparato de notas.
 *
 * Medido en el Salmo 23:1-3 entregado: la introducción salió con un «¹» en la
 * prosa y, aparte, un párrafo «¹. Peter C. Craigie, *Psalms 1-50*, vol. 19,
 * Word Biblical Commentary (Waco, TX: Word Books, 1983), 206.» que en el Word
 * aparece como CUERPO —no como nota— y que además duplica las notas reales
 * que el exportador sí genera en las secciones de versículo.
 *
 * El formato en sí estaba bien: el modelo sabe escribir Turabian. Lo que
 * faltaba es que alguien le dijera que su trabajo es MARCAR la cita, no
 * escribir la nota; la nota la arma el exportador desde la ficha del libro,
 * con datos que el compositor no tiene.
 */
const PASSAGE: PassageReference = { bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 1, verseEnd: 3 };

const base = (citationForm?: 'footnote' | 'parenthetical') => ({
    paperPassage: PASSAGE,
    language: 'es' as const,
    assignmentBrief: 'encuadre',
    verseAnalyses: [buildEmptyCanonicalVerseAnalysis({ ...PASSAGE, verseStart: 1, verseEnd: 1 })],
    styleGuideContent: '',
    styleGuideManifest: null,
    sources: [],
    pinnedSourceKeys: [],
    paperRubric: null,
    exegeticalStrategy: null,
    regenerationHint: null,
    citationForm,
});

const construir = {
    introducción: (f?: 'footnote' | 'parenthetical') => buildIntroductionPrompt(
        { ...base(f), acceptedConclusionMarkdown: null } as unknown as ComposeIntroductionInput),
    conclusión: (f?: 'footnote' | 'parenthetical') => buildConclusionPrompt(
        base(f) as unknown as ComposeConclusionInput),
};

describe.each(Object.entries(construir))('%s — cómo se marca una cita', (_n, build) => {
    it('recibe la regla de forma de cita, igual que el compositor de versículos', () => {
        expect(build('footnote').systemInstruction).toContain('(Apellido, "Título", p. N)');
    });

    it('la forma parentética de la entrega también llega', () => {
        const s = build('parenthetical').systemInstruction;
        expect(s).toContain('(Apellido, p. N)');
        expect(s).not.toContain('(Apellido, "Título", p. N)');
    });

    it('sin forma declarada aplica la de la casa, que es nota al pie', () => {
        expect(build(undefined).systemInstruction).toContain('(Apellido, "Título", p. N)');
    });

    it('ya no se le pide que escriba las notas al pie él mismo', () => {
        // «footnotes for citations» era una invitación a inventarse el
        // aparato: un superíndice en la prosa y las notas como párrafo.
        expect(build('footnote').systemInstruction).not.toContain('footnotes for citations');
    });
});
