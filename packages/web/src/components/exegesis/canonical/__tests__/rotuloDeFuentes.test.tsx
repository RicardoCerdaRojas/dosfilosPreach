import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { buildEmptyCanonicalVerseAnalysis, type PassageReference } from '@dosfilos/domain';
import { CanonicalAnalysisStudyView } from '../CanonicalAnalysisStudyView';

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));

/**
 * Las citas de contexto histórico, léxico y notas (revisión adversarial de
 * E3): decían «p.» sobre una hoja, «p. 0 (2.3)» sobre una sección, y al
 * abrirlas se perdía la sección.
 */
const REF = { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 14, verseEnd: 14 } as PassageReference;
function analisis() {
    return {
        ...buildEmptyCanonicalVerseAnalysis(REF),
        historicalContext: [{
            aspect: 'fe y obras', relevance: 'x',
            sources: [
                { sourceKey: 'Wallace', page: 0, pageKind: 'section' as const, locator: '2.3' },
                { sourceKey: 'Moo', page: 54, pageKind: 'printed' as const },
                { sourceKey: 'Vieja', page: 12 },
            ],
        }],
    };
}

beforeEach(() => cleanup());

describe('lista de fuentes del análisis', () => {
    it('cada cita con su rótulo: sección, página impresa, hoja', () => {
        render(<CanonicalAnalysisStudyView analysis={analisis()} onOpenCitation={() => {}} />);
        fireEvent.click(screen.getByText(/historical/i, { selector: 'button *, button' }));
        expect(screen.getByRole('button', { name: 'Wallace § 2.3' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Moo p. 54' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Vieja hoja 12' })).toBeInTheDocument();
        expect(screen.queryByText(/\(2\.3\)/)).toBeNull();
    });

    it('abrir una cita por sección lleva su sección', () => {
        const abrir = vi.fn();
        render(<CanonicalAnalysisStudyView analysis={analisis()} onOpenCitation={abrir} />);
        fireEvent.click(screen.getByText(/historical/i, { selector: 'button *, button' }));
        fireEvent.click(screen.getByRole('button', { name: 'Wallace § 2.3' }));
        expect(abrir).toHaveBeenCalledWith(expect.objectContaining({ sourceKey: 'Wallace', pageKind: 'section', locator: '2.3' }));
    });
});
