import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/** TP #8 (#36; 8b, E4): «3 de 4 con prosa» junto al ensamble. */
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ setStepInclusion: { mutate: vi.fn() } }) }));
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/hooks/exegesis/useExegesisPaper', () => ({ useExegesisPaper: () => ({ paper: null }) }));
const { AssemblyManifest } = await import('../AssemblyManifest');

const parte = (stepId: string, kind: 'verse' | 'introduction', words = 100) => ({ stepId, kind, label: `Santiago 4:${stepId}`, words });

describe('el contador de prosa del ensamble', () => {
    it('cuenta los versículos del documento con prosa, sin la introducción ni los excluidos', () => {
        render(<AssemblyManifest paperId="p" preguntas={[]} contents={{
            included: [parte('1', 'verse'), parte('2', 'verse'), parte('3', 'verse'), parte('0', 'introduction')],
            pending: [parte('5', 'verse', 0)],
            excluded: [parte('4', 'verse', 0)],
            words: 400,
        }} />);
        expect(screen.getByText(/assembly\.proseCount/).textContent).toContain('{"done":3,"total":4}');
    });
});
