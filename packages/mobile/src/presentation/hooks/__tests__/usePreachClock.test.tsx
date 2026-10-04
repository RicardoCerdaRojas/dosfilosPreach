import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { newClock, startClock } from '@dosfilos/domain';

import { readPreachSession, savePreachSession } from '@/data/offline/preachSession';
import { usePreachClock } from '../usePreachClock';

jest.mock('expo-haptics', () => ({
    notificationAsync: jest.fn(() => Promise.resolve()),
    impactAsync: jest.fn(() => Promise.resolve()),
    NotificationFeedbackType: { Warning: 'warning' },
    ImpactFeedbackStyle: { Light: 'light' },
}));
const haptics = jest.requireMock('expo-haptics') as {
    notificationAsync: jest.Mock;
    impactAsync: jest.Mock;
};

type Api = ReturnType<typeof usePreachClock>;
const T0 = 1_800_000_000_000;
const MIN = 60_000;

function Sonda({
    onApi,
    onRestore = () => undefined,
    targetMinutes = 30,
    withHaptics = true,
}: {
    onApi: (api: Api) => void;
    onRestore?: (place: { sectionIndex: number; pageIndex: number }) => void;
    targetMinutes?: number;
    withHaptics?: boolean;
}) {
    const api = usePreachClock({
        sermonId: 's1',
        sectionSlugs: ['a', 'b'],
        sectionSlug: 'a',
        pageIndex: 0,
        targetMinutes,
        haptics: withHaptics,
        budgetsFor: () => [],
        onRestore,
    });
    onApi(api);
    return null;
}

/** Deja correr las promesas de AsyncStorage dentro de `act`. */
const flush = () =>
    act(async () => {
        for (let i = 0; i < 5; i++) await Promise.resolve();
    });

let renderer: ReactTestRenderer | undefined;

beforeEach(async () => {
    jest.useFakeTimers({ now: T0 });
    await AsyncStorage.clear();
    haptics.notificationAsync.mockClear();
    haptics.impactAsync.mockClear();
});

afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
    jest.useRealTimers();
});

describe('reloj del atril (usePreachClock)', () => {
    it('retoma el lugar, el reloj y la HORA DE TÉRMINO guardados', async () => {
        const endAt = T0 + 40 * MIN;
        await savePreachSession('s1', { clock: startClock(newClock('b'), T0), sectionSlug: 'b', pageIndex: 2, endAt }, T0);
        jest.setSystemTime(T0 + MIN);

        let api: Api | undefined;
        const onRestore = jest.fn();
        act(() => {
            renderer = create(<Sonda onApi={(a) => (api = a)} onRestore={onRestore} />);
        });
        await flush();

        expect(onRestore).toHaveBeenCalledWith({ sectionIndex: 1, pageIndex: 2 });
        expect(api?.endAt).toBe(endAt);
        expect(api?.running).toBe(true);
        // Con hora de término, la duración es lo predicado más lo que falta.
        expect(api?.targetSeconds).toBe(40 * 60);
    });

    it('la hora de término se guarda con la sesión, y reiniciar la quita', async () => {
        let api: Api | undefined;
        act(() => {
            renderer = create(<Sonda onApi={(a) => (api = a)} />);
        });
        await flush();
        act(() => api!.ensureStarted());
        act(() => api!.setEndAt(T0 + 25 * MIN));
        await flush();
        expect((await readPreachSession('s1', T0))?.endAt).toBe(T0 + 25 * MIN);

        act(() => api!.reset());
        await flush();
        expect(api?.endAt).toBeNull();
        expect(await readPreachSession('s1', T0)).toBeNull();
    });

    it('el aviso del 80 % se siente en la mano una sola vez', async () => {
        let api: Api | undefined;
        act(() => {
            renderer = create(<Sonda onApi={(a) => (api = a)} targetMinutes={1} />);
        });
        await flush();
        act(() => api!.ensureStarted());
        act(() => jest.advanceTimersByTime(47_000));
        expect(haptics.notificationAsync).not.toHaveBeenCalled();
        act(() => jest.advanceTimersByTime(2_000));
        expect(haptics.notificationAsync).toHaveBeenCalledTimes(1);
        act(() => jest.advanceTimersByTime(5_000));
        expect(haptics.notificationAsync).toHaveBeenCalledTimes(1);
    });

    it('en tinta electrónica (sin motor háptico) no pulsa', async () => {
        let api: Api | undefined;
        act(() => {
            renderer = create(<Sonda onApi={(a) => (api = a)} targetMinutes={1} withHaptics={false} />);
        });
        await flush();
        act(() => api!.ensureStarted());
        act(() => jest.advanceTimersByTime(60_000));
        expect(haptics.notificationAsync).not.toHaveBeenCalled();
    });
});
