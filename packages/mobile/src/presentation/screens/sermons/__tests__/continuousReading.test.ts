import { describe, expect, it } from '@jest/globals';
import type { ReadingBlockKind } from '@dosfilos/domain';

import {
    anchoredStep,
    continuousFocusStep,
    isStopTouch,
    progressInSection,
    screenStep,
    sectionAtLine,
    trackedPlace,
    type ReadingAnchor,
} from '../continuousReading';

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

describe('dónde se está leyendo', () => {
    it('el movimiento que cruza la línea de lectura, y cuánto de él', () => {
        // Línea en 400 + 0,3·900 = 670: el movimiento 0 (0–1000), por la mitad y algo.
        expect(trackedPlace([0, 1000, 2000], 400, 900, 3000, 10)).toEqual({ at: 0, step: 6 });
    });

    it('REGRESIÓN: con el documento al final, se lee el último aunque sea corto', () => {
        // Conclusión de 300 (2600–2900): su comienzo nunca llegaba a la línea (2000 + 270).
        expect(trackedPlace([16, 1000, 2000, 2600], 2000, 900, 2900, 10)).toEqual({ at: 3, step: 9 });
    });

    it('un documento que entra en la pantalla no está «al final»', () => {
        expect(trackedPlace([0, 300], 0, 900, 600, 10)?.at).toBe(0);
    });

    it('sin movimientos medidos, todavía no se sabe', () => {
        expect(trackedPlace([], 0, 900, 3000, 10)).toBeNull();
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

    it('REGRESIÓN: una idea sin medir (cita plegada) se salta, no deja el foco fuera de la vista', () => {
        const kindsQ: ReadingBlockKind[] = ['paragraph', 'quote', 'paragraph'];
        const boxesQ = [{ top: 0, bottom: 300 }, null, { top: 360, bottom: 600 }];
        expect(continuousFocusStep(kindsQ, boxesQ, 0, 1, view, 40, 80)).toEqual({ focus: 2, scrollTo: null });
    });

    it('en el final del sermón el foco se queda', () => {
        expect(continuousFocusStep(kinds, boxes, 3, 1, { ...view, scroll: 680 }, 40, 80)).toEqual({ focus: 3, scrollTo: null });
    });
});

describe('un toque que detiene el documento', () => {
    it('REGRESIÓN: con el texto corriendo por la inercia, el toque sólo lo detiene', () => {
        // El documento se movió hace 16 ms, por la inercia que dejó el dedo.
        expect(isStopTouch(10_000, 9_984, { dragging: false, momentum: true })).toBe(true);
        // Mientras se arrastra, también.
        expect(isStopTouch(10_000, 9_990, { dragging: true, momentum: false })).toBe(true);
    });

    it('con el documento quieto, el toque navega (aunque quedara marcada una inercia)', () => {
        expect(isStopTouch(10_000, 9_000, { dragging: false, momentum: true })).toBe(false);
    });

    it('REGRESIÓN: el paso del propio atril no frena el toque siguiente (dos toques suman)', () => {
        expect(isStopTouch(10_000, 9_990, { dragging: false, momentum: false })).toBe(false);
    });
});

describe('avance que cae en un comienzo', () => {
    // Pantalla de 1000, solape 80: el paso de siempre baja 920.
    const step = (anchors: ReadingAnchor[], scroll = 0, towards: 1 | -1 = 1) =>
        anchoredStep(scroll, 1000, 10_000, 80, towards, anchors, 10);

    it('REGRESIÓN: prefiere un título, aunque se repita texto', () => {
        expect(step([{ y: 700, rank: 0 }, { y: 900, rank: 1 }, { y: 925, rank: 2 }])).toBe(690);
    });

    it('sin título, el comienzo de un párrafo o viñeta antes que una oración', () => {
        expect(step([{ y: 800, rank: 1 }, { y: 925, rank: 2 }])).toBe(790);
    });

    it('del mismo tipo, el que más avanza', () => {
        expect(step([{ y: 600, rank: 1 }, { y: 880, rank: 1 }])).toBe(870);
    });

    it('nunca avanza menos de media pantalla', () => {
        expect(step([{ y: 300, rank: 0 }, { y: 910, rank: 2 }])).toBe(900);
    });

    it('sin comienzos a mano, el paso de siempre', () => {
        expect(step([{ y: 2000, rank: 0 }])).toBe(920);
    });

    it('hacia atrás, con la misma regla', () => {
        // Desde 3000: el paso de siempre sube a 2080; se puede poner arriba entre 2080 y 2500.
        expect(step([{ y: 2300, rank: 0 }, { y: 2100, rank: 1 }], 3000, -1)).toBe(2290);
    });
});
