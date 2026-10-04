import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { MovementBudget, PreachClock } from '@dosfilos/domain';
import {
    EIGHTY_PERCENT_CUE,
    FIVE_MINUTES_CUE,
    dueCues,
    elapsedMs,
    markCues,
    moveClockTo,
    newClock,
    pauseClock,
    spentSeconds,
    startClock,
    targetSecondsUntil,
} from '@dosfilos/domain';

import {
    SESSION_SAVE_EVERY_MS,
    clearPreachSession,
    readPreachSession,
    resumeClock,
    savePreachSession,
} from '@/data/offline/preachSession';

/**
 * El reloj del atril y su sesión guardada (A4), fuera de la pantalla (C6: el
 * atril pasaba las 1.100 líneas).
 *
 * - Estado + hora de pared, del dominio: el intervalo sólo repinta; si el
 *   sistema lo duerme, al volver el tiempo es el correcto.
 * - Avisos que se sienten en la mano (C7): 80 % y 5 minutos con un pulso de
 *   aviso; un movimiento pasado de su presupuesto con uno leve. Nada en tinta
 *   electrónica (no hay motor háptico).
 * - Hora de término (C7): «termino a las 11:45» reemplaza a la duración
 *   mientras esté puesta, y se guarda con la sesión.
 * - Sesión: se guarda en cada cambio y cada 30 s mientras corre; al volver
 *   se retoma (pausada si la app estuvo muerta).
 */
interface Options {
    sermonId: string | undefined;
    /** Para saber qué movimientos existen al retomar. */
    sectionSlugs: string[];
    /** El movimiento y la página a la vista: se guardan con la sesión. */
    sectionSlug: string | null;
    pageIndex: number;
    /** Duración elegida o la del texto, en minutos. */
    targetMinutes: number;
    /**
     * Presupuestos por movimiento para una duración dada. Es función porque
     * la duración puede salir del propio reloj (hora de término).
     */
    budgetsFor: (targetSeconds: number) => MovementBudget[];
    haptics: boolean;
    /**
     * Se retomó una sesión: llevar al pastor a ese lugar. `onReading`: estaba
     * en la página de Lectura.
     */
    onRestore: (place: { sectionIndex: number; pageIndex: number; onReading: boolean }) => void;
}

/** Slug de la página de Lectura en el reloj: su tiempo no es de ningún movimiento. */
export const READING_SLUG = 'lectura';

/**
 * Un pulso por tic, no uno por aviso: con objetivo de 25 min el 80 % y los
 * 5 minutos caen en el mismo segundo y eran dos pulsos seguidos (revisión
 * adversarial de C7). El de tiempo total manda sobre el de movimiento.
 */
export function pulseFor(cues: string[]): 'warning' | 'light' | null {
    if (cues.some((cue) => cue === EIGHTY_PERCENT_CUE || cue === FIVE_MINUTES_CUE)) return 'warning';
    return cues.length ? 'light' : null;
}

