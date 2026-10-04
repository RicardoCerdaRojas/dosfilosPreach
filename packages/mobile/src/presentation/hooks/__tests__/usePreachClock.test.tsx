import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { newClock, startClock } from '@dosfilos/domain';

import { EIGHTY_PERCENT_CUE, FIVE_MINUTES_CUE, overrunCue } from '@dosfilos/domain';
import { readPreachSession, savePreachSession } from '@/data/offline/preachSession';
import { READING_SLUG, pulseFor, usePreachClock } from '../usePreachClock';

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
    sectionSlug = 'a',
}: {
    onApi: (api: Api) => void;
    onRestore?: (place: { sectionIndex: number; pageIndex: number; onReading: boolean }) => void;
    targetMinutes?: number;
    withHaptics?: boolean;
    sectionSlug?: string;
}) {
    const api = usePreachClock({
        sermonId: 's1',
        sectionSlugs: ['a', 'b'],
        sectionSlug,
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

afterEach(async () => {
    act(() => renderer?.unmount());
    renderer = undefined;
    // Un guardado en vuelo de esta prueba no puede aterrizar en la siguiente.
    await flush();
    await AsyncStorage.clear();
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

        expect(onRestore).toHaveBeenCalledWith({ sectionIndex: 1, pageIndex: 2, onReading: false });
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

    it('REGRESIÓN: una hora de término ya pasada (de otro culto) no se retoma', async () => {
        await savePreachSession(
            's1',
            { clock: startClock(newClock('a'), T0), sectionSlug: 'a', pageIndex: 0, endAt: T0 + 2 * MIN },
            T0 + MIN,
        );
        jest.setSystemTime(T0 + 3 * MIN);
        let api: Api | undefined;
        act(() => {
            renderer = create(<Sonda onApi={(a) => (api = a)} />);
        });
        await flush();
        expect(api?.endAt).toBeNull();
        expect(api?.targetSeconds).toBe(30 * 60);
    });

    it('REGRESIÓN: con hora de término y el reloj quieto, lo que queda baja igual', async () => {
        let api: Api | undefined;
        act(() => {
            renderer = create(<Sonda onApi={(a) => (api = a)} />);
        });
        await flush();
        expect(api?.clock.running).toBe(false);
        expect(api?.clock.accumulatedMs).toBe(0);
        // Abrió el atril y 20 minutos después pone la hora: cuenta desde AHORA.
        jest.setSystemTime(T0 + 20 * MIN);
        act(() => api!.setEndAt(T0 + 50 * MIN));
        expect(api?.targetSeconds).toBe(30 * 60);
        act(() => jest.advanceTimersByTime(10 * MIN));
        expect(api?.targetSeconds).toBe(20 * 60);
    });

    it('REGRESIÓN: el tiempo de la Lectura no se carga a la introducción', async () => {
        let api: Api | undefined;
        act(() => {
            renderer = create(<Sonda onApi={(a) => (api = a)} sectionSlug={READING_SLUG} />);
        });
        await flush();
        act(() => api!.ensureStarted());
        expect(api?.clock.slug).toBe(READING_SLUG);
    });

    it('retomar en la Lectura vuelve a la Lectura', async () => {
        await savePreachSession('s1', { clock: startClock(newClock(READING_SLUG), T0), sectionSlug: READING_SLUG, pageIndex: 0 }, T0);
        const onRestore = jest.fn();
        let api: Api | undefined;
        act(() => {
            renderer = create(<Sonda onApi={(a) => (api = a)} onRestore={onRestore} />);
        });
        await flush();
        expect(onRestore).toHaveBeenCalledWith({ sectionIndex: 0, pageIndex: 0, onReading: true });
        expect(api?.clock.slug).toBe(READING_SLUG);
    });

    it('REGRESIÓN: al salir, el tic no recrea la sesión borrada', async () => {
        let api: Api | undefined;
        act(() => {
            renderer = create(<Sonda onApi={(a) => (api = a)} />);
        });
        await flush();
        act(() => api!.ensureStarted());
        await flush();
        act(() => api!.finish());
        await flush();
        act(() => jest.advanceTimersByTime(60_000));
        await flush();
        expect(await readPreachSession('s1', Date.now())).toBeNull();
    });

    it('un pulso por tic: el 80 % y los 5 minutos juntos no son dos', () => {
        expect(pulseFor([EIGHTY_PERCENT_CUE, FIVE_MINUTES_CUE])).toBe('warning');
        expect(pulseFor([overrunCue('a')])).toBe('light');
        expect(pulseFor([overrunCue('a'), FIVE_MINUTES_CUE])).toBe('warning');
        expect(pulseFor([])).toBeNull();
    });
});
