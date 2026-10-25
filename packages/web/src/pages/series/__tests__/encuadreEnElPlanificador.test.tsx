import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * El encuadre del proyecto en el planificador (`docs/FASE_ENCUADRE_SERIE_2026-10.md`,
 * §2 pasos 6–8, U5): precarga una sola vez y sin pisar un borrador, la
 * tarjeta «Tu lectura y lo que propone el panorama» que anota en el registro,
 * el aviso de unidades contra domingos, y que NADA del encuadre llegue a los
 * pases.
 */
const svc = vi.hoisted(() => ({ createSeriesFromPlan: vi.fn() }));
vi.mock('@dosfilos/application', () => ({ seriesService: { createSeriesFromPlan: svc.createSeriesFromPlan } }));

const estado = vi.hoisted(() => ({
    projects: [] as unknown[],
    updateProject: vi.fn(),
}));
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({
    useFacultyProjects: () => ({
        projects: estado.projects,
        isLoadingProjects: false,
        updateProject: { mutateAsync: estado.updateProject },
    }),
}));
vi.mock('@/hooks/library', () => ({ useLibrary: () => ({ resources: [], isLoading: false }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ papers: [] }) }));

const pases = vi.hoisted(() => ({
    loadVerses: vi.fn(),
    runPanorama: vi.fn(),
    runMacro: vi.fn(),
}));
const mutacion = (mutate: (...a: unknown[]) => void = () => {}) => ({ mutate, isPending: false, isError: false });
vi.mock('@/hooks/series/useExpositoryAssistant', () => ({
    useExpositoryAssistant: () => ({
        loadVerses: pases.loadVerses,
        runPanorama: mutacion(pases.runPanorama),
        runSuperMacro: mutacion(),
        runMacro: mutacion(pases.runMacro),
        runMicro: mutacion(),
        runPreachable: mutacion(),
        runFidelity: mutacion(),
    }),
}));
vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => {
            if (opts && 'count' in opts && !('book' in opts)) return `${key}:${String(opts.count)}`;
            if (opts && 'units' in opts) return `${key}[${String(opts.units)}|${String(opts.sundays)}]`;
            return key;
        },
        i18n: { language: 'es' },
    }),
}));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useNavigate: () => vi.fn(),
}));
vi.mock('@/components/expository/MethodologyPresentation', () => ({ MethodologyPresentation: () => null, hasMethodologyBeenShown: () => true, markMethodologyShown: () => {} }));
vi.mock('@/components/exegesis/PassagePicker', () => ({
    PassagePicker: ({ value }: { value: unknown }) => <output aria-label="pasaje">{JSON.stringify(value)}</output>,
}));
vi.mock('@/components/exegesis/BookPicker', () => ({
    BookPicker: ({ value, onChange }: { value: string; onChange: (id: string) => void }) => (
        <input aria-label="libro" value={value} onChange={(e) => onChange(e.target.value)} />
    ),
}));

import { ExpositoryAssistantPage } from '../ExpositoryAssistantPage';

const CLAVE = 'dosfilos.expositoryAssistant.draft:ezr';
const URL_EZR = '/dashboard/plans/pericope?projectId=ezr&book=EZR';

const alcance = { bookId: 'EZR', chapterStart: 7, chapterEnd: 10, verseStart: null, verseEnd: null };
const encuadre = {
    purpose: 'preach',
    scope: { bookId: 'EZR', passage: alcance },
    centralIdea: 'Dios restaura a su pueblo por su Palabra.',
    structure: [{ passage: { bookId: 'EZR', chapterStart: 7, chapterEnd: 8, verseStart: null, verseEnd: null }, title: 'Esdras llega con la Ley' }],
    rhythm: { sundays: 3, startDate: '2026-11-01', frequency: 'biweekly' },
};
const esdras = (framing: Record<string, unknown> | null = encuadre) => ({
    id: 'ezr', title: 'Esdras — serie expositiva', bibliographyCriteria: { bibleBooks: ['EZR'] },
    ...(framing ? { framing } : {}),
});

