import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * TP #8 (8b, E4): «Componer paper académico» reescribe el documento entero y
 * borra lo editado a mano. Se dice antes de pulsar.
 */
vi.mock('@/hooks/exegesis/useExegesisPaper', () => ({ useExegesisPaper: () => ({ paper: null }) }));
vi.mock('@/hooks/exegesis/useCitationAnchoring', () => ({ useCitationAnchoring: () => null }));
vi.mock('../CitationAnchoringNotice', () => ({ CitationAnchoringNotice: () => null }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({
    useExegesisPapers: () => ({
        composeAcademicPaper: { mutateAsync: vi.fn(), isPending: false },
        saveAssembledPaper: { mutateAsync: vi.fn(), isPending: false },
        saveExegesisArtifact: { mutateAsync: vi.fn(), isPending: false },
    }),
}));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const { AcademicCompositionDialog } = await import('../AcademicCompositionDialog');

describe('Componer paper académico', () => {
    it.each([['sin composición guardada', ''], ['con una guardada', '# Trabajo']])('avisa que reescribe todo, %s', (_n, guardado) => {
        render(<AcademicCompositionDialog open onOpenChange={vi.fn()} paperId="p" suggestedFilename="x" savedAssembledMarkdown={guardado} />);
        expect(screen.getByRole('alert')).toHaveTextContent('canonical.compose.rewriteWarning');
    });
});
