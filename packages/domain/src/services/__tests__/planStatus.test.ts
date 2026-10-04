import { describe, it, expect } from 'vitest';

import { calendarDay, nextByCalendar, nextInPlan, pickCurrentPlan, planStatus, type PlanItemState } from '../planStatus';

const item = (week: number, opts: Partial<PlanItemState> = {}): PlanItemState => ({
    week,
    ready: opts.ready ?? true,
    preached: opts.preached ?? false,
    scheduledDate: opts.scheduledDate,
});

const NOW = new Date('2026-08-29T12:00:00Z');

describe('planStatus', () => {
    it('sin sermones, el plan está vacío', () => {
        expect(planStatus([], NOW)).toBe('empty');
    });

    it('con todos predicados, terminado', () => {
        expect(planStatus([item(1, { preached: true }), item(2, { preached: true })], NOW)).toBe(
            'finished',
        );
    });

    it('con uno predicado, activo — aunque falten los demás', () => {
        expect(planStatus([item(1, { preached: true }), item(2)], NOW)).toBe('active');
    });

    it('sin nada predicado pero con una fecha ya pasada, activo', () => {
        expect(planStatus([item(1, { scheduledDate: new Date('2026-08-23') })], NOW)).toBe('active');
    });

    it('sin nada predicado y con todas las fechas por delante, por empezar', () => {
        expect(planStatus([item(1, { scheduledDate: new Date('2026-09-06') })], NOW)).toBe(
            'upcoming',
        );
    });

    it('sin fechas y sin nada predicado, por empezar', () => {
        expect(planStatus([item(1), item(2)], NOW)).toBe('upcoming');
    });
});

describe('nextInPlan', () => {
    it('devuelve el primero SIN PREDICAR, no el último creado', () => {
        const items = [item(1, { preached: true }), item(2), item(3)];
        expect(nextInPlan(items)?.week).toBe(2);
    });

    it('ordena por fecha cuando la hay', () => {
        const items = [
            item(3, { scheduledDate: new Date('2026-09-06') }),
            item(1, { scheduledDate: new Date('2026-09-20') }),
        ];
        expect(nextInPlan(items)?.week).toBe(3);
    });

    it('cae al número de semana cuando el plan no tiene fechas', () => {
        expect(nextInPlan([item(4), item(2)])?.week).toBe(2);
    });

    it('un plan terminado no tiene próximo', () => {
        expect(nextInPlan([item(1, { preached: true })])).toBeNull();
    });

    it('lo que falta escribir TAMBIÉN es lo próximo: el orden no depende de que esté listo', () => {
        // Si el que sigue todavía no se escribió, es igual el que sigue — y la
        // interfaz tiene que poder decirlo en vez de saltearlo en silencio.
        const next = nextInPlan([item(1, { preached: true }), item(2, { ready: false }), item(3)]);
        expect(next?.week).toBe(2);
        expect(next?.ready).toBe(false);
    });
});

describe('pickCurrentPlan', () => {
    const status = (plan: { s: string }) => plan.s as ReturnType<typeof planStatus>;

    it('prefiere el activo sobre el que está por empezar', () => {
        const plans = [{ s: 'upcoming' }, { s: 'active' }];
        expect(pickCurrentPlan(plans, status)).toEqual({ s: 'active' });
    });

    it('sin activo, muestra el que está por empezar', () => {
        expect(pickCurrentPlan([{ s: 'finished' }, { s: 'upcoming' }], status)).toEqual({
            s: 'upcoming',
        });
    });

    it('si sólo hay terminados, no hay plan que mostrar', () => {
        expect(pickCurrentPlan([{ s: 'finished' }], status)).toBeNull();
    });
});

describe('lo que toca este domingo, por calendario', () => {
    // Serie de Jonás: seis domingos desde el 6 de septiembre de 2026.
    const sunday = (day: number) => new Date(2026, 8, 6 + 7 * (day - 1), 10);
    const serie = (preached: number[]): (PlanItemState & { week: number })[] =>
        [1, 2, 3, 4, 5, 6].map((week) => ({
            week,
            scheduledDate: sunday(week),
            ready: true,
            preached: preached.includes(week),
        }));

    it('REGRESIÓN: las semanas predicadas sin registrar no se ofrecen; toca la del domingo', () => {
        // Hoy es el 4 de octubre: el domingo de la semana 5. Sólo la 1 está registrada.
        const today = new Date(2026, 9, 4, 8);
        expect(nextByCalendar(serie([1]), today)?.week).toBe(5);
        expect(nextInPlan(serie([1]))?.week).toBe(2);
    });

    it('un día de semana, toca la del domingo que viene', () => {
        expect(nextByCalendar(serie([1]), new Date(2026, 9, 7))?.week).toBe(6);
    });

    it('lo ya registrado no se ofrece aunque sea su fecha', () => {
        expect(nextByCalendar(serie([1, 5]), new Date(2026, 9, 4, 8))?.week).toBe(6);
    });

    it('sin fechas (plan flexible) o con todas pasadas, vale el primero sin predicar', () => {
        const flexible = serie([1]).map((i) => ({ ...i, scheduledDate: undefined }));
        expect(nextByCalendar(flexible, new Date(2026, 9, 4))?.week).toBe(2);
        expect(nextByCalendar(serie([1]), new Date(2027, 0, 1))?.week).toBe(2);
    });
});

describe('día de calendario', () => {
    it('REGRESIÓN: una fecha guardada a medianoche UTC es ese día, en cualquier huso', () => {
        // Así guarda el planificador «domingo 4 de octubre».
        expect(calendarDay(new Date('2026-10-04'))).toBe(20261004);
    });

    it('una fecha con hora es su día local', () => {
        expect(calendarDay(new Date(2026, 9, 4, 10, 30))).toBe(20261004);
    });

    it('el domingo a medianoche UTC sigue siendo «hoy» el domingo por la mañana', () => {
        const items = [
            { week: 5, scheduledDate: new Date('2026-10-04'), ready: true, preached: false },
            { week: 6, scheduledDate: new Date('2026-10-11'), ready: true, preached: false },
        ];
        expect(nextByCalendar(items, new Date(2026, 9, 4, 8))?.week).toBe(5);
        expect(nextByCalendar(items, new Date(2026, 9, 4, 23, 59))?.week).toBe(5);
    });
});

