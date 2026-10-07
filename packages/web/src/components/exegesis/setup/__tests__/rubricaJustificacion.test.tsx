import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ExegeticalPaper } from '@dosfilos/domain';

/**
 * TP #6: «Comentario expositivo» sin justificación mostraba sólo la línea de
 * ejemplos, que se leía como si fuera la justificación.
 */
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('@/hooks/library', () => ({ useLibrary: () => ({ resources: [] }) }));
vi.mock('@/hooks/exegesis/useAttachLibrarySource', () => ({ useAttachLibrarySource: () => ({ attach: vi.fn() }) }));
vi.mock('@/hooks/exegesis/usePaperExclusions', () => ({ usePaperExclusions: () => [] }));
vi.mock('../../recommendations/RecommendationsSection', () => ({ RecommendationsSection: () => null }));

const { RubricGapCard } = await import('../RubricGapCard');

const paper = (justification: string) => ({
    id: 'p', sources: [], displayLanguage: 'es', passage: { bookId: 'JAS' },
    rubric: { sourceRequirements: [{ sourceType: 'commentary-expository', minimum: 1, maximum: null, justification }] },
}) as unknown as ExegeticalPaper;

describe('la justificación de un requisito', () => {
    it('REGRESIÓN: sin justificación propia, la descripción del tipo', () => {
        render(<RubricGapCard paper={paper('  ')} />);
        expect(screen.getByText('sourceTypes.commentary-expository.description')).toBeInTheDocument();
    });

    it('con justificación propia, ésa', () => {
        render(<RubricGapCard paper={paper('Lo pide el profesor.')} />);
        expect(screen.getByText('Lo pide el profesor.')).toBeInTheDocument();
        expect(screen.queryByText('sourceTypes.commentary-expository.description')).not.toBeInTheDocument();
    });
});
