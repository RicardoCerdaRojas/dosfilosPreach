import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * El planificador expositivo abierto desde el proyecto «Nehemías» (etapa 3
 * de ADR-046): libro preseleccionado, borrador propio, obras heredables con
 * casillas y la serie que nace ligada. Sin parámetros, todo como antes.
 */
const svc = vi.hoisted(() => ({ createSeriesFromPlan: vi.fn() }));
vi.mock('@dosfilos/application', () => ({ seriesService: { createSeriesFromPlan: svc.createSeriesFromPlan } }));

const estado = vi.hoisted(() => ({
    projects: [] as unknown[],
    isLoadingProjects: false,
    resources: [] as unknown[],
    libraryLoading: false,
    papers: [] as unknown[],
    papersCalls: 0,
}));
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({
    useFacultyProjects: () => ({ projects: estado.projects, isLoadingProjects: estado.isLoadingProjects }),
}));
vi.mock('@/hooks/library', () => ({ useLibrary: () => ({ resources: estado.resources, isLoading: estado.libraryLoading }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({
    useExegesisPapers: () => {
        estado.papersCalls += 1;
        return { papers: estado.papers };
    },
}));
const mutacion = () => ({ mutate: vi.fn(), isPending: false, isError: false });
vi.mock('@/hooks/series/useExpositoryAssistant', () => ({
    useExpositoryAssistant: () => ({
        loadVerses: vi.fn(),
        runPanorama: mutacion(),
        runSuperMacro: mutacion(),
        runMacro: mutacion(),
        runMicro: mutacion(),
        runPreachable: mutacion(),
        runFidelity: mutacion(),
    }),
}));
vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => (opts && 'title' in opts ? `${key}:${String(opts.title)}` : key),
        i18n: { language: 'es' },
    }),
}));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useNavigate: () => navigate,
}));
vi.mock('@/components/expository/MethodologyPresentation', () => ({ MethodologyPresentation: () => null, hasMethodologyBeenShown: () => true, markMethodologyShown: () => {} }));
vi.mock('@/components/exegesis/PassagePicker', () => ({ PassagePicker: () => null }));
vi.mock('@/components/exegesis/BookPicker', () => ({
    BookPicker: ({ value, onChange }: { value: string; onChange: (id: string) => void }) => (
        <input aria-label="libro" value={value} onChange={(e) => onChange(e.target.value)} />
    ),
}));

import { ExpositoryAssistantPage } from '../ExpositoryAssistantPage';
import { buildSeriesPlan } from '../utils/serieDesdeProyecto';

const CLAVE = 'dosfilos.expositoryAssistant.draft';

const nehemias = { id: 'neh', title: 'Nehemías', sourceIds: ['williamson', 'moo', 'halot'], bibliographyCriteria: { bibleBooks: ['NEH'] } };
const biblioteca = () => [
    { id: 'williamson', title: 'Ezra, Nehemiah', author: 'Williamson', exegeticalType: 'commentary-critical', coversBibleBooks: ['EZR', 'NEH'] },
    { id: 'moo', title: 'Romans', author: 'Moo', exegeticalType: 'commentary-critical', coversBibleBooks: ['ROM'] },
    { id: 'halot', title: 'HALOT', author: 'Koehler', exegeticalType: 'lexicon-technical', scope: 'whole-bible' },
];

const unidad = { id: 'u1', macroSectionId: 'm1', syntacticUnit: { book: 'Nehemías', chapterStart: 1, verseStart: 1, chapterEnd: 1, verseEnd: 11, justification: 'Oración.' } };
const predicable = {
    id: 'p1', title: 'La oración de Nehemías', passage: 'Nehemías 1:1-11',
    chapterStart: 1, verseStart: 1, chapterEnd: 1, verseEnd: 11,
    sourcedExegeticalUnitIds: ['u1'], exegeticalProposition: 'Prop.', homileticalProposition: 'Hom.', pastoralObjective: 'Obj.', order: 0,
};
const guardarBorrador = (clave: string, extra: Record<string, unknown> = {}) => localStorage.setItem(clave, JSON.stringify({
    schemaVersion: 'v1', savedAt: new Date().toISOString(),
    bookId: 'NEH', displayLanguage: 'es', bookDisplay: 'Nehemías',
    verses: [{ chapter: 1, verse: 1, text: 'Palabras de Nehemías' }],
    exegeticalUnits: [unidad], preachableUnits: [predicable],
    ...extra,
}));

