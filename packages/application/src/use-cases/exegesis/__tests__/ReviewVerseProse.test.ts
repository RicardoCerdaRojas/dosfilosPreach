import { describe, it, expect, vi } from 'vitest';

/**
 * TP #8 (2026-10-21, fase 8b, E3): «Revisión antes de entregar». La prosa
 * recompuesta perdió el criterio de 4:3 y Wallace 533 en 4:5; el revisor los
 * lee con lo que el análisis ya decidió.
 */
const consumeExegesis = vi.fn().mockResolvedValue(undefined);
const refundExegesis = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../services/ProcessingBalanceService', () => ({
    processingBalanceService: { consumeExegesis, refundExegesis },
    InsufficientExegesisCreditsError: class extends Error { },
}));
vi.mock('../../../services/exegesisPricingTracker', () => ({ fireExegesisPricingEvent: vi.fn() }));
const { ReviewVerseProseUseCase } = await import('../ReviewVerseProseUseCase');
const { buildEmptyCanonicalVerseAnalysis } = await import('@dosfilos/domain');

const PROSA = 'λέγει introduce la cita (Mayor, p. 135).';
const analisis = {
    ...buildEmptyCanonicalVerseAnalysis({ bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 5, verseEnd: 5 } as never),
    syntacticAnalysis: { mainVerb: { text: 'λέγει', interpretiveSignificance: 'Presente perfectivo (Wallace, p. 533).' }, keyConstructions: [] },
    questionAnswers: [{
        questionNumber: 4, directAnswer: 'Ninguna cita conocida', options: [], decision: 'paráfrasis',
        decisiveCriterion: { text: 'ningún pasaje del AT corresponde exactamente', whyThisOverThat: 'Mayor 135', sources: [] },
    }],
};
const paper = (markdown = PROSA) => ({
    id: 'p', displayLanguage: 'es', styleGuideId: 'g',
    styleGuideSnapshot: { manifest: { additionalRules: ['Tercera persona en todo el trabajo.', '  '] } },
    passage: { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 1, verseEnd: 10 },
    assignmentBrief: '4. ¿Qué pasaje está citando Jacobo (Stg. 4:5)?',
    rubric: { formatting: { citationForm: 'parenthetical', pageLabel: 'bare' } },
    sources: [
        { sourceType: 'grammar-syntax', citationKey: 'Wallace' },
        { sourceType: 'commentary-critical', citationKey: 'Mayor' },
    ],
    steps: [{
        id: 's', kind: 'verse', state: 'accepted',
        verseRef: { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 5, verseEnd: 5 },
        accepted: { id: 'v1', markdown, canonicalAnalysis: analisis }, current: null,
    }],
});

const correr = async (p = paper(), review = vi.fn().mockResolvedValue({ findings: [], modelId: 'm', tokensUsed: 1 })) => {
    const repo = { getPaper: vi.fn().mockResolvedValue(p) };
    const guias = { getGuide: vi.fn() };
    const r = await new ReviewVerseProseUseCase(repo as never, guias as never, { review } as never)
        .execute({ ownerId: 'o', paperId: 'p', stepId: 's' });
    return { r, input: review.mock.calls[0]?.[0], guias };
};

describe('ReviewVerseProseUseCase', () => {
    it('revisa la prosa como se entrega, con lo decidido, la gramática y las reglas del curso', async () => {
        const { r, input, guias } = await correr();
        expect(input.prose).toBe('λέγει introduce la cita (Mayor, 135).');
        expect(input.verseLabel).toContain('4:5');
        expect(input.questions).toEqual([{ number: 4, text: '¿Qué pasaje está citando Jacobo (Stg. 4:5)?' }]);
        expect(input.decisiveCriteria).toEqual([{ questionNumber: 4, text: 'ningún pasaje del AT corresponde exactamente', whyThisOverThat: 'Mayor 135', decision: 'paráfrasis' }]);
        expect(input.grammarCitations).toEqual(['Wallace, p. 533']);
        expect(input.criteria.at(-1)).toBe('Tercera persona en todo el trabajo.');
        // Manda la copia de la guía que se llevó el trabajo.
        expect(guias.getGuide).not.toHaveBeenCalled();
        expect(r.reviewedMarkdown).toBe(input.prose);
        expect(consumeExegesis).toHaveBeenCalled();
    });

    it('en revisión, la versión nueva: la que la tarjeta muestra', async () => {
        const p = paper('VIEJA');
        Object.assign(p.steps[0]!, { state: 'awaiting-review', current: { id: 'v2', markdown: 'NUEVA', canonicalAnalysis: analisis } });
        const { input } = await correr(p);
        expect(input.prose).toBe('NUEVA');
    });

    it('sin prosa no cobra ni llama', async () => {
        consumeExegesis.mockClear();
        const review = vi.fn();
        await expect(correr(paper('  '), review)).rejects.toThrow(/no tiene prosa/);
        expect(review).not.toHaveBeenCalled();
        expect(consumeExegesis).not.toHaveBeenCalled();
    });

    // TP #9 (4:14): la nota «el criterio no decide; se corrige en la prosa»
    // no llegaba al revisor, y el revisor pidió Wallace 961, que no existe.
    it('pasa las notas de revisión manual y descarta la cita inventada (B39, B40)', async () => {
        const p = paper();
        const qa = analisis.questionAnswers[0]!;
        Object.assign(p.steps[0]!.accepted, {
            citationReviews: [{ path: 'questionAnswers[0].decisiveCriterion.sources[0]', note: 'Mayor 135 no decide; se corrige en la prosa.' }],
            canonicalAnalysis: { ...analisis, questionAnswers: [{ ...qa, decisiveCriterion: { ...qa.decisiveCriterion, sources: [{ sourceKey: 'Mayor', page: 135 }] } }] },
        });
        const review = vi.fn().mockResolvedValue({
            findings: [
                { criterion: 9, quote: '', problem: 'Falta la referencia a Wallace, p. 961.', fix: '' },
                { criterion: 1, quote: '', problem: 'La prosa no sigue al análisis en el criterio: ¿es a propósito?', fix: '' },
                { criterion: 9, quote: '', problem: 'El análisis cita Wallace, p. 533 y la prosa no.', fix: '' },
            ],
            modelId: 'm', tokensUsed: 1,
        });
        const { r, input } = await correr(p, review);
        expect(input.reviewNotes).toEqual([{ citation: 'Mayor, p. 135 (pregunta 4, criterio decisivo)', note: 'Mayor 135 no decide; se corrige en la prosa.' }]);
        expect(input.decisiveCriteria[0].reviewNotes).toEqual(['Mayor, p. 135 (pregunta 4, criterio decisivo): Mayor 135 no decide; se corrige en la prosa.']);
        expect(input.availableCitations).toEqual(expect.arrayContaining(['Mayor, p. 135', 'Wallace, p. 533']));
        expect(r.findings.map((f: { problem: string }) => f.problem)).toEqual([
            'La prosa no sigue al análisis en el criterio: ¿es a propósito?',
            'El análisis cita Wallace, p. 533 y la prosa no.',
        ]);
    });
});
