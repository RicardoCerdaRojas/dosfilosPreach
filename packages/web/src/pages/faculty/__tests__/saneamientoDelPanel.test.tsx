import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Etapa 0 de la fase «Escritorio del proyecto» (deuda 1–3): lo que el panel
 * muestra mientras carga y cuando algo falla.
 *  - En frío, la lista de proyectos todavía no llegó: un esqueleto, no
 *    «Proyecto no encontrado».
 *  - Los avisos de error no repiten el texto de éxito ni pegan el mensaje
 *    técnico del error.
 *  - Mientras cargan las fuentes (o la biblioteca que las clasifica), el
 *    recorrido no ofrece la fase 2 como próximo paso.
 */
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const getUserSeries = vi.fn(async () => []);
vi.mock('@dosfilos/application', () => ({ seriesService: { getUserSeries: () => getUserSeries() } }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/hooks/useAuthorization', () => ({ useAuthorization: () => ({ isAdmin: false }) }));

let proyectos: unknown[] = [];
let cargandoProyectos = false;
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({
    useFacultyProjects: () => ({
        projects: proyectos, isLoadingProjects: cargandoProyectos,
        updateProject: { mutateAsync: vi.fn(), isPending: false },
    }),
}));
vi.mock('@/hooks/faculty/useFacultySessions', () => ({ useFacultySessions: () => ({ sessions: [] }) }));
vi.mock('@/hooks/use-sermons', () => ({ useSermons: () => ({ sermons: [], loading: false }) }));
let biblioteca = { resources: [] as unknown[], isLoading: false };
vi.mock('@/hooks/library', () => ({ useLibrary: () => biblioteca }));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [], isLoading: false }) }));
vi.mock('@/hooks/useGreekSessions', () => ({ useGreekSessions: () => ({ sessions: [] }) }));
vi.mock('@/hooks/useHebrewSessions', () => ({ useHebrewSessions: () => ({ sessions: [] }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ papers: [], isLoading: false }) }));

const createOutput = { mutateAsync: vi.fn(), isPending: false };
const updateOutput = { mutateAsync: vi.fn(), isPending: false };
const deleteOutput = { mutateAsync: vi.fn(), isPending: false };
vi.mock('@/hooks/faculty/useProjectWorkspace', () => ({
    useProjectWorkspace: () => ({ outputs: [], isLoadingOutputs: false, createOutput, updateOutput, deleteOutput }),
}));

let fuentes: { sources: unknown[]; isLoading: boolean; error: Error | null } = { sources: [], isLoading: false, error: null };
vi.mock('../hooks/useProjectAttachedSources', () => ({
    useProjectAttachedSources: () => ({ ...fuentes, reprocessing: {}, reprocessSource: vi.fn() }),
}));
vi.mock('../hooks/useSaveProjectSources', () => ({ useSaveProjectSources: () => ({ save: vi.fn(), saving: false }) }));
vi.mock('../hooks/useLinkProjectSession', () => ({ useLinkProjectSession: () => ({ linkingId: null, link: vi.fn() }) }));

vi.mock('../components/project/ProjectSetupCards', () => ({ ProjectSetupCards: () => null }));
vi.mock('../components/project/desk/CourseDeskSections', () => ({ CourseDeskSections: () => null }));
vi.mock('../components/project/ProjectSourcePickerModal', () => ({ ProjectSourcePickerModal: () => null }));
vi.mock('../components/project/ProjectLinkSessionDialog', () => ({ ProjectLinkSessionDialog: () => null }));
// La lista de material abre el editor; el editor manda crear o actualizar.
vi.mock('../components/project/ProjectMaterialList', () => ({
    ProjectMaterialList: ({ onCreateOutput }: { onCreateOutput: () => void }) => (
        <button type="button" onClick={onCreateOutput}>abrir-editor</button>
    ),
}));
vi.mock('../components/project/ProjectOutputEditorDialog', () => ({
    ProjectOutputEditorDialog: ({ onCreate, onUpdate }: {
        onCreate: (i: unknown) => void; onUpdate: (i: unknown) => void;
    }) => (
        <>
            <button type="button" onClick={() => onCreate({ kind: 'note', title: 'N', content: '' })}>crear</button>
            <button type="button" onClick={() => onUpdate({ outputId: 'o1', title: 'N' })}>actualizar</button>
        </>
    ),
}));

const { ProjectDashboard } = await import('../ProjectDashboard');

const proyecto = {
    id: 'p1', userId: 'u1', title: 'Teología II', color: 'amber', type: 'course', sourceIds: ['f1', 'f2'],
};

const montar = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/dashboard/projects/p1']}>
                <Routes><Route path="/dashboard/projects/:projectId" element={<ProjectDashboard />} /></Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    );
};

beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    proyectos = [proyecto];
    cargandoProyectos = false;
    fuentes = { sources: [{ id: 'f1' }, { id: 'f2' }], isLoading: false, error: null };
    biblioteca = { resources: [], isLoading: false };
});

describe('la carga en frío', () => {
    it('mientras llega la lista de proyectos muestra el esqueleto, no «Proyecto no encontrado»', () => {
        proyectos = [];
        cargandoProyectos = true;
        montar();
        expect(screen.getByTestId('project-dashboard-loading')).toBeInTheDocument();
        expect(screen.queryByText('notFound.title')).toBeNull();
    });

    it('ya cargada, si el proyecto no está, lo dice', () => {
        proyectos = [];
        montar();
        expect(screen.getByText('notFound.title')).toBeInTheDocument();
        expect(screen.queryByTestId('project-dashboard-loading')).toBeNull();
    });
});

