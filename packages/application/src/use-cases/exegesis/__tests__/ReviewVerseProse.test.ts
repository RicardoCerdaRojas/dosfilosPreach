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
});
