import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { buildProjectDesk, type ProjectDeskInput } from '@dosfilos/domain';
import esDesk from '@/i18n/locales/es/projectDeskExegetical.json';
import enDesk from '@/i18n/locales/en/projectDeskExegetical.json';

/**
 * El escritorio Exegético (W2-B, `docs/FASE_ESCRITORIO_PROYECTO_2026-10.md`
 * §3): fase 1 con la nota de antes, Fuentes, la mesa de perícopas y la
 * síntesis. El modelo es el de verdad (`buildProjectDesk`); solo se simulan
 * las escrituras y los textos.
 */
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}));
const mutateAsync = vi.fn().mockResolvedValue(undefined);
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({ useFacultyProjects: () => ({ updateProject: { mutateAsync, isPending: false } }) }));
const salidas = { outputs: [] as Array<{ id: string; kind: string; content: string; title: string; updatedAt: Date }>, isLoadingOutputs: false };
vi.mock('@/hooks/faculty/useProjectWorkspace', () => ({ useProjectWorkspace: () => salidas }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { ExegeticalDeskSections } = await import('../../ExegeticalDeskSections');
const { isPendingRow } = await import('../PericopeTable');
const { formWithNote, formFromProject } = await import('../../../ProjectFramingForm');

beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    salidas.outputs = [];
    try { window.localStorage.clear(); } catch { /* sin almacenamiento */ }
});

const NOW = new Date(2026, 9, 26, 10, 0, 0);
const pasaje = (c: number, v1: number, v2: number) => ({ bookId: 'EZR', chapterStart: c, chapterEnd: c, verseStart: v1, verseEnd: v2 });
const estudio = (id: string, phase: string, over: Record<string, unknown> = {}): ProjectDeskInput['studies'][number] => ({
    id, passage: pasaje(Number(id.slice(1)) || 1, 1, 10), phase, stepCount: 8, acceptedStepCount: phase === 'in-progress' ? 3 : phase === 'assembled' ? 8 : 0,
    title: `Estudio ${id}`, createdAt: new Date(2026, 9, 1), updatedAt: new Date(2026, 9, 1), seriesId: 'sEzr', ...over,
}) as never;
const esdras = (over: Record<string, unknown> = {}) => ({
    id: 'ezr', userId: 'u', title: 'Esdras', color: 'amber', type: 'exegetical',
    bibliographyCriteria: { bibleBooks: ['EZR'] }, ...over,
});
const serie = {
    id: 'sEzr', title: 'Esdras', projectId: 'ezr', createdAt: new Date(2026, 9, 1),
    metadata: { plannedSermons: [
        { id: 'p1', week: 1, passage: 'Esd 1:1-11', title: 'El decreto', paperId: 'e1', draftId: 'd1' },
        { id: 'p2', week: 2, passage: 'Esd 2:1-70', paperId: 'e2' },
        { id: 'p3', week: 3, passage: 'Esd 3:1-13', paperId: 'e3' },
        { id: 'p4', week: 4, passage: 'Esd 4:1-24' },
    ] },
};
const sermones = [
    { id: 'd1', status: 'draft', updatedAt: new Date(2026, 9, 2), hasContent: true },
    { id: 'c1', status: 'published', sourceSermonId: 'd1', updatedAt: new Date(2026, 9, 3) },
];

/** Fases 1 y 2 listas (lectura escrita, una obra aprobada): la activa es la división. */
const listo = esdras({
    framing: { centralIdea: 'Dios restaura a su pueblo.' },
    bibliography: [{ id: 'a', title: 'A', resourceId: 'ra', weight: 'recommended', decision: 'approved', origins: ['catalog'] }],
});

function desk(input: Partial<ProjectDeskInput> & { project: ProjectDeskInput['project'] }) {
    return buildProjectDesk({ studies: [], ...input } as ProjectDeskInput, NOW);
}

function Donde() {
    const l = useLocation();
    return <p data-testid="donde">{`${l.pathname}${l.search}|${(l.state as { from?: string } | null)?.from ?? ''}`}</p>;
}