const montar = (url: string, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => render(
    <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
            <ExpositoryAssistantPage />
        </MemoryRouter>
    </QueryClientProvider>,
);

const botonCrear = () => screen.getByRole('button', { name: /expository\.create\.cta/ });

beforeEach(() => {
    localStorage.clear();
    Object.assign(estado, { projects: [nehemias], isLoadingProjects: false, resources: biblioteca(), libraryLoading: false, papers: [], papersCalls: 0 });
    svc.createSeriesFromPlan.mockReset().mockResolvedValue({ id: 's1', metadata: { plannedSermons: [] } });
    Object.values(toast).forEach((f) => f.mockReset());
    navigate.mockReset();
});

describe('entrar desde el proyecto', () => {
    it('con ?projectId=neh&book=NEH el selector arranca en Nehemías y aparece el banner', async () => {
        montar('/dashboard/plans/pericope?projectId=neh&book=NEH');
        await waitFor(() => expect(screen.getByLabelText('libro')).toHaveValue('NEH'));
        expect(screen.getByText('expository.project.banner:Nehemías')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /expository\.project\.back/ })).toHaveAttribute('href', '/dashboard/projects/neh');
        expect(screen.queryByText('expository.project.bookOutside')).not.toBeInTheDocument();
    });

    it('un proyecto sin libro obliga a elegir: «Comenzar» no se puede pulsar hasta tocar el selector', async () => {
        estado.projects = [{ ...nehemias, bibliographyCriteria: null }];
        montar('/dashboard/plans/pericope?projectId=neh');
        await screen.findByText('expository.project.chooseBook');
        const comenzar = screen.getByRole('button', { name: /expository\.setup\.start/ });
        expect(comenzar).toBeDisabled();
        fireEvent.change(screen.getByLabelText('libro'), { target: { value: 'NEH' } });
        expect(comenzar).toBeEnabled();
        expect(screen.queryByText('expository.project.chooseBook')).not.toBeInTheDocument();
    });

    it('espera a que carguen los proyectos para restaurar el borrador del proyecto', async () => {
        guardarBorrador(`${CLAVE}:neh`, { projectId: 'neh' });
        estado.isLoadingProjects = true;
        estado.projects = [];
        const client = new QueryClient();
        const { rerender } = montar('/dashboard/plans/pericope?projectId=neh&book=NEH', client);
        expect(screen.queryByRole('button', { name: /expository\.create\.cta/ })).not.toBeInTheDocument();
        estado.isLoadingProjects = false;
        estado.projects = [nehemias];
        rerender(
            <QueryClientProvider client={client}>
                <MemoryRouter initialEntries={['/dashboard/plans/pericope?projectId=neh&book=NEH']}>
                    <ExpositoryAssistantPage />
                </MemoryRouter>
            </QueryClientProvider>,
        );
        expect(await screen.findByRole('button', { name: /expository\.create\.cta/ })).toBeInTheDocument();
        expect(toast.success).toHaveBeenCalledWith('expository.toast.draftRestored');
    });

    it('un borrador suelto de 2 Pedro no se restaura al entrar desde el proyecto', async () => {
        guardarBorrador(CLAVE, { bookId: '2PE', bookDisplay: '2 Pedro' });
        montar('/dashboard/plans/pericope?projectId=neh&book=NEH');
        await waitFor(() => expect(screen.getByLabelText('libro')).toHaveValue('NEH'));
        expect(screen.queryByRole('button', { name: /expository\.create\.cta/ })).not.toBeInTheDocument();
        expect(toast.success).not.toHaveBeenCalledWith('expository.toast.draftRestored');
        // Y sigue ahí para cuando vuelva a la entrada genérica.
        expect(localStorage.getItem(CLAVE)).not.toBeNull();
    });
});

