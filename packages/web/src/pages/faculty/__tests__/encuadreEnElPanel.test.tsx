import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * El encuadre en el panel del proyecto (fase «Encuadre de la serie»): el
 * botón de la fase 1 abre el diálogo, `?encuadre=1` también (lo usa
 * «Cambiar en el encuadre»), la tarjeta se ve solo en el Exegético y guardar
 * es UNA escritura con `framingPatch` y `bibleBooks`.
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
vi.mock('@/hooks/use-sermons', () => ({ useSermons: () => ({ sermons: [] }) }));
vi.mock('@/hooks/useGreekSessions', () => ({ useGreekSessions: () => ({ sessions: [] }) }));
vi.mock('@/hooks/useHebrewSessions', () => ({ useHebrewSessions: () => ({ sessions: [] }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ papers: [], isLoading: false }) }));
const mutacion = { mutateAsync: vi.fn(), isPending: false };
vi.mock('@/hooks/faculty/useProjectWorkspace', () => ({
    useProjectWorkspace: () => ({ outputs: [], isLoadingOutputs: false, createOutput: mutacion, updateOutput: mutacion, deleteOutput: mutacion }),
}));
vi.mock('../hooks/useProjectAttachedSources', () => ({ useProjectAttachedSources: () => ({ sources: [], reprocessing: null, reprocessSource: vi.fn() }) }));
vi.mock('../hooks/useSaveProjectSources', () => ({ useSaveProjectSources: () => ({ save: vi.fn(), saving: false }) }));
vi.mock('../hooks/useLinkProjectSession', () => ({ useLinkProjectSession: () => ({ linkingId: null, link: vi.fn() }) }));
vi.mock('@/hooks/exegesis/useWorkProfiles', () => ({ useWorkProfiles: () => ({ profiles: [] }) }));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [] }) }));
vi.mock('@/hooks/exegesis/useUserAssignmentBriefs', () => ({ useUserAssignmentBriefs: () => ({ briefs: [] }) }));
vi.mock('@/hooks/exegesis/useUserStyleGuides', () => ({ useUserStyleGuides: () => ({ guides: [] }) }));
vi.mock('../components/project/ProjectResourceGrid', () => ({ ProjectResourceGrid: () => null }));
vi.mock('../components/project/ProjectMaterialList', () => ({ ProjectMaterialList: () => null }));
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
const botonDelPaso = async (texto: string) => {
    const etiqueta = await screen.findByText(/roadmap\.activePhase\.label/);
    return within(etiqueta.closest('div.rounded-xl') as HTMLElement).getByRole('button', { name: texto });
};

beforeEach(() => {
    cleanup(); vi.clearAllMocks();
    proyectos = [esdras];
    getUserSeries.mockResolvedValue([]);
    updateProject.mockResolvedValue({});
});

describe('el encuadre en el panel del Exegético', () => {
    it('«Definir el encuadre» abre el diálogo, y guardar es una sola escritura con framingPatch y bibleBooks', async () => {
        montar();
        fireEvent.click(await botonDelPaso('roadmap.phases.exegetical.passage.cta'));
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

    it('con encuadre, la fase 1 se completa y su botón dice «Editar»', async () => {
        proyectos = [{ ...esdras, bibliographyCriteria: { bibleBooks: ['EZR'] }, framing: { centralIdea: 'Dios restaura.' } }];
        montar();
        await screen.findByText(/roadmap\.activePhase\.label/);
        // La fase activa ya es la siguiente; la pastilla de la fase 1 abre la edición.
        fireEvent.click(screen.getByTitle('roadmap.phases.exegetical.passageEdit.cta'));
        expect(screen.getByText('framing.dialog.title')).toBeInTheDocument();
    });

    it('«Cambiar en el encuadre» llega con ?encuadre=1 y abre el diálogo', async () => {
        montar('/dashboard/projects/ezr?encuadre=1');
        expect(await screen.findByText('framing.dialog.title')).toBeInTheDocument();
    });

    it('la tarjeta del encuadre se ve en el Exegético, y las de curso quedan plegadas detrás de «Opciones de curso»', async () => {
        montar();
        expect(await screen.findByTestId('project-framing-card')).toBeInTheDocument();
        expect(screen.queryByText('course.save')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'course.options' }));
        expect(screen.getByText('course.save')).toBeInTheDocument();
    });

    it('un Curso no tiene tarjeta de encuadre y ve sus tarjetas como siempre', async () => {
        proyectos = [{ ...esdras, type: 'course' }];
        montar();
        expect(await screen.findByText('course.save')).toBeInTheDocument();
        expect(screen.queryByTestId('project-framing-card')).toBeNull();
    });
});
