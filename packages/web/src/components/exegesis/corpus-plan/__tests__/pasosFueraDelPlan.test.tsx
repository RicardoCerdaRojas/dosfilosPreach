import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/** TP #7 (#16): desde el plan no había cómo meter 3:15 al documento. */
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
const mutate = vi.fn();
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ setStepInclusion: { mutate, isPending: false } }) }));
const { PasosFueraDelPlan } = await import('../PasosFueraDelPlan');

describe('los pasos fuera del documento, con su interruptor', () => {
    it('incluir uno lo mete al documento', () => {
        const v15 = { id: 'v15', kind: 'verse', verseRef: { bookId: 'JAS', chapterStart: 3, chapterEnd: 3, verseStart: 15, verseEnd: 15 } };
        render(<PasosFueraDelPlan paperId="p1" steps={[v15] as never} />);
        fireEvent.click(screen.getByRole('button', { name: 'paperSetup.subSteps.corpus-plan.includeStepAria' }));
        expect(mutate).toHaveBeenCalledWith({ paperId: 'p1', stepId: 'v15', include: true }, expect.anything());
    });

    it('sin pasos fuera, no dice nada', () => {
        const { container } = render(<PasosFueraDelPlan paperId="p1" steps={[]} />);
        expect(container).toBeEmptyDOMElement();
    });
});
