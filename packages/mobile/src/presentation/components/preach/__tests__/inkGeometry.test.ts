import { describe, expect, it } from '@jest/globals';
import type { InkStroke } from '@dosfilos/domain';
import { toNoteSpace } from '@dosfilos/domain';

import { inkSignature, nearestStroke, showsBridge, withoutStroke } from '../inkGeometry';

const RECT = { x: 100, y: 200, height: 40 };
const BODY = 28;
/** Un trazo horizontal en pantalla, guardado en el espacio de la nota. */
const stroke = (y: number): InkStroke => ({
    points: [0, 20, 40].map((dx) => toNoteSpace({ x: 120 + dx, y }, RECT, BODY)),
    width: 0.07,
    color: 'ink',
});

describe('goma', () => {
    const a = stroke(210);
    const b = stroke(260);
    const notes = [{ id: 'n1', strokes: [a, b] }];

    it('encuentra el trazo que toca el dedo, y nada fuera de su alcance', () => {
        expect(nearestStroke(notes, () => RECT, BODY, 140, 212)).toEqual({ noteId: 'n1', stroke: a });
        expect(nearestStroke(notes, () => RECT, BODY, 140, 262)).toEqual({ noteId: 'n1', stroke: b });
        expect(nearestStroke(notes, () => RECT, BODY, 600, 600)).toBeNull();
    });

    it('REGRESIÓN: en un mismo gesto no vuelve sobre lo que ya borró (borraba al vecino)', () => {
        const skip = new Set([a]);
        // El dedo sigue sobre «a», que ya se borró: no toca a nadie más.
        expect(nearestStroke(notes, () => RECT, BODY, 140, 212, skip)?.stroke).not.toBe(a);
    });

    it('borra el trazo mismo, no el que quede en su número', () => {
        const left = withoutStroke(notes, 'n1', a);
        expect(left[0]!.strokes).toEqual([b]);
        // Repetir el borrado del mismo trazo no se lleva a «b».
        expect(withoutStroke(left, 'n1', a)[0]!.strokes).toEqual([b]);
        expect(withoutStroke(left, 'n1', b)).toEqual([]);
    });
});

describe('trazo puente', () => {
    it('se muestra mientras lo dibujado es lo que había al soltar', () => {
        const at = inkSignature([{ id: 'n1', strokes: [stroke(210)] }]);
        expect(showsBridge(at, at)).toBe(true);
        // Llegó la nota con el trazo nuevo: el puente sobra.
        expect(showsBridge(at, inkSignature([{ id: 'n1', strokes: [stroke(210), stroke(260)] }]))).toBe(false);
    });

    it('REGRESIÓN: al borrar con la goma el puente NO vuelve (era el trazo fantasma)', () => {
        const before = inkSignature([{ id: 'n1', strokes: [stroke(210), stroke(260)] }]);
        const afterErase = inkSignature([{ id: 'n1', strokes: [stroke(210)] }]);
        expect(showsBridge(before, afterErase)).toBe(false);
        expect(showsBridge(null, afterErase)).toBe(false);
    });
});