const panorama = {
    genre: 'narrative', purpose: 'Mostrar que la restauración nace de la Ley enseñada.',
    pastoralProblem: 'pp', centralTheme: 'ct', movements: ['Regreso', 'Reforma'], keyTerms: [],
};
const predicable = (id: string, cs: number) => ({
    id, title: `Unidad ${id}`, passage: `Esdras ${cs}:1-10`,
    chapterStart: cs, verseStart: 1, chapterEnd: cs, verseEnd: 10,
    sourcedExegeticalUnitIds: [], exegeticalProposition: 'P', homileticalProposition: 'H', pastoralObjective: 'O', order: 0,
});
const guardarBorrador = (extra: Record<string, unknown> = {}) => localStorage.setItem(CLAVE, JSON.stringify({
    schemaVersion: 'v1', savedAt: new Date().toISOString(), projectId: 'ezr',
    bookId: 'EZR', displayLanguage: 'es', bookDisplay: 'Esdras',
    // Libro entero: de 1:1 al capítulo 10.
    verses: [{ chapter: 1, verse: 1, text: 'a' }, { chapter: 10, verse: 44, text: 'b' }],
    preachableUnits: [predicable('p1', 1)],
    ...extra,
}));

const arbol = (url = URL_EZR) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[url]}>
            <ExpositoryAssistantPage />
        </MemoryRouter>
    </QueryClientProvider>
);

beforeEach(() => {
    localStorage.clear();
    estado.projects = [esdras()];
    estado.updateProject.mockReset().mockResolvedValue({});
    svc.createSeriesFromPlan.mockReset().mockResolvedValue({ id: 's1', metadata: { plannedSermons: [] } });
    pases.loadVerses.mockReset().mockResolvedValue({
        book: 'Esdras', source: 'original-hebrew',
        verses: Array.from({ length: 6 }, (_, i) => ({ chapter: 7, verse: i + 1, text: `v${i}` })),
    });
    pases.runPanorama.mockReset();
    pases.runMacro.mockReset();
    Object.values(toast).forEach((f) => f.mockReset());
});

describe('precarga desde el encuadre', () => {
    it('sin borrador: el alcance del encuadre en modo pasaje; los domingos NO van a «≈N sermones»', async () => {
        render(arbol());
        const pasaje = await screen.findByLabelText('pasaje');
        expect(JSON.parse(pasaje.textContent ?? 'null')).toEqual(alcance);
        expect(screen.getByLabelText('expository.setup.targetCount')).toHaveValue(null);
    });

    it('con borrador restaurado, el alcance no se toca; fecha y frecuencia sí se precargan, y la idea PROVISORIA no', async () => {
        guardarBorrador();
        render(arbol());
        // Con encuadre y sin idea revisada: el campo aparece, vacío.
        expect(await screen.findByLabelText('expository.create.description')).toHaveValue('');
        // El análisis restaurado manda: sigue en libro entero.
        expect(screen.queryByLabelText('pasaje')).not.toBeInTheDocument();
        expect(screen.getByLabelText('libro')).toHaveValue('EZR');
        expect(screen.getByLabelText('expository.create.startDate')).toHaveValue('2026-11-01');
        expect(screen.getByLabelText('expository.create.frequency')).toHaveValue('biweekly');
    });

    it('la idea revisada y vigente sí precarga la descripción', async () => {
        estado.projects = [esdras({
            ...encuadre,
            revision: { centralIdea: 'La Palabra enseñada restaura.', verdict: 'nuanced', why: 'Esd 7:10', ofIdea: encuadre.centralIdea, revisedAt: '2026-10-25T00:00:00Z' },
        })];
        guardarBorrador();
        render(arbol());
        expect(await screen.findByLabelText('expository.create.description')).toHaveValue('La Palabra enseñada restaura.');
    });

    it('una sola vez: un refetch del proyecto no pisa lo que el pastor editó', async () => {
        guardarBorrador();
        const { rerender } = render(arbol());
        const descripcion = await screen.findByLabelText('expository.create.description');
        fireEvent.change(descripcion, { target: { value: 'Mi descripción' } });
        fireEvent.change(screen.getByLabelText('expository.create.startDate'), { target: { value: '2026-12-06' } });
        estado.projects = [esdras({ ...encuadre, centralIdea: 'Otra idea', rhythm: { startDate: '2027-01-03', frequency: 'monthly' } })];
        rerender(arbol());
        expect(screen.getByLabelText('expository.create.description')).toHaveValue('Mi descripción');
        expect(screen.getByLabelText('expository.create.startDate')).toHaveValue('2026-12-06');
        expect(screen.getByLabelText('expository.create.frequency')).toHaveValue('biweekly');
    });

    it('la serie se crea con la descripción, la fecha y la frecuencia del formulario', async () => {
        guardarBorrador();
        render(arbol());
        fireEvent.change(await screen.findByLabelText('expository.create.description'), { target: { value: '  Restaurados por la Palabra  ' } });
        const crear = screen.getByRole('button', { name: /expository\.create\.cta/ });
        await waitFor(() => expect(crear).toBeEnabled());
        fireEvent.click(crear);
        await waitFor(() => expect(svc.createSeriesFromPlan).toHaveBeenCalledTimes(1));
        const plan = svc.createSeriesFromPlan.mock.calls[0]![1];
        expect(plan.series.description).toBe('Restaurados por la Palabra');
        expect(plan.frequency).toBe('biweekly');
        expect(plan.series.startDate).toEqual(new Date(2026, 10, 1));
    });

    it('un proyecto sin encuadre: ni alcance, ni campo de descripción, y la serie lleva el texto de siempre', async () => {
        estado.projects = [esdras(null)];
        guardarBorrador();
        render(arbol());
        const crear = await screen.findByRole('button', { name: /expository\.create\.cta/ });
        expect(screen.queryByLabelText('expository.create.description')).not.toBeInTheDocument();
        expect(screen.queryByText('expository.framing.contrast.title')).not.toBeInTheDocument();
        expect(screen.getByLabelText('expository.create.frequency')).toHaveValue('weekly');
        await waitFor(() => expect(crear).toBeEnabled());
        fireEvent.click(crear);
        await waitFor(() => expect(svc.createSeriesFromPlan).toHaveBeenCalledTimes(1));
        const plan = svc.createSeriesFromPlan.mock.calls[0]![1];
        expect(plan.series.description).toBe('expository.create.defaultDescription');
        expect(plan.frequency).toBe('weekly');
        expect(plan.series.startDate).toBeUndefined();
    });
});

