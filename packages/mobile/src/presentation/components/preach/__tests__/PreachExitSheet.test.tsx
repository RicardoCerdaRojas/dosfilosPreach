import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TextInput, TouchableOpacity } from 'react-native';

import { PreachExitSheet } from '../PreachExitSheet';
import { READING_MODES } from '@/core/theme/readingModes';
import { useReaderSettingsStore } from '@/presentation/state/readerSettings.store';

// jest sube los mocks por encima de los imports.

jest.mock('@/presentation/hooks/useSermons', () => {
    const mutate = jest.fn();
    return { __mutate: mutate, useAddPreachingLog: () => ({ mutate }) };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));


const mutate = (jest.requireMock('@/presentation/hooks/useSermons') as { __mutate: jest.Mock<any> }).__mutate;

function abrir(onLeave = jest.fn()) {
    let tree!: ReactTestRenderer;
    act(() => {
        tree = create(
            <PreachExitSheet
                visible
                tokens={READING_MODES.claro}
                report={{ rows: [], totalActual: 0, totalBudget: 0 }}
                sermonId="s1"
                elapsedSeconds={38 * 60}
                onClose={jest.fn()}
                onLeave={onLeave}
            />,
        );
    });
    const guardar = tree.root
        .findAllByType(TouchableOpacity)
        .find((n) => n.props.accessibilityLabel === 'preach:log_save')!;
    return { tree, guardar };
}

describe('registro al bajar del púlpito', () => {
    beforeEach(() => {
        mutate.mockClear();
        useReaderSettingsStore.setState({ lastPreachingPlace: '' });
    });

    it('REGRESIÓN: sin escribir el lugar se registra igual (el botón lo exigía)', () => {
        const onLeave = jest.fn();
        const { guardar } = abrir(onLeave);
        expect(guardar.props.disabled).toBeFalsy();
        act(() => guardar.props.onPress());
        expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ location: '', durationMinutes: 38 }));
        expect(onLeave).toHaveBeenCalled();
    });

    it('el lugar de la vez anterior viene escrito', () => {
        useReaderSettingsStore.setState({ lastPreachingPlace: 'Iglesia Central' });
        const { guardar } = abrir();
        act(() => guardar.props.onPress());
        expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ location: 'Iglesia Central' }));
    });

    it('un lugar nuevo queda recordado para la próxima', () => {
        const { tree } = abrir();
        const lugar = tree.root
            .findAllByType(TextInput)
            .find((n) => n.props.placeholder === 'preach:log_place')!;
        act(() => lugar.props.onChangeText('Retiro de jóvenes'));
        const guardarAhora = tree.root
            .findAllByType(TouchableOpacity)
            .find((n) => n.props.accessibilityLabel === 'preach:log_save')!;
        act(() => guardarAhora.props.onPress());
        expect(useReaderSettingsStore.getState().lastPreachingPlace).toBe('Retiro de jóvenes');
    });
});
