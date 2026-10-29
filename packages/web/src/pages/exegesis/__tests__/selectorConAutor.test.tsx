import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

/**
 * TP #9, B19: la cabecera del selector de páginas muestra el autor del libro
 * bajo el rótulo de la fuente (del recurso de la biblioteca).
 */
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ paperId: 'p1', sourceId: 's1' }), useNavigate: () => vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@dosfilos/infrastructure', () => ({ proposeSheetRanges: () => new Promise(() => {}) }));
vi.mock('@dosfilos/application', () => ({ PaperCorpusTooLargeError: class extends Error {} }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'yo' } }) }));
vi.mock('@/hooks/exegesis/useExegesisPaper', () => ({
    useExegesisPaper: () => ({
        isLoading: false,
        paper: {
            id: 'p1', passage: 'Santiago 4:11-17', assignmentBrief: null, displayLanguage: 'es', steps: [],
            sources: [{ id: 's1', displayLabel: 'NA28', sourceType: 'critical-text', sourceLibraryResourceId: 'res-na28', corpusId: 'res-na28', excerptRecipe: null, excerpts: [], mode: 'extracted-excerpts', extractionFingerprint: null }],
        },
    }),
}));
vi.mock('@/hooks/exegesis/useDocumentPageIndex', () => ({ useDocumentPageIndex: () => ({ isLoading: false, data: { pages: [], sections: [], printedPageOffset: null } }) }));
vi.mock('@/hooks/exegesis/useCorpusFootprint', () => ({ useCorpusFootprint: () => ({}) }));
vi.mock('@/hooks/exegesis/useSelectSourcePages', () => ({ useSelectSourcePages: () => ({ isPending: false, mutateAsync: vi.fn() }) }));
vi.mock('@/hooks/exegesis/useLemmaPages', () => ({ useLemmaPages: () => ({ proposals: [], isLoading: false }) }));
vi.mock('@/hooks/exegesis/usePassagePages', () => ({ usePassagePages: () => ({ proposals: [], isLoading: false }) }));
vi.mock('@/hooks/exegesis/usePassageLemmas', () => ({ usePassageLemmas: () => ({ data: undefined, isLoading: false }) }));
vi.mock('@/hooks/exegesis/useLexiconSuggestion', () => ({ useLexiconSuggestion: () => null }));
let autor: string | null = 'Barbara Aland';
vi.mock('@/hooks/library/usePageNumbering', () => ({
    usePageNumbering: () => ({ data: { numbering: null, title: 'Novum Testamentum Graece', author: autor } }),
}));
vi.mock('@/components/exegesis/setup/page-picker/SourcePagesWorkspace', () => ({ SourcePagesWorkspace: () => <div data-testid="selector" /> }));
const { ExegesisSourcePagesPage } = await import('../ExegesisSourcePagesPage');

afterEach(() => { cleanup(); autor = 'Barbara Aland'; });

describe('Selector de páginas — cabecera', () => {
    it('muestra título del recurso y autor bajo el rótulo', () => {
        render(<ExegesisSourcePagesPage />);
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('NA28');
        expect(screen.getByTestId('libro-autor').textContent).toBe('Novum Testamentum Graece · Barbara Aland');
    });
});
