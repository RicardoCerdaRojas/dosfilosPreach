import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { AppState, Platform } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { usePreachBrightness } from '../usePreachBrightness';

jest.mock('expo-brightness', () => ({
    getBrightnessAsync: jest.fn(() => Promise.resolve(0.35)),
    setBrightnessAsync: jest.fn(() => Promise.resolve()),
    restoreSystemBrightnessAsync: jest.fn(() => Promise.resolve()),
}));
const brightness = jest.requireMock('expo-brightness') as Record<
    'getBrightnessAsync' | 'setBrightnessAsync' | 'restoreSystemBrightnessAsync',
    jest.Mock
>;

let appStateListener: ((state: string) => void) | null = null;
const remove = jest.fn();

function Sonda({ level }: { level: number | null }) {
    usePreachBrightness(level);
    return null;
}

const flush = () =>
    act(async () => {
        for (let i = 0; i < 5; i++) await Promise.resolve();
    });

const originalOS = Platform.OS;
let renderer: ReactTestRenderer;

beforeEach(() => {
    Object.values(brightness).forEach((m) => m.mockClear());
    remove.mockClear();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, fn: (s: string) => void) => {
        appStateListener = fn;
        return { remove } as never;
    }) as never);
});
afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    jest.restoreAllMocks();
});

describe('brillo del atril', () => {
    it('iOS: pone el del atril y al salir repone el que había', async () => {
        Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
        act(() => {
            renderer = create(<Sonda level={0.8} />);
        });
        await flush();
        expect(brightness.setBrightnessAsync).toHaveBeenLastCalledWith(0.8);

        act(() => renderer.unmount());
        await flush();
        expect(brightness.setBrightnessAsync).toHaveBeenLastCalledWith(0.35);
        expect(remove).toHaveBeenCalled();
    });

    it('iOS: en segundo plano repone el original, y al volver pone el del atril', async () => {
        Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
        act(() => {
            renderer = create(<Sonda level={0.8} />);
        });
        await flush();
        await act(async () => appStateListener?.('background'));
        expect(brightness.setBrightnessAsync).toHaveBeenLastCalledWith(0.35);
        await act(async () => appStateListener?.('active'));
        expect(brightness.setBrightnessAsync).toHaveBeenLastCalledWith(0.8);
        act(() => renderer.unmount());
    });

    it('Android: al salir vuelve al brillo del sistema', async () => {
        Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
        act(() => {
            renderer = create(<Sonda level={0.6} />);
        });
        await flush();
        expect(brightness.setBrightnessAsync).toHaveBeenLastCalledWith(0.6);
        act(() => renderer.unmount());
        await flush();
        expect(brightness.restoreSystemBrightnessAsync).toHaveBeenCalled();
    });

    it('sin brillo propio no toca nada', async () => {
        act(() => {
            renderer = create(<Sonda level={null} />);
        });
        await flush();
        act(() => renderer.unmount());
        await flush();
        expect(brightness.setBrightnessAsync).not.toHaveBeenCalled();
        expect(brightness.restoreSystemBrightnessAsync).not.toHaveBeenCalled();
    });
});
