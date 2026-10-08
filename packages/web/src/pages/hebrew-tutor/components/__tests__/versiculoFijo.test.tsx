import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/**
 * El versículo que acompaña al scroll queda APAGADO por defecto y se activa
 * con «Fijo» (pedido del fundador, 2026-10-08). La elección se recuerda.
 */
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
vi.mock('../StickyVerseHeader', () => ({ StickyVerseHeader: () => <div data-testid="versiculo-fijo" /> }));
vi.mock('../../HebrewTutorProvider', () => ({ useHebrewTutor: () => ({}) }));
// Los paneles de investigación traen servicios con Firebase; aquí no se abren.
vi.mock('../VerbDetectivePanel', () => ({ VerbDetectivePanel: () => null }));
vi.mock('../NominalDetectivePanel', () => ({ NominalDetectivePanel: () => null }));
vi.mock('@/components/language-structure/useVerseStructure', () => ({
    useVerseStructure: () => ({ loading: false, unavailable: true, nodes: null, words: [], ordinal: new Map(), frontedByOrdinal: new Map() }),
    conLectura: () => new Map(),
}));
const { VerseAnalysisResult } = await import('../VerseAnalysisResult');
const { TooltipProvider } = await import('@/components/ui/tooltip');

const analisis = { reference: 'Rut 1:1', hebrewText: '', literalTranslation: '', fluidTranslation: '', words: [], verbTable: [], exegeticalNotes: [] } as never;
const pagina = () => render(<TooltipProvider><VerseAnalysisResult analysis={analisis} /></TooltipProvider>);

describe('versículo fijo al bajar', () => {
    beforeEach(() => localStorage.clear());

    it('por defecto no aparece', () => {
        pagina();
        expect(screen.queryByTestId('versiculo-fijo')).toBeNull();
        expect(screen.getByText('verseAnalyzer.stickyVerse.off')).toBeInTheDocument();
    });

    it('se activa con el botón y se recuerda', () => {
        const { unmount } = pagina();
        fireEvent.click(screen.getByText('verseAnalyzer.stickyVerse.off'));
        expect(screen.getByTestId('versiculo-fijo')).toBeInTheDocument();
        unmount();
        pagina();
        expect(screen.getByTestId('versiculo-fijo')).toBeInTheDocument();
    });
});
