import { describe, expect, it } from '@jest/globals';
import { createGestureGate, swipeDirection, tapZone, type TouchPoint } from '../preachGestures';

/** n dedos con ids desde `from`. */
const dedos = (n: number, from = 0): TouchPoint[] => Array.from({ length: n }, (_, i) => ({ identifier: from + i }));

let nextId = 10;
const NEXT = () => (nextId += 10);

describe('toques del atril', () => {
    it('REGRESIÓN: dos toques rápidos de un dedo NO apagan la pantalla; son dos páginas', () => {
        const gate = createGestureGate();
        expect(gate.touchStart(dedos(1), 1000)).toBe(false);
        expect(gate.acceptsTap(1000)).toBe(true);
        expect(gate.touchStart(dedos(1), 1150)).toBe(false);
        expect(gate.acceptsTap(1150)).toBe(true);
    });

    it('dos dedos dos veces seguidas: pantalla negra', () => {
        const gate = createGestureGate();
        expect(gate.touchStart(dedos(2, NEXT()), 1000)).toBe(false);
        expect(gate.touchStart(dedos(2, NEXT()), 1300)).toBe(true);
    });

    it('dos dedos con mucha pausa entre medio: no apaga', () => {
        const gate = createGestureGate();
        gate.touchStart(dedos(2, NEXT()), 1000);
        expect(gate.touchStart(dedos(2, NEXT()), 2000)).toBe(false);
    });

    it('el toque de un dedo durante un gesto de dos dedos no pasa página', () => {
        const gate = createGestureGate();
        gate.touchStart(dedos(2, NEXT()), 1000);
        expect(gate.acceptsTap(1050)).toBe(false);
        expect(gate.acceptsTap(1500)).toBe(true);
    });

    it('tres toques de dos dedos: apaga una vez, no vuelve a apagar con el tercero', () => {
        const gate = createGestureGate();
        gate.touchStart(dedos(2, NEXT()), 1000);
        expect(gate.touchStart(dedos(2, NEXT()), 1200)).toBe(true);
        expect(gate.touchStart(dedos(2, NEXT()), 1400)).toBe(false);
    });

    it('zonas: tercio izquierdo atrás, centro controles, tercio derecho adelante', () => {
        expect(tapZone(100, 900)).toBe('back');
        expect(tapZone(450, 900)).toBe('center');
        expect(tapZone(800, 900)).toBe('forward');
    });
});

describe('revisión adversarial de A3', () => {
    it('un pulgar APOYADO en el borde no convierte cada toque en «dos dedos»', () => {
        const gate = createGestureGate();
        const pulgar = { identifier: 1 };
        gate.touchStart([pulgar], 0);
        // Más tarde, el otro dedo toca dos veces rápido: llega con 2 toques en
        // pantalla cada vez, pero sólo uno es nuevo.
        expect(gate.touchStart([pulgar, { identifier: 2 }], 5000)).toBe(false);
        expect(gate.acceptsTap(5000)).toBe(true);
        expect(gate.touchStart([pulgar, { identifier: 3 }], 5200)).toBe(false);
        expect(gate.acceptsTap(5200)).toBe(true);
    });

    it('deslizar: hacia la izquierda avanza, hacia la derecha retrocede; un toque no desliza', () => {
        expect(swipeDirection(500, 400)).toBe(1);
        expect(swipeDirection(400, 500)).toBe(-1);
        expect(swipeDirection(400, 420)).toBe(0);
        expect(swipeDirection(null, 100)).toBe(0);
    });
});
