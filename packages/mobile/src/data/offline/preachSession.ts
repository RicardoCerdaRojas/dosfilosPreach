import AsyncStorage from '@react-native-async-storage/async-storage';
import { pauseClock, type PreachClock } from '@dosfilos/domain';

/**
 * La sesión del atril, para retomarla (A4).
 *
 * Si el sistema mata la app a mitad del sermón —memoria, una llamada, el
 * pastor que la cerró sin querer—, al volver se abría en la primera página y
 * con el reloj en cero. Ahora se guarda el lugar y el reloj en cada cambio
 * (no en cada segundo: el reloj se calcula contra la hora, así que guardarlo
 * cuando cambia de estado alcanza) y se retoma si es reciente.
 */
export interface PreachSession {
    clock: PreachClock;
    sectionSlug: string | null;
    pageIndex: number;
    savedAt: number;
}

/** Más vieja que esto, no es la misma predicación: se descarta. */
export const SESSION_MAX_AGE_MS = 4 * 60 * 60 * 1000;

/** Prefijo de las claves: cerrar sesión las borra (clearOfflineData). */
export const SESSION_PREFIX = 'preach-session:';
const key = (sermonId: string) => `${SESSION_PREFIX}${sermonId}`;

/** Mientras el reloj corre, la sesión se guarda al menos cada tanto. */
export const SESSION_SAVE_EVERY_MS = 30 * 1000;
/**
 * Si al retomar pasó más que esto desde el último guardado, la app estuvo
 * MUERTA, no predicando: el reloj vuelve pausado en el último guardado.
 * Antes volvía corriendo y sumaba las horas con la app cerrada — el pulso del
 * 80 % sonaba en el primer segundo y el registro salía inflado (revisión
 * adversarial de A4). Tiene que ser bastante mayor que SESSION_SAVE_EVERY_MS.
 */
export const RESUME_GAP_MS = 5 * 60 * 1000;

/** El reloj de una sesión retomada. */
export function resumeClock(session: PreachSession, now: number): PreachClock {
    if (session.clock.running && now - session.savedAt > RESUME_GAP_MS) {
        return pauseClock(session.clock, session.savedAt);
    }
    return session.clock;
}

export async function savePreachSession(
    sermonId: string,
    session: Omit<PreachSession, 'savedAt'>,
    now: number = Date.now(),
): Promise<void> {
    const saved: PreachSession = { ...session, savedAt: now };
    await AsyncStorage.setItem(key(sermonId), JSON.stringify(saved));
}

export async function readPreachSession(sermonId: string, now: number): Promise<PreachSession | null> {
    const raw = await AsyncStorage.getItem(key(sermonId));
    if (!raw) return null;
    try {
        const session = JSON.parse(raw) as PreachSession;
        if (now - session.savedAt > SESSION_MAX_AGE_MS) {
            await AsyncStorage.removeItem(key(sermonId));
            return null;
        }
        return session;
    } catch {
        return null;
    }
}

export async function clearPreachSession(sermonId: string): Promise<void> {
    await AsyncStorage.removeItem(key(sermonId));
}
