import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

/**
 * SeriesDetail conoce su proyecto (etapa 3 de ADR-046, U7): el chip, ligar
 * la serie de Jonás con sus estudios y obras, desligar, y «Crear estudio»
 * que hereda la bibliografía del proyecto en el momento de crear.
 */
const svc = vi.hoisted(() => ({
    listPapers: vi.fn(),
    createPaper: vi.fn(),
    updateSeries: vi.fn(),
    setSeriesProject: vi.fn(),
    linkSeriesToProject: vi.fn(),
}));
const estado = vi.hoisted(() => ({
    series: null as unknown,
    sermonItems: [] as unknown[],
    projects: [] as unknown[],
    loadingProjects: false,
    resources: [] as unknown[],
    loadingLibrary: false,
    reloadData: vi.fn(),
    invalidateQueries: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('@dosfilos/application', () => ({
    exegesisService: {
        listPapers: { execute: svc.listPapers },
        createPaper: { execute: svc.createPaper },
        startStudyFromPaper: { execute: vi.fn() },
    },
    seriesService: {
        updateSeries: svc.updateSeries,
        setSeriesProject: svc.setSeriesProject,
        linkSeriesToProject: svc.linkSeriesToProject,
    },
}));
vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${JSON.stringify(opts)}` : key),
        i18n: { language: 'es' },
    }),
}));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({
    useNavigate: () => navigate,
    useParams: () => ({ id: 's1' }),
    Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}));
vi.mock('sonner', () => ({ toast: estado.toast }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: estado.invalidateQueries }) }));
vi.mock('@/hooks/useSeriesData', () => ({
    useSeriesData: () => ({
        series: estado.series,
        sermonItems: estado.sermonItems,
        loading: false,
        handleStartDraft: vi.fn(),
        handleLinkExisting: vi.fn(),
        handleContinueEditing: vi.fn(),
        handleUpdateSermonDate: vi.fn(),
        handleDeleteSermon: vi.fn(),
        handleMarkComplete: vi.fn(),
        reloadData: estado.reloadData,
    }),
}));
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({
    useFacultyProjects: () => ({ projects: estado.projects, isLoadingProjects: estado.loadingProjects }),
}));
vi.mock('@/hooks/library', () => ({
    useLibrary: () => ({ resources: estado.resources, isLoading: estado.loadingLibrary }),
}));
// Lo que no se prueba aquí y pide sus propios proveedores.
vi.mock('@/components/plan/AddSermonDialog', () => ({ AddSermonDialog: () => null }));
vi.mock('@/components/plan/EditSermonDialog', () => ({ EditSermonDialog: () => null }));
vi.mock('@/components/plan/ExegesisDefaultsCard', () => ({ ExegesisDefaultsCard: () => null }));
vi.mock('@/components/plan/InlineDateEditor', () => ({ InlineDateEditor: () => null }));
vi.mock('@/components/plan/SeriesTimelineModal', () => ({ SeriesTimelineModal: () => null }));

import { SeriesDetail } from '../SeriesDetail';

const ficha = (id: string, resourceId: string, sourceType: string) => ({
    id, title: id, author: null, weight: 'recommended', decision: 'approved', origins: ['manual'], resourceId, sourceType,
});
const nehemias = {
    id: 'p1',
    title: 'Nehemías',
    bibliography: [
        ficha('Ezra, Nehemiah (WBC)', 'williamson', 'commentary-critical'),
        ficha('Romans', 'moo', 'commentary-critical'),
        ficha('HALOT', 'halot', 'lexicon-technical'),
    ],
};
const biblioteca = [
    { id: 'williamson', title: 'Ezra, Nehemiah', author: 'Williamson', exegeticalType: 'commentary-critical', coversBibleBooks: ['EZR', 'NEH'] },
    { id: 'moo', title: 'Romans', author: 'Moo', exegeticalType: 'commentary-critical', coversBibleBooks: ['ROM'] },
    { id: 'halot', title: 'HALOT', author: 'KB', exegeticalType: 'lexicon-technical', scope: 'whole-bible' },
];
const unidad = { book: 'Nehemías', chapterStart: 1, verseStart: 1, chapterEnd: 1, verseEnd: 11, justification: 'La oración' };
const deLaSerie = { corpusId: 'serieObra', sourceType: 'commentary-expository', displayLabel: 'Obra de la serie', mode: 'full-document', libraryResourceId: 'serieObra' };

const serie = (over: Record<string, unknown> = {}, metadata: Record<string, unknown> = {}) => ({
    id: 's1',
    title: 'Serie de Nehemías',
    createdAt: new Date(2026, 9, 1),
    metadata: {
        plannedSermons: [{ id: 'per1', title: 'Neh 1', passage: 'Nehemías 1:1-11', syntacticUnit: unidad }],
        exegesisDefaults: { sourceRefs: [deLaSerie] },
        ...metadata,
    },
    ...over,
});

const crearEstudio = () => screen.getByRole('button', { name: 'detail.table.createPaper' });

beforeEach(() => {
    navigate.mockReset();
    Object.values(svc).forEach(f => f.mockReset());
    Object.values(estado.toast).forEach(f => f.mockReset());
    estado.reloadData.mockReset().mockResolvedValue(undefined);
    estado.invalidateQueries.mockReset().mockResolvedValue(undefined);
    // Las fases de los estudios no se miran aquí: sin resolver, no hay renders tardíos.
    svc.listPapers.mockReturnValue(new Promise(() => {}));
    svc.createPaper.mockResolvedValue({ id: 'paper1' });
    svc.updateSeries.mockResolvedValue(undefined);
    estado.series = serie();
    estado.sermonItems = [{ id: 'per1', title: 'Neh 1', description: '', passage: 'Nehemías 1:1-11', status: 'planned', plannedSermonId: 'per1' }];
    estado.projects = [nehemias];
    estado.loadingProjects = false;
    estado.resources = biblioteca;
    estado.loadingLibrary = false;
});

describe('el proyecto en la cabecera de la serie', () => {
    it('una serie ligada a un proyecto activo muestra el chip con el enlace al proyecto', () => {
        estado.series = serie({ projectId: 'p1' });
        render(<SeriesDetail />);
        const chip = screen.getByRole('link', { name: /detail\.project\.chip/ });
        expect(chip).toHaveAttribute('href', '/dashboard/projects/p1');
        expect(chip.textContent).toContain('Nehemías');
        expect(screen.getByText('detail.project.sourcesFromProject')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'detail.project.unlink' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'detail.project.link' })).toBeNull();
    });

    it('con el proyecto borrado dice «Proyecto no disponible» y ofrece desligar', () => {
        estado.series = serie({ projectId: 'p1' });
        estado.projects = [{ ...nehemias, deletedAt: new Date() }];
        render(<SeriesDetail />);
        expect(screen.getByText('detail.project.unavailable')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /detail\.project\.chip/ })).toBeNull();
        expect(screen.getByRole('button', { name: 'detail.project.unlink' })).toBeInTheDocument();
    });

    it('sin projectId ofrece «Ligar a un proyecto»', () => {
        render(<SeriesDetail />);
        expect(screen.getByRole('button', { name: 'detail.project.link' })).toBeInTheDocument();
        expect(screen.queryByText('detail.project.sourcesFromProject')).toBeNull();
    });

    it('mientras cargan los proyectos no afirma que el proyecto no está', () => {
        estado.series = serie({ projectId: 'p1' });
        estado.projects = [];
        estado.loadingProjects = true;
        render(<SeriesDetail />);
        expect(screen.queryByText('detail.project.unavailable')).toBeNull();
    });
});

describe('la flecha de volver (escritorio: siempre hay vuelta)', () => {
    it('una serie del proyecto vuelve a su escritorio y lo nombra', () => {
        estado.series = serie({ projectId: 'p1' });
        render(<SeriesDetail />);
        const volver = screen.getByRole('button', { name: /detail\.header\.backToProject/ });
        expect(volver.textContent).toContain('Nehemías');
        fireEvent.click(volver);
        expect(navigate).toHaveBeenCalledWith('/dashboard/projects/p1');
    });

    it('una serie suelta, o con el proyecto borrado, vuelve a la lista de planes', () => {
        render(<SeriesDetail />);
        fireEvent.click(screen.getByRole('button', { name: 'detail.header.back' }));
        expect(navigate).toHaveBeenLastCalledWith('/dashboard/plans');
        cleanup();
        estado.series = serie({ projectId: 'p1' });
        estado.projects = [{ ...nehemias, deletedAt: new Date() }];
        render(<SeriesDetail />);
        expect(screen.queryByRole('button', { name: /detail\.header\.backToProject/ })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'detail.header.back' }));
        expect(navigate).toHaveBeenLastCalledWith('/dashboard/plans');
    });

    it('el estudio que se abre desde la serie vuelve a la serie', async () => {
        estado.series = serie({ projectId: 'p1' });
        render(<SeriesDetail />);
        fireEvent.click(crearEstudio());
        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/dashboard/exegesis/paper1', { state: { from: '/dashboard/plans/s1', fromLabel: 'detail.backToSeries' } }));
    });
});

describe('«Crear estudio» de una perícopa', () => {
    it('en una serie ligada hereda el proyecto: origen p1, sus obras primero y sin las desmarcadas', async () => {
        estado.series = serie({ projectId: 'p1' }, { projectSourceExclusions: ['halot'] });
        render(<SeriesDetail />);
        fireEvent.click(crearEstudio());
        await waitFor(() => expect(svc.createPaper).toHaveBeenCalledTimes(1));
        const arg = svc.createPaper.mock.calls[0]![0];
        expect(arg.projectId).toBe('p1');
        expect(arg.initialSources.map((s: { corpusId: string }) => s.corpusId)).toEqual(['williamson', 'serieObra']);
        expect(arg).toMatchObject({ seriesId: 's1', pericopeId: 'per1', styleGuideId: null });
    });

    it('en una serie suelta recibe exactamente lo de hoy', async () => {
        render(<SeriesDetail />);
        fireEvent.click(crearEstudio());
        await waitFor(() => expect(svc.createPaper).toHaveBeenCalledTimes(1));
        const arg = svc.createPaper.mock.calls[0]![0];
        expect('projectId' in arg).toBe(false);
        expect(arg).toEqual({
            ownerId: 'u1',
            passage: { bookId: 'NEH', chapterStart: 1, verseStart: 1, chapterEnd: 1, verseEnd: 11 },
            displayLanguage: 'es',
            title: 'Neh 1',
            // La justificación sola; su lugar en la serie va en su campo (FASE_ENCUADRE_SERIE, U5).
            assignmentBrief: 'La oración',
            seriesPlacement: { position: 1, total: 1 },
            styleGuideId: null,
            initialSources: [
                { corpusId: 'serieObra', sourceType: 'commentary-expository', displayLabel: 'Obra de la serie', mode: 'full-document', sourceLibraryResourceId: 'serieObra' },
            ],
            seriesId: 's1',
            pericopeId: 'per1',
        });
    });

    it('el estudio nace con su lugar en la serie como dato, con la perícopa de antes y la de después; el encargo, sin él', async () => {
        const otra = (id: string, cs: number) => ({
            id, title: `Neh ${cs}`, passage: `Nehemías ${cs}:1-10`,
            syntacticUnit: { ...unidad, chapterStart: cs, chapterEnd: cs, verseEnd: 10, justification: `Corte ${cs}` },
        });
        estado.series = serie({}, { plannedSermons: [otra('a', 1), otra('b', 2), otra('c', 3)] });
        estado.sermonItems = ['a', 'b', 'c'].map((id, i) => ({ id, title: `Neh ${i + 1}`, description: '', passage: `Nehemías ${i + 1}:1-10`, status: 'planned', plannedSermonId: id }));
        render(<SeriesDetail />);
        fireEvent.click(screen.getAllByRole('button', { name: 'detail.table.createPaper' })[1]!);
        await waitFor(() => expect(svc.createPaper).toHaveBeenCalledTimes(1));
        expect(svc.createPaper.mock.calls[0]![0]).toMatchObject({
            pericopeId: 'b',
            assignmentBrief: 'Corte 2',
            seriesPlacement: {
                position: 2, total: 3,
                previous: { passage: 'Nehemías 1:1-10', title: 'Neh 1' },
                next: { passage: 'Nehemías 3:1-10', title: 'Neh 3' },
            },
        });
    });

    it('con un proyecto que ya no está, crea como una serie suelta', async () => {
        estado.series = serie({ projectId: 'p1' });
        estado.projects = [{ ...nehemias, archivedAt: new Date() }];
        render(<SeriesDetail />);
        fireEvent.click(crearEstudio());
        await waitFor(() => expect(svc.createPaper).toHaveBeenCalledTimes(1));
        expect('projectId' in svc.createPaper.mock.calls[0]![0]).toBe(false);
    });

    it('con la biblioteca cargando queda deshabilitado en la serie ligada, no en la suelta', () => {
        estado.loadingLibrary = true;
        estado.series = serie({ projectId: 'p1' });
        const { unmount } = render(<SeriesDetail />);
        expect(crearEstudio()).toBeDisabled();
        unmount();
        estado.series = serie();
        render(<SeriesDetail />);
        expect(crearEstudio()).toBeEnabled();
    });

    it('mientras cargan los proyectos tampoco crea en la serie ligada', () => {
        estado.series = serie({ projectId: 'p1' });
        estado.projects = [];
        estado.loadingProjects = true;
        render(<SeriesDetail />);
        expect(crearEstudio()).toBeDisabled();
    });
});

describe('ligar y desligar', () => {
    const conEstudios = () =>
        serie({}, {
            plannedSermons: [
                { id: 'per1', title: 'Neh 1', passage: 'Nehemías 1:1-11', syntacticUnit: unidad, paperId: 'a' },
                { id: 'per2', title: 'Neh 2', passage: 'Nehemías 2:1-10', syntacticUnit: { ...unidad, chapterStart: 2, chapterEnd: 2 }, paperId: 'b' },
                { id: 'per3', title: 'Neh 2b', passage: 'Nehemías 2:11-20', paperId: 'a' },
            ],
        });

    const abrir = () => {
        fireEvent.click(screen.getByRole('button', { name: 'detail.project.link' }));
        return screen.getByRole('dialog');
    };

    it('con las dos casillas lleva los estudios y les agrega las obras del proyecto', async () => {
        estado.series = conEstudios();
        estado.projects = [nehemias, { id: 'p2', title: 'Viejo', archivedAt: new Date() }];
        svc.linkSeriesToProject.mockResolvedValue({ moved: 2, linked: 0, unchanged: 0, sourcesAdded: 4, failed: 0 });
        render(<SeriesDetail />);
        abrir();
        // Solo los proyectos activos se ofrecen.
        expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['—', 'Nehemías']);
        // Los estudios se cuentan una vez aunque dos perícopas compartan uno.
        const llevar = screen.getByRole('checkbox', { name: /detail\.project\.movePapers.*"count":2/ });
        const agregar = screen.getByRole('checkbox', { name: 'detail.project.addSources' });
        expect(llevar).toBeChecked();
        expect(agregar).toBeChecked();
        fireEvent.click(screen.getByRole('button', { name: 'detail.project.confirm' }));
        await waitFor(() => expect(svc.linkSeriesToProject).toHaveBeenCalledTimes(1));
        const [uid, id, projectId, opts] = svc.linkSeriesToProject.mock.calls[0]!;
        expect([uid, id, projectId]).toEqual(['u1', 's1', 'p1']);
        expect(opts.movePapers).toBe(true);
        expect(opts.sourcesToAdd.map((s: { corpusId: string }) => s.corpusId)).toEqual(['williamson', 'halot']);
        await waitFor(() => expect(estado.reloadData).toHaveBeenCalled());
        expect(estado.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['series'] });
        // Solo las cifras que no son cero, cada una con su plural.
        const aviso = estado.toast.success.mock.calls[0]![0] as string;
        expect(aviso).toMatch(/^detail\.project\.linked \{"title":"Nehemías"/);
        expect(aviso).toContain('detail.project.linkedMoved {\\"count\\":2}');
        expect(aviso).toContain('detail.project.linkedSources {\\"count\\":4}');
        expect(aviso).not.toContain('linkedLinked');
        expect(estado.toast.warning).not.toHaveBeenCalled();
    });

    it('sin llevar los estudios no se pueden agregar obras ni se mandan', async () => {
        estado.series = conEstudios();
        svc.linkSeriesToProject.mockResolvedValue({ moved: 0, linked: 0, unchanged: 0, sourcesAdded: 0, failed: 0 });
        render(<SeriesDetail />);
        abrir();
        fireEvent.click(screen.getByRole('checkbox', { name: /detail\.project\.movePapers/ }));
        const agregar = screen.getByRole('checkbox', { name: 'detail.project.addSources' });
        expect(agregar).toBeDisabled();
        expect(agregar).not.toBeChecked();
        fireEvent.click(screen.getByRole('button', { name: 'detail.project.confirm' }));
        await waitFor(() => expect(svc.linkSeriesToProject).toHaveBeenCalledWith('u1', 's1', 'p1', { movePapers: false }));
        // Sin estudios movidos no se muestran tres ceros: solo que quedó ligada.
        await waitFor(() => expect(estado.toast.success).toHaveBeenCalledWith('detail.project.linkedOnly {"title":"Nehemías"}'));
    });

    it('los textos del aviso al ligar tienen plural en es y en', async () => {
        const i18next = (await import('i18next')).default.createInstance();
        const es = (await import('@/i18n/locales/es/series.json')).default;
        const en = (await import('@/i18n/locales/en/series.json')).default;
        await i18next.init({ lng: 'es', resources: { es: { series: es }, en: { series: en } }, ns: ['series'], defaultNS: 'series', interpolation: { escapeValue: false } });
        const t = i18next.t.bind(i18next);
        expect(t('detail.project.linkedMoved', { count: 1 })).toBe('1 estudio llevado');
        expect(t('detail.project.linkedMoved', { count: 3 })).toBe('3 estudios llevados');
        expect(t('detail.project.linkedSources', { count: 1 })).toBe('1 obra agregada');
        expect(t('detail.project.linked', { title: 'Nehemías', parts: '1 estudio llevado' })).toBe('Serie ligada al proyecto «Nehemías»: 1 estudio llevado.');
        await i18next.changeLanguage('en');
        expect(t('detail.project.linkedLinked', { count: 1 })).toBe('1 study linked');
        expect(t('detail.project.linkedLinked', { count: 2 })).toBe('2 studies linked');
    });

    it('un estudio que no quedó completo se avisa aparte', async () => {
        estado.series = conEstudios();
        svc.linkSeriesToProject.mockResolvedValue({ moved: 2, linked: 0, unchanged: 0, sourcesAdded: 1, failed: 1 });
        render(<SeriesDetail />);
        abrir();
        fireEvent.click(screen.getByRole('button', { name: 'detail.project.confirm' }));
        await waitFor(() => expect(estado.toast.warning).toHaveBeenCalledWith(expect.stringContaining('detail.project.partialFailed')));
    });

    it('si falla, avisa y no recarga', async () => {
        estado.series = conEstudios();
        svc.linkSeriesToProject.mockRejectedValue(new Error('boom'));
        render(<SeriesDetail />);
        abrir();
        fireEvent.click(screen.getByRole('button', { name: 'detail.project.confirm' }));
        await waitFor(() => expect(estado.toast.error).toHaveBeenCalledWith('detail.project.failed'));
        expect(estado.reloadData).not.toHaveBeenCalled();
    });

    it('mientras carga la biblioteca no se puede confirmar', () => {
        estado.series = conEstudios();
        estado.loadingLibrary = true;
        render(<SeriesDetail />);
        abrir();
        expect(screen.getByRole('button', { name: 'detail.project.confirm' })).toBeDisabled();
    });

    it('desligar solo quita el proyecto de la serie', async () => {
        estado.series = serie({ projectId: 'p1' });
        svc.setSeriesProject.mockResolvedValue(undefined);
        render(<SeriesDetail />);
        fireEvent.click(screen.getByRole('button', { name: 'detail.project.unlink' }));
        await waitFor(() => expect(svc.setSeriesProject).toHaveBeenCalledWith('s1', null));
        await waitFor(() => expect(estado.reloadData).toHaveBeenCalled());
        expect(estado.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['series'] });
        expect(svc.linkSeriesToProject).not.toHaveBeenCalled();
    });
});
