import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { ExegeticalStep } from '@dosfilos/domain';

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
const { ComposeSectionPrecheckDialog } = await import('../ComposeSectionPrecheckDialog');

const v5 = { id: 'v5', kind: 'verse', verseRef: { bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 5, verseEnd: 5 } } as unknown as ExegeticalStep;
beforeEach(() => cleanup());

describe('ComposeSectionPrecheckDialog — el aviso del orden (B60)', () => {
    it('suave: dice que quedan fuera, muestra el orden y «Componer igual» sigue', () => {
        const onProceed = vi.fn();
        const onOpenChange = vi.fn();
        render(<ComposeSectionPrecheckDialog open onOpenChange={onOpenChange} section="conclusion" language="es"
            missing={{ awaitingReview: [], noAnalysis: [v5], conclusionMissing: false, blocking: false }} onProceed={onProceed} />);
        expect(screen.getByText('canonical.precheck.conclusion.softTitle')).toBeInTheDocument();
        expect(screen.getByText('canonical.precheck.order')).toBeInTheDocument();
        fireEvent.click(screen.getByText('canonical.precheck.proceedAnyway'));
        expect(onProceed).toHaveBeenCalled();
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('bloqueante: no ofrece componer igual', () => {
        render(<ComposeSectionPrecheckDialog open onOpenChange={vi.fn()} section="conclusion" language="es"
            missing={{ awaitingReview: [], noAnalysis: [v5], conclusionMissing: false, blocking: true }} onProceed={vi.fn()} />);
        expect(screen.getByText('canonical.precheck.conclusion.title')).toBeInTheDocument();
        expect(screen.queryByText('canonical.precheck.proceedAnyway')).not.toBeInTheDocument();
        expect(screen.getByText('canonical.precheck.order')).toBeInTheDocument();
    });
});