describe('crear la serie dentro del proyecto', () => {
    it('el plan lleva el proyecto, las obras marcadas y las desmarcadas; el borrador del proyecto se borra', async () => {
        guardarBorrador(`${CLAVE}:neh`, { projectId: 'neh' });
        montar('/dashboard/plans/pericope?projectId=neh&book=NEH');
        const halot = await screen.findByRole('checkbox', { name: /HALOT/ });
        expect(screen.getByRole('checkbox', { name: /Ezra, Nehemiah/ })).toBeChecked();
        // Un comentario de Romanos no se hereda en una serie de Nehemías.
        expect(screen.queryByRole('checkbox', { name: /Romans/ })).not.toBeInTheDocument();
        fireEvent.click(halot);
        await waitFor(() => expect(botonCrear()).toBeEnabled());
        fireEvent.click(botonCrear());

        await waitFor(() => expect(svc.createSeriesFromPlan).toHaveBeenCalledTimes(1));
        const [uid, plan] = svc.createSeriesFromPlan.mock.calls[0]!;
        expect(uid).toBe('u1');
        expect(plan.project.projectId).toBe('neh');
        expect(plan.project.sources.map((s: { corpusId: string }) => s.corpusId)).toEqual(['williamson']);
        expect(plan.project.excludedResourceIds).toEqual(['halot']);
        // La bibliografía no se copia a los valores por defecto de la serie.
        expect(plan.series.metadata.exegesisDefaults).toBeUndefined();
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('expository.project.createdInProject:Nehemías'));
        expect(localStorage.getItem(`${CLAVE}:neh`)).toBeNull();
        expect(navigate).toHaveBeenCalledWith('/dashboard/plans/s1');
    });

    it('un título de menos de 3 letras se avisa antes de crear los estudios', async () => {
        guardarBorrador(`${CLAVE}:neh`, { projectId: 'neh' });
        montar('/dashboard/plans/pericope?projectId=neh&book=NEH');
        await screen.findByRole('checkbox', { name: /HALOT/ });
        fireEvent.change(screen.getByLabelText('expository.create.seriesTitle'), { target: { value: 'Ne' } });
        await waitFor(() => expect(botonCrear()).toBeEnabled());
        fireEvent.click(botonCrear());
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('expository.toast.titleTooShort'));
        expect(svc.createSeriesFromPlan).not.toHaveBeenCalled();
    });

    it('mientras la biblioteca carga no se puede crear', async () => {
        guardarBorrador(`${CLAVE}:neh`, { projectId: 'neh' });
        estado.resources = [];
        estado.libraryLoading = true;
        montar('/dashboard/plans/pericope?projectId=neh&book=NEH');
        await screen.findByText('expository.project.libraryLoading');
        expect(botonCrear()).toBeDisabled();
        fireEvent.click(botonCrear());
        expect(svc.createSeriesFromPlan).not.toHaveBeenCalled();
    });

    it('con fichas modernas, la biblioteca que llega después habilita «Crear serie» aunque la lista no cambie', async () => {
        // Título y tipo vienen en la ficha: la oferta calcula lo mismo
        // cargando y cargada, y avisa una sola vez (durante la carga).
        estado.projects = [{
            id: 'neh', title: 'Nehemías', bibliographyCriteria: { bibleBooks: ['NEH'] },
            bibliography: [
                { id: 'b1', title: 'Ezra, Nehemiah', resourceId: 'williamson', sourceType: 'commentary-critical', decision: 'approved', weight: 'recommended', origins: ['library'] },
                { id: 'b2', title: 'HALOT', resourceId: 'halot', sourceType: 'lexicon-technical', decision: 'approved', weight: 'recommended', origins: ['library'] },
            ],
        }];
        guardarBorrador(`${CLAVE}:neh`, { projectId: 'neh' });
        estado.resources = [];
        estado.libraryLoading = true;
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const { rerender } = montar('/dashboard/plans/pericope?projectId=neh&book=NEH', client);
        await screen.findByText('expository.project.libraryLoading');
        expect(botonCrear()).toBeDisabled();
        estado.resources = biblioteca();
        estado.libraryLoading = false;
        rerender(
            <QueryClientProvider client={client}>
                <MemoryRouter initialEntries={['/dashboard/plans/pericope?projectId=neh&book=NEH']}>
                    <ExpositoryAssistantPage />
                </MemoryRouter>
            </QueryClientProvider>,
        );
        await waitFor(() => expect(botonCrear()).toBeEnabled());
        fireEvent.click(botonCrear());
        await waitFor(() => expect(svc.createSeriesFromPlan).toHaveBeenCalledTimes(1));
        const plan = svc.createSeriesFromPlan.mock.calls[0]![1];
        expect(plan.project.sources.map((s: { corpusId: string }) => s.corpusId)).toEqual(['williamson', 'halot']);
        expect(plan.project.excludedResourceIds).toEqual([]);
    });

    it('sin obras heredables lo dice y enlaza al estado del arte', async () => {
        // Solo un comentario de Romanos: nada se hereda en Nehemías.
        estado.projects = [{ ...nehemias, sourceIds: ['moo'] }];
        guardarBorrador(`${CLAVE}:neh`, { projectId: 'neh' });
        montar('/dashboard/plans/pericope?projectId=neh&book=NEH');
        expect(await screen.findByText(/expository\.project\.noSources/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'expository.project.openStateOfArt' })).toHaveAttribute('href', '/dashboard/projects/neh/estado-del-arte');
        expect(screen.queryByText('create.projectSources.hint')).not.toBeInTheDocument();
        await waitFor(() => expect(botonCrear()).toBeEnabled());
    });

    it('con obras heredables no aparece el aviso y la ayuda es la de la serie', async () => {
        guardarBorrador(`${CLAVE}:neh`, { projectId: 'neh' });
        montar('/dashboard/plans/pericope?projectId=neh&book=NEH');
        await screen.findByRole('checkbox', { name: /Ezra, Nehemiah/ });
        expect(screen.getByText('expository.project.sourcesHint')).toBeInTheDocument();
        expect(screen.queryByText('create.projectSources.hint')).not.toBeInTheDocument();
        expect(screen.queryByText(/expository\.project\.noSources/)).not.toBeInTheDocument();
    });

    it('cambiar el selector después de analizar no cambia las obras heredadas', async () => {
        guardarBorrador(`${CLAVE}:neh`, { projectId: 'neh' });
        montar('/dashboard/plans/pericope?projectId=neh&book=NEH');
        await screen.findByRole('checkbox', { name: /Ezra, Nehemiah/ });
        expect(screen.queryByText('expository.setup.bookChanged')).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('libro'), { target: { value: 'ROM' } });
        // El aviso del plan (punto 5): la serie sigue siendo de Nehemías.
        expect(screen.getByText('expository.setup.bookChanged')).toBeInTheDocument();
        // Sigue filtrando por Nehemías, el libro analizado: Romanos no entra.
        expect(screen.getByRole('checkbox', { name: /Ezra, Nehemiah/ })).toBeInTheDocument();
        expect(screen.queryByRole('checkbox', { name: /Romans/ })).not.toBeInTheDocument();
        // El borrador guarda el libro analizado, no el del selector.
        expect(JSON.parse(localStorage.getItem(`${CLAVE}:neh`) ?? '{}')).toMatchObject({ bookId: 'NEH', projectId: 'neh' });
        // Y lo guarda en la clave del proyecto: el borrador suelto no se toca.
        expect(localStorage.getItem(CLAVE)).toBeNull();
        await waitFor(() => expect(botonCrear()).toBeEnabled());
        fireEvent.click(botonCrear());
        await waitFor(() => expect(svc.createSeriesFromPlan).toHaveBeenCalledTimes(1));
        const plan = svc.createSeriesFromPlan.mock.calls[0]![1];
        expect(plan.project.sources.map((s: { corpusId: string }) => s.corpusId)).toEqual(['williamson', 'halot']);
        expect(plan.project.excludedResourceIds).toEqual([]);
    });

    it('avisa de los estudios del proyecto que ya tratan una perícopa, sin bloquear', async () => {
        guardarBorrador(`${CLAVE}:neh`, { projectId: 'neh' });
        estado.papers = [
            { id: 'e1', title: 'Neh 1 para el curso', projectId: 'neh', passage: { bookId: 'NEH', chapterStart: 1, verseStart: 4, chapterEnd: 1, verseEnd: 11 }, seriesId: null, archivedAt: null },
            { id: 'e2', title: 'De otro proyecto', projectId: 'otro', passage: { bookId: 'NEH', chapterStart: 1, verseStart: 1, chapterEnd: 1, verseEnd: 3 }, seriesId: null, archivedAt: null },
        ];
        montar('/dashboard/plans/pericope?projectId=neh&book=NEH');
        await screen.findByText('expository.project.overlapTitle');
        expect(screen.getByText('Nehemías 1:1-11 — Neh 1 para el curso')).toBeInTheDocument();
        expect(screen.queryByText(/De otro proyecto/)).not.toBeInTheDocument();
        await waitFor(() => expect(botonCrear()).toBeEnabled());
    });
});