describe('los avisos de error del material', () => {
    it('al crear: su propio texto, sin el de éxito ni el mensaje técnico', async () => {
        createOutput.mutateAsync.mockRejectedValue(new Error('FirebaseError: PERMISSION_DENIED'));
        const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        montar();
        fireEvent.click(await screen.findByText('abrir-editor'));
        fireEvent.click(screen.getByText('crear'));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('outputEditor.toastCreateError'));
        expect(toast.error.mock.calls.flat().join(' ')).not.toMatch(/PERMISSION_DENIED|toastCreated/);
        consola.mockRestore();
    });

    it('al actualizar: su propio texto, sin el de éxito ni el mensaje técnico', async () => {
        updateOutput.mutateAsync.mockRejectedValue(new Error('FirebaseError: unavailable'));
        const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        montar();
        fireEvent.click(await screen.findByText('abrir-editor'));
        fireEvent.click(screen.getByText('actualizar'));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('outputEditor.toastUpdateError'));
        expect(toast.error.mock.calls.flat().join(' ')).not.toMatch(/unavailable|toastUpdated/);
        consola.mockRestore();
    });
});

describe('las fuentes en el recorrido', () => {
    it('Curso: si la fase 2 sería la activa, mientras carga la biblioteca que clasifica las obras, el recorrido espera', async () => {
        proyectos = [{ ...proyecto, sourceIds: [], workTypes: [{ id: 'tp', label: 'TP', rubricTemplateId: null, rubricConfirmed: true }] }];
        biblioteca = { resources: [], isLoading: true };
        montar();
        // Que lleguen las series y los estudios: lo único que falta es la biblioteca.
        await waitFor(() => expect(getUserSeries).toHaveBeenCalled());
        await act(async () => { await new Promise(r => setTimeout(r, 20)); });
        expect(screen.getByTestId('project-roadmap-loading')).toBeInTheDocument();
        expect(screen.queryByTestId('desk-now')).toBeNull();
    });

    it('Curso: si la activa es otra, el recorrido no espera la biblioteca y la fase 2 dice «cargando» (B6)', async () => {
        biblioteca = { resources: [], isLoading: true };
        montar();
        await waitFor(() => expect(getUserSeries).toHaveBeenCalled());
        await act(async () => { await new Promise(r => setTimeout(r, 20)); });
        expect(screen.queryByTestId('project-roadmap-loading')).toBeNull();
        expect(screen.getByTestId('desk-journey')).toBeInTheDocument();
        expect(document.querySelector('[data-phase-status="loading"]')).not.toBeNull();
    });

    it('un tipo viejo (Investigación): mientras cargan las fuentes del selector, el recorrido espera', async () => {
        proyectos = [{ ...proyecto, type: 'study', contextNote: 'La justificación en Romanos' }];
        fuentes = { sources: [], isLoading: true, error: null };
        montar();
        await waitFor(() => expect(getUserSeries).toHaveBeenCalled());
        await act(async () => { await new Promise(r => setTimeout(r, 20)); });
        expect(screen.getByTestId('project-roadmap-loading')).toBeInTheDocument();
        expect(screen.queryByText(/roadmap\.activePhase\.label/)).toBeNull();
    });

    it('si la lectura de las fuentes falla, cuenta las anotadas en el proyecto: no manda a preparar el estado del arte', async () => {
        proyectos = [{ ...proyecto, type: 'study', contextNote: 'La justificación en Romanos' }];
        fuentes = { sources: [], isLoading: false, error: new Error('sin red') };
        montar();
        expect(await screen.findByText(/roadmap\.activePhase\.label/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Preparar el estado del arte/ })).toBeNull();
        cleanup();

        // Sin fuentes anotadas, el mismo fallo sí deja la fase por hacer.
        proyectos = [{ ...proyecto, type: 'study', contextNote: 'La justificación en Romanos', sourceIds: [] }];
        montar();
        expect(await screen.findByRole('button', { name: /Preparar el estado del arte/ })).toBeInTheDocument();
    });

    it('cargadas, el escritorio se dibuja', async () => {
        montar();
        await waitFor(() => expect(screen.queryByTestId('project-roadmap-loading')).toBeNull());
        expect(screen.queryByTestId('project-roadmap-error')).toBeNull();
        expect(screen.getByTestId('desk-now')).toBeInTheDocument();
    });
});

describe('los textos nuevos existen en es y en, sin jerga técnica', () => {
    it.each(['outputEditor.toastCreateError', 'outputEditor.toastUpdateError', 'loading.project', 'linkSession.toastError', 'sourcePicker.toastError', 'deleteOutput.toastError'])('%s', async (clave) => {
        for (const idioma of ['es', 'en']) {
            const json = (await import(`../../../i18n/locales/${idioma}/projects.json`)).default as Record<string, unknown>;
            const valor = clave.split('.').reduce<unknown>((n, k) => (n && typeof n === 'object' ? (n as Record<string, unknown>)[k] : undefined), json);
            expect(typeof valor === 'string' && valor.trim() !== '', `${idioma}: ${clave}`).toBe(true);
            expect(/\b(IA|AI|modelo|model|Gemini|LLM|Firebase|Firestore|error:)\b/i.test(valor as string)).toBe(false);
        }
    });
});
