import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { buildEmptyCanonicalVerseAnalysis, type ExegeticalStep } from '@dosfilos/domain';

/**
 * TP #8 (2026-10-21, #36; fase 8b, E4): el fundador no sabía que después de
 * aceptar el análisis había que componer la prosa. Era un ícono gris de 28 px.
 */
const mutaciones = new Map<string, { mutateAsync: ReturnType<typeof vi.fn>; mutate: ReturnType<typeof vi.fn>; isPending: boolean }>();
const mutacion = (k: string) => {
    if (!mutaciones.has(k)) mutaciones.set(k, { mutateAsync: vi.fn().mockResolvedValue({ assemblyUpdated: true }), mutate: vi.fn(), isPending: false });
    return mutaciones.get(k)!;
};
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({
    useExegesisPapers: () => new Proxy({}, { get: (_t, k: string) => mutacion(k) }),
}));
vi.mock('@/hooks/exegesis/useReopenStep', () => ({ useReopenStep: () => mutacion('reopen') }));
vi.mock('../StudentReadingPanel', () => ({ StudentReadingPanel: () => null, ObservationCitationNotice: ({ method }: { method?: string | null }) => <span>{`aviso:${String(method)}`}</span> }));
let papelDelPaso: Record<string, unknown> = { sources: [] };
vi.mock('@/hooks/exegesis/useExegesisPaper', () => ({ useExegesisPaper: () => ({ paper: papelDelPaso }) }));
vi.mock('@/hooks/exegesis/useReviewVerseProse', () => ({ useReviewVerseProse: () => ({ mutateAsync: vi.fn(), isPending: false, data: undefined }) }));
vi.mock('@/components/exegesis/citation/SourceViewerProvider', () => ({
    useRegisterCitationSink: () => undefined,
    useSourceViewer: () => ({ open: vi.fn(), openCitation: vi.fn() }),
}));
vi.mock('@/components/exegesis/canonical/CanonicalAnalysisStudyView', () => ({ CanonicalAnalysisStudyView: () => null }));
vi.mock('@/pages/library/components/CreditPacksDialog', () => ({ CreditPacksDialog: () => null }));
vi.mock('@/components/exegesis/ExegesisOutOfCreditsDialog', () => ({ ExegesisOutOfCreditsDialog: () => null }));
vi.mock('@/components/exegesis/CitationVerificationDialog', () => ({ CitationVerificationDialog: () => null }));
vi.mock('@/components/exegesis/AgregarIdeaDialog', () => ({ AgregarIdeaDialog: () => null }));
vi.mock('@/components/exegesis/ExegesisPreConfirmDialog', () => ({ ExegesisPreConfirmDialog: () => null }));
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}));
vi.mock('react-router-dom', () => ({
    Link: ({ children }: { children: unknown }) => children,
    useNavigate: () => vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

const { StepCard } = await import('../StepCard');

const REF = { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 3, verseEnd: 3 };
const paso = (markdown: string): ExegeticalStep => {
    const version = { id: 'v1', markdown, canonicalAnalysis: buildEmptyCanonicalVerseAnalysis(REF as never), createdAt: new Date() };
    return {
        id: 's3', paperId: 'p', kind: 'verse', verseRef: REF, order: 3, state: 'accepted',
        versions: [version], current: version, accepted: version, createdAt: new Date(), updatedAt: new Date(),
    } as unknown as ExegeticalStep;
};
const COMPONER = 'canonical.verseProse.button.compose';

beforeEach(() => {
    cleanup();
    mutaciones.clear();
    papelDelPaso = { sources: [] };
});

describe('después de aceptar, componer la prosa es lo principal', () => {
    it('con la tarjeta cerrada, el botón está en el encabezado y compone', () => {
        render(<StepCard step={paso('')} paperId="p" language="es" />);
        // El encabezado entero es pulsable (abre la tarjeta): el botón va dentro.
        const boton = screen.getAllByRole('button', { name: new RegExp(COMPONER) }).find(b => b.tagName === 'BUTTON')!;
        fireEvent.click(boton);
        expect(mutacion('composeVerseAcademicProse').mutateAsync).toHaveBeenCalledWith({ paperId: 'p', stepId: 's3' });
    });

    it('abierta, va en el pie con el aviso de que sin prosa no entra al documento', () => {
        render(<StepCard step={paso('')} paperId="p" language="es" />);
        fireEvent.click(screen.getByRole('button', { name: /detail\.steps\.action\.expand/ }));
        expect(screen.getAllByRole('button', { name: new RegExp(COMPONER) }).filter(b => b.tagName === 'BUTTON')).toHaveLength(1);
        expect(screen.getByText('canonical.verseProse.nextStepHint')).toBeInTheDocument();
    });

    it('un versículo fuera del documento no lleva el botón en el encabezado (revisión de 8b)', () => {
        const fuera = { ...paso(''), includeInDocument: false } as ExegeticalStep;
        render(<StepCard step={fuera} paperId="p" language="es" />);
        expect(screen.queryAllByRole('button', { name: new RegExp(COMPONER) }).filter(b => b.tagName === 'BUTTON')).toEqual([]);
    });

    it('con prosa ya compuesta, no: queda recomponer', () => {
        render(<StepCard step={paso('La prosa del versículo.')} paperId="p" language="es" />);
        expect(screen.queryAllByRole('button', { name: new RegExp(COMPONER) }).filter(b => b.tagName === 'BUTTON')).toEqual([]);
    });
});

describe('etapa 2, capa 3: el camino viejo no conoce el método', () => {
    const pendiente = { ...paso(''), state: 'pending', current: null, accepted: null, versions: [] } as unknown as ExegeticalStep;

    it('sin método se ofrece como siempre', () => {
        render(<StepCard step={pendiente} paperId="p" language="es" />);
        expect(screen.getByText('detail.steps.action.generateLegacyVerse')).toBeInTheDocument();
    });

    it('con un método que separa la observación se oculta', () => {
        papelDelPaso = { sources: [], exegeticalMethod: 'mixed' };
        render(<StepCard step={pendiente} paperId="p" language="es" />);
        expect(screen.queryByText('detail.steps.action.generateLegacyVerse')).toBeNull();
        expect(screen.getByText('canonical.actions.analyze')).toBeInTheDocument();
    });

    it('el aviso de la observación mira el método con que se generó la versión, no el actual', () => {
        papelDelPaso = { sources: [], exegeticalMethod: 'mixed' };
        const viejo = paso('');
        const { unmount } = render(<StepCard step={viejo} paperId="p" language="es" />);
        fireEvent.click(screen.getByRole('button', { name: /detail\.steps\.action\.expand/ }));
        expect(screen.queryByText('aviso:mixed')).toBeNull();
        unmount();
        const nuevo = paso('');
        (nuevo.accepted as unknown as Record<string, unknown>).analysisMethod = 'mixed';
        render(<StepCard step={nuevo} paperId="p" language="es" />);
        fireEvent.click(screen.getByRole('button', { name: /detail\.steps\.action\.expand/ }));
        expect(screen.getByText('aviso:mixed')).toBeInTheDocument();
    });
});
