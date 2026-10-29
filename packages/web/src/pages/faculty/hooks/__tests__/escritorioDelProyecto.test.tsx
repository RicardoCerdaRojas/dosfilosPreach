import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * `useProjectDesk` (W2-A, deuda 5): un selector sobre lo que ya está en
 * caché, con estado por bloque. Lo que se prueba:
 *   - el borrador del planificador de ESTE proyecto pone la fase 3 «en curso»;
 *   - llegan TODOS los sermones (el marcador vacío de la serie se reconoce);
 *   - mientras cargan estudios, series o biblioteca, el recorrido espera;
 *   - si las series fallan, el bloque dice «error» (no «sin serie»);
 *   - en Exegético y Curso no se pide la lectura del selector de fuentes;
 *   - sin catálogo de rúbricas (cargando), no se da una rúbrica por faltante.
 */
let proyectos: unknown[] = [];
let estudios: unknown[] = [];
let cargandoEstudios = false;
let errorEstudios: Error | null = null;
let sermones: unknown[] = [];
let errorSermones: string | null = null;
let cargandoSermones = false;
let biblioteca: { resources: unknown[]; isLoading: boolean; isError?: boolean } = { resources: [], isLoading: false };
let rubricas: { rubrics: unknown[]; isLoading: boolean } = { rubrics: [], isLoading: false };
const getUserSeries = vi.fn();
const fuentesPedidas = vi.fn();

vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@dosfilos/application', () => ({ seriesService: { getUserSeries: (uid: string) => getUserSeries(uid) } }));
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({
    useFacultyProjects: () => ({ projects: proyectos, isLoadingProjects: false, updateProject: { mutateAsync: vi.fn(), isPending: false } }),
}));
vi.mock('@/hooks/faculty/useFacultySessions', () => ({ useFacultySessions: () => ({ sessions: [] }) }));
vi.mock('@/hooks/use-sermons', () => ({ useSermons: () => ({ sermons: sermones, loading: cargandoSermones, error: errorSermones, refetch: vi.fn() }) }));
vi.mock('@/hooks/useGreekSessions', () => ({ useGreekSessions: () => ({ sessions: [] }) }));
vi.mock('@/hooks/useHebrewSessions', () => ({ useHebrewSessions: () => ({ sessions: [] }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ papers: estudios, isLoading: cargandoEstudios, error: errorEstudios }) }));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => rubricas }));
vi.mock('@/hooks/library', () => ({ useLibrary: () => biblioteca }));
const mutacion = { mutateAsync: vi.fn(), isPending: false };
vi.mock('@/hooks/faculty/useProjectWorkspace', () => ({
    useProjectWorkspace: () => ({ outputs: [], isLoadingOutputs: false, createOutput: mutacion, updateOutput: mutacion, deleteOutput: mutacion }),
}));
vi.mock('../useProjectAttachedSources', () => ({
    useProjectAttachedSources: (o: { sourceIds?: string[] }) => {
        fuentesPedidas(o.sourceIds);
        return { sources: [], isLoading: false, error: null, reprocessing: {}, reprocessSource: vi.fn() };
    },
}));

const { useProjectDesk, hasPlannerDraft, deskWhileLibraryLoads } = await import('../useProjectDesk');

const envolver = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

const esdras = { id: 'ezr', userId: 'u1', title: 'Esdras', color: 'amber', type: 'exegetical', bibliographyCriteria: { bibleBooks: ['EZR'] }, sourceIds: ['r1'] };
const pasaje = (c: number) => ({ bookId: 'EZR', chapterStart: c, chapterEnd: c, verseStart: null, verseEnd: null });
const estudio = (id: string, c: number, phase = 'configuring') => ({
    id, title: `Esd ${c}`, passage: pasaje(c), phase, stepCount: 8, acceptedStepCount: 0, archivedAt: null,
    createdAt: new Date('2026-10-01T10:00:00Z'), updatedAt: new Date('2026-10-01T10:00:00Z'),
    citedSourceKeys: [], seriesId: 'sz', projectId: 'ezr', linkedProjectIds: [],
});
const serie = {
    id: 'sz', title: 'Esdras', projectId: 'ezr', createdAt: new Date('2026-10-02'),
    metadata: { plannedSermons: [{ id: 'p1', week: 1, passage: 'Esd 1', paperId: 'e1', draftId: 'd1' }, { id: 'p2', week: 2, passage: 'Esd 2', paperId: 'e2' }] },
};
const borrador = (projectId: string) => JSON.stringify({ schemaVersion: 'v1', savedAt: new Date().toISOString(), bookId: 'EZR', projectId, displayLanguage: 'es', bookDisplay: 'Esdras', verses: [] });

beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    proyectos = [esdras];
    estudios = [];
    cargandoEstudios = false;
    errorEstudios = null;
    sermones = [];
    errorSermones = null;
    cargandoSermones = false;
    biblioteca = { resources: [], isLoading: false };
    rubricas = { rubrics: [], isLoading: false };
    getUserSeries.mockResolvedValue([]);
});

describe('deskWhileLibraryLoads', () => {
    it('sin carga devuelve el modelo tal cual; con carga, solo la fase 2 «cargando» y sin lectura dirigida', () => {
        const modelo = { phases: [{ id: 'charge', status: 'ready' }, { id: 'sources', status: 'doing' }], course: { directedReading: [{ requirementId: 'pag' }] } } as never;
        expect(deskWhileLibraryLoads(modelo, false)).toBe(modelo);
        expect(deskWhileLibraryLoads(null, true)).toBeNull();
        const v = deskWhileLibraryLoads(modelo, true)!;
        expect(v.phases).toEqual([{ id: 'charge', status: 'ready' }, { id: 'sources', status: 'doing', loading: true }]);
        expect(v.course!.directedReading).toEqual([]);
    });
});

describe('el borrador del planificador', () => {
    it('el de este proyecto pone «División en perícopas» en curso; el de otro proyecto o el suelto, no', async () => {
        window.localStorage.setItem('dosfilos.expositoryAssistant.draft:otro', borrador('otro'));
        window.localStorage.setItem('dosfilos.expositoryAssistant.draft', borrador(''));
        expect(hasPlannerDraft('ezr')).toBe(false);
        const sin = renderHook(() => useProjectDesk('ezr'), { wrapper: envolver() });
        await waitFor(() => expect(sin.result.current.journey).toBe('ready'));
        expect(sin.result.current.desk!.phases.find(p => p.id === 'division')!.status).toBe('todo');

        window.localStorage.setItem('dosfilos.expositoryAssistant.draft:ezr', borrador('ezr'));
        expect(hasPlannerDraft('ezr')).toBe(true);
        const con = renderHook(() => useProjectDesk('ezr'), { wrapper: envolver() });
        await waitFor(() => expect(con.result.current.journey).toBe('ready'));
        expect(con.result.current.desk!.phases.find(p => p.id === 'division')!.status).toBe('doing');
    });

    it('si el almacenamiento falla, no hay borrador (y nada se rompe)', () => {
        const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('privado'); });
        const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        expect(hasPlannerDraft('ezr')).toBe(false);
        get.mockRestore();
        aviso.mockRestore();
    });
});

describe('los sermones', () => {
    it('llegan todos: el marcador vacío que la serie creó no cuenta como sermón de la perícopa', async () => {
        estudios = [estudio('e1', 1), estudio('e2', 2)];
        getUserSeries.mockResolvedValue([serie]);
        // d1 es el marcador vacío del plan (paso 0, sin cuerpo) y NO es del proyecto por projectId.
        sermones = [{ id: 'd1', status: 'draft', updatedAt: new Date('2026-10-02'), wizardProgress: { currentStep: 0 } }];
        const { result } = renderHook(() => useProjectDesk('ezr'), { wrapper: envolver() });
        await waitFor(() => expect(result.current.journey).toBe('ready'));
        const filas = result.current.desk!.exegetical!.series[0]!.rows;
        expect(filas.map(f => f.sermon)).toEqual(['none', 'none']);

        // Con cuerpo, ya es un borrador del pastor.
        sermones = [{ id: 'd1', status: 'draft', updatedAt: new Date('2026-10-02'), content: 'cuerpo' }];
        const otro = renderHook(() => useProjectDesk('ezr'), { wrapper: envolver() });
        await waitFor(() => expect(otro.result.current.journey).toBe('ready'));
        expect(otro.result.current.desk!.exegetical!.series[0]!.rows[0]!.sermon).toBe('draft');
    });
});

