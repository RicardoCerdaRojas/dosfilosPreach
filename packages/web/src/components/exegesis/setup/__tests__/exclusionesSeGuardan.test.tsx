import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/**
 * TP #7 (#9, #11): el fundador desmarcó NA28 en la propuesta y no pulsó
 * «Excluirlas». Al refrescar volvió marcada, los pasos que redactan no
 * recibían la decisión y la tarjeta de NA28 seguía diciendo «no debería
 * entrar».
 */
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
const mutateAsync = vi.fn().mockResolvedValue({});
const previa = {
    id: 'tp6', title: null, createdAt: new Date('2026-10-06'), citedSourceKeys: ['Adamson', 'NA28'],
    passage: { bookId: 'JAS', chapterStart: 3, chapterEnd: 3, verseStart: 1, verseEnd: 12 },
};
const actual = { id: 'tp7', title: null, createdAt: new Date('2026-10-14'), citedSourceKeys: [], passage: previa.passage };
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({ useFacultyProjects: () => ({ projects: [] }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({
    useExegesisPapers: () => ({ papers: [previa, actual], updatePaperExcludedSources: { mutateAsync, isPending: false } }),
}));
const { ExcludedSourcesCard } = await import('../ExcludedSourcesCard');

describe('la propuesta de exclusiones se guarda al marcar', () => {
    it('desmarcar NA28 guarda las demás en el momento, sin pulsar «Excluirlas»', () => {
        render(<ExcludedSourcesCard paper={{ id: 'tp7', excludedSources: null, displayLanguage: 'es' } as never} />);
        fireEvent.click(screen.getByLabelText('NA28'));
        expect(mutateAsync).toHaveBeenCalledWith({
            paperId: 'tp7',
            excludedSources: [expect.objectContaining({ key: 'Adamson' })],
        });
        // La lista sigue a la vista para seguir decidiendo.
        expect(screen.getByLabelText('NA28')).not.toBeChecked();
        expect(screen.getByText('paperSetup.subSteps.corpus.excluded.done')).toBeInTheDocument();
    });
});
