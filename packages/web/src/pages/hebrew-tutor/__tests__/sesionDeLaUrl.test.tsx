import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * El tutor de hebreo abre la sesión de `?sessionId=` (los enlaces del
 * escritorio del proyecto, TP #9): navega a su versículo una vez, con el
 * análisis guardado (`navigate`), sin generar.
 */
const navigate = vi.fn();
const analyze = vi.fn();
vi.mock('../hooks/useVerseAnalysis', () => ({
    useVerseAnalysis: () => ({
        selectedBook: '', selectedChapter: 1, selectedVerse: 1, verseReference: '', bookIndex: null, analysis: null, analyzedRef: null,
        hebrewVerse: null, isLoadingIndex: false, isAnalyzing: false, isLoadingVerse: false, error: null,
        setBook: vi.fn(), setChapter: vi.fn(), setVerse: vi.fn(), analyze, clearError: vi.fn(), canReanalyze: true,
        navigate, nextVerse: vi.fn(), prevVerse: vi.fn(),
    }),
}));
vi.mock('../hooks/useRecentVerses', () => ({ addRecentVerse: vi.fn(), useRecentVerses: () => ({ recents: [], refresh: vi.fn() }) }));
let sesiones: Array<{ id: string; passage: string }> = [];
vi.mock('@/hooks/useHebrewSessions', () => ({
    useHebrewSessions: () => ({ sessions: sesiones, isLoading: false }),
    hebrewStudySessionRepo: { recordActivity: vi.fn() },
}));
vi.mock('@dosfilos/infrastructure', () => ({ HEBREW_BOOKS_CATALOG: [{ morphhbKey: 'Jonah', nameSpanish: 'Jonás' }] }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
for (const m of ['VerseSelector', 'VerseNavBar', 'ModeSelectorInline', 'VerseAnalysisResult', 'VersePreview', 'HebrewLoadingTips']) {
    vi.doMock(`../components/${m}`, () => ({ [m]: () => null }));
}
vi.mock('../components/HebrewToolbar', () => ({ HebrewToolbar: () => null }));

const { VerseAnalyzerPage } = await import('../VerseAnalyzerPage');
const pintar = (url: string) => render(
    <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[url]}>
            <VerseAnalyzerPage mode="analyzer" onModeChange={vi.fn()} toolbarCollapsed={false} onToggleToolbar={vi.fn()} />
        </MemoryRouter>
    </QueryClientProvider>,
);

beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    sesiones = [{ id: 'u1__Jon_s_3_4', passage: 'Jonás 3:4' }];
});

describe('el tutor de hebreo y `?sessionId=`', () => {
    it('abre el versículo de la sesión, una vez y sin generar', () => {
        const { rerender } = pintar('/dashboard/hebrew-tutor?sessionId=u1__Jon_s_3_4&projectId=ezr');
        expect(navigate).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith('Jonah', 3, 4);
        // La lista de sesiones se relee (otra referencia): no vuelve a navegar,
        // aunque el pastor ya se haya movido a otro versículo.
        sesiones = [...sesiones];
        rerender(
            <QueryClientProvider client={new QueryClient()}>
                <MemoryRouter initialEntries={['/dashboard/hebrew-tutor?sessionId=u1__Jon_s_3_4']}>
                    <VerseAnalyzerPage mode="analyzer" onModeChange={vi.fn()} toolbarCollapsed={false} onToggleToolbar={vi.fn()} />
                </MemoryRouter>
            </QueryClientProvider>,
        );
        expect(navigate).toHaveBeenCalledTimes(1);
        expect(analyze).not.toHaveBeenCalled();
    });

    it('sin `sessionId`, o con una sesión que no está, no navega', () => {
        pintar('/dashboard/hebrew-tutor');
        pintar('/dashboard/hebrew-tutor?sessionId=otra');
        expect(navigate).not.toHaveBeenCalled();
    });
});