describe('el estado por bloque', () => {
    it('mientras cargan los estudios, el recorrido espera', () => {
        cargandoEstudios = true;
        const { result } = renderHook(() => useProjectDesk('ezr'), { wrapper: envolver() });
        expect(result.current.blocks.work).toBe('loading');
        expect(result.current.journey).toBe('loading');
    });

    it('mientras carga la biblioteca, el recorrido NO la espera si la fase 2 no es la activa: esa fase sale «cargando» (B6)', async () => {
        // La biblioteca del fundador pesa 39 MB (medido el 2026-10-28): el escritorio no la espera para lo que no la usa.
        biblioteca = { resources: [], isLoading: true };
        const { result } = renderHook(() => useProjectDesk('ezr'), { wrapper: envolver() });
        await waitFor(() => expect(result.current.blocks.series).toBe('ready'));
        expect(result.current.blocks.sources).toBe('loading');
        expect(result.current.desk!.activePhaseId).toBe('passage');
        expect(result.current.journey).toBe('ready');
        expect(result.current.desk!.phases.find(p => p.id === 'sources')!.loading).toBe(true);
        expect(result.current.desk!.phases.find(p => p.id === 'passage')!.loading).toBeUndefined();
    });

    it('si la fase 2 es la activa, la biblioteca decide: el recorrido espera', async () => {
        proyectos = [{ ...esdras, sourceIds: [], framing: { centralIdea: 'Dios restaura a su pueblo' } }];
        biblioteca = { resources: [], isLoading: true };
        const { result } = renderHook(() => useProjectDesk('ezr'), { wrapper: envolver() });
        await waitFor(() => expect(result.current.blocks.series).toBe('ready'));
        expect(result.current.desk!.activePhaseId).toBe('sources');
        expect(result.current.journey).toBe('loading');
    });

    it('un tipo viejo, que cuenta las fuentes del selector, sigue esperando la biblioteca', async () => {
        proyectos = [{ ...esdras, type: 'counseling' }];
        biblioteca = { resources: [], isLoading: true };
        const { result } = renderHook(() => useProjectDesk('ezr'), { wrapper: envolver() });
        await waitFor(() => expect(result.current.blocks.series).toBe('ready'));
        expect(result.current.journey).toBe('loading');
    });

    it('si las series fallan, el bloque dice «error»: no afirma que no hay serie', async () => {
        getUserSeries.mockRejectedValue(new Error('sin red'));
        const { result } = renderHook(() => useProjectDesk('ezr'), { wrapper: envolver() });
        await waitFor(() => expect(result.current.blocks.series).toBe('error'));
        expect(result.current.journey).toBe('error');
    });
});

describe('las fuentes del selector', () => {
    it('Exegético y Curso no piden la lectura del selector: sus fuentes van por el estado del arte', async () => {
        renderHook(() => useProjectDesk('ezr'), { wrapper: envolver() });
        expect(fuentesPedidas).toHaveBeenCalled();
        expect(fuentesPedidas.mock.calls.every(c => c[0] === undefined)).toBe(true);
    });

    it('General sí, con las del proyecto', () => {
        proyectos = [{ ...esdras, type: 'general' }];
        renderHook(() => useProjectDesk('ezr'), { wrapper: envolver() });
        expect(fuentesPedidas).toHaveBeenLastCalledWith(['r1']);
    });

    it('un tipo viejo cuenta las fuentes anotadas en su recorrido', async () => {
        proyectos = [{ ...esdras, type: 'study' }];
        const { result } = renderHook(() => useProjectDesk('ezr'), { wrapper: envolver() });
        await waitFor(() => expect(result.current.legacyRoadmap).not.toBeNull());
        expect(result.current.desk!.type).toBe('other');
    });
});