const pulse = (cues: string[]) => {
    const kind = pulseFor(cues);
    if (kind === 'warning') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else if (kind === 'light') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export function usePreachClock({
    sermonId,
    sectionSlugs,
    sectionSlug,
    pageIndex,
    targetMinutes,
    budgetsFor,
    haptics,
    onRestore,
}: Options) {
    const [clock, setClock] = useState<PreachClock>(() => newClock(null));
    const [now, setNow] = useState(() => Date.now());
    /** Hora de término (reloj de pared), si el pastor la puso. */
    const [endAt, setEndAt] = useState<number | null>(null);
    const [restored, setRestored] = useState(false);

    const targetSeconds = endAt !== null ? targetSecondsUntil(clock, now, endAt) : targetMinutes * 60;
    const budgets = budgetsFor(targetSeconds);

    // El tic lee lo vigente por ref: recrear el intervalo en cada cambio
    // perdería la fracción en curso.
    const live = useRef({ clock, targetSeconds, budgets, haptics, sectionSlug, pageIndex, endAt });
    const lastSaveRef = useRef(0);
    /** Al salir del atril se deja de guardar: si no, el tic recreaba la sesión borrada. */
    const finishedRef = useRef(false);
    useEffect(() => {
        live.current = { clock, targetSeconds, budgets, haptics, sectionSlug, pageIndex, endAt };
    });

    // Con hora de término, lo que queda baja aunque el reloj esté en pausa:
    // el tic sigue, sólo para repintar (revisión adversarial de C7).
    const ticking = clock.running || endAt !== null;
    useEffect(() => {
        if (!ticking) return;
        const timer = setInterval(() => {
            const t1 = Date.now();
            setNow(t1);
            const cur = live.current;
            if (!cur.clock.running) return;
            const due = dueCues(cur.clock, t1, cur.targetSeconds, cur.budgets);
            if (due.length) {
                // Marcado en el ref YA: si dos tics corren antes de volver a
                // pintar, el segundo no repite el pulso (revisión de A4).
                live.current = { ...cur, clock: markCues(cur.clock, due) };
                if (cur.haptics) pulse(due);
                setClock((c) => markCues(c, due));
            }
            // Guardado periódico: al retomar, lo que pasó desde el último
            // guardado decide si la app estuvo predicando o muerta.
            if (sermonId && !finishedRef.current && t1 - lastSaveRef.current >= SESSION_SAVE_EVERY_MS) {
                lastSaveRef.current = t1;
                void savePreachSession(sermonId, {
                    clock: live.current.clock,
                    sectionSlug: cur.sectionSlug,
                    pageIndex: cur.pageIndex,
                    endAt: cur.endAt,
                });
            }
        }, 1000);
        // Al volver a la app, repintar ya: no esperar al próximo segundo.
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') setNow(Date.now());
        });
        return () => {
            clearInterval(timer);
            sub.remove();
        };
    }, [ticking, sermonId]);

    // Retomar: si la app se cerró a mitad del sermón, vuelve al lugar y con
    // el reloj. Una sola vez, cuando ya se conocen los movimientos.
    const restoringRef = useRef(false);
    const slugsKey = sectionSlugs.join('|');
    useEffect(() => {
        if (!sermonId || restoringRef.current || !slugsKey) return;
        restoringRef.current = true;
        const known = slugsKey.split('|');
        void readPreachSession(sermonId, Date.now())
            .then((session) => {
                if (!session) return;
                const t0 = Date.now();
                const at = known.indexOf(session.sectionSlug ?? '');
                const onReading = session.sectionSlug === READING_SLUG;
                if (at >= 0) onRestore({ sectionIndex: at, pageIndex: session.pageIndex, onReading: false });
                else onRestore({ sectionIndex: 0, pageIndex: 0, onReading });
                // Si la app estuvo muerta, vuelve PAUSADO en el último guardado
                // (resumeClock). Si el movimiento ya no existe (se editó), el
                // tiempo sigue en el primero.
                const resumed = resumeClock(session, t0);
                const slug = at >= 0 || onReading ? session.sectionSlug : (known[0] ?? null);
                setClock(slug ? moveClockTo(resumed, slug, t0) : resumed);
                // Una hora de término ya pasada es de OTRO culto (la app murió
                // sin pasar por la salida): con ella el objetivo quedaba en
                // un minuto y todo salía pasado (revisión adversarial de C7).
                setEndAt(session.endAt && session.endAt > t0 ? session.endAt : null);
                setNow(t0);
            })
            // Sin esto, una falla de lectura dejaba la sesión sin guardarse
            // en toda la predicación.
            .catch(() => undefined)
            .finally(() => setRestored(true));
        // onRestore es de la pantalla; sólo importa la primera vez.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sermonId, slugsKey]);

    // Se guarda en cada cambio de estado del reloj o de lugar.
    useEffect(() => {
        if (!sermonId || !restored || finishedRef.current) return;
        if (clock.accumulatedMs === 0 && !clock.running) return;
        void savePreachSession(sermonId, { clock, sectionSlug, pageIndex, endAt }).then(() => {
            lastSaveRef.current = Date.now();
        });
    }, [sermonId, restored, clock, sectionSlug, pageIndex, endAt]);

    /** Carga lo corrido al movimiento que se deja (al NAVEGAR, no en un efecto). */
    const moveTo = (slug: string) => setClock((c) => moveClockTo(c, slug, Date.now()));

    /** Arrancar con el movimiento a la vista ya anotado. */
    const startWithSlug = (c: PreachClock, t0: number) =>
        startClock(c.slug || !sectionSlug ? c : moveClockTo(c, sectionSlug, t0), t0);

    /** El reloj arranca solo con el primer toque (A4). */
    const ensureStarted = () => {
        if (clock.running || clock.accumulatedMs > 0) return;
        const t0 = Date.now();
        setClock((c) => startWithSlug(c, t0));
        setNow(t0);
    };

    const toggle = () => {
        const t0 = Date.now();
        setClock((c) => (c.running ? pauseClock(c, t0) : startWithSlug(c, t0)));
        setNow(t0);
    };

    /** Poner o quitar la hora de término, con la hora de AHORA (no la del último tic). */
    const setEnd = (update: number | null | ((current: number | null) => number | null)) => {
        setEndAt(update);
        setNow(Date.now());
    };

    /** Salir del atril: la sesión se borra y no se vuelve a guardar. */
    const finish = () => {
        finishedRef.current = true;
        if (sermonId) void clearPreachSession(sermonId);
    };

    const reset = () => {
        setClock(newClock(sectionSlug));
        setEndAt(null);
        setNow(Date.now());
        if (sermonId) void clearPreachSession(sermonId);
    };

    return {
        clock,
        now,
        running: clock.running,
        elapsed: Math.floor(elapsedMs(clock, now) / 1000),
        spent: spentSeconds(clock, now),
        targetSeconds,
        budgets,
        endAt,
        setEndAt: setEnd,
        finish,
        moveTo,
        ensureStarted,
        toggle,
        reset,
    };
}
