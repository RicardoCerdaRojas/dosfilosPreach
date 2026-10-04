import { estimateSpokenMinutes } from './movementBudget';

/**
 * El reloj del púlpito (A4 de la fase Púlpito premium).
 *
 * Antes era un `setInterval` que sumaba un segundo por tick. Tres defectos que
 * un pastor nota el domingo:
 * - Bloquear la pantalla o pasar a otra app detiene el intervalo: el reloj
 *   perdía los minutos en que el sistema lo dormía.
 * - Si el sistema mataba la app, se perdían el tiempo y el lugar.
 * - Cambiar la duración ponía el reloj en cero a mitad del sermón.
 *
 * Ahora el reloj es ESTADO + reloj de pared: guarda desde cuándo corre y
 * cuánto acumuló, y el tiempo se CALCULA contra `now`. El intervalo sólo
 * vuelve a pintar; si se duerme, al despertar el número es el correcto. El
 * estado es JSON plano, así que se guarda y se recupera tal cual.
 *
 * Todo en milisegundos; las pantallas muestran segundos.
 */
export interface PreachClock {
    running: boolean;
    /** Tiempo de los tramos ya cerrados. */
    accumulatedMs: number;
    /** Inicio del tramo en curso (reloj de pared), si corre. */
    runningSince: number | null;
    /** Movimiento que se está leyendo: a él se le carga el tiempo. */
    slug: string | null;
    /** Desde cuándo se le carga al movimiento actual, si corre. */
    slugSince: number | null;
    /** Tiempo cerrado por movimiento. */
    spentMs: Record<string, number>;
    /** Avisos ya dados: no se repiten. */
    cuesFired: string[];
}

export function newClock(slug: string | null = null): PreachClock {
    return { running: false, accumulatedMs: 0, runningSince: null, slug, slugSince: null, spentMs: {}, cuesFired: [] };
}

/** Un tramo de pared; si el reloj del sistema retrocede, cuenta cero. */
const span = (from: number | null, now: number) => (from === null ? 0 : Math.max(0, now - from));

export function startClock(clock: PreachClock, now: number): PreachClock {
    if (clock.running) return clock;
    return { ...clock, running: true, runningSince: now, slugSince: now };
}

export function pauseClock(clock: PreachClock, now: number): PreachClock {
    if (!clock.running) return clock;
    return {
        ...clock,
        running: false,
        accumulatedMs: clock.accumulatedMs + span(clock.runningSince, now),
        runningSince: null,
        spentMs: chargeSlug(clock, now),
        slugSince: null,
    };
}

/** Pasar a otro movimiento: lo corrido hasta acá se le carga al anterior. */
export function moveClockTo(clock: PreachClock, slug: string, now: number): PreachClock {
    if (clock.slug === slug) return clock;
    if (!clock.running) return { ...clock, slug };
    return { ...clock, spentMs: chargeSlug(clock, now), slug, slugSince: now };
}

function chargeSlug(clock: PreachClock, now: number): Record<string, number> {
    if (!clock.slug || !clock.running) return clock.spentMs;
    return { ...clock.spentMs, [clock.slug]: (clock.spentMs[clock.slug] ?? 0) + span(clock.slugSince, now) };
}

export function elapsedMs(clock: PreachClock, now: number): number {
    return clock.accumulatedMs + (clock.running ? span(clock.runningSince, now) : 0);
}

/** Segundos por movimiento, contando el tramo abierto: lo que pide el informe. */
export function spentSeconds(clock: PreachClock, now: number): Record<string, number> {
    const charged = chargeSlug(clock, now);
    return Object.fromEntries(Object.entries(charged).map(([slug, ms]) => [slug, Math.round(ms / 1000)]));
}

/**
 * Avisos que tocan ahora y no se dieron todavía. Hoy uno: al 80 % del
 * objetivo, un pulso háptico — se siente en la mano y nadie más lo oye.
 */
export const EIGHTY_PERCENT_CUE = 'eighty';
/** Faltan cinco minutos (C7). Sólo si el sermón dura más de diez. */
export const FIVE_MINUTES_CUE = 'five-left';
/** Un movimiento se pasó de su presupuesto (C7): uno por movimiento. */
export const overrunCue = (slug: string) => `overrun:${slug}`;

/**
 * Avisos que tocan ahora y no se dieron todavía. Todos se sienten en la mano
 * y nadie más los oye (pulso háptico):
 * - al 80 % del objetivo;
 * - a los 5 minutos del final, si el sermón dura más de 10 (C7);
 * - cuando el movimiento que se está leyendo se pasa de su presupuesto, una
 *   vez por movimiento (C7).
 */
export function dueCues(
    clock: PreachClock,
    now: number,
    targetSeconds: number,
    budgets: ReadonlyArray<{ slug: string; seconds: number }> = [],
): string[] {
    const due: string[] = [];
    const fired = new Set(clock.cuesFired);
    const elapsed = elapsedMs(clock, now) / 1000;
    if (targetSeconds > 0 && elapsed >= targetSeconds * 0.8 && !fired.has(EIGHTY_PERCENT_CUE)) {
        due.push(EIGHTY_PERCENT_CUE);
    }
    if (targetSeconds > 600 && targetSeconds - elapsed <= 300 && !fired.has(FIVE_MINUTES_CUE)) {
        due.push(FIVE_MINUTES_CUE);
    }
    if (clock.running && clock.slug) {
        const budget = budgets.find((b) => b.slug === clock.slug);
        const spent = spentSeconds(clock, now)[clock.slug] ?? 0;
        const cue = overrunCue(clock.slug);
        if (budget && spent > budget.seconds && !fired.has(cue)) due.push(cue);
    }
    return due;
}

/**
 * La duración que resulta de una HORA DE TÉRMINO (C7): lo predicado más lo que
 * queda hasta esa hora. El culto no empieza a horario y el pastor no decide
 * cuándo sube: «termino a las 11:45» es lo que de verdad sabe. Nunca menos de
 * un minuto.
 */
export function targetSecondsUntil(clock: PreachClock, now: number, endAt: number): number {
    return Math.max(60, Math.round(elapsedMs(clock, now) / 1000 + (endAt - now) / 1000));
}

export function markCues(clock: PreachClock, cues: string[]): PreachClock {
    if (!cues.length) return clock;
    return { ...clock, cuesFired: [...new Set([...clock.cuesFired, ...cues])] };
}

/**
 * Duración objetivo por defecto: la del texto, no 30 fijos.
 *
 * La estimación de palabras se lleva al múltiplo de 5 más cercano —los
 * pastores piensan el culto en tramos así— y se acota entre 10 y 60. Sin
 * texto, 30.
 */
export function defaultTargetMinutes(content: string): number {
    const estimate = estimateSpokenMinutes(content);
    if (!estimate) return 30;
    return Math.min(60, Math.max(10, Math.round(estimate / 5) * 5));
}

/** Las duraciones que ofrece el atril de entrada. */
export const BASE_TARGET_OPTIONS = [20, 25, 30, 35, 40, 45] as const;

/**
 * Las opciones de duración, con la vigente SIEMPRE incluida. La duración por
 * defecto sale del texto (10 a 60) y la hoja ofrecía sólo 20-45: un sermón de
 * 55 no marcaba ninguna y, si el pastor cambiaba a 45, ya no podía volver
 * (revisión adversarial de A4).
 */
export function targetMinuteOptions(current: number): number[] {
    return [...new Set([...BASE_TARGET_OPTIONS, current])].sort((a, b) => a - b);
}