describe('las rúbricas del curso', () => {
    const curso = { id: 'c', userId: 'u1', title: 'NT785', color: 'amber', type: 'course', workTypes: [{ id: 'tp', label: 'TP', rubricTemplateId: 'rub-borrada' }] };

    it('mientras cargan, la rúbrica no se da por faltante; cargadas, sí', async () => {
        proyectos = [curso];
        rubricas = { rubrics: [], isLoading: true };
        const cargando = renderHook(() => useProjectDesk('c'), { wrapper: envolver() });
        // FX-1: con el catálogo cargando, la rúbrica no se decide (ni faltante ni resuelta) y la fase 1 dice «cargando».
        const tipo = cargando.result.current.desk!.course!.workTypes[0]!;
        expect(tipo.rubricLoading).toBe(true);
        expect(tipo.rubricResolved).toBe(false);
        expect(tipo.rubric).not.toBe('missing');
        expect(cargando.result.current.desk!.phases.find(p => p.id === 'charge')!.loading).toBe(true);
        // Y el recorrido del Curso espera a las rúbricas (aunque lo demás ya llegó).
        await waitFor(() => expect(cargando.result.current.blocks.series).toBe('ready'));
        expect(cargando.result.current.blocks.rubrics).toBe('loading');
        expect(cargando.result.current.journey).toBe('loading');

        rubricas = { rubrics: [{ id: 'otra', isDefault: true, rubric: { sourceRequirements: [] } }], isLoading: false };
        const listo = renderHook(() => useProjectDesk('c'), { wrapper: envolver() });
        expect(listo.result.current.desk!.course!.workTypes[0]!.rubric).toBe('missing');
    });
});

describe('cada bloque con su carga y su error (FX-4)', () => {
    it('si los estudios fallan, la mesa no dice «sin estudios»: el bloque y el recorrido dicen «error»', async () => {
        errorEstudios = new Error('red');
        const { result } = renderHook(() => useProjectDesk('ezr'), { wrapper: envolver() });
        await waitFor(() => expect(result.current.blocks.series).toBe('ready'));
        expect(result.current.blocks.studies).toBe('error');
        expect(result.current.blocks.work).toBe('error');
        expect(result.current.journey).toBe('error');
    });

    it('si la biblioteca falla, las fuentes no se dan por vacías: el recorrido dice «error»', async () => {
        biblioteca = { resources: [], isLoading: false, isError: true };
        const { result } = renderHook(() => useProjectDesk('ezr'), { wrapper: envolver() });
        await waitFor(() => expect(result.current.blocks.series).toBe('ready'));
        expect(result.current.blocks.sources).toBe('error');
        expect(result.current.journey).toBe('error');
    });

    it('los sermones: mientras cargan, el recorrido espera; si fallan, solo su bloque dice «error»', async () => {
        cargandoSermones = true;
        const cargando = renderHook(() => useProjectDesk('ezr'), { wrapper: envolver() });
        await waitFor(() => expect(cargando.result.current.blocks.series).toBe('ready'));
        expect(cargando.result.current.journey).toBe('loading');
        cargandoSermones = false;
        errorSermones = 'red';
        const fallo = renderHook(() => useProjectDesk('ezr'), { wrapper: envolver() });
        await waitFor(() => expect(fallo.result.current.blocks.series).toBe('ready'));
        expect(fallo.result.current.blocks.sermons).toBe('error');
        expect(fallo.result.current.journey).toBe('ready');
    });

    it('en un Exegético, las rúbricas que cargan no detienen el recorrido', async () => {
        rubricas = { rubrics: [], isLoading: true };
        const { result } = renderHook(() => useProjectDesk('ezr'), { wrapper: envolver() });
        await waitFor(() => expect(result.current.journey).toBe('ready'));
    });
});
