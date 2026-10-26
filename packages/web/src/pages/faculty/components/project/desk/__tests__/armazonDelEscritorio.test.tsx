import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render, renderHook, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { buildProjectDesk, type ProjectDeskModel } from '@dosfilos/domain';
import { NOW, esdrasEnSintesis, esdrasRecienCreado } from '@dosfilos/domain/exegesis/services/__tests__/projectDesk.fixtures';

/**
 * El armazón del escritorio (ronda de arreglos FX-4): «Ahora» primero en el
 * teléfono y con encabezado, el cierre propio del Curso, la fase posterior en
 * una línea, la fase que todavía carga, las herramientas con nombre
 * accesible, el material con su estado de carga y la hora que avanza sola.
 */
vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (k: string, p?: Record<string, unknown>) => (p && Object.keys(p).length ? `${k}|${JSON.stringify(p)}` : k),
        i18n: { language: 'es' },
    }),
}));
vi.mock('../../../../utils/exportMarkdown', () => ({ exportOutputMarkdown: vi.fn() }));

const { DeskJourney } = await import('../DeskJourney');
const { DeskTools } = await import('../DeskTools');
const { LaterPhase, PhaseStep, StatusChip, isLaterEmptyPhase, FOCUS_RING } = await import('../primitives');
const { useDeskClock, DESK_CLOCK_MS } = await import('../../../../hooks/useDeskClock');

beforeEach(() => {
    cleanup();
    window.localStorage.clear();
});

describe('«Ahora»', () => {
    it('va primero en el teléfono (`order-first`, y en su lugar en pantalla ancha) y tiene su encabezado', () => {
        render(<DeskJourney desk={buildProjectDesk(esdrasRecienCreado(), NOW)} onNow={vi.fn()} onNote={vi.fn()} />);
        const ahora = screen.getByTestId('desk-now');
        expect(ahora.className).toMatch(/(^|\s)order-first(\s|$)/);
        expect(ahora.className).toMatch(/md:order-none/);
        expect(ahora.tagName).toBe('SECTION');
        const titulo = document.getElementById(ahora.getAttribute('aria-labelledby')!)!;
        expect(titulo.tagName).toBe('H3');
        expect(titulo.textContent).toContain('desk.journey.nowLabel');
    });

    it('un rótulo largo pasa a otra línea en el teléfono: el botón no lleva alto fijo ni `nowrap` allí', () => {
        render(<DeskJourney desk={buildProjectDesk(esdrasRecienCreado(), NOW)} onNow={vi.fn()} onNote={vi.fn()} />);
        const boton = within(screen.getByTestId('desk-now')).getByRole('button');
        expect(boton.className).toContain('whitespace-normal');
        expect(boton.className).toContain('h-auto');
    });

    it('todo listo: el Exegético y el Curso dicen cada uno su cierre', () => {
        render(<DeskJourney desk={buildProjectDesk(esdrasEnSintesis(), NOW)} onNow={vi.fn()} onNote={vi.fn()} />);
        expect(screen.getByText('desk.journey.allReady')).toBeInTheDocument();
        cleanup();
        const curso = {
            type: 'course', phases: [{ id: 'charge', status: 'ready', evidence: { key: 'desk.course.charge.ready' } }],
            activePhaseId: null, now: null, notes: [],
        } as unknown as ProjectDeskModel;
        render(<DeskJourney desk={curso} onNow={vi.fn()} onNote={vi.fn()} />);
        expect(screen.getByText('desk.journey.allReadyCourse')).toBeInTheDocument();
        expect(screen.queryByText('desk.journey.allReady')).toBeNull();
    });

    it('la nota de la fase 1 sin tu lectura se destaca entre las demás', () => {
        const desk = {
            type: 'exegetical', phases: [{ id: 'passage', status: 'todo', evidence: { key: 'x' } }], activePhaseId: 'passage',
            now: { kind: 'continuity', text: { key: 'desk.now.continue' }, target: { type: 'study', id: 'e1' } },
            notes: [
                { text: { key: 'desk.notes.phase.passage' }, target: { type: 'framing' }, phaseId: 'passage' },
                { text: { key: 'desk.notes.revisionStale' }, target: { type: 'reviseIdea' }, phaseId: 'synthesis' },
            ],
        } as unknown as ProjectDeskModel;
        render(<DeskJourney desk={desk} onNow={vi.fn()} onNote={vi.fn()} />);
        expect(screen.getByText('desk.notes.phase.passage').closest('button')!.className).toContain('font-medium');
        expect(screen.getByText('desk.notes.revisionStale').closest('button')!.className).not.toContain('font-medium');
    });
});

describe('la fase posterior a la activa', () => {
    const fases = [
        { id: 'passage', status: 'doing' as const },
        { id: 'sources', status: 'todo' as const },
        { id: 'division', status: 'ready' as const },
        { id: 'pericopes', status: 'doing' as const },
    ];
    it('solo la posterior y por empezar va en una línea; la activa y la que ya tiene algo, no', () => {
        expect(isLaterEmptyPhase(fases, 'passage', 'sources')).toBe(true);
        expect(isLaterEmptyPhase(fases, 'passage', 'passage')).toBe(false);
        expect(isLaterEmptyPhase(fases, 'passage', 'division')).toBe(false);
        // Posterior pero ya en curso (un estudio empezado fuera de orden): se muestra entera.
        expect(isLaterEmptyPhase(fases, 'passage', 'pericopes')).toBe(false);
        expect(isLaterEmptyPhase(fases, 'sources', 'sources')).toBe(false);
        // Sin fase activa (todo listo) o con una fase que el tipo no tiene: nada se reduce.
        expect(isLaterEmptyPhase(fases, null, 'sources')).toBe(false);
        expect(isLaterEmptyPhase(fases, 'passage', 'otra')).toBe(false);
    });

    it('la línea dice la fase, «por empezar» y cuándo se abre, sin acción, y conserva el ancla enfocable', () => {
        render(<LaterPhase id="fase-x" eyebrow="Fase 3" title="División" reason="se abre cuando…" />);
        const seccion = document.getElementById('fase-x')!;
        expect(seccion.textContent).toContain('desk.journey.laterLine');
        expect(seccion.textContent).toContain('se abre cuando…');
        expect(within(seccion).queryByRole('button')).toBeNull();
        expect(seccion.querySelector('[data-desk-heading]')!.getAttribute('tabindex')).toBe('-1');
    });
});

