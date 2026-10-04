import { describe, expect, it } from '@jest/globals';
import type { ReadingBlockKind } from '@dosfilos/domain';

import { focusOnArrival, isDimmed, stepFocus } from '../readingFocus';

const PAGE: ReadingBlockKind[] = ['subheading', 'paragraph', 'paragraph', 'listitem'];

describe('foco de lectura', () => {
    it('avanzar recorre las ideas de la página antes de pasarla', () => {
        expect(stepFocus(PAGE, 1, 1)).toEqual({ focus: 2, turn: 0 });
        expect(stepFocus(PAGE, 2, 1)).toEqual({ focus: 3, turn: 0 });
        expect(stepFocus(PAGE, 3, 1)).toEqual({ focus: 3, turn: 1 });
    });

    it('retroceder vuelve por las ideas y después pasa a la página anterior', () => {
        expect(stepFocus(PAGE, 2, -1)).toEqual({ focus: 1, turn: 0 });
        expect(stepFocus(PAGE, 1, -1)).toEqual({ focus: 1, turn: -1 });
    });

    it('el subtítulo no es una parada', () => {
        expect(stepFocus(PAGE, null, 1)).toEqual({ focus: 1, turn: 0 });
        expect(focusOnArrival(PAGE, 1)).toBe(1);
        expect(focusOnArrival(PAGE, -1)).toBe(3);
    });

    it('una página sin texto (sólo títulos) se pasa de largo', () => {
        expect(stepFocus(['subheading'], null, 1)).toEqual({ focus: null, turn: 1 });
        expect(focusOnArrival([], 1)).toBeNull();
    });

    it('se atenúa lo que no está en foco, pero no el subtítulo del párrafo en foco', () => {
        expect(isDimmed(PAGE, 1, 0)).toBe(false);
        expect(isDimmed(PAGE, 2, 0)).toBe(true);
        expect(isDimmed(PAGE, 1, 2)).toBe(true);
        expect(isDimmed(PAGE, 1, 1)).toBe(false);
        expect(isDimmed(PAGE, null, 2)).toBe(false);
    });
});
