import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { buildEmptyCanonicalVerseAnalysis } from '@dosfilos/domain';

/**
 * TP #9 (B41): la página «Revisión de citas» mostraba solo el análisis. La
 * prosa, que es lo que va al Word, va primero y con sus citas marcadas.
 */
let papel: unknown = null;
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-router-dom', () => ({
    useParams: () => ({ paperId: 'p', stepId: 's' }),
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('@/hooks/exegesis/useExegesisPaper', () => ({ useExegesisPaper: () => ({ paper: papel, isLoading: false }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({
    useExegesisPapers: () => {
        const m = { mutateAsync: vi.fn(), isPending: false };
        return { verifyStepCitations: m, reviewCitation: m, correctCitation: m, acceptStep: m };
    },
}));
vi.mock('@/components/exegesis/canonical/CanonicalAnalysisStudyView', () => ({ CanonicalAnalysisStudyView: () => <div data-testid="analisis" /> }));
vi.mock('@/components/exegesis/citation/CitationSourceModal', () => ({ CitationSourceModal: () => null }));
vi.mock('@/components/exegesis/review/CitationEvidencePanel', () => ({ CitationEvidencePanel: () => null }));
vi.mock('@/components/exegesis/review/OrphanCitationKeysNotice', () => ({ OrphanCitationKeysNotice: () => null }));
const { ExegesisStepReviewPage } = await import('@/pages/exegesis/ExegesisStepReviewPage');

const PROSA = 'Sustitución de perspectivas (Tuggy, 90; Robertson, 574).';
const conPaso = (kind: string, analysis: unknown, markdown = PROSA) => ({
    id: 'p', sources: [{ citationKey: 'Tuggy', excerpts: [] }, { citationKey: 'Robertson', excerpts: [] }],
    steps: [{
        id: 's', kind, state: 'accepted', order: 1, current: null,
        verseRef: kind === 'verse' ? { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 15, verseEnd: 15 } : null,
        accepted: {
            id: 'v', markdown, canonicalAnalysis: analysis, citationReviews: [],
            verifications: { lastRunAt: new Date() },
            citationVerdicts: [{ raw: '(Tuggy, 90', author: 'Tuggy', pages: '90', offset: PROSA.indexOf('(Tuggy'), status: 'verified', origin: 'prose', note: null }],
        },
    }],
});

beforeEach(() => cleanup());

describe('la página de revisión muestra la prosa', () => {
    it('con análisis: la prosa primero, con sus citas marcadas; el análisis debajo', () => {
        papel = conPaso('verse', buildEmptyCanonicalVerseAnalysis({ bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 15, verseEnd: 15 } as never));
        render(<ExegesisStepReviewPage />);
        const prosa = screen.getByText('canonical.review.prose.title');
        const analisis = screen.getByTestId('analisis');
        expect(prosa.compareDocumentPosition(analisis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByText('canonical.review.analysisTitle')).toBeInTheDocument();
        expect(screen.getAllByTestId('cita-con-veredicto').map(b => b.textContent)).toEqual(['Tuggy, 90 · canonical.verify.status.verified']);
        expect(screen.getByText('canonical.review.prose.subtitle')).toBeInTheDocument();
    });

    it('sin análisis (introducción, ensamble): la prosa, no «no tiene análisis»', () => {
        papel = conPaso('introduction', null);
        render(<ExegesisStepReviewPage />);
        expect(screen.getByText('canonical.review.prose.title')).toBeInTheDocument();
        expect(screen.queryByText('canonical.review.noAnalysis')).toBeNull();
        expect(screen.queryByTestId('analisis')).toBeNull();
    });

    it('sin prosa ni análisis, lo dice', () => {
        papel = conPaso('introduction', null, '  ');
        render(<ExegesisStepReviewPage />);
        expect(screen.getByText('canonical.review.noAnalysis')).toBeInTheDocument();
    });

    // «Editar contenido aceptado» hereda la fecha de verificación y borra los
    // veredictos de la prosa: la página decía «cada cita lleva su punto».
    it('prosa editada tras verificar (sin veredictos de prosa): pide volver a verificar', () => {
        const p = conPaso('introduction', null) as { steps: Array<{ accepted: { citationVerdicts: unknown[] } }> };
        p.steps[0]!.accepted.citationVerdicts = [];
        papel = p;
        render(<ExegesisStepReviewPage />);
        expect(screen.getByText('canonical.review.prose.needsVerify')).toBeInTheDocument();
        expect(screen.queryByText('canonical.review.prose.subtitle')).toBeNull();
    });
});