describe('una fase que todavía carga (`DeskPhase.loading`)', () => {
    it('dice «cargando», no «en curso», en el recorrido y en su sección', () => {
        render(<PhaseStep number={1} name="Lo que pide el curso" status="doing" loading onClick={vi.fn()} />);
        const paso = screen.getByRole('button');
        expect(paso.getAttribute('data-phase-status')).toBe('loading');
        expect(paso.getAttribute('aria-label')).toContain('desk.journey.status.loading');
        cleanup();
        render(<StatusChip status="doing" loading />);
        expect(screen.getByText('desk.journey.status.loading')).toBeInTheDocument();
        expect(screen.queryByText('desk.journey.status.doing')).toBeNull();
    });
});

describe('el foco', () => {
    it('el anillo usa el token `--focus` (≥ 3:1 en todos los temas), no `ring-primary/40`', () => {
        expect(FOCUS_RING).toContain('focus-visible:ring-focus');
        expect(FOCUS_RING).not.toContain('ring-primary/40');
        const config = readFileSync(resolve(__dirname, '../../../../../../../tailwind.config.cjs'), 'utf8');
        expect(config).toContain("focus: 'hsl(var(--focus))'");
        expect(config).toContain("solid: 'hsl(var(--destructive-solid))'");
    });

    it('el botón destructivo del panel usa el rojo sólido con AA, y el hover oscurece', () => {
        const panel = readFileSync(resolve(__dirname, '../../../../ProjectDashboard.tsx'), 'utf8');
        expect(panel).toContain('bg-destructive-solid text-destructive-foreground hover:bg-destructive-solid-hover');
        expect(panel).not.toContain('hover:bg-destructive/90');
    });
});

describe('herramientas y material', () => {
    const herramientas = (over: Record<string, unknown> = {}) => render(
        <MemoryRouter>
            <DeskTools
                projectId="ezr"
                languages={['hebrew', 'aramaic']}
                conversations={[{ id: 'c1' }]}
                greek={{ sessions: [], canLink: false, onLink: vi.fn() }}
                hebrew={{ sessions: [{ id: 'h 1' }, { id: 'h2', passage: 'Esd 4:8' }], canLink: false, onLink: vi.fn() }}
                material={{ items: [], isLoading: false, onCreate: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() }}
                onNavigate={vi.fn()}
                {...over}
            />
        </MemoryRouter>,
    );

    it('una sesión sin título ni pasaje igual tiene nombre accesible, y la de hebreo lleva su id', () => {
        herramientas();
        const enlaces = screen.getAllByRole('link');
        for (const a of enlaces) expect(a.getAttribute('aria-label')).toMatch(/desk\.tools\.openSession/);
        const sinNombre = enlaces.find(a => a.getAttribute('href')?.includes('hebrew-tutor') && a.textContent === 'desk.tools.untitledSession')!;
        expect(sinNombre.getAttribute('href')).toBe('/dashboard/hebrew-tutor?sessionId=h%201&projectId=ezr');
        expect(sinNombre.getAttribute('aria-label')).toContain('"label":"desk.tools.untitledSession"');
        const conversacion = enlaces.find(a => a.getAttribute('href') === '/dashboard/faculty/c1')!;
        expect(conversacion.textContent).toBe('desk.tools.untitledSession');
    });

    it('en el Curso, las lenguas se usan «dentro de cada trabajo»', () => {
        herramientas({ workNoun: 'work' });
        expect(screen.getByText('desk.tools.descriptionCourse')).toBeInTheDocument();
        cleanup();
        herramientas();
        expect(screen.getByText('desk.tools.description')).toBeInTheDocument();
    });

    it('el material es una sección del escritorio y, mientras carga, lo anuncia (`role="status"`)', () => {
        herramientas({ material: { items: [], isLoading: true, onCreate: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() } });
        const material = screen.getByTestId('desk-material');
        expect(material.id).toBe('material');
        expect(material.querySelector('h2[data-desk-heading]')!.textContent).toContain('material.sectionLabel');
        expect(within(material).getByRole('status').getAttribute('aria-label')).toBe('material.loading');
        expect(within(material).queryByText('material.empty')).toBeNull();
    });
});

describe('la hora del escritorio', () => {
    afterEach(() => { vi.useRealTimers(); });

    it('avanza sola cada minuto (plazos de 72 h y la medianoche sin recargar) y se detiene al desmontar', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 9, 26, 23, 59, 30));
        const { result, unmount } = renderHook(() => useDeskClock());
        expect(result.current.getDate()).toBe(26);
        act(() => { vi.advanceTimersByTime(DESK_CLOCK_MS); });
        expect(result.current.getDate()).toBe(27);
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });
});
