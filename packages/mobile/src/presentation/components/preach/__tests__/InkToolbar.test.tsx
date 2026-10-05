import { describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { Alert } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { READING_MODES } from '@/core/theme/readingModes';
import { InkToolbar, type InkControls } from '../InkToolbar';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const controls = (over: Partial<InkControls> = {}): InkControls => ({
    tool: 'pen',
    setTool: jest.fn(),
    width: 'fine',
    setWidth: jest.fn(),
    penColor: 'ink',
    setPenColor: jest.fn(),
    eraser: false,
    setEraser: jest.fn(),
    undo: jest.fn(),
    redo: jest.fn(),
    canUndo: true,
    canRedo: false,
    ...over,
});

function render(ink: InkControls, clearOptions = [{ label: 'Esta página', onPress: jest.fn() }]) {
    let r!: ReactTestRenderer;
    act(() => {
        r = create(
            <InkToolbar
                tokens={READING_MODES.claro}
                ink={ink}
                visible
                onToggleVisible={jest.fn()}
                clearOptions={clearOptions}
                onDone={jest.fn()}
            />,
        );
    });
    return r;
}
/** El botón con esa etiqueta: el primer nodo que la lleva y responde al toque. */
const button = (r: ReactTestRenderer, label: string) =>
    r.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0]!;

describe('barra de la tinta', () => {

    it('la goma es una goma (no una varita) y se ve cuándo está activa', () => {
        const r = render(controls({ eraser: true }));
        const eraser = button(r, 'preach:eraser');
        expect(eraser.props.accessibilityState.selected).toBe(true);
        expect(eraser.findAll((n) => n.props.name === 'eraser').length).toBeGreaterThan(0);
    });

    it('deshacer se apaga cuando no hay nada que deshacer', () => {
        const ink = controls({ canUndo: false });
        const r = render(ink);
        expect(button(r, 'preach:ink_undo').props.disabled).toBe(true);
        expect(button(r, 'preach:ink_redo').props.disabled).toBe(true);
    });

    it('elegir el resaltador apaga la goma', () => {
        const ink = controls({ eraser: true });
        const r = render(ink);
        act(() => button(r, 'preach:ink_highlighter').props.onPress());
        expect(ink.setTool).toHaveBeenCalledWith('highlighter');
        expect(ink.setEraser).toHaveBeenCalledWith(false);
    });

    it('borrar pide confirmación con las opciones de esta pantalla', () => {
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
        const page = jest.fn();
        const r = render(controls(), [{ label: 'Esta página', onPress: page }, { label: 'Todo el sermón', onPress: jest.fn() }]);
        act(() => button(r, 'preach:ink_clear').props.onPress());
        const options = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
        expect(options.map((o) => o.text)).toEqual(['Esta página', 'Todo el sermón', 'common:cancel']);
        options[0]!.onPress?.();
        expect(page).toHaveBeenCalled();
        alert.mockRestore();
    });

    it('el botón de «sólo Apple Pencil» aparece sólo donde se puede usar', () => {
        expect(button(render(controls()), 'preach:ink_pencil_only')).toBeUndefined();
        const toggle = jest.fn();
        let r!: ReactTestRenderer;
        act(() => {
            r = create(
                <InkToolbar
                    tokens={READING_MODES.claro}
                    ink={controls()}
                    visible
                    onToggleVisible={jest.fn()}
                    clearOptions={[]}
                    onDone={jest.fn()}
                    pencilOnly={{ on: true, toggle }}
                />,
            );
        });
        const pencil = button(r, 'preach:ink_pencil_only');
        expect(pencil.props.accessibilityState.selected).toBe(true);
        act(() => pencil.props.onPress());
        expect(toggle).toHaveBeenCalled();
    });
});
