import { describe, expect, it } from 'vitest';
import {
    EIGHTY_PERCENT_CUE,
    defaultTargetMinutes,
    dueCues,
    elapsedMs,
    markCues,
    moveClockTo,
    newClock,
    pauseClock,
    spentSeconds,
    startClock,
    targetMinuteOptions,
    FIVE_MINUTES_CUE,
    overrunCue,
    shiftEndAt,
    suggestedEndAt,
    targetSecondsUntil,
} from '../preachClock';

const MIN = 60_000;

describe('reloj del púlpito', () => {
    it('REGRESIÓN: con la pantalla bloqueada el tiempo sigue contando (se calcula contra el reloj de pared)', () => {
        const c = startClock(newClock('intro'), 0);
        // Ningún tick en el medio: el intervalo estuvo dormido 7 minutos.
        expect(elapsedMs(c, 7 * MIN)).toBe(7 * MIN);
    });

    it('pausar y seguir no pierde ni suma tiempo', () => {
        let c = startClock(newClock('intro'), 0);
        c = pauseClock(c, 3 * MIN);
        expect(elapsedMs(c, 10 * MIN)).toBe(3 * MIN);
        c = startClock(c, 10 * MIN);
        expect(elapsedMs(c, 12 * MIN)).toBe(5 * MIN);
    });

    it('el tiempo se le carga al movimiento que se leía, incluido el tramo abierto', () => {
        let c = startClock(newClock('intro'), 0);
        c = moveClockTo(c, 'punto-1', 4 * MIN);
        expect(spentSeconds(c, 9 * MIN)).toEqual({ intro: 240, 'punto-1': 300 });
    });

    it('moverse con el reloj parado no carga nada', () => {
        let c = newClock('intro');
        c = moveClockTo(c, 'punto-1', 5 * MIN);
        expect(spentSeconds(c, 6 * MIN)).toEqual({});
    });

    it('el estado es JSON plano: se guarda y se recupera tal cual', () => {
        let c = startClock(newClock('intro'), 0);
        c = moveClockTo(c, 'punto-1', MIN);
        const recuperado = JSON.parse(JSON.stringify(c));
        expect(elapsedMs(recuperado, 3 * MIN)).toBe(3 * MIN);
    });

    it('si el reloj del sistema retrocede, no hay tiempo negativo', () => {
        const c = startClock(newClock('intro'), 10 * MIN);
        expect(elapsedMs(c, 5 * MIN)).toBe(0);
    });

    it('el aviso del 80 % se da una sola vez', () => {
        let c = startClock(newClock('intro'), 0);
        expect(dueCues(c, 23 * MIN, 30 * 60)).toEqual([]);
        expect(dueCues(c, 24 * MIN, 30 * 60)).toEqual([EIGHTY_PERCENT_CUE]);
        c = markCues(c, [EIGHTY_PERCENT_CUE]);
        expect(dueCues(c, 26 * MIN, 30 * 60)).not.toContain(EIGHTY_PERCENT_CUE);
    });

    it('la duración por defecto sale del texto, en múltiplos de 5 y entre 10 y 60', () => {
        const palabras = (n: number) => Array.from({ length: n }, () => 'palabra').join(' ');
        expect(defaultTargetMinutes(palabras(130 * 27))).toBe(25);
        expect(defaultTargetMinutes(palabras(130 * 4))).toBe(10);
        expect(defaultTargetMinutes(palabras(130 * 90))).toBe(60);
        expect(defaultTargetMinutes('')).toBe(30);
    });
});

describe('opciones de duración (revisión adversarial de A4)', () => {
    it('invariante: la duración por defecto de CUALQUIER texto está entre las opciones del atril', () => {
        for (let words = 0; words <= 130 * 120; words += 130) {
            const texto = Array.from({ length: words }, () => 'p').join(' ');
            const d = defaultTargetMinutes(texto);
            expect(targetMinuteOptions(d)).toContain(d);
        }
    });

    it('sin duplicar ni desordenar', () => {
        expect(targetMinuteOptions(30)).toEqual([20, 25, 30, 35, 40, 45]);
        expect(targetMinuteOptions(55)).toEqual([20, 25, 30, 35, 40, 45, 55]);
    });
});

describe('avisos y hora de término (C7)', () => {
    it('a los 5 minutos del final, una vez; no en un sermón de 10 o menos', () => {
        let c = startClock(newClock('a'), 0);
        expect(dueCues(c, 24 * MIN, 30 * 60)).not.toContain(FIVE_MINUTES_CUE);
        expect(dueCues(c, 25 * MIN, 30 * 60)).toContain(FIVE_MINUTES_CUE);
        c = markCues(c, [FIVE_MINUTES_CUE]);
        expect(dueCues(c, 26 * MIN, 30 * 60)).not.toContain(FIVE_MINUTES_CUE);
        expect(dueCues(startClock(newClock('a'), 0), 6 * MIN, 10 * 60)).not.toContain(FIVE_MINUTES_CUE);
    });

    it('el movimiento que se pasa de su presupuesto avisa una vez, y sólo el que se lee', () => {
        let c = startClock(newClock('intro'), 0);
        const budgets = [
            { slug: 'intro', seconds: 180 },
            { slug: 'punto-1', seconds: 600 },
        ];
        expect(dueCues(c, 2 * MIN, 30 * 60, budgets)).toEqual([]);
        expect(dueCues(c, 4 * MIN, 30 * 60, budgets)).toEqual([overrunCue('intro')]);
        c = markCues(c, [overrunCue('intro')]);
        c = moveClockTo(c, 'punto-1', 4 * MIN);
        expect(dueCues(c, 6 * MIN, 30 * 60, budgets)).toEqual([]);
    });

    it('«termino a las 11:45»: lo predicado más lo que queda; nunca menos de un minuto', () => {
        const c = startClock(newClock('a'), 0);
        expect(targetSecondsUntil(c, 10 * MIN, 40 * MIN)).toBe(40 * 60);
        expect(targetSecondsUntil(newClock('a'), 0, 25 * MIN)).toBe(25 * 60);
        expect(targetSecondsUntil(c, 50 * MIN, 40 * MIN)).toBe(40 * 60);
        expect(targetSecondsUntil(newClock('a'), 10 * MIN, 0)).toBe(60);
    });
});

describe('hora de término (C7)', () => {
    // 10:00:00 de un día cualquiera, en ms desde la época (múltiplo de 5 min).
    const TEN = 1_800_000_000_000 - (1_800_000_000_000 % (5 * MIN));

    it('propone el próximo múltiplo de 5 minutos después de lo que queda', () => {
        expect(suggestedEndAt(TEN, 30 * 60)).toBe(TEN + 30 * MIN);
        expect(suggestedEndAt(TEN + 20_000, 30 * 60)).toBe(TEN + 35 * MIN);
        expect(suggestedEndAt(TEN + 3 * MIN, 30 * 60)).toBe(TEN + 35 * MIN);
    });

    it('con el objetivo ya vencido propone al menos un minuto más', () => {
        expect(suggestedEndAt(TEN + 2 * MIN, -600)).toBe(TEN + 5 * MIN);
    });

    it('corre de a 5 minutos y nunca a una hora ya pasada', () => {
        expect(shiftEndAt(TEN + 30 * MIN, 5, TEN)).toBe(TEN + 35 * MIN);
        expect(shiftEndAt(TEN + 30 * MIN, -5, TEN)).toBe(TEN + 25 * MIN);
        expect(shiftEndAt(TEN + 3 * MIN, -5, TEN + 30_000)).toBe(TEN + 2 * MIN);
    });
});
