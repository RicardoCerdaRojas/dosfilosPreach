import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { buildEmptyCanonicalVerseAnalysis, type PassageReference } from '@dosfilos/domain';
import { CanonicalAnalysisStudyView } from '../CanonicalAnalysisStudyView';

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));

/**
 * Jonás 4:5-11: «Crítica textual (0)» con la nota adentro se leía como «vacío»,
 * y «Decisiones de traducción (0)» no decía por qué.
 */
const REF = { bookId: 'JON', chapterStart: 4, chapterEnd: 4, verseStart: 5, verseEnd: 5 } as PassageReference;
function analisis() {
    const a = buildEmptyCanonicalVerseAnalysis(REF);
    return { ...a, textualCriticism: { ...a.textualCriticism, note: 'Sin variantes significativas en el TM.', variants: [] } };
}

beforeEach(() => cleanup());

describe('secciones del análisis sin contenido', () => {
    it('el «(0)» no aparece: una sección revisada no se lee como vacía', () => {
        render(<CanonicalAnalysisStudyView analysis={analisis()} />);
        expect(screen.queryByText('(0)')).toBeNull();
    });

    it('crítica textual con nota y sin variantes dice «revisado · sin variantes»', () => {
        render(<CanonicalAnalysisStudyView analysis={analisis()} />);
        expect(screen.getByText(/canonical\.study\.status\.noVariants/)).toBeInTheDocument();
    });

    it('decisiones de traducción vacías dicen la regla, no sólo «sin decisiones»', () => {
        render(<CanonicalAnalysisStudyView analysis={analisis()} />);
        // La sección de cruces abre por defecto.
        expect(screen.getByText('canonical.study.empty.cruxes')).toBeInTheDocument();
    });
});
