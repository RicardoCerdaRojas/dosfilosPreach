import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

/**
 * TP #7 (#29): un paso regenerado después de aceptarse. Aceptar acepta la
 * versión nueva y el servidor la bloquea mientras tenga citas sin revisar; la
 * página verificaba y revisaba la ACEPTADA vieja y la nueva no tenía salida.
 */
const verifyStepCitations = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
const reviewCitation = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({
    useExegesisPapers: () => ({
        verifyStepCitations,
        reviewCitation,
        correctCitation: { mutateAsync: vi.fn(), isPending: false },
        acceptStep: { mutateAsync: vi.fn(), isPending: false },
    }),
}));
const { useStepReview } = await import('../useStepReview');

const version = (id: string) => ({ id, canonicalAnalysis: null, citationVerdicts: [], citationReviews: [] });

describe('la página de revisión mira la versión que se va a aceptar', () => {
    it('regenerado tras aceptar: verifica y revisa la nueva', async () => {
        const step = { id: 's1', state: 'awaiting-review', current: version('nueva'), accepted: version('vieja') };
        const { result } = renderHook(() => useStepReview({ id: 'p1', sources: [] } as never, step as never));
        await act(() => result.current.verify());
        await act(() => result.current.review('ruta', 'p. 203 lo dice'));
        expect(verifyStepCitations.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ versionId: 'nueva' }));
        expect(reviewCitation.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ versionId: 'nueva' }));
    });
});
