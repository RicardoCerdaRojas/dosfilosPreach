import { describe, expect, it } from '@jest/globals';
import type { InkStroke } from '@dosfilos/domain';
import { toNoteSpace } from '@dosfilos/domain';

import { READING_MODES } from '@/core/theme/readingModes';

import { inkColorFor, inkSignature, inkTouchMode, nearestStroke, noteWithStroke, showsBridge, touchWrites, withStrokeRestored, withoutStroke } from '../inkGeometry';

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

describe('deshacer necesita reconocer el trazo', () => {
    const a = stroke(210);
    const b = stroke(260);

    it('un trazo releído de Firestore (otro objeto, mismos puntos) es el mismo trazo', () => {
        const copy = JSON.parse(JSON.stringify(a)) as InkStroke;
        expect(noteWithStroke([{ id: 'n1', strokes: [copy] }], a)?.id).toBe('n1');
        expect(withoutStroke([{ id: 'n1', strokes: [copy, b] }], 'n1', a)[0]!.strokes).toEqual([b]);
    });

    it('lápiz y resaltador con los mismos puntos no son el mismo trazo', () => {
        const highlighter: InkStroke = { ...a, tool: 'highlighter' };
        expect(noteWithStroke([{ id: 'n1', strokes: [highlighter] }], a)).toBeNull();
    });

    it('vuelve a poner el trazo donde estaba, o la nota entera si se había ido', () => {
        expect(withStrokeRestored([{ id: 'n1', strokes: [b] }], { id: 'n1', strokes: [] }, a, 0)[0]!.strokes).toEqual([a, b]);
        expect(withStrokeRestored([], { id: 'n1', strokes: [a, b] }, a, 0)).toEqual([{ id: 'n1', strokes: [a] }]);
        // Si ya está, no lo duplica.
        expect(withStrokeRestored([{ id: 'n1', strokes: [a] }], { id: 'n1', strokes: [] }, a, 0)[0]!.strokes).toEqual([a]);
    });
});

describe('sólo Apple Pencil (T-9)', () => {
    it('con la opción, escribe el lápiz y el dedo navega', () => {
        expect(touchWrites(true, true)).toBe(true);
        expect(touchWrites(false, true)).toBe(false);
    });

    it('sin la opción, escribe cualquiera (como siempre)', () => {
        expect(touchWrites(false, false)).toBe(true);
        expect(touchWrites(true, false)).toBe(true);
    });
});

describe('con la tinta activa en la Biblia: escribir o desplazar', () => {
    it('REGRESIÓN: dos dedos desplazan siempre (antes la capa se los tragaba)', () => {
        expect(inkTouchMode(2, false, false)).toBe('scroll');
        expect(inkTouchMode(2, true, true)).toBe('scroll');
    });

    it('el lápiz escribe; un dedo escribe salvo con «sólo Apple Pencil», que desplaza', () => {
        expect(inkTouchMode(1, true, true)).toBe('draw');
        expect(inkTouchMode(1, false, false)).toBe('draw');
        expect(inkTouchMode(1, false, true)).toBe('scroll');
    });
});


describe('colores de la tinta', () => {
    const tokens = { ...READING_MODES.claro };
    it('verde y amarillo existen, y el resaltador amarillo es amarillo de verdad (no ámbar)', () => {
        expect(inkColorFor('green', tokens)).toBe(tokens.timerOk);
        expect(inkColorFor('yellow', tokens)).toBe(tokens.timerWarn);
        expect(inkColorFor('yellow', tokens, true)).toBe('#facc15');
        expect(inkColorFor('ink', tokens, true)).toBe(tokens.textPrimary);
    });

    it('en tinta electrónica todo es negro', () => {
        expect(inkColorFor('yellow', READING_MODES.eink, true)).toBe(READING_MODES.eink.textPrimary);
    });
});