describe('proyecto archivado', () => {
    it('aparece el aviso y la serie se crea suelta, sin project', async () => {
        estado.projects = [{ ...nehemias, archivedAt: new Date() }];
        guardarBorrador(CLAVE);
        montar('/dashboard/plans/pericope?projectId=neh&book=NEH');
        await screen.findByText('expository.project.unavailable');
        expect(screen.queryByText('expository.project.banner:Nehemías')).not.toBeInTheDocument();
        fireEvent.click(await screen.findByRole('button', { name: /expository\.create\.cta/ }));
        await waitFor(() => expect(svc.createSeriesFromPlan).toHaveBeenCalledTimes(1));
        expect('project' in svc.createSeriesFromPlan.mock.calls[0]![1]).toBe(false);
        expect(toast.success).toHaveBeenCalledWith('expository.toast.seriesCreated');
    });

    it('si se archiva mientras se analizaba, se vuelve a leer al crear y la serie nace suelta', async () => {
        guardarBorrador(`${CLAVE}:neh`, { projectId: 'neh' });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        montar('/dashboard/plans/pericope?projectId=neh&book=NEH', client);
        await waitFor(() => expect(botonCrear()).toBeEnabled());
        // Lo que trae la relectura de useFacultyProjects: ya archivado.
        client.setQueryData(['faculty', 'projects', 'u1'], [{ ...nehemias, archivedAt: new Date() }]);
        fireEvent.click(botonCrear());
        await waitFor(() => expect(svc.createSeriesFromPlan).toHaveBeenCalledTimes(1));
        expect('project' in svc.createSeriesFromPlan.mock.calls[0]![1]).toBe(false);
        expect(toast.warning).toHaveBeenCalledWith('expository.project.unavailable');
        // El borrador era del proyecto: se borra de su clave.
        expect(localStorage.getItem(`${CLAVE}:neh`)).toBeNull();
    });
});

