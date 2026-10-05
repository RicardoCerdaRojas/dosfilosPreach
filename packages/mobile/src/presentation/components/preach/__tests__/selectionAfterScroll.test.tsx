import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { buildReadingBlocks } from '@dosfilos/domain';

import { SelectableParagraph } from '../SelectableParagraph';

const noop = () => undefined;
/** Dónde está el párrafo en la ventana: lo que cambia al desplazar. */
let windowY = 100;

beforeEach(() => {
    jest.useFakeTimers();
    windowY = 100;
});
afterEach(() => {
    jest.useRealTimers();
});

function render(onSelectionChange: (range: { start: number; end: number } | null) => void) {
    const [block] = buildReadingBlocks('Jonás huyó a Tarsis.');
    let r!: ReactTestRenderer;
    act(() => {
        r = create(
            <SelectableParagraph
                units={block!.units}
                fontSize={30}
                lineHeight={42}
                color="#000"
                selection={null}
                selectionColor="#ff0"
                styleAt={() => null}
                onSelectionChange={onSelectionChange}
                onSelectionEnd={noop}
                onTapAt={noop}
                onPressCitation={noop}
                faceClass=""
            />,
        );
    });
    // Cada palabra en el renglón 0–42 del párrafo, de 100 de ancho.
    const container = r.root.findAllByType(View)[0]!;
    // La vista simulada de jest no mide: se le enseña a responder dónde está.
    const node = r.root.findAll((n) => n.instance && typeof n.instance.measureInWindow === 'function')[0]!;
    node.instance.measureInWindow = (cb: (x: number, y: number) => void) => cb(0, windowY);
    act(() => container.props.onLayout?.({ nativeEvent: { layout: { x: 0, y: 0, width: 600, height: 42 } } }));
    container
        .findAllByType(View)
        .filter((v) => v !== container && typeof v.props.onLayout === 'function')
        .forEach((v, i) =>
            act(() => v.props.onLayout({ nativeEvent: { layout: { x: i * 100, y: 0, width: 100, height: 42 } } })),
        );
    return { r, container };
}

describe('marcar en el documento que se desplaza', () => {
    it('REGRESIÓN: después de desplazar, un toque largo marca la palabra que está bajo el dedo', () => {
        const change = jest.fn();
        const { container } = render(change);
        // El documento bajó 300: el párrafo ahora está 300 más arriba en la ventana.
        windowY = -200;
        act(() => container.props.onTouchStart({ nativeEvent: { pageX: 150, pageY: -180 } }));
        act(() => {
            jest.advanceTimersByTime(300);
        });
        // «huyó» (la segunda palabra, x 100–200), no nada ni otro renglón.
        expect(change).toHaveBeenCalledWith({ start: 6, end: 10 });
    });
});
