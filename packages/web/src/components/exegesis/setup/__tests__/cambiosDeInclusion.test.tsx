import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/** TP #7 (#16): al guardar el encuadre, 3:15 entra si el estudiante quiere. */
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o?.name ? `${k}:${o.name}` : k), i18n: { language: 'es' } }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const mutateAsync = vi.fn().mockResolvedValue({});
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ setStepInclusion: { mutateAsync } }) }));
const { CambiosDeInclusion } = await import('../CambiosDeInclusion');

describe('la propuesta de inclusión', () => {
    const cambios = [
        { stepId: 'v15', kind: 'verse' as const, include: true,
          verseRef: { bookId: 'JAS', chapterStart: 3, chapterEnd: 3, verseStart: 15, verseEnd: 15 } },
        { stepId: 'intro', kind: 'introduction' as const, include: false, verseRef: null },
    ];

    it('nombra cada sección y aplica sólo al confirmar', async () => {
        const onDone = vi.fn();
        render(<CambiosDeInclusion paperId="p1" cambios={cambios as never} onDone={onDone} />);
        expect(screen.getByText(/paperSetup.brief.inclusion.enters:.*3:15/)).toBeInTheDocument();
        expect(screen.getByText('paperSetup.brief.inclusion.leaves:detail.steps.kind.introduction')).toBeInTheDocument();
        expect(mutateAsync).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText('paperSetup.brief.inclusion.apply'));
        await waitFor(() => expect(onDone).toHaveBeenCalled());
        expect(mutateAsync).toHaveBeenCalledWith({ paperId: 'p1', stepId: 'v15', include: true });
        expect(mutateAsync).toHaveBeenCalledWith({ paperId: 'p1', stepId: 'intro', include: false });
    });

    it('«Dejar como está» no cambia nada', () => {
        mutateAsync.mockClear();
        const onDone = vi.fn();
        render(<CambiosDeInclusion paperId="p1" cambios={cambios as never} onDone={onDone} />);
        fireEvent.click(screen.getAllByText('paperSetup.brief.inclusion.keep')[0]!);
        expect(onDone).toHaveBeenCalled();
        expect(mutateAsync).not.toHaveBeenCalled();
    });
});
