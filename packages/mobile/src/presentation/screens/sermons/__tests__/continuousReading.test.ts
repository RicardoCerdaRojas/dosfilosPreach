import { describe, expect, it } from '@jest/globals';
import type { ReadingBlockKind } from '@dosfilos/domain';

import { continuousFocusStep, progressInSection, screenStep, sectionAtLine } from '../continuousReading';

describe('en qué movimiento se está leyendo', () => {
    const tops = [0, 1000, 2500];

    it('el último cuyo comienzo pasó la línea de lectura', () => {
        expect(sectionAtLine(tops, 10)).toBe(0);
        expect(sectionAtLine(tops, 999)).toBe(0);
        expect(sectionAtLine(tops, 1000)).toBe(1);
        expect(sectionAtLine(tops, 9999)).toBe(2);
    });

    it('antes del primero: la Lectura (-1)', () => {
        expect(sectionAtLine([400, 900], 100)).toBe(-1);
    });

    it('cuánto del movimiento quedó atrás', () => {
        expect(progressInSection(tops, 1, 1750, 4000)).toBeCloseTo(0.5);
        expect(progressInSection(tops, 2, 4000, 4000)).toBe(1);
        expect(progressInSection(tops, 0, -50, 4000)).toBe(0);
    });
});

describe('un toque en el costado', () => {
    it('baja casi una pantalla y deja a la vista lo último que se leía', () => {
        expect(screenStep(0, 800, 5000, 80, 1)).toBe(720);
        expect(screenStep(720, 800, 5000, 80, -1)).toBe(0);
    });

    it('no se pasa del final ni del comienzo', () => {
        expect(screenStep(4100, 800, 5000, 80, 1)).toBe(4200);
        expect(screenStep(100, 800, 5000, 80, -1)).toBe(0);
    });
});

describe('el foco de lectura en el sermón continuo', () => {
    const kinds: ReadingBlockKind[] = ['paragraph', 'subheading', 'paragraph', 'paragraph'];
    const boxes = [
        { top: 0, bottom: 300 },
        { top: 320, bottom: 360 },
        { top: 380, bottom: 700 },
        { top: 720, bottom: 1300 },
    ];
    const view = { scroll: 0, height: 800, contentHeight: 3000 };

    it('sin foco, avanzar lo pone en la primera idea a la vista, sin desplazar', () => {
        expect(continuousFocusStep(kinds, boxes, null, 1, view, 40, 80)).toEqual({ focus: 0, scrollTo: null });
        expect(continuousFocusStep(kinds, boxes, null, 1, { ...view, scroll: 350 }, 40, 80)).toEqual({ focus: 2, scrollTo: null });
    });

    it('la idea siguiente que entra en la pantalla: el foco baja, el texto no se mueve', () => {
        // Salta el subtítulo: va con el párrafo que encabeza.
        expect(continuousFocusStep(kinds, boxes, 0, 1, view, 40, 80)).toEqual({ focus: 2, scrollTo: null });
    });

    it('la idea siguiente que no entra: queda arriba, con un renglón de aire', () => {
        expect(continuousFocusStep(kinds, boxes, 2, 1, view, 40, 80)).toEqual({ focus: 3, scrollTo: 680 });
    });

    it('REGRESIÓN: un párrafo más alto que la pantalla se termina de recorrer antes de soltarlo', () => {
        const tall = [{ top: 0, bottom: 2000 }, null, { top: 2050, bottom: 2400 }, null];
        expect(continuousFocusStep(kinds, tall, 0, 1, view, 40, 80)).toEqual({ focus: 0, scrollTo: 720 });
    });

    it('volviendo, la idea anterior queda abajo, donde estaba al leerla', () => {
        // La anterior está a la vista: sólo se mueve el foco.
        expect(continuousFocusStep(kinds, boxes, 2, -1, view, 40, 80)).toEqual({ focus: 0, scrollTo: null });
        // La anterior quedó arriba, cortada: se baja hasta que su final quede al pie.
        expect(continuousFocusStep(kinds, boxes, 3, -1, { ...view, scroll: 680 }, 40, 80)).toEqual({ focus: 2, scrollTo: 0 });
        const below = [{ top: 0, bottom: 300 }, null, { top: 1400, bottom: 1700 }, { top: 2000, bottom: 2600 }];
        expect(continuousFocusStep(kinds, below, 3, -1, { ...view, scroll: 1950 }, 40, 80)).toEqual({ focus: 2, scrollTo: 940 });
    });

    it('en el final del sermón el foco se queda', () => {
        expect(continuousFocusStep(kinds, boxes, 3, 1, { ...view, scroll: 680 }, 40, 80)).toEqual({ focus: 3, scrollTo: null });
    });
});
