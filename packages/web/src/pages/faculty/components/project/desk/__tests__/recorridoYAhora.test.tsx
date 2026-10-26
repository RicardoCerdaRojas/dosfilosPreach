import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { buildProjectDesk } from '@dosfilos/domain';
import {
    NOW, NOW_CURSO, esdrasAMedias, esdrasRecienCreado, esdrasEnSintesis, nt785, study,
} from '@dosfilos/domain/exegesis/services/__tests__/projectDesk.fixtures';

/**
 * El recorrido del escritorio y «Ahora» (W2-A, `docs/FASE_ESCRITORIO_PROYECTO_2026-10.md` §3.1):
 * las fases navegan (no crean), «Ahora» es el único botón lleno, lo que
 * falta del método va como enlace, y el andamiaje de la fase activa va
 * abierto, se pliega y el pliegue se recuerda.
 */
vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        // La clave y sus valores, para ver qué se tradujo y con qué.
        t: (k: string, p?: Record<string, unknown>) => (p && Object.keys(p).length ? `${k}|${JSON.stringify(p)}` : k),
        i18n: { language: 'es' },
    }),
}));

const { DeskJourney } = await import('../DeskJourney');
const { DeskSection, deskSectionId, formatDeskDay, useDeskText } = await import('../primitives');

beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
});

const montar = (desk: ReturnType<typeof buildProjectDesk>, extra: { onNow?: () => void; onNote?: () => void } = {}) => {
    const onNow = extra.onNow ?? vi.fn();
    const onNote = extra.onNote ?? vi.fn();
    const r = render(
        <>
            <DeskJourney desk={desk} onNow={onNow} onNote={onNote} />
            {desk.phases.map((p, i) => (
                <DeskSection key={p.id} id={deskSectionId(p.id)} phase={i + 1} title={`titulo-${p.id}`}>cuerpo</DeskSection>
            ))}
        </>,
    );
    return { ...r, onNow, onNote };
};

describe('las fases del recorrido', () => {
    it('Esdras recién creado: cinco fases con su nombre y estado; la activa es la fase 1 (la nota vieja no la completa)', () => {
        const desk = buildProjectDesk(esdrasRecienCreado(), NOW);
        montar(desk);
        const fases = within(screen.getByTestId('desk-journey')).getAllByRole('listitem');
        expect(fases).toHaveLength(5);
        const activa = screen.getByRole('button', { current: 'step' });
        expect(activa.getAttribute('aria-label')).toContain('desk.journey.phases.exegetical.passage.name');
        expect(activa.getAttribute('data-phase-status')).toBe('doing');
    });

    it('tocar una fase lleva a su sección y le pasa el foco al título: no crea nada', () => {
        const desk = buildProjectDesk(esdrasAMedias(), NOW);
        const scroll = vi.fn();
        Element.prototype.scrollIntoView = scroll;
        const { onNow, onNote } = montar(desk);
        const division = screen.getAllByRole('button').find(b => b.getAttribute('aria-label')?.includes('phases.exegetical.division.name'))!;
        fireEvent.click(division);
        expect(scroll).toHaveBeenCalledTimes(1);
        expect(document.activeElement?.textContent).toBe('titulo-division');
        expect(onNow).not.toHaveBeenCalled();
        expect(onNote).not.toHaveBeenCalled();
    });

    it('una fase lista dice «lista» (verde reservado) y las demás no', () => {
        const desk = buildProjectDesk(esdrasEnSintesis(), NOW);
        montar(desk);
        const estados = screen.getAllByRole('button').map(b => b.getAttribute('data-phase-status')).filter(Boolean);
        expect(estados.every(e => e === 'ready')).toBe(true);
        // Todas listas: no hay «Ahora» que empujar ni andamiaje.
        expect(screen.getByText('desk.journey.allReady')).toBeInTheDocument();
        expect(screen.queryByTestId('desk-scaffold')).toBeNull();
    });
});

