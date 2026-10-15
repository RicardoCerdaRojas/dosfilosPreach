import { describe, it, expect, vi } from 'vitest';

/**
 * TP #6 (#22): sumar una evidencia a una sección pedía recomponerla entera.
 * «Agregar una idea» calcula la sección con la idea puesta y NO guarda.
 */
vi.mock('../../../services/ProcessingBalanceService', () => ({
    processingBalanceService: { consumeExegesis: vi.fn().mockResolvedValue(undefined), refundExegesis: vi.fn().mockResolvedValue(undefined) },
    InsufficientExegesisCreditsError: class extends Error { },
}));
vi.mock('../../../services/exegesisPricingTracker', () => ({ fireExegesisPricingEvent: vi.fn() }));
const { PlaceIdeaInSectionUseCase } = await import('../PlaceIdeaInSectionUseCase');

const PROSA = 'El genitivo es epexegético (McCartney, p. 198). La mansedumbre es sabiduría.\n\nOtra lectura lo toma como fuente.';
const paper = {
    id: 'p', displayLanguage: 'es',
    rubric: { formatting: { lineSpacing: 'single', blankLineBetweenParagraphs: true, citationForm: 'parenthetical', pageLabel: 'bare' } },
    steps: [{
        id: 's', kind: 'verse', state: 'awaiting-review',
        current: { id: 'v2', markdown: PROSA }, accepted: { id: 'v1', markdown: 'VIEJA' },
    }],
};

describe('PlaceIdeaInSectionUseCase', () => {
    it('pone la idea en la versión en revisión, como se entrega, y no guarda', async () => {
        const repo = { getPaper: vi.fn().mockResolvedValue(paper), saveManualEdit: vi.fn(), setStepState: vi.fn() };
        const placer = { placeIdea: vi.fn().mockResolvedValue({
            placement: { paragraphIndex: 0, afterSentence: 'El genitivo es epexegético (McCartney, 198).', sentence: 'Mayor lo confirma (Mayor, 14).' },
            tokensUsed: 10, modelId: 'm',
        }) };
        const r = await new PlaceIdeaInSectionUseCase(repo as never, placer as never)
            .execute({ ownerId: 'o', paperId: 'p', stepId: 's', idea: 'Mayor lo confirma con paralelos (Mayor, 14)' });

        // La prosa que vio el asistente es la entregada: «(McCartney, 198)», sin «p.».
        expect(placer.placeIdea.mock.calls[0]![0].paragraphs[0]).toContain('(McCartney, 198)');
        expect(r.markdown).toBe('El genitivo es epexegético (McCartney, 198). Mayor lo confirma (Mayor, 14). La mansedumbre es sabiduría.\n\nOtra lectura lo toma como fuente.');
        expect(r.anchored).toBe(true);
        expect(r.placement.sentence).toBe('Mayor lo confirma (Mayor, 14).');
        expect(r.lostCitations).toEqual([]);
        expect(repo.saveManualEdit).not.toHaveBeenCalled();
    });
});

describe('lo ya dicho se avisa sólo si está de verdad en la sección', () => {
    const correr = async (alreadyStated: string) => {
        const repo = { getPaper: vi.fn().mockResolvedValue(paper) };
        const placer = { placeIdea: vi.fn().mockResolvedValue({
            placement: { paragraphIndex: 0, afterSentence: '', sentence: 'S.', alreadyStated }, tokensUsed: 1, modelId: 'm',
        }) };
        return new PlaceIdeaInSectionUseCase(repo as never, placer as never).execute({ ownerId: 'o', paperId: 'p', stepId: 's', idea: 'x' });
    };
    it('una oración que está en la sección, se avisa', async () => {
        expect((await correr('La mansedumbre es sabiduría.')).alreadyStated).toBe('La mansedumbre es sabiduría.');
    });
    it('una que el asistente imaginó, no', async () => {
        expect((await correr('Esto no está.')).alreadyStated).toBe('');
    });
});