describe('sin parámetros, todo como antes', () => {
    it('arranca en 2 Pedro, restaura el borrador de siempre y crea con el mismo argumento', async () => {
        guardarBorrador(`${CLAVE}:neh`, { projectId: 'neh' });
        guardarBorrador(CLAVE, { bookId: '2PE', bookDisplay: '2 Pedro' });
        montar('/dashboard/plans/pericope');
        expect(await screen.findByLabelText('libro')).toHaveValue('2PE');
        expect(screen.queryByText(/expository\.project\./)).not.toBeInTheDocument();
        fireEvent.click(await screen.findByRole('button', { name: /expository\.create\.cta/ }));
        await waitFor(() => expect(svc.createSeriesFromPlan).toHaveBeenCalledTimes(1));
        expect(svc.createSeriesFromPlan.mock.calls[0]![1]).toEqual(buildSeriesPlan({
            title: 'expository.create.defaultTitle',
            description: 'expository.create.defaultDescription',
            startDate: undefined,
            frequency: 'weekly',
            bookDisplay: '2 Pedro',
            preachableUnits: [predicable as never],
            exegeticalUnits: [unidad as never],
            panorama: null,
            displayLanguage: 'es',
        }));
        // Ni la biblioteca de obras heredables ni los estudios se cargan.
        expect(estado.papersCalls).toBe(0);
        // Solo se borra el borrador suelto; el del proyecto sigue.
        expect(localStorage.getItem(CLAVE)).toBeNull();
        expect(localStorage.getItem(`${CLAVE}:neh`)).not.toBeNull();
    });
});
