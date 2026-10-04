import { describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { READING_MODES } from '@/core/theme/readingModes';
import { PreachSettingsSheet } from '../PreachSettingsSheet';

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const noop = () => undefined;

function render(onClose: () => void = noop) {
    let r!: ReactTestRenderer;
    act(() => {
        r = create(
            <PreachSettingsSheet
                visible
                onClose={onClose}
                tokens={READING_MODES.claro}
                readingMode="claro"
                setReadingMode={noop}
                fontSize={30}
                setFontSize={noop}
                senseLines={false}
                setSenseLines={noop}
                gazeLine={false}
                setGazeLine={noop}
                statusBarMode="full"
                setStatusBarMode={noop}
                panelMode="full"
                setPanelMode={noop}
                panelRatio={0.3}
                setPanelRatio={noop}
                deliveryFace="lexend"
                setDeliveryFace={noop}
                hangingIndent={false}
                setHangingIndent={noop}
                readingPage={false}
                setReadingPage={noop}
                readingFocus={false}
                setReadingFocus={noop}
                collapseQuotes={false}
                setCollapseQuotes={noop}
                brightness={null}
                setBrightness={noop}
                targetMinutes={30}
                onPickDuration={noop}
                endAt={null}
                onToggleEndAt={noop}
                onShiftEndAt={noop}
                onResetClock={noop}
                budgets={[]}
                onSetBudget={noop}
            />,
        );
    });
    return r;
}

const ancestors = (node: ReactTestInstance) => {
    const list: ReactTestInstance[] = [];
    for (let n = node.parent; n; n = n.parent) list.push(n);
    return list;
};

describe('el cajón de ajustes del atril', () => {
    it('REGRESIÓN: la lista se desplaza — acotada por estilo y fuera de todo lo tocable', () => {
        const r = render();
        const scroll = r.root.findByProps({ testID: 'settings-scroll' });
        expect(scroll.type).toBe(ScrollView);
        // Acotada por estilo: con la clase, el alto podía no llegar y la
        // lista crecía al alto de su contenido, sin nada que desplazar.
        expect(StyleSheet.flatten(scroll.props.style)).toMatchObject({ flex: 1 });
        const root = ancestors(scroll).filter((n) => n.type === View).pop()!;
        expect(StyleSheet.flatten(root.props.style)).toMatchObject({ flex: 1 });
        // Ningún ancestro tocable se queda con el gesto del dedo.
        expect(ancestors(scroll).some((n) => typeof n.props.onPress === 'function')).toBe(false);
    });

    it('«Citas plegadas» está dentro de la lista que se desplaza', () => {
        const r = render();
        const scroll = r.root.findByProps({ testID: 'settings-scroll' });
        expect(scroll.findAll((n) => n.props.children === 'preach:collapse_quotes').length).toBeGreaterThan(0);
    });

    it('tocar fuera del cajón lo cierra', () => {
        const close = jest.fn();
        const r = render(close);
        act(() => r.root.findByProps({ testID: 'settings-backdrop' }).props.onPress());
        expect(close).toHaveBeenCalled();
    });
});