function montar(project: Record<string, unknown>, input: Partial<ProjectDeskInput> = {}, extra: { onOpenFraming?: () => void; sermons?: unknown[] } = {}) {
    const d = desk({ project: project as never, ...input });
    const onOpenFraming = extra.onOpenFraming ?? vi.fn();
    render(
        <MemoryRouter initialEntries={['/dashboard/projects/ezr']}>
            <Routes>
                <Route path="/dashboard/projects/:id" element={<ExegeticalDeskSections project={project as never} desk={d} onOpenFraming={onOpenFraming} sermons={extra.sermons as never} />} />
                <Route path="*" element={<Donde />} />
            </Routes>
        </MemoryRouter>,
    );
    return { d, onOpenFraming };
}

describe('el escritorio Exegético · secciones', () => {
    it('cada fase tiene su ancla, en el orden del trabajo', () => {
        montar(esdras());
        const ids = ['fase-passage', 'fase-sources', 'fase-division', 'fase-pericopes', 'fase-synthesis'];
        const els = ids.map(id => document.getElementById(id));
        expect(els.every(Boolean)).toBe(true);
        // El orden del documento repite el orden del método.
        for (let i = 1; i < els.length; i++) {
            expect(els[i - 1]!.compareDocumentPosition(els[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        }
    });

    it('sin modelo Exegético no dibuja nada', () => {
        const d = desk({ project: { id: 'g', type: 'general' } as never });
        const { container } = render(<MemoryRouter><ExegeticalDeskSections project={{ id: 'g' } as never} desk={d} onOpenFraming={vi.fn()} /></MemoryRouter>);
        expect(container.textContent).toBe('');
    });

    it('i18n: las mismas claves en es y en', () => {
        const claves = (o: Record<string, unknown>, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? claves(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`]));
        expect(claves(enDesk).sort()).toEqual(claves(esDesk).sort());
        // Nunca se nombra la máquina.
        expect(JSON.stringify([esDesk, enDesk])).not.toMatch(/\b(IA|AI|modelo|model|Gemini|LLM)\b/);
    });
});

describe('fase 1 · tu lectura del libro', () => {
    it('sin encuadre: el vacío invita a escribir y abre el diálogo del panel', () => {
        const onOpenFraming = vi.fn();
        montar(esdras({ bibliographyCriteria: null }), {}, { onOpenFraming });
        const seccion = within(document.getElementById('fase-passage')!);
        expect(seccion.getByText('reading.emptyTitle')).toBeInTheDocument();
        expect(seccion.queryByRole('button', { name: 'reading.editLabel' })).toBeNull();
        fireEvent.click(seccion.getByRole('button', { name: /reading\.write/ }));
        expect(onOpenFraming).toHaveBeenCalledTimes(1);
    });

    it('con el libro y sin idea: dice que falta la idea y ofrece «Editar»', () => {
        montar(esdras());
        expect(within(screen.getByTestId('desk-idea')).getByText('reading.noIdea')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'reading.editLabel' })).toBeInTheDocument();
    });

    it('con encuadre: la idea vigente y los movimientos; «Editar» abre el diálogo', () => {
        const onOpenFraming = vi.fn();
        montar(esdras({
            framing: {
                centralIdea: 'Dios restaura a su pueblo por su palabra.',
                structure: [{ passage: { bookId: 'EZR', chapterStart: 1, chapterEnd: 6, verseStart: null, verseEnd: null }, title: 'El templo' }, { passage: { bookId: 'EZR', chapterStart: 7, chapterEnd: 10, verseStart: null, verseEnd: null }, title: '' }],
            },
        }), {}, { onOpenFraming });
        const idea = screen.getByTestId('desk-idea');
        expect(within(idea).getByText('Dios restaura a su pueblo por su palabra.')).toBeInTheDocument();
        expect(within(idea).getByText('reading.ideaOriginal')).toBeInTheDocument();
        const movs = within(screen.getByTestId('desk-movements')).getAllByRole('listitem');
        expect(movs).toHaveLength(2);
        expect(movs[1]!.textContent).toContain('reading.untitledMovement');
        fireEvent.click(screen.getByRole('button', { name: 'reading.editLabel' }));
        expect(onOpenFraming).toHaveBeenCalledTimes(1);
    });

    it('la idea revisada y vigente es la que se muestra', () => {
        montar(esdras({
            framing: {
                centralIdea: 'Dios restaura.',
                hypothesisLog: [{ id: 'h1', at: '2026-10-20T00:00:00.000Z', source: 'study', studyId: 'e1', verdict: 'nuances', note: 'n' }],
                revision: { centralIdea: 'Dios restaura por su palabra.', verdict: 'nuanced', why: 'y', ofIdea: 'Dios restaura.', revisedAt: '2026-10-21T00:00:00.000Z' },
            },
        }));
        const idea = screen.getByTestId('desk-idea');
        expect(within(idea).getByText('Dios restaura por su palabra.')).toBeInTheDocument();
        expect(within(idea).getByText('reading.ideaRevised')).toBeInTheDocument();
    });

    it('la nota de antes: se ofrece pasarla; el diálogo la precarga en la idea central y el pastor confirma', async () => {
        montar(esdras({ contextNote: 'Esdras: el regreso y la reconstrucción por la palabra.' }));
        const nota = screen.getByTestId('desk-old-note');
        expect(within(nota).getByText('Esdras: el regreso y la reconstrucción por la palabra.')).toBeInTheDocument();
        // Nada se escribe hasta confirmar.
        fireEvent.click(within(nota).getByRole('button', { name: /reading\.oldNote\.action/ }));
        expect(mutateAsync).not.toHaveBeenCalled();
        expect(screen.getByTestId('framing-old-note').textContent).toContain('noteDialog.intoIdea');
        expect((screen.getByLabelText('framing.dialog.centralIdea') as HTMLTextAreaElement).value).toBe('Esdras: el regreso y la reconstrucción por la palabra.');
        fireEvent.click(screen.getByRole('button', { name: /framing\.dialog\.save/ }));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync.mock.calls[0]![0]).toMatchObject({ projectId: 'ezr', bibleBooks: ['EZR'], framingPatch: { centralIdea: 'Esdras: el regreso y la reconstrucción por la palabra.' } });
        await waitFor(() => expect(screen.queryByTestId('framing-old-note')).toBeNull());
    });

    it('la nota del material: su texto sale de la caché del panel', () => {
        salidas.outputs = [{ id: 'o1', kind: 'note', title: 'Notas', content: 'Mi lectura de Esdras.', updatedAt: new Date(2026, 9, 2) }];
        montar(esdras(), { outputs: [{ id: 'o1', kind: 'note', title: 'Notas', updatedAt: new Date(2026, 9, 2) }] });
        expect(within(screen.getByTestId('desk-old-note')).getByText('Mi lectura de Esdras.')).toBeInTheDocument();
    });

    it('la nota nunca pisa una idea escrita, y se recorta al tope del campo', () => {
        const base = formFromProject({ framing: { centralIdea: 'Mía.' }, bibliographyCriteria: { bibleBooks: ['EZR'] } } as never);
        expect(formWithNote(base, 'Nota')).toEqual({ form: base, placed: false, truncated: false });
        const vacia = formFromProject({ bibliographyCriteria: { bibleBooks: ['EZR'] } } as never);
        expect(formWithNote(vacia, '  Nota  ').form.centralIdea).toBe('Nota');
        const larga = formWithNote(vacia, 'x'.repeat(2100));
        expect(larga).toMatchObject({ placed: true, truncated: true });
        expect(larga.form.centralIdea).toHaveLength(2000);
        expect(formWithNote(vacia, '   ').placed).toBe(false);
    });
});

describe('fase 2 · fuentes', () => {
    it('sin fichas y con la fase 1 por hacer: una línea, sin acción (el vacío completo es de la fase activa)', () => {
        montar(esdras());
        const seccion = document.getElementById('fase-sources')!;
        expect(seccion.hasAttribute('data-later-phase')).toBe(true);
        expect(seccion.textContent).toContain('later.sources');
        expect(within(seccion).queryByRole('link')).toBeNull();
        expect(within(seccion).queryByRole('button')).toBeNull();
        // El recorrido sigue pudiendo saltar aquí: el título es enfocable.
        expect(seccion.querySelector('[data-desk-heading]')).not.toBeNull();
    });

    it('sin fichas, siendo la fase activa: el vacío lleva al estado del arte, sin atajo', () => {
        montar(esdras({ framing: { centralIdea: 'Dios restaura a su pueblo.' } }));
        const s = within(document.getElementById('fase-sources')!);
        expect(s.getByText('sources.emptyTitle')).toBeInTheDocument();
        expect(s.getByRole('link', { name: 'sources.choose' }).getAttribute('href')).toBe('/dashboard/projects/ezr/estado-del-arte');
        expect(s.queryByText(/adjuntar/i)).toBeNull();
    });

    it('con fichas: el resumen, las de antes aparte y la nota de «por conseguir»', () => {
        montar(esdras({
            bibliography: [
                { id: 'a', title: 'A', resourceId: 'ra', weight: 'recommended', decision: 'approved', origins: ['catalog'] },
                { id: 'b', title: 'B', resourceId: null, weight: 'recommended', decision: 'approved', origins: ['syllabus'] },
                { id: 'c', title: 'C', resourceId: 'rc', weight: 'recommended', decision: 'approved', origins: ['selector'] },
                { id: 'd', title: 'D', resourceId: 'rd', weight: 'complementary', decision: 'candidate', origins: ['library'] },
            ],
        }));
        const s = within(document.getElementById('fase-sources')!);
        expect(s.getByTestId('desk-sources-summary').textContent).toBe('sources.approved:{"count":3} · sources.toAcquire:{"count":1} · sources.candidates:{"count":1}');
        expect(s.getByTestId('desk-sources-manual').textContent).toBe('sources.manual:{"count":1}');
        expect(s.getByText('sources.toAcquireNote')).toBeInTheDocument();
        expect(s.getByRole('link', { name: /sources\.open/ }).getAttribute('href')).toBe('/dashboard/projects/ezr/estado-del-arte');
    });
});

describe('fases 3 y 4 · la mesa de perícopas', () => {
    const conSerie = (over: Record<string, unknown> = {}) => ({
        studies: [
            estudio('e1', 'assembled'),
            estudio('e2', 'in-progress', { updatedAt: new Date(2026, 9, 20) }),
            estudio('e3', 'assembled'),
            estudio('e9', 'configuring', { seriesId: null }),
        ],
        series: [serie],
        sermons: sermones,
        ...over,
    }) as Partial<ProjectDeskInput>;
    const anotada = esdras({ framing: { centralIdea: 'Dios restaura.', hypothesisLog: [{ id: 'h1', at: '2026-10-20T00:00:00.000Z', source: 'study', studyId: 'e1', verdict: 'confirms', note: 'sí' }] } });

    it('sin serie y antes de su turno: una línea «Fases 3 y 4 · por empezar», sin acción', () => {
        montar(esdras());
        const mesa = document.getElementById('fase-pericopes')!;
        expect(mesa.hasAttribute('data-later-phase')).toBe(true);
        expect(mesa.textContent).toContain('later.division');
        expect(within(mesa).queryByRole('button')).toBeNull();
        // La fase 3 sigue saltando aquí.
        expect(document.getElementById('fase-division')!.contains(mesa)).toBe(true);
    });

    it('sin serie, siendo la fase activa: la invitación a planificar la serie lleva al planificador con el libro', () => {
        montar(listo);
        const mesa = within(document.getElementById('fase-pericopes')!);
        expect(mesa.getByText('table.noSeriesTitle')).toBeInTheDocument();
        fireEvent.click(mesa.getByRole('button', { name: 'table.planSeries' }));
        expect(screen.getByTestId('donde').textContent).toBe('/dashboard/plans/pericope?projectId=ezr&book=EZR|');
    });

    it('con serie: una fila por perícopa con su estudio, tu lectura y su sermón', () => {
        montar(anotada, conSerie(), { sermons: sermones });
        const grupo = screen.getByTestId('desk-table-group');
        const filas = within(grupo).getAllByTestId('desk-table-row');
        expect(filas).toHaveLength(4);
        expect(filas[0]!.textContent).toContain('table.study.assembled');
        expect(filas[0]!.textContent).toContain('table.reading.annotated');
        expect(filas[1]!.textContent).toContain('table.study.inProgress:{"done":3,"total":8}');
        expect(filas[2]!.textContent).toContain('table.reading.pending');
        expect(filas[3]!.textContent).toContain('table.study.none');
        // El sermón publicado como copia abre la copia.
        expect(within(filas[0]!).getByRole('link', { name: 'table.sermon.published' }).getAttribute('href')).toBe('/dashboard/sermons/c1');
        // El estudio fuera de la serie va aparte.
        expect(within(screen.getByTestId('desk-table-loose')).getAllByTestId('desk-table-row')).toHaveLength(1);
        expect(screen.getByText('table.looseTitle')).toBeInTheDocument();
    });

    it('el enlace al estudio vuelve al proyecto (`from`)', () => {
        montar(anotada, conSerie());
        const fila = screen.getAllByTestId('desk-table-row')[1]!;
        fireEvent.click(within(fila).getByRole('link', { name: /table\.study\.open/ }));
        expect(screen.getByTestId('donde').textContent).toBe('/dashboard/exegesis/e2?from=%2Fdashboard%2Fprojects%2Fezr|');
    });

    it('«Anotar» abre el registro con ESE estudio elegido; guardar agrega la anotación', async () => {
        montar(anotada, conSerie());
        const fila = screen.getAllByTestId('desk-table-row')[2]!;
        fireEvent.click(within(fila).getByRole('button', { name: /table\.reading\.annotateLabel/ }));
        const dialogo = screen.getByRole('dialog');
        expect((within(dialogo).getByRole('combobox') as HTMLSelectElement).value).toBe('e3');
        fireEvent.click(within(dialogo).getByLabelText('framing.hypothesisVerdict.nuances'));
        fireEvent.click(within(dialogo).getByRole('button', { name: /framing\.annotate\.save/ }));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync.mock.calls[0]![0]).toEqual({ projectId: 'ezr', hypothesisEntry: { source: 'study', studyId: 'e3', verdict: 'nuances', note: '' } });
    });

    it('«Pendientes» deja lo que falta estudiar o anotar, y se recuerda', () => {
        montar(anotada, conSerie());
        fireEvent.click(screen.getByRole('button', { name: 'table.filter.pending' }));
        expect(screen.getByRole('button', { name: 'table.filter.pending' }).getAttribute('aria-pressed')).toBe('true');
        const grupo = screen.getByTestId('desk-table-group');
        // e1 (ensamblado y anotado) sale; e2, e3 y la perícopa sin estudio quedan.
        expect(within(grupo).getAllByTestId('desk-table-row')).toHaveLength(3);
        expect(window.localStorage.getItem('desk.exegetical.tableFilter.ezr')).toBe('pending');
        cleanup();
        montar(anotada, conSerie());
        expect(within(screen.getByTestId('desk-table-group')).getAllByTestId('desk-table-row')).toHaveLength(3);
    });

    it('el filtro se recuerda POR PROYECTO: otro proyecto abre con todas las filas', () => {
        window.localStorage.setItem('desk.exegetical.tableFilter.otro', 'pending');
        montar(anotada, conSerie());
        expect(screen.getByRole('button', { name: 'table.filter.all' }).getAttribute('aria-pressed')).toBe('true');
        expect(within(screen.getByTestId('desk-table-group')).getAllByTestId('desk-table-row')).toHaveLength(4);
    });

    it('si los sermones fallaron, la columna dice «—» (no «sin sermón») y se avisa', () => {
        const d = desk({ project: anotada as never, ...conSerie() });
        render(
            <MemoryRouter>
                <ExegeticalDeskSections project={anotada as never} desk={d} onOpenFraming={vi.fn()} sermonsFailed />
            </MemoryRouter>,
        );
        const filas = within(screen.getByTestId('desk-table-group')).getAllByTestId('desk-table-row');
        expect(filas[0]!.textContent).not.toContain('table.sermon.');
        expect(screen.getByText('table.sermonsError')).toBeInTheDocument();
    });

    it('la regla de «pendiente»', () => {
        const fila = (state: string, reading: string) => ({ study: { id: 'x', state, accepted: 0, total: 0 }, reading }) as never;
        expect(isPendingRow(fila('assembled', 'annotated'))).toBe(false);
        expect(isPendingRow(fila('assembled', 'pending'))).toBe(true);
        expect(isPendingRow(fila('inProgress', 'none'))).toBe(true);
        expect(isPendingRow(fila('none', 'none'))).toBe(true);
    });

    it('los estados de las fases 3 y 4 con su evidencia', () => {
        montar(anotada, conSerie());
        const estados = screen.getByTestId('desk-table-phases');
        expect(estados.textContent).toContain('table.phase.division');
        expect(estados.textContent).toContain('desk.exegetical.division.readySeries');
        expect(estados.textContent).toContain('desk.exegetical.pericopes.progress');
        // Con serie: otra serie y un estudio fuera de ella.
        expect(screen.getByRole('button', { name: /table\.planAnother/ })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /table\.addOutside/ }));
        expect(screen.getByTestId('donde').textContent).toBe('/dashboard/exegesis/new?projectId=ezr|');
    });
});

describe('fase 5 · síntesis', () => {
    it('cerrada hasta la primera anotación; antes de su turno, una línea sin acción', () => {
        montar(esdras({ framing: { centralIdea: 'Dios restaura.' } }), { studies: [estudio('e1', 'assembled')] });
        const linea = document.getElementById('fase-synthesis')!;
        expect(linea.hasAttribute('data-later-phase')).toBe(true);
        expect(linea.textContent).toContain('later.synthesis');
        expect(within(linea).queryByRole('button')).toBeNull();
    });

    it('cerrada y siendo la fase activa: el vacío completo, con «Anotar un estudio»', () => {
        montar(
            { ...listo, framing: { centralIdea: 'Dios restaura.', purpose: 'teach', divisionWithoutSeries: true } },
            { studies: [estudio('e1', 'assembled')] },
        );
        const s = within(document.getElementById('fase-synthesis')!);
        expect(s.getByText('synthesis.emptyTitle')).toBeInTheDocument();
        expect(s.getByRole('button', { name: /synthesis\.annotate/ })).toBeInTheDocument();
        expect(s.queryByRole('button', { name: /synthesis\.history/ })).toBeNull();
    });

    it('abierta: el registro resumido, las últimas, revisar y ver cómo cambió', async () => {
        const log = [
            { id: 'h1', at: '2026-10-10T00:00:00.000Z', source: 'study', studyId: 'e1', verdict: 'confirms', note: 'primera' },
            { id: 'h2', at: '2026-10-12T00:00:00.000Z', source: 'study', studyId: 'e1', verdict: 'confirms', note: 'segunda' },
            { id: 'h3', at: '2026-10-14T00:00:00.000Z', source: 'panorama', verdict: 'nuances', note: 'tercera' },
            { id: 'h4', at: '2026-10-16T00:00:00.000Z', source: 'study', studyId: 'e1', verdict: 'contradicts', note: 'cuarta' },
        ];
        montar(esdras({ framing: { centralIdea: 'Dios restaura.', hypothesisLog: log } }), { studies: [estudio('e1', 'assembled')] });
        const s = within(document.getElementById('fase-synthesis')!);
        expect(s.getByTestId('desk-synthesis-counts').textContent).toBe('synthesis.confirms:{"count":2} · synthesis.nuances:{"count":1} · synthesis.contradicts:{"count":1}');
        // Las tres últimas, la más nueva primero.
        const entradas = within(s.getByTestId('framing-log')).getAllByRole('listitem').map(li => li.textContent);
        expect(entradas).toHaveLength(3);
        expect(entradas[0]).toContain('cuarta');
        expect(entradas[2]).toContain('segunda');
        expect(s.getByRole('button', { name: /synthesis\.seeAll/ })).toBeInTheDocument();

        // Revisar la idea: el caso de uso fija la idea guardada.
        fireEvent.click(s.getByRole('button', { name: /synthesis\.revise$/ }));
        const revisar = screen.getByRole('dialog');
        fireEvent.change(within(revisar).getAllByRole('textbox')[0]!, { target: { value: 'Dios restaura por su palabra.' } });
        fireEvent.click(within(revisar).getByLabelText('framing.revisionVerdict.nuanced'));
        fireEvent.click(within(revisar).getByRole('button', { name: /framing\.consolidate\.save/ }));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync.mock.calls[0]![0].framingPatch.revision).toMatchObject({ centralIdea: 'Dios restaura por su palabra.', verdict: 'nuanced', ofIdea: 'Dios restaura.' });
    });

    it('«Ver cómo cambió tu lectura»: original → registro en orden → revisada, solo lo del pastor', () => {
        const log = [
            { id: 'h1', at: '2026-10-10T00:00:00.000Z', source: 'study', studyId: 'e1', verdict: 'confirms', note: 'primera' },
            { id: 'h2', at: '2026-10-12T00:00:00.000Z', source: 'study', studyId: 'e1', verdict: 'nuances', note: 'segunda' },
        ];
        montar(esdras({
            framing: {
                centralIdea: 'Dios restaura.', hypothesisLog: log,
                revision: { centralIdea: 'Dios restaura por su palabra.', verdict: 'nuanced', why: 'por Esd 7', ofIdea: 'Dios restaura.', revisedAt: '2026-10-21T00:00:00.000Z' },
            },
        }), { studies: [estudio('e1', 'assembled')] });
        expect(screen.getByTestId('desk-revised-idea').textContent).toContain('Dios restaura por su palabra.');
        fireEvent.click(screen.getByRole('button', { name: /synthesis\.history/ }));
        const h = within(screen.getByTestId('reading-history'));
        expect(h.getByTestId('history-original').textContent).toBe('Dios restaura.');
        const entradas = within(h.getByTestId('framing-log')).getAllByRole('listitem').map(li => li.textContent);
        expect(entradas[0]).toContain('primera');
        expect(entradas[1]).toContain('segunda');
        expect(h.getByTestId('history-revised').textContent).toContain('por Esd 7');
    });

    it('sin idea original no se ofrece revisar: se dice por qué', () => {
        montar(esdras({ framing: { hypothesisLog: [{ id: 'h1', at: '2026-10-10T00:00:00.000Z', source: 'study', studyId: 'e1', verdict: 'confirms', note: '' }] } }), { studies: [estudio('e1', 'assembled')] });
        expect(screen.getByTestId('desk-needs-idea')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /synthesis\.revise$/ })).toBeNull();
    });

    it('una revisión vieja avisa y ofrece volver a revisar', () => {
        montar(esdras({
            framing: {
                centralIdea: 'Otra idea.',
                hypothesisLog: [{ id: 'h1', at: '2026-10-10T00:00:00.000Z', source: 'study', studyId: 'e1', verdict: 'confirms', note: '' }],
                revision: { centralIdea: 'R', verdict: 'confirmed', why: '', ofIdea: 'Dios restaura.', revisedAt: '2026-10-21T00:00:00.000Z' },
            },
        }), { studies: [estudio('e1', 'assembled')] });
        expect(screen.getByText('synthesis.stale')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /synthesis\.reviseAgain/ })).toBeInTheDocument();
        expect(screen.queryByTestId('desk-revised-idea')).toBeNull();
    });
});
