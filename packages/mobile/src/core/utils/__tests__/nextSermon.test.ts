import { describe, expect, it } from '@jest/globals';

import { PIN_TTL_MS, pickNextSermon } from '../nextSermon';

const s = (id: string, day: number, timesPreached = 0) => ({ id, timesPreached, publishedAt: new Date(2026, 8, day) });
const SERMONS = [s('uno', 1, 1), s('dos', 5), s('tres', 9), s('cinco', 30)];
const NOW = new Date(2026, 9, 4).getTime();

describe('el sermón de este domingo', () => {
    it('lo elegido a mano manda sobre el plan', () => {
        const pin = { sermonId: 'cinco', preachedAtPin: 0, pinnedAt: NOW };
        expect(pickNextSermon(SERMONS, SERMONS[1], pin, NOW)?.id).toBe('cinco');
    });

    it('lo elegido deja de mandar cuando se predica, o a los 10 días', () => {
        const pin = { sermonId: 'cinco', preachedAtPin: 0, pinnedAt: NOW };
        const predicado = SERMONS.map((x) => (x.id === 'cinco' ? { ...x, timesPreached: 1 } : x));
        expect(pickNextSermon(predicado, SERMONS[1], pin, NOW)?.id).toBe('dos');
        expect(pickNextSermon(SERMONS, SERMONS[1], pin, NOW + PIN_TTL_MS + 1)?.id).toBe('dos');
    });

    it('sin elección, el del plan; sin plan, el más viejo sin predicar', () => {
        expect(pickNextSermon(SERMONS, SERMONS[2], null, NOW)?.id).toBe('tres');
        expect(pickNextSermon(SERMONS, undefined, null, NOW)?.id).toBe('dos');
    });

    it('con todo predicado, el más reciente', () => {
        const todos = SERMONS.map((x) => ({ ...x, timesPreached: 1 }));
        expect(pickNextSermon(todos, undefined, null, NOW)?.id).toBe('cinco');
    });

    it('un sermón elegido que ya no existe no rompe nada', () => {
        expect(pickNextSermon(SERMONS, undefined, { sermonId: 'borrado', preachedAtPin: 0, pinnedAt: NOW }, NOW)?.id).toBe('dos');
    });
});