describe('«Ahora»', () => {
    it('Exegético a medias: la continuidad (la perícopa 5 en análisis) gana sobre el método, en el único botón lleno', () => {
        const desk = buildProjectDesk(esdrasAMedias(), NOW);
        const { onNow } = montar(desk);
        const ahora = screen.getByTestId('desk-now');
        expect(ahora.textContent).toContain('desk.now.continuePericope');
        expect(ahora.textContent).toContain('desk.journey.kind.continuity');
        const boton = within(ahora).getByRole('button');
        expect(boton.textContent).toContain('desk.journey.action.study');
        fireEvent.click(boton);
        expect(onNow).toHaveBeenCalledWith(expect.objectContaining({ kind: 'continuity', target: expect.objectContaining({ type: 'study', id: 's5' }) }));
        // Es el único botón lleno: el resto son contornos o enlaces.
        const llenos = screen.getAllByRole('button').filter(b => b.className.includes('bg-primary-solid'));
        expect(llenos).toEqual([boton]);
    });

    it('Curso: el plazo gobierna; la fecha se dice como día, no como YYYY-MM-DD', () => {
        const desk = buildProjectDesk(nt785(), NOW_CURSO);
        montar(desk);
        const ahora = screen.getByTestId('desk-now');
        expect(ahora.textContent).toContain('desk.now.deadline.continue');
        expect(ahora.textContent).toContain('desk.journey.kind.deadline');
        expect(ahora.textContent).not.toContain('2026-10-28');
        expect(ahora.textContent).toMatch(/mi[eé]/i);
    });

    it('un trabajo ensamblado que vence pronto se ofrece como «Revisar antes de entregar»', () => {
        const input = nt785();
        input.studies = input.studies.map(s => (s.id === 's9' ? { ...s, phase: 'assembled', acceptedStepCount: 8 } : s));
        const desk = buildProjectDesk(input, NOW_CURSO);
        montar(desk);
        expect(within(screen.getByTestId('desk-now')).getByRole('button').textContent).toContain('desk.journey.action.review');
    });

    it('con la nota de antes, «Ahora» lleva a la nota (que se pasa al encuadre en su sección), no al formulario vacío', () => {
        const desk = buildProjectDesk(esdrasRecienCreado(), NOW);
        montar(desk);
        expect(within(screen.getByTestId('desk-now')).getByRole('button').textContent).toContain('desk.journey.action.oldNote');
    });

    it('General: sin fases, solo «Ahora» con lo último que se tocó', () => {
        const desk = buildProjectDesk({ project: { id: 'g', type: 'general' }, studies: [study('x', { title: 'Romanos 8', updatedAt: '2026-10-20T10:00:00.000Z' })] }, NOW);
        montar(desk);
        expect(screen.getByText('desk.journey.nowOnlyLabel')).toBeInTheDocument();
        expect(screen.queryByRole('listitem')).toBeNull();
        expect(screen.getByTestId('desk-now').textContent).toContain('desk.now.recentStudy');
    });

    it('General sin nada tocado: no dibuja nada', () => {
        const desk = buildProjectDesk({ project: { id: 'g', type: 'general' }, studies: [] }, NOW);
        const { container } = render(<DeskJourney desk={desk} onNow={vi.fn()} onNote={vi.fn()} />);
        expect(container.innerHTML).toBe('');
    });
});

describe('lo que falta del método', () => {
    it('va como enlaces secundarios con su fase, y llevan a su destino', () => {
        const desk = buildProjectDesk(nt785(), NOW_CURSO);
        const { onNote } = montar(desk);
        expect(desk.notes.length).toBeGreaterThan(0);
        const nota = screen.getAllByRole('button').find(b => b.textContent?.includes('desk.notes.requiredToAcquire'))!;
        expect(nota.className).not.toContain('bg-primary-solid');
        expect(nota.textContent).toContain('desk.journey.phaseLabel');
        fireEvent.click(nota);
        expect(onNote).toHaveBeenCalledWith(expect.objectContaining({ phaseId: 'sources' }));
    });
});

describe('el andamiaje de la fase activa', () => {
    it('va abierto con para qué · bien hecha · error común; plegado, se recuerda', () => {
        const desk = buildProjectDesk(esdrasRecienCreado(), NOW);
        montar(desk);
        const andamio = screen.getByTestId('desk-scaffold');
        const boton = within(andamio).getByRole('button');
        expect(boton.getAttribute('aria-expanded')).toBe('true');
        for (const parte of ['purpose', 'wellDone', 'commonError']) {
            expect(within(andamio).getByText(`desk.journey.phases.exegetical.passage.${parte}`)).toBeInTheDocument();
        }
        // `aria-controls` apunta a un cuerpo que existe, abierto o plegado.
        const cuerpo = document.getElementById(boton.getAttribute('aria-controls')!)!;
        expect(cuerpo).not.toBeNull();
        expect(cuerpo.hidden).toBe(false);
        fireEvent.click(boton);
        expect(boton.getAttribute('aria-expanded')).toBe('false');
        expect(document.getElementById(boton.getAttribute('aria-controls')!)).toBe(cuerpo);
        expect(cuerpo.hidden).toBe(true);

        // Otra visita: sigue plegado.
        cleanup();
        montar(desk);
        expect(within(screen.getByTestId('desk-scaffold')).getByRole('button').getAttribute('aria-expanded')).toBe('false');
    });

    it('si el almacenamiento falla, va abierto y plegar no rompe', () => {
        const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('privado'); });
        const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('privado'); });
        const desk = buildProjectDesk(esdrasRecienCreado(), NOW);
        montar(desk);
        const boton = within(screen.getByTestId('desk-scaffold')).getByRole('button');
        expect(boton.getAttribute('aria-expanded')).toBe('true');
        fireEvent.click(boton);
        expect(boton.getAttribute('aria-expanded')).toBe('false');
        get.mockRestore();
        set.mockRestore();
    });
});

describe('las fechas de los textos del modelo', () => {
    it('`dueDate` llega como YYYY-MM-DD y se dice como día, sin correrse por UTC', () => {
        const { result } = renderHook(() => useDeskText());
        const texto = result.current({ key: 'desk.notes.overdue', params: { label: 'TP #8', dueDate: '2026-10-21' } });
        expect(texto).not.toContain('2026-10-21');
        expect(texto).toContain(formatDeskDay('2026-10-21', 'es'));
        // El 21 de octubre de 2026 es miércoles, en cualquier zona horaria.
        expect(formatDeskDay('2026-10-21', 'es')).toMatch(/mi[eé].*21/i);
        expect(formatDeskDay('no es fecha', 'es')).toBe('no es fecha');
    });
});