describe('«Tu lectura y lo que propone el panorama»', () => {
    it('lado a lado, con el rótulo «del libro» para un análisis del libro entero, nunca «lo que dice el texto»', async () => {
        guardarBorrador({ panorama });
        render(arbol());
        expect(await screen.findByText('expository.framing.contrast.title')).toBeInTheDocument();
        expect(screen.getAllByText('expository.framing.contrast.panoramaBook').length).toBeGreaterThan(0);
        expect(screen.queryByText(/panoramaPassage/)).not.toBeInTheDocument();
        const tarjeta = within(screen.getByRole('region', { name: 'expository.framing.contrast.title' }));
        expect(tarjeta.getByText(encuadre.centralIdea)).toBeInTheDocument();
        expect(tarjeta.getByText(panorama.purpose)).toBeInTheDocument();
        // Sus movimientos, en la numeración del lector, y los del panorama.
        expect(tarjeta.getByText('Esdras 7-8')).toBeInTheDocument();
        expect(tarjeta.getByText(/Esdras llega con la Ley/)).toBeInTheDocument();
        expect(tarjeta.getByText('Regreso')).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/lo que dice el texto/i);
    });

    it('con la macroestructura, compara contra sus secciones', async () => {
        guardarBorrador({
            panorama,
            macroSections: [{ id: 'm1', title: 'La reforma de Esdras', chapterStart: 7, verseStart: 1, chapterEnd: 10, verseEnd: 44, theme: 't', functionInBook: 'climax', order: 0 }],
        });
        render(arbol());
        const tarjeta = within(await screen.findByRole('region', { name: 'expository.framing.contrast.title' }));
        expect(tarjeta.getByText(/La reforma de Esdras/)).toBeInTheDocument();
        expect(tarjeta.getByText('Esdras 7:1-10:44')).toBeInTheDocument();
        expect(tarjeta.queryByText('Regreso')).not.toBeInTheDocument();
    });

    it('con alcance acotado dice «del pasaje»; y el input de los pases no cambia con el encuadre', async () => {
        render(arbol());
        await screen.findByLabelText('pasaje');
        pases.runPanorama.mockImplementation((_input: unknown, opts: { onSuccess: (r: unknown) => void }) => opts.onSuccess({ payload: panorama, modelId: 'm' }));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /expository\.setup\.start/ }));
        });
        expect(await screen.findByText('expository.framing.contrast.title')).toBeInTheDocument();
        expect(screen.getAllByText('expository.framing.contrast.panoramaPassage').length).toBeGreaterThan(0);
        expect(screen.queryByText('expository.framing.contrast.panoramaBook')).not.toBeInTheDocument();
        // Lo que recibieron los pases: ni la idea, ni los movimientos, ni el ritmo.
        const entrada = JSON.stringify([pases.runPanorama.mock.calls[0]![0], pases.runMacro.mock.calls[0]![0]]);
        for (const dato of [encuadre.centralIdea, 'Esdras llega con la Ley', '2026-11-01', 'biweekly']) {
            expect(entrada).not.toContain(dato);
        }
        expect(pases.runPanorama.mock.calls[0]![0]).not.toHaveProperty('targetPreachableCount');
    });

    it('el input del Pase 1 es idéntico con encuadre y sin él', async () => {
        const sinAlcance = { ...encuadre, scope: null };
        const correr = async () => {
            const vista = render(arbol());
            const comenzar = await screen.findByRole('button', { name: /expository\.setup\.start/ });
            await act(async () => { fireEvent.click(comenzar); });
            await waitFor(() => expect(pases.runPanorama).toHaveBeenCalled());
            const entrada = pases.runPanorama.mock.calls[0]![0];
            vista.unmount();
            pases.runPanorama.mockReset();
            localStorage.clear();
            return entrada;
        };
        estado.projects = [esdras(sinAlcance)];
        const conEncuadre = await correr();
        estado.projects = [esdras(null)];
        const sinEncuadre = await correr();
        expect(conEncuadre).toEqual(sinEncuadre);
    });

    it('«¿Qué cambia en tu lectura?» anota en el registro con source panorama; no es obligatorio', async () => {
        guardarBorrador({ panorama });
        render(arbol());
        const anotar = await screen.findByRole('button', { name: 'expository.framing.contrast.save' });
        expect(anotar).toBeDisabled();
        fireEvent.click(screen.getByRole('radio', { name: 'expository.framing.contrast.verdict.nuances' }));
        fireEvent.change(screen.getByLabelText('expository.framing.contrast.noteLabel'), { target: { value: '  El panorama ve la Ley antes que el templo (7:10).  ' } });
        expect(anotar).toBeEnabled();
        fireEvent.click(anotar);
        await waitFor(() => expect(estado.updateProject).toHaveBeenCalledTimes(1));
        expect(estado.updateProject).toHaveBeenCalledWith({
            projectId: 'ezr',
            hypothesisEntry: { source: 'panorama', verdict: 'nuances', note: 'El panorama ve la Ley antes que el templo (7:10).' },
        });
        expect(await screen.findByText('expository.framing.contrast.saved')).toBeInTheDocument();
    });

    it('si falla al anotar, lo dice y deja reintentar', async () => {
        estado.updateProject.mockRejectedValueOnce(new Error('red'));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        guardarBorrador({ panorama });
        render(arbol());
        fireEvent.click(await screen.findByRole('radio', { name: 'expository.framing.contrast.verdict.confirms' }));
        fireEvent.click(screen.getByRole('button', { name: 'expository.framing.contrast.save' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('expository.framing.contrast.saveFailed');
        expect(screen.getByRole('button', { name: 'expository.framing.contrast.save' })).toBeEnabled();
    });

    it('si ya anotó tras el panorama, lo muestra en vez de pedirlo; «Anotar otra vez» abre la pregunta', async () => {
        estado.projects = [esdras({
            ...encuadre,
            hypothesisLog: [
                { id: 'h1', at: '2026-10-20T10:00:00.000Z', source: 'panorama', verdict: 'confirms', note: '' },
                { id: 'h2', at: '2026-10-22T10:00:00.000Z', source: 'panorama', verdict: 'nuances', note: 'Esd 7:10 pesa más.' },
                { id: 'h3', at: '2026-10-23T10:00:00.000Z', source: 'study', studyId: 'p9', verdict: 'contradicts', note: '' },
            ],
        })];
        guardarBorrador({ panorama });
        render(arbol());
        const tarjeta = within(await screen.findByRole('region', { name: 'expository.framing.contrast.title' }));
        // La última del panorama (no la del estudio), con su nota.
        expect(tarjeta.getByText('expository.framing.contrast.already')).toBeInTheDocument();
        expect(tarjeta.getByText('Esd 7:10 pesa más.')).toBeInTheDocument();
        expect(tarjeta.queryByRole('radio')).not.toBeInTheDocument();
        fireEvent.click(tarjeta.getByRole('button', { name: 'expository.framing.contrast.again' }));
        const primera = tarjeta.getByRole('radio', { name: 'expository.framing.contrast.verdict.confirms' });
        expect(primera).toHaveFocus();
        expect(tarjeta.queryByText('expository.framing.contrast.already')).not.toBeInTheDocument();
    });

    it('un panorama nuevo vuelve a invitar: la tarjeta se monta de nuevo', async () => {
        render(arbol());
        await screen.findByLabelText('pasaje');
        pases.runPanorama.mockImplementation((_input: unknown, opts: { onSuccess: (r: unknown) => void }) => opts.onSuccess({ payload: { ...panorama }, modelId: 'm' }));
        const correr = async () => {
            await act(async () => { fireEvent.click(screen.getByRole('button', { name: /expository\.setup\.start/ })); });
            return screen.findByRole('button', { name: 'expository.framing.contrast.save' });
        };
        await correr();
        fireEvent.click(screen.getByRole('radio', { name: 'expository.framing.contrast.verdict.nuances' }));
        fireEvent.click(screen.getByRole('button', { name: 'expository.framing.contrast.save' }));
        expect(await screen.findByText('expository.framing.contrast.saved')).toBeInTheDocument();
        // Otra corrida: la confirmación de la anterior no se queda pegada.
        await correr();
        expect(screen.queryByText('expository.framing.contrast.saved')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'expository.framing.contrast.save' })).toBeDisabled();
    });

    it('si lo analizado no es un libro del proyecto, la tarjeta no aparece', async () => {
        localStorage.setItem(CLAVE, JSON.stringify({
            schemaVersion: 'v1', savedAt: new Date().toISOString(), projectId: 'ezr',
            bookId: 'RUT', displayLanguage: 'es', bookDisplay: 'Rut',
            verses: [{ chapter: 1, verse: 1, text: 'a' }, { chapter: 4, verse: 22, text: 'b' }],
            panorama,
        }));
        estado.projects = [esdras()];
        // Sin `book` en la dirección: así se restaura el borrador de Rut.
        render(arbol('/dashboard/plans/pericope?projectId=ezr'));
        expect(await screen.findByLabelText('libro')).toHaveValue('RUT');
        // El panorama de Rut sí se restauró (lo muestra el Pase 1); la tarjeta no.
        expect(screen.getAllByText(panorama.purpose).length).toBeGreaterThan(0);
        expect(screen.queryByText('expository.framing.contrast.title')).not.toBeInTheDocument();
    });

    it('sin idea central ni movimientos, la tarjeta no aparece', async () => {
        estado.projects = [esdras({ ...encuadre, centralIdea: undefined, structure: undefined })];
        guardarBorrador({ panorama });
        render(arbol());
        await screen.findByRole('button', { name: /expository\.create\.cta/ });
        expect(screen.queryByText('expository.framing.contrast.title')).not.toBeInTheDocument();
    });
});

