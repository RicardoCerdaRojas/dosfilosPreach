import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * El cableado del panel del proyecto (fase Proyecto → Serie, revisión F3):
 * «Planificar la serie», la tarjeta de la serie, la fase activa y «Otros
 * estudios», y lo que se muestra mientras la lista de series carga.
 */
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useNavigate: () => navigate,
}));

const getUserSeries = vi.fn();
vi.mock('@dosfilos/application', () => ({ seriesService: { getUserSeries: (uid: string) => getUserSeries(uid) } }));

vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/hooks/useAuthorization', () => ({ useAuthorization: () => ({ isAdmin: false }) }));

let proyectos: unknown[] = [];
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({
    useFacultyProjects: () => ({ projects: proyectos, updateProject: { mutateAsync: vi.fn(), isPending: false } }),
}));
vi.mock('@/hooks/faculty/useFacultySessions', () => ({ useFacultySessions: () => ({ sessions: [] }) }));
vi.mock('@/hooks/use-sermons', () => ({ useSermons: () => ({ sermons: [] }) }));
vi.mock('@/hooks/useGreekSessions', () => ({ useGreekSessions: () => ({ sessions: [] }) }));
vi.mock('@/hooks/useHebrewSessions', () => ({ useHebrewSessions: () => ({ sessions: [] }) }));

let estudios: unknown[] = [];
let cargandoEstudios = false;
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({
    useExegesisPapers: () => ({ papers: estudios, isLoading: cargandoEstudios }),
}));
const mutacion = { mutateAsync: vi.fn(), isPending: false };
vi.mock('@/hooks/faculty/useProjectWorkspace', () => ({
    useProjectWorkspace: () => ({ outputs: [], isLoadingOutputs: false, createOutput: mutacion, updateOutput: mutacion, deleteOutput: mutacion }),
}));
vi.mock('../hooks/useProjectAttachedSources', () => ({
    useProjectAttachedSources: () => ({ sources: [{ id: 'f1' }], reprocessing: null, reprocessSource: vi.fn() }),
}));
vi.mock('../hooks/useSaveProjectSources', () => ({ useSaveProjectSources: () => ({ save: vi.fn(), saving: false }) }));
vi.mock('../hooks/useLinkProjectSession', () => ({ useLinkProjectSession: () => ({ linkingId: null, link: vi.fn() }) }));

// Lo que no es de esta prueba: fuera.
vi.mock('../components/project/ProjectSetupCards', () => ({ ProjectSetupCards: () => null }));
vi.mock('../components/project/ProjectResourceGrid', () => ({ ProjectResourceGrid: () => null }));
vi.mock('../components/project/ProjectMaterialList', () => ({ ProjectMaterialList: () => null }));
vi.mock('../components/project/ProjectSourcePickerModal', () => ({ ProjectSourcePickerModal: () => null }));
vi.mock('../components/project/ProjectOutputEditorDialog', () => ({ ProjectOutputEditorDialog: () => null }));
vi.mock('../components/project/ProjectLinkSessionDialog', () => ({ ProjectLinkSessionDialog: () => null }));

const { ProjectDashboard } = await import('../ProjectDashboard');
const { seriesWorkUrl } = await import('../components/project/ProjectSeriesSection');

const nehemias = {
    id: 'neh', userId: 'u1', title: 'Nehemías', color: 'amber', type: 'exegetical',
    contextNote: 'Nehemías entero, para predicarlo', sourceIds: ['f1'], bibliographyCriteria: { bibleBooks: ['NEH'] },
};
const pasaje = (c: number) => ({ bookId: 'NEH', chapterStart: c, chapterEnd: c, verseStart: 1, verseEnd: 11 });
const estudio = (id: string, c: number, phase = 'configuring') =>
    ({ id, title: `Neh ${c}`, passage: pasaje(c), phase, updatedAt: new Date(2026, 9, c), projectId: 'neh', linkedProjectIds: [] });
const serieDe = (paperIds: string[]) => ({
    id: 'sNeh', title: 'Nehemías', projectId: 'neh', createdAt: new Date('2026-10-20'),
    metadata: { plannedSermons: paperIds.map((paperId, i) => ({ id: `p${i + 1}`, week: i + 1, passage: `Neh ${i + 1}`, paperId })) },
});

const montar = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/dashboard/projects/neh']}>
                <Routes><Route path="/dashboard/projects/:projectId" element={<ProjectDashboard />} /></Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    );
};
/** El botón del próximo paso: el del recuadro de la fase activa. */
const botonDelPaso = async (texto: string) => {
    const etiqueta = await screen.findByText(/roadmap\.activePhase\.label/);
    return within(etiqueta.closest('div.rounded-xl') as HTMLElement).getByRole('button', { name: texto });
};

beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    proyectos = [nehemias];
    estudios = [];
    cargandoEstudios = false;
    getUserSeries.mockResolvedValue([]);
});

