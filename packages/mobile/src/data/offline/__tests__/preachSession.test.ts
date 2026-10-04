import { beforeEach, describe, expect, it } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { elapsedMs, newClock, startClock } from '@dosfilos/domain';

import {
    RESUME_GAP_MS,
    SESSION_MAX_AGE_MS,
    SESSION_PREFIX,
    SESSION_SAVE_EVERY_MS,
    clearPreachSession,
    readPreachSession,
    resumeClock,
    savePreachSession,
} from '../preachSession';
import { clearOfflineData } from '../offlineSermons';

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

describe('retomar sin inflar el reloj (revisión adversarial de A4)', () => {
    const MIN = 60_000;

    it('REGRESIÓN: la app muerta dos horas vuelve PAUSADA en el último guardado, no con dos horas de más', () => {
        // Predicó 40 min (9:00 → 9:40), último guardado 9:40, abre a las 11:40.
        const clock = startClock(newClock('punto-3'), 0);
        const vuelta = resumeClock({ clock, sectionSlug: 'punto-3', pageIndex: 4, savedAt: 40 * MIN }, 160 * MIN);
        expect(vuelta.running).toBe(false);
        expect(elapsedMs(vuelta, 160 * MIN)).toBe(40 * MIN);
    });

    it('una vuelta rápida (una llamada, un minuto) sigue corriendo: estaba predicando', () => {
        const clock = startClock(newClock('punto-3'), 0);
        const vuelta = resumeClock({ clock, sectionSlug: 'punto-3', pageIndex: 4, savedAt: 40 * MIN }, 41 * MIN);
        expect(vuelta.running).toBe(true);
        expect(elapsedMs(vuelta, 41 * MIN)).toBe(41 * MIN);
    });

    it('invariante: el umbral para retomar corriendo deja varios guardados de margen', () => {
        expect(RESUME_GAP_MS).toBeGreaterThanOrEqual(5 * SESSION_SAVE_EVERY_MS);
    });

    it('cerrar sesión borra las sesiones del atril (mismo prefijo que el guardado)', async () => {
        await savePreachSession('s1', { clock: newClock(), sectionSlug: null, pageIndex: 0 }, 1);
        await clearOfflineData();
        expect(await readPreachSession('s1', 2)).toBeNull();
        expect(SESSION_PREFIX).toBe('preach-session:');
    });
});