describe('aviso de unidades contra domingos (tras el Pase 4)', () => {
    it('más unidades que domingos: agrupar o ajustar el calendario', async () => {
        guardarBorrador({ preachableUnits: [1, 2, 3, 4].map((c) => predicable(`p${c}`, c)) });
        render(arbol());
        expect(await screen.findByText('expository.framing.units.summary[expository.framing.units.unitCount:4|expository.framing.units.sundayCount:3]')).toBeInTheDocument();
        expect(screen.getByText('expository.framing.units.moreUnits')).toBeInTheDocument();
        expect(screen.queryByText('expository.framing.units.fewerUnits')).not.toBeInTheDocument();
    });

    it('menos unidades que domingos: ajustar el calendario, sin prometer una opción que no existe', async () => {
        guardarBorrador({ preachableUnits: [predicable('p1', 1)] });
        render(arbol());
        expect(await screen.findByText('expository.framing.units.fewerUnits')).toBeInTheDocument();
        expect(screen.queryByText('expository.framing.units.moreUnits')).not.toBeInTheDocument();
    });

    it('dos salidas reales: «Ajustar el calendario» abre el encuadre del proyecto y «Revisar la división» despliega el Pase 4 y le da el foco', async () => {
        const scroll = vi.fn();
        Element.prototype.scrollIntoView = scroll;
        guardarBorrador({ preachableUnits: [1, 2, 3, 4].map((c) => predicable(`p${c}`, c)) });
        render(arbol());
        const calendario = await screen.findByRole('link', { name: 'expository.framing.units.adjustCalendar' });
        expect(calendario).toHaveAttribute('href', '/dashboard/projects/ezr?encuadre=1');
        // Pliega el Pase 4 y vuelve a él desde el aviso.
        const pase4 = document.getElementById('expository-pass-4')!;
        fireEvent.click(within(pase4).getAllByRole('button').find((b) => /collapse|plegar/i.test(b.getAttribute('aria-label') ?? b.textContent ?? ''))!);
        await waitFor(() => expect(document.getElementById('expository-pass-4')).toBeNull());
        fireEvent.click(screen.getByRole('button', { name: 'expository.framing.units.reviewDivision' }));
        await waitFor(() => expect(document.getElementById('expository-pass-4')).not.toBeNull());
        await waitFor(() => expect(document.getElementById('expository-pass-4')).toHaveFocus());
        expect(scroll).toHaveBeenCalled();
    });

    it('iguales, o sin domingos en el encuadre: no aparece', async () => {
        guardarBorrador({ preachableUnits: [1, 2, 3].map((c) => predicable(`p${c}`, c)) });
        const { unmount } = render(arbol());
        await screen.findByRole('button', { name: /expository\.create\.cta/ });
        expect(screen.queryByText(/expository\.framing\.units\.summary/)).not.toBeInTheDocument();
        unmount();
        estado.projects = [esdras({ ...encuadre, rhythm: { startDate: '2026-11-01' } })];
        guardarBorrador({ preachableUnits: [predicable('p1', 1)] });
        render(arbol());
        await screen.findByRole('button', { name: /expository\.create\.cta/ });
        expect(screen.queryByText(/expository\.framing\.units\.summary/)).not.toBeInTheDocument();
    });
});

