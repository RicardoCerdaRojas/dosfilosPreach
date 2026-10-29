import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * El encuadre en el escritorio del proyecto (fase «Encuadre de la serie» y
 * W2-A): «Ahora» de la fase 1 abre el diálogo, `?encuadre=1` también (lo usa
 * «Cambiar en el encuadre»), guardar es UNA escritura con `framingPatch` y
 * `bibleBooks`, y un Curso no tiene encuadre. Integra el hook del escritorio
 * real con las fuentes de datos simuladas; las secciones de cada tipo son de
 * sus unidades y aquí se reemplazan.
 */
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const getUserSeries = vi.fn();
vi.mock('@dosfilos/application', () => ({ seriesService: { getUserSeries: (uid: string) => getUserSeries(uid) } }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/hooks/useAuthorization', () => ({ useAuthorization: () => ({ isAdmin: false }) }));
let proyectos: unknown[] = [];
const updateProject = vi.fn();
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({
    useFacultyProjects: () => ({ projects: proyectos, updateProject: { mutateAsync: updateProject, isPending: false } }),
}));
vi.mock('@/hooks/faculty/useFacultySessions', () => ({ useFacultySessions: () => ({ sessions: [] }) }));
vi.mock('@/hooks/use-sermons', () => ({ useSermons: () => ({ sermons: [], loading: false }) }));
vi.mock('@/hooks/useGreekSessions', () => ({ useGreekSessions: () => ({ sessions: [] }) }));
vi.mock('@/hooks/useHebrewSessions', () => ({ useHebrewSessions: () => ({ sessions: [] }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ papers: [], isLoading: false }) }));
const mutacion = { mutateAsync: vi.fn(), isPending: false };
vi.mock('@/hooks/faculty/useProjectWorkspace', () => ({
    useProjectWorkspace: () => ({ outputs: [], isLoadingOutputs: false, createOutput: mutacion, updateOutput: mutacion, deleteOutput: mutacion }),
}));
vi.mock('../hooks/useProjectAttachedSources', () => ({ useProjectAttachedSources: () => ({ sources: [], isLoading: false, error: null, reprocessing: {}, reprocessSource: vi.fn() }) }));
vi.mock('../hooks/useSaveProjectSources', () => ({ useSaveProjectSources: () => ({ save: vi.fn(), saving: false }) }));
vi.mock('../hooks/useLinkProjectSession', () => ({ useLinkProjectSession: () => ({ linkingId: null, link: vi.fn() }) }));
vi.mock('@/hooks/exegesis/useWorkProfiles', () => ({ useWorkProfiles: () => ({ profiles: [] }) }));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [], isLoading: false }) }));
vi.mock('@/hooks/library', () => ({ useLibrary: () => ({ resources: [], isLoading: false }) }));
vi.mock('@/hooks/exegesis/useUserAssignmentBriefs', () => ({ useUserAssignmentBriefs: () => ({ briefs: [] }) }));
vi.mock('@/hooks/exegesis/useUserStyleGuides', () => ({ useUserStyleGuides: () => ({ guides: [] }) }));
vi.mock('../components/project/ProjectMaterialList', () => ({ ProjectMaterialList: () => null }));
vi.mock('../components/project/desk/ExegeticalDeskSections', () => ({ ExegeticalDeskSections: () => <div data-testid="secciones-exegeticas" /> }));
vi.mock('../components/project/desk/CourseDeskSections', () => ({ CourseDeskSections: () => <div data-testid="secciones-del-curso" /> }));
vi.mock('../components/project/ProjectSourcePickerModal', () => ({ ProjectSourcePickerModal: () => null }));
vi.mock('../components/project/ProjectOutputEditorDialog', () => ({ ProjectOutputEditorDialog: () => null }));
vi.mock('../components/project/ProjectLinkSessionDialog', () => ({ ProjectLinkSessionDialog: () => null }));

const { ProjectDashboard } = await import('../ProjectDashboard');

const esdras = { id: 'ezr', userId: 'u1', title: 'Esdras', color: 'amber', type: 'exegetical' };
const montar = (url = '/dashboard/projects/ezr') => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[url]}>
            <Routes><Route path="/dashboard/projects/:projectId" element={<ProjectDashboard />} /></Routes>
        </MemoryRouter>
    </QueryClientProvider>,
);
/** El único botón lleno del escritorio. */
const botonAhora = async () => within(await screen.findByTestId('desk-now')).getByRole('button');

beforeEach(() => {
    cleanup(); vi.clearAllMocks();
    proyectos = [esdras];
    getUserSeries.mockResolvedValue([]);
    updateProject.mockResolvedValue({});
});

describe('el encuadre en el escritorio del Exegético', () => {
    it('«Ahora» de la fase 1 abre el diálogo, y guardar es una sola escritura con framingPatch y bibleBooks', async () => {
        montar();
        fireEvent.click(await botonAhora());
        expect(screen.getByText('framing.dialog.title')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('framing.dialog.addBook'), { target: { value: 'EZR' } });
        fireEvent.change(screen.getByLabelText('framing.dialog.centralIdea'), { target: { value: 'Dios restaura.' } });
        fireEvent.click(screen.getByRole('button', { name: 'framing.dialog.save' }));
        await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
        const llamada = updateProject.mock.calls[0]![0];
        expect(Object.keys(llamada).sort()).toEqual(['bibleBooks', 'framingPatch', 'projectId']);
        expect(llamada.bibleBooks).toEqual(['EZR']);
        await waitFor(() => expect(screen.queryByText('framing.dialog.title')).toBeNull());
    });

    it('con encuadre completo, la fase 1 está lista y «Ahora» pasa a la siguiente', async () => {
        proyectos = [{ ...esdras, bibliographyCriteria: { bibleBooks: ['EZR'] }, framing: { centralIdea: 'Dios restaura.' } }];
        montar();
        expect((await botonAhora()).textContent).toContain('desk.journey.action.stateOfArt');
        const fases = screen.getAllByRole('button').filter(b => b.hasAttribute('data-phase-status'));
        expect(fases[0]!.getAttribute('data-phase-status')).toBe('ready');
    });

    it('«Cambiar en el encuadre» llega con ?encuadre=1 y abre el diálogo', async () => {
        montar('/dashboard/projects/ezr?encuadre=1');
        expect(await screen.findByText('framing.dialog.title')).toBeInTheDocument();
    });

    it('el Exegético monta sus secciones y ya no muestra «Opciones de curso»', async () => {
        montar();
        expect(await screen.findByTestId('secciones-exegeticas')).toBeInTheDocument();
        expect(screen.queryByText('course.options')).toBeNull();
        expect(screen.queryByText('course.save')).toBeNull();
    });

    it('un Curso no tiene encuadre: monta las suyas, y ?encuadre=1 no abre nada', async () => {
        proyectos = [{ ...esdras, type: 'course' }];
        montar('/dashboard/projects/ezr?encuadre=1');
        expect(await screen.findByTestId('secciones-del-curso')).toBeInTheDocument();
        expect(screen.queryByText('framing.dialog.title')).toBeNull();
        expect(screen.queryByTestId('secciones-exegeticas')).toBeNull();
    });
});
