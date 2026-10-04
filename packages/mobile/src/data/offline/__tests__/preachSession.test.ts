import { beforeEach, describe, expect, it } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { elapsedMs, newClock, startClock } from '@dosfilos/domain';

import { SESSION_MAX_AGE_MS, clearPreachSession, readPreachSession, savePreachSession } from '../preachSession';

beforeEach(async () => {
    await AsyncStorage.clear();
});

describe('sesión del atril', () => {
    it('la app cerrada a mitad del sermón retoma el lugar y el reloj sigue contando', async () => {
        const clock = startClock(newClock('punto-1'), 1_000_000);
        await savePreachSession('s1', { clock, sectionSlug: 'punto-1', pageIndex: 2 }, 1_000_000);
        const vuelta = await readPreachSession('s1', 1_000_000 + 120_000);
        expect(vuelta).toMatchObject({ sectionSlug: 'punto-1', pageIndex: 2 });
        expect(elapsedMs(vuelta!.clock, 1_000_000 + 120_000)).toBe(120_000);
    });

    it('una sesión de hace más de 4 horas no es esta predicación: se descarta', async () => {
        await savePreachSession('s1', { clock: newClock(), sectionSlug: null, pageIndex: 0 }, 0);
        expect(await readPreachSession('s1', SESSION_MAX_AGE_MS + 1)).toBeNull();
        expect(await AsyncStorage.getItem('preach-session:s1')).toBeNull();
    });

    it('al salir del atril se borra', async () => {
        await savePreachSession('s1', { clock: newClock(), sectionSlug: null, pageIndex: 0 }, 0);
        await clearPreachSession('s1');
        expect(await readPreachSession('s1', 1)).toBeNull();
    });
});
