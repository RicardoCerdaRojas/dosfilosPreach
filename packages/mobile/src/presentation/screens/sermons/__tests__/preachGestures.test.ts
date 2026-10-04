import { describe, expect, it } from '@jest/globals';
import { createGestureGate, tapZone } from '../preachGestures';

describe('toques del atril', () => {
    it('REGRESIÓN: dos toques rápidos de un dedo NO apagan la pantalla; son dos páginas', () => {
        const gate = createGestureGate();
        expect(gate.touchStart(1, 1000)).toBe(false);
        expect(gate.acceptsTap(1000)).toBe(true);
        expect(gate.touchStart(1, 1150)).toBe(false);
        expect(gate.acceptsTap(1150)).toBe(true);
    });

    it('dos dedos dos veces seguidas: pantalla negra', () => {
        const gate = createGestureGate();
        expect(gate.touchStart(2, 1000)).toBe(false);
        expect(gate.touchStart(2, 1300)).toBe(true);
    });

    it('dos dedos con mucha pausa entre medio: no apaga', () => {
        const gate = createGestureGate();
        gate.touchStart(2, 1000);
        expect(gate.touchStart(2, 2000)).toBe(false);
    });

    it('el toque de un dedo durante un gesto de dos dedos no pasa página', () => {
        const gate = createGestureGate();
        gate.touchStart(2, 1000);
        expect(gate.acceptsTap(1050)).toBe(false);
        expect(gate.acceptsTap(1500)).toBe(true);
    });

    it('tres toques de dos dedos: apaga una vez, no vuelve a apagar con el tercero', () => {
        const gate = createGestureGate();
        gate.touchStart(2, 1000);
        expect(gate.touchStart(2, 1200)).toBe(true);
        expect(gate.touchStart(2, 1400)).toBe(false);
    });

    it('zonas: tercio izquierdo atrás, centro controles, tercio derecho adelante', () => {
        expect(tapZone(100, 900)).toBe('back');
        expect(tapZone(450, 900)).toBe('center');
        expect(tapZone(800, 900)).toBe('forward');
    });
});