describe('textos del encuadre en el planificador', () => {
    const aplanar = (o: unknown, pre = ''): string[] =>
        Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
            v && typeof v === 'object' ? aplanar(v, `${pre}${k}.`) : [`${pre}${k}`]);
    const val = (o: unknown, k: string) => k.split('.').reduce((x, y) => (x as Record<string, unknown>)[y], o) as string;
    const marcas = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

    it('es y en: mismas claves y mismos marcadores', async () => {
        const es = (await import('@/i18n/locales/es/series.json')).default as { expository: Record<string, unknown> };
        const en = (await import('@/i18n/locales/en/series.json')).default as { expository: Record<string, unknown> };
        for (const rama of ['framing', 'create'] as const) {
            const a = es.expository[rama];
            const b = en.expository[rama];
            expect(aplanar(a).sort()).toEqual(aplanar(b).sort());
            for (const k of aplanar(a)) expect(marcas(val(b, k))).toEqual(marcas(val(a, k)));
        }
    });

    it('glosario: el Pase 4 propone (nunca «el texto dio»), «tu lectura» y sin prometer opciones futuras', async () => {
        const es = (await import('@/i18n/locales/es/series.json')).default as unknown as { expository: { framing: Record<string, Record<string, string>> } };
        const en = (await import('@/i18n/locales/en/series.json')).default as unknown as { expository: { framing: Record<string, Record<string, string>> } };
        const textos = JSON.stringify([es.expository.framing, en.expository.framing]);
        expect(textos).not.toMatch(/el texto dio|the text yielded|hipótesis|hypothesis|próxima versión|upcoming version|overview/i);
        expect(es.expository.framing.units!.summary).toBe('El Pase 4 propone {{units}}; planeaste {{sundays}}.');
        expect(es.expository.framing.contrast!.question).toBe('Después de volver al texto, ¿qué hace con tu lectura?');
        expect(es.expository.framing.contrast!.noteLabel).toBe('Nota (opcional)');
        expect(es.expository.framing.contrast!.saveFailed).toMatch(/Inténtalo de nuevo\.$/);
        expect(textos).not.toMatch(/\b(IA|AI|GPT|Gemini|modelo|model|LLM)\b/);
    });
});
