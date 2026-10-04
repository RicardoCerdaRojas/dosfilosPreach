import { describe, expect, it } from '@jest/globals';

import { pickNextSermon, pinExpiry, sameSermon } from '../nextSermon';

const s = (id: string, day: number, timesPreached = 0, extra: object = {}) => ({
    id,
    timesPreached,
    publishedAt: new Date(2026, 8, day),
    ...extra,
});
const SERMONS = [s('uno', 1, 1), s('dos', 5), s('tres', 9), s('cinco', 30)];
// Domingo 4 de octubre de 2026, 8:00.
const SUNDAY = new Date(2026, 9, 4, 8);
const THURSDAY = new Date(2026, 9, 1, 18);

const sermonOf = (choice: ReturnType<typeof pickNextSermon>) => (choice?.kind === 'sermon' ? choice.sermon.id : choice?.kind);

describe('el sermón de este domingo', () => {
    it('lo elegido a mano manda sobre el plan', () => {
        const pin = { sermonId: 'cinco', preachedAtPin: 0, pinnedAt: SUNDAY.getTime(), until: pinExpiry(SUNDAY) };
        const choice = pickNextSermon(SERMONS, { sermon: SERMONS[1] }, pin, SUNDAY.getTime());
        expect(sermonOf(choice)).toBe('cinco');
        expect(choice?.kind === 'sermon' && choice.pinned).toBe(true);
    });

    it('REGRESIÓN: lo elegido vence la noche del domingo para el que se eligió', () => {
        const pin = { sermonId: 'cinco', preachedAtPin: 0, pinnedAt: THURSDAY.getTime(), until: pinExpiry(THURSDAY) };
        // El domingo 4 vale; el lunes 5, ya no.
        expect(sermonOf(pickNextSermon(SERMONS, { sermon: SERMONS[2] }, pin, new Date(2026, 9, 4, 23).getTime()))).toBe('cinco');
        expect(sermonOf(pickNextSermon(SERMONS, { sermon: SERMONS[2] }, pin, new Date(2026, 9, 5, 9).getTime()))).toBe('tres');
    });

    it('lo elegido deja de mandar si se registra que se predicó', () => {
        const pin = { sermonId: 'cinco', preachedAtPin: 0, pinnedAt: SUNDAY.getTime(), until: pinExpiry(SUNDAY) };
        const predicado = SERMONS.map((x) => (x.id === 'cinco' ? { ...x, timesPreached: 1 } : x));
        expect(sermonOf(pickNextSermon(predicado, { sermon: SERMONS[1] }, pin, SUNDAY.getTime()))).toBe('dos');
    });

    it('REGRESIÓN: si lo que toca en el plan no está escrito, se dice; no se vuelve a la semana 2', () => {
        expect(pickNextSermon(SERMONS, {}, null, SUNDAY.getTime())).toEqual({ kind: 'unwritten' });
    });

    it('sin plan: el más viejo sin predicar, sin contar lo que el plan dejó atrás', () => {
        expect(sermonOf(pickNextSermon(SERMONS, null, null, SUNDAY.getTime()))).toBe('dos');
        expect(sermonOf(pickNextSermon(SERMONS, null, null, SUNDAY.getTime(), [SERMONS[1]!, SERMONS[2]!]))).toBe('cinco');
    });

    it('con todo predicado, el más reciente; sin sermones, nada', () => {
        const todos = SERMONS.map((x) => ({ ...x, timesPreached: 1 }));
        expect(sermonOf(pickNextSermon(todos, null, null, SUNDAY.getTime()))).toBe('cinco');
        expect(pickNextSermon([], null, null, SUNDAY.getTime())).toBeNull();
    });
});

describe('vencimiento de lo elegido', () => {
    it('un domingo vence esa noche; un jueves, el domingo siguiente', () => {
        expect(new Date(pinExpiry(SUNDAY)).getDate()).toBe(4);
        expect(new Date(pinExpiry(THURSDAY)).getDate()).toBe(4);
        expect(new Date(pinExpiry(new Date(2026, 9, 5))).getDate()).toBe(11);
    });
});

describe('copias del mismo sermón', () => {
    it('la copia publicada y su borrador, o dos versiones, son el mismo sermón', () => {
        expect(sameSermon(s('copia', 1, 0, { sourceSermonId: 'borrador' }), s('borrador', 1))).toBe(true);
        expect(sameSermon(s('v2', 1, 0, { versionOf: 'raiz' }), s('v3', 1, 0, { versionOf: 'raiz' }))).toBe(true);
        expect(sameSermon(s('a', 1), s('b', 1))).toBe(false);
    });
});
