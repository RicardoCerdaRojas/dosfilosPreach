import { describe, expect, it } from '@jest/globals';

import { READING_MODES, shownSeconds } from '../readingModes';

describe('el reloj en tinta electrónica (C3)', () => {
    it('cambia una vez por minuto: dentro del minuto, la pantalla no se repinta', () => {
        const eink = READING_MODES.eink;
        expect(shownSeconds(eink, 12 * 60)).toBe(12 * 60);
        expect(shownSeconds(eink, 12 * 60 + 59)).toBe(12 * 60);
        expect(shownSeconds(eink, 13 * 60)).toBe(13 * 60);
    });

    it('en los demás modos sigue por segundo', () => {
        for (const mode of ['claro', 'sepia', 'oscuro', 'atril'] as const) {
            expect(shownSeconds(READING_MODES[mode], 12 * 60 + 59)).toBe(12 * 60 + 59);
        }
    });
});
