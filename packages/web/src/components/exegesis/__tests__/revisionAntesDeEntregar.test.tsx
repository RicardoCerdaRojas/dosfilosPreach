import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

/**
 * TP #8 (2026-10-21, fase 8b, E3): «Revisión antes de entregar». Avisa lo
 * que hubo que corregir a mano y ofrece recomponer con eso; no bloquea.
 */
const mutateAsync = vi.fn();
let data: unknown = undefined;
vi.mock('@/hooks/exegesis/useReviewVerseProse', () => ({
    useReviewVerseProse: () => ({ mutateAsync, isPending: false, data }),
}));
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
const { ProseReviewCard } = await import('../ProseReviewCard');

const PROSA = 'La construcción διά τό μὴ αἰτεῖσθαι es causal (Wallace, 597).';
const montar = (over: Record<string, unknown> = {}) => {
    const onRecompose = vi.fn();
    const onQuotaError = vi.fn(() => false);
    render(
        <ProseReviewCard
            paperId="p" stepId="s" prose={PROSA} analysis={null} verdicts={[]} reviews={[]}
            sources={[{ citationKey: 'Wallace', displayLabel: 'Wallace', sourceType: 'grammar-syntax' }]}
            language="es" onRecompose={onRecompose} recomposing={false} disabled={false} onQuotaError={onQuotaError}
            {...over}
        />,
    );
    fireEvent.click(screen.getByRole('button', { name: /proseReview\.title/ }));
    return { onRecompose, onQuotaError };
};

beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    data = undefined;
});

describe('«Revisión antes de entregar»', () => {
    it('los controles fijos corren solos: «διά τό» con su arreglo', () => {
        montar();
        expect(screen.getByText(/proseReview\.count/).textContent).toContain('"count":2');
        expect(screen.getByText('→ διὰ τό')).toBeInTheDocument();
        // Lo mecánico se corrige a mano: no ofrece recomponer por un acento.
        expect(screen.queryByText('canonical.proseReview.action.recompose')).toBeNull();
    });

    it('el revisor con los criterios se pide con un botón, y su hallazgo entra en la indicación', async () => {
        mutateAsync.mockResolvedValue(undefined);
        data = {
            reviewedMarkdown: PROSA,
            criteria: ['c1', 'c2', 'c3', 'c4', 'c5', 'El criterio decisivo distingue entre las lecturas.'],
            findings: [{ criterion: 6, quote: 'es causal', problem: 'No discrimina.', fix: 'Usar la concesión.' }],
        };
        const { onRecompose } = montar();
        expect(screen.getByText('No discrimina.')).toBeInTheDocument();
        expect(screen.getByText(/El criterio decisivo distingue/)).toBeInTheDocument();
        fireEvent.click(screen.getByText('canonical.proseReview.action.reviewAgain'));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        fireEvent.click(screen.getByText('canonical.proseReview.action.recompose'));
        expect(onRecompose.mock.calls[0]![0]).toContain('En «es causal»: No discrimina. → Usar la concesión.');
    });

    it('si la prosa cambió después de revisar, quedan solo los que señalan una frase que sigue (revisión de 8b)', () => {
        data = { reviewedMarkdown: 'otra prosa', criteria: ['c1'], findings: [
            { criterion: 1, quote: '', problem: 'Viejo.', fix: '' },
            { criterion: 1, quote: 'es causal', problem: 'Sigue.', fix: '' },
        ] };
        montar();
        expect(screen.queryByText('Viejo.')).toBeNull();
        expect(screen.getByText('Sigue.')).toBeInTheDocument();
        expect(screen.getByText('canonical.proseReview.reviewer.stale')).toBeInTheDocument();
    });

    it('sin saldo, abre el diálogo de créditos', async () => {
        const err = Object.assign(new Error('x'), { code: 'insufficient-exegesis-credits' });
        mutateAsync.mockRejectedValue(err);
        const { onQuotaError } = montar();
        fireEvent.click(screen.getByText('canonical.proseReview.action.review'));
        await waitFor(() => expect(onQuotaError).toHaveBeenCalledWith(err));
    });
});