describe('panel del proyecto Exegético', () => {
    it('sin serie: el paso es planificar, y el botón abre el planificador en Nehemías', async () => {
        montar();
        expect(await screen.findByText('seriesSection.empty')).toBeInTheDocument();
        fireEvent.click(await botonDelPaso('roadmap.phases.exegetical.division.cta'));
        expect(navigate).toHaveBeenCalledWith('/dashboard/plans/pericope?projectId=neh&book=NEH');
        // El botón de la sección hace lo mismo.
        navigate.mockClear();
        fireEvent.click(screen.getByText('seriesSection.plan'));
        expect(navigate).toHaveBeenCalledWith('/dashboard/plans/pericope?projectId=neh&book=NEH');
    });

    it('con la serie: su tarjeta, «Planificar otra serie», «Otros estudios» sin los suyos y el paso lleva al primer estudio sin empezar', async () => {
        estudios = [estudio('e1', 1, 'analysis'), estudio('e2', 2), estudio('e3', 3), estudio('suelto', 5)];
        getUserSeries.mockResolvedValue([serieDe(['e1', 'e2', 'e3'])]);
        montar();
        expect(await screen.findByTestId('project-series-card')).toBeInTheDocument();
        expect(screen.getByText('seriesSection.planAnother')).toBeInTheDocument();

        const lista = screen.getByText('studies.otherTitle').closest('section') as HTMLElement;
        expect(within(lista).getAllByRole('link').map(a => a.getAttribute('href'))).toEqual(['/dashboard/exegesis/suelto']);

        fireEvent.click(await botonDelPaso('roadmap.phases.exegetical.pericopesSeries.cta'));
        expect(navigate).toHaveBeenCalledWith('/dashboard/exegesis/e2');
        expect(navigate).not.toHaveBeenCalledWith(expect.stringContaining('/dashboard/exegesis/new'));
    });

    it('si todos los estudios están en la serie, «Otros estudios» no dice que no hay estudios', async () => {
        estudios = [estudio('e1', 1), estudio('e2', 2)];
        getUserSeries.mockResolvedValue([serieDe(['e1', 'e2'])]);
        montar();
        expect(await screen.findByText('studies.otherEmpty')).toBeInTheDocument();
        expect(screen.queryByText('studies.empty')).toBeNull();
    });

    it('mientras cargan las series no afirma que no hay serie ni ofrece planificarla', async () => {
        getUserSeries.mockReturnValue(new Promise(() => {}));
        montar();
        expect(await screen.findByText('seriesSection.loading')).toBeInTheDocument();
        expect(screen.queryByText('seriesSection.empty')).toBeNull();
        expect(screen.queryByText('seriesSection.plan')).toBeNull();
        expect(screen.getByTestId('project-roadmap-loading')).toBeInTheDocument();
        expect(screen.queryByText('roadmap.phases.exegetical.division.cta')).toBeNull();
        expect(screen.getByText('studies.loading')).toBeInTheDocument();
        expect(screen.queryByText('studies.empty')).toBeNull();
    });

    it('si la lista de series falla, lo avisa en vez de mostrar el vacío', async () => {
        getUserSeries.mockRejectedValue(new Error('sin red'));
        montar();
        expect(await screen.findByText('seriesSection.loadError')).toBeInTheDocument();
        expect(screen.queryByText('seriesSection.empty')).toBeNull();
        expect(screen.queryByText('seriesSection.plan')).toBeNull();
        // El recorrido tampoco ofrece planificar: no se sabe si ya hay serie.
        expect(screen.getByTestId('project-roadmap-error')).toBeInTheDocument();
        expect(screen.queryByText(/roadmap\.activePhase\.label/)).toBeNull();
    });

    it('mientras cargan los estudios el recorrido no se dibuja con cero estudios', async () => {
        cargandoEstudios = true;
        montar();
        expect(await screen.findByTestId('project-roadmap-loading')).toBeInTheDocument();
        expect(screen.queryByText(/roadmap\.activePhase\.label/)).toBeNull();
    });
});

describe('qué proyectos muestran «Series de predicación»', () => {
    it('uno General sin serie, no; con una serie ligada, sí', async () => {
        proyectos = [{ ...nehemias, type: 'general' }];
        montar();
        expect(await screen.findByText('studies.title')).toBeInTheDocument();
        expect(screen.queryByText('seriesSection.title')).toBeNull();
        cleanup();

        getUserSeries.mockResolvedValue([serieDe([])]);
        montar();
        expect(await screen.findByText('seriesSection.title')).toBeInTheDocument();
    });
});

describe('seriesWorkUrl', () => {
    const fases: Record<string, string> = { e1: 'assembled', e2: 'configuring', e3: 'configuring' };
    it('el primer estudio sin empezar, en el orden del plan', () => {
        expect(seriesWorkUrl(serieDe(['e1', 'e2', 'e3']), id => fases[id])).toBe('/dashboard/exegesis/e2');
    });
    it('sin estudios por empezar, el plan', () => {
        expect(seriesWorkUrl(serieDe(['e1']), id => fases[id])).toBe('/dashboard/plans/sNeh');
    });
});

describe('los textos nuevos del panel existen en es y en', () => {
    it.each([
        'roadmap.loading',
        'roadmap.phases.exegetical.pericopesSeries.title',
        'roadmap.phases.exegetical.pericopesSeries.description',
        'roadmap.phases.exegetical.pericopesSeries.cta',
        'seriesSection.loading',
        'seriesSection.loadError',
        'seriesSection.retry',
        'studies.otherEmpty',
        'studies.loading',
    ])('%s', async (clave) => {
        for (const idioma of ['es', 'en']) {
            const json = (await import(`../../../i18n/locales/${idioma}/projects.json`)).default as Record<string, unknown>;
            const valor = clave.split('.').reduce<unknown>((n, k) => (n && typeof n === 'object' ? (n as Record<string, unknown>)[k] : undefined), json);
            expect(typeof valor === 'string' && valor.trim() !== '', `${idioma}: ${clave}`).toBe(true);
            expect(/\b(IA|AI|modelo|Gemini|LLM)\b/i.test(valor as string)).toBe(false);
        }
    });
});
