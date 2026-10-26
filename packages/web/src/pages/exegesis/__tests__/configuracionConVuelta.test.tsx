import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

/**
 * La configuración de un trabajo creado desde un proyecto llega con
 * `?from=` (la página de creación lo pone) y lo pasa al estudio: si no, la
 * flecha del estudio volvía a la lista de estudios y no al proyecto. Solo
 * rutas internas (`safeInternalPath`).
 */
const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
vi.mock('@/hooks/exegesis/useExegesisPaper', () => ({
    useExegesisPaper: () => ({
        paper: { id: 'p1', title: 'TP #10', phase: 'setup', passage: { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 13, verseEnd: 17 } },
        isLoading: false, error: null,
    }),
}));
const vacio = () => null;
vi.mock('@/components/exegesis/setup/RubricSubStep', () => ({ RubricSubStep: vacio }));
vi.mock('@/components/exegesis/setup/StyleManifestSubStep', () => ({ StyleManifestSubStep: vacio }));
vi.mock('@/components/exegesis/setup/CorpusSubStep', () => ({ CorpusSubStep: vacio }));
vi.mock('@/components/exegesis/setup/StructuralPlanSubStep', () => ({ StructuralPlanSubStep: vacio }));
vi.mock('@/components/exegesis/setup/PaperBriefButton', () => ({ PaperBriefButton: vacio }));
vi.mock('@/components/exegesis/setup/PaperCoverButton', () => ({ PaperCoverButton: vacio }));
vi.mock('@/components/exegesis/setup/PaperRubricButton', () => ({ PaperRubricButton: vacio }));
vi.mock('@/components/exegesis/setup/SaveWorkProfileButton', () => ({ SaveWorkProfileButton: vacio }));
vi.mock('@/components/exegesis/setup/PaperMethodSelect', () => ({ PaperMethodSelect: vacio }));
vi.mock('@/components/exegesis/corpus-plan/CorpusUsagePlanSubStep', () => ({ CorpusUsagePlanSubStep: vacio }));
const { ExegesisPaperSetupPage } = await import('../ExegesisPaperSetupPage');

const abrir = (q: string) => render(
    <MemoryRouter initialEntries={[`/dashboard/exegesis/p1/setup${q}`]}>
        <Routes><Route path="/dashboard/exegesis/:paperId/setup" element={<ExegesisPaperSetupPage />} /></Routes>
    </MemoryRouter>,
);

beforeEach(() => { cleanup(); vi.clearAllMocks(); });

describe('la configuración pasa la vuelta al estudio', () => {
    it('con `?from=` del proyecto, la flecha y «Ir al trabajo» la llevan', () => {
        abrir('?from=%2Fdashboard%2Fprojects%2Fnt785');
        const conVuelta = '/dashboard/exegesis/p1?from=%2Fdashboard%2Fprojects%2Fnt785';
        expect(screen.getByLabelText('paperSetup.backToPaper').getAttribute('href')).toBe(conVuelta);
        fireEvent.click(screen.getByText('paperSetup.goToPaper'));
        expect(navigate).toHaveBeenCalledWith(conVuelta);
    });

    it('sin `?from=`, o con uno que sale de la app, el estudio sin vuelta', () => {
        abrir('?from=%2F%2Fotro.sitio');
        expect(screen.getByLabelText('paperSetup.backToPaper').getAttribute('href')).toBe('/dashboard/exegesis/p1');
        cleanup();
        abrir('');
        expect(screen.getByLabelText('paperSetup.backToPaper').getAttribute('href')).toBe('/dashboard/exegesis/p1');
    });
});
