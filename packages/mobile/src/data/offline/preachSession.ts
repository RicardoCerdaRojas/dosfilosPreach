import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PreachClock } from '@dosfilos/domain';

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

const key = (sermonId: string) => `preach-session:${sermonId}`;

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
