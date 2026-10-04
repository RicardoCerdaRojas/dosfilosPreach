import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Sermon } from '@dosfilos/domain';

import type { SermonSummary } from '@/domain/models/sermon.model';

/**
 * El domingo sin red (A1 de la fase Púlpito premium).
 *
 * Hasta acá el maletín GUARDABA el sermón y nadie lo leía: el atril y el
 * detalle iban sólo a Firestore, y la lista sólo al callable. Con la app
 * recién abierta y sin red, el inicio decía «no tienes sermones» y el atril
 * quedaba en un spinner. El check verde prometía algo que no existía.
 *
 * La regla de ahora: se pide a la red con un PLAZO; si no contesta a tiempo o
 * falla, se usa lo guardado. El plazo importa tanto como el respaldo: en una
 * iglesia el WiFi casi nunca está caído del todo, está lento, y una pantalla
 * que espera 30 s a un servidor es tan inútil como una que falla.
 */

export const BRIEFCASE_PREFIX = 'briefcase:';
const LIST_PREFIX = 'sermon-list:';

export const briefcaseKey = (sermonId: string) => `${BRIEFCASE_PREFIX}${sermonId}`;
const listKey = (uid: string) => `${LIST_PREFIX}${uid}`;

/** Con copia en el maletín, la red tiene este tiempo para contestar. */
export const SERMON_DEADLINE_MS = 6000;
/** La lista pesa más (callable + series): un poco más de margen. */
export const LIST_DEADLINE_MS = 9000;

export interface BriefcaseEntry {
    sermon: Sermon;
    savedAt: string;
}

export type Origin = 'live' | 'briefcase' | 'snapshot';

export class DeadlineError extends Error {
    constructor() {
        super('deadline');
        this.name = 'DeadlineError';
    }
}

/** La promesa, o un error si no resuelve en `ms`. No la cancela: la deja correr. */
export function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new DeadlineError()), ms);
    });
    return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

// ── JSON ↔ fechas ───────────────────────────────────────────────────────────
// JSON convierte las fechas en texto. Sin revivirlas, `getTime()` revienta en
// la primera pantalla que ordena por fecha.

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const asDate = (v: unknown): Date | undefined => {
    if (v instanceof Date) return v;
    if (typeof v === 'string' && ISO.test(v)) {
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
};

export function reviveSermon(raw: any): Sermon {
    return {
        ...raw,
        createdAt: asDate(raw.createdAt) ?? new Date(0),
        updatedAt: asDate(raw.updatedAt) ?? new Date(0),
        publishedAt: asDate(raw.publishedAt),
        scheduledDate: asDate(raw.scheduledDate),
        preachingHistory: (raw.preachingHistory ?? []).map((p: any) => ({
            ...p,
            date: asDate(p.date) ?? new Date(0),
        })),
    } as Sermon;
}

export function reviveSummary(raw: any): SermonSummary {
    return {
        ...raw,
        publishedAt: asDate(raw.publishedAt),
        updatedAt: asDate(raw.updatedAt),
        lastPreachedAt: asDate(raw.lastPreachedAt),
    } as SermonSummary;
}

/** El renglón de lista de un sermón guardado: lo que la lista sabe mostrar. */
export function summaryFromSermon(s: Sermon): SermonSummary {
    const history = s.preachingHistory ?? [];
    const last = history.reduce<Date | undefined>(
        (acc, p) => (!acc || p.date.getTime() > acc.getTime() ? p.date : acc),
        undefined,
    );
    return {
        id: s.id,
        title: s.title,
        status: s.status,
        bibleReferences: s.bibleReferences ?? [],
        tags: s.tags ?? [],
        seriesId: s.seriesId,
        hasContent: (s.content ?? '').trim().length > 0,
        publishedAt: s.publishedAt,
        updatedAt: s.updatedAt,
        versionOf: (s as { versionOf?: string }).versionOf,
        sourceSermonId: (s as { sourceSermonId?: string }).sourceSermonId,
        timesPreached: history.length,
        lastPreachedAt: last,
    };
}

// ── Almacenamiento ─────────────────────────────────────────────────────────

export async function readBriefcase(sermonId: string): Promise<BriefcaseEntry | null> {
    const raw = await AsyncStorage.getItem(briefcaseKey(sermonId));
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return { savedAt: parsed.savedAt, sermon: reviveSermon(parsed.sermon) };
    } catch {
        // Una entrada corrupta es como no tenerla: se re-prepara.
        return null;
    }
}

export async function writeBriefcase(entry: BriefcaseEntry): Promise<void> {
    await AsyncStorage.setItem(briefcaseKey(entry.sermon.id), JSON.stringify(entry));
}

export async function removeBriefcase(sermonId: string): Promise<void> {
    await AsyncStorage.removeItem(briefcaseKey(sermonId));
}

/** Todo lo guardado en el maletín DE ESTE usuario. */
export async function listBriefcase(uid: string): Promise<BriefcaseEntry[]> {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(BRIEFCASE_PREFIX));
    if (keys.length === 0) return [];
    const pairs = await AsyncStorage.multiGet(keys);
    const out: BriefcaseEntry[] = [];
    for (const [, raw] of pairs) {
        if (!raw) continue;
        try {
            const parsed = JSON.parse(raw);
            const sermon = reviveSermon(parsed.sermon);
            // Defensa: una tablet compartida no muestra el maletín de otro.
            if (sermon.userId === uid) out.push({ savedAt: parsed.savedAt, sermon });
        } catch {
            // ignorada: corrupta
        }
    }
    return out;
}

export async function readListSnapshot(uid: string): Promise<SermonSummary[] | null> {
    const raw = await AsyncStorage.getItem(listKey(uid));
    if (!raw) return null;
    try {
        return (JSON.parse(raw) as unknown[]).map(reviveSummary);
    } catch {
        return null;
    }
}

export async function writeListSnapshot(uid: string, summaries: SermonSummary[]): Promise<void> {
    await AsyncStorage.setItem(listKey(uid), JSON.stringify(summaries));
}

/** Al cerrar sesión: nada de lo guardado sobrevive al usuario que lo guardó. */
export async function clearOfflineData(): Promise<void> {
    const keys = (await AsyncStorage.getAllKeys()).filter(
        (k) => k.startsWith(BRIEFCASE_PREFIX) || k.startsWith(LIST_PREFIX),
    );
    if (keys.length) await AsyncStorage.multiRemove(keys);
}

// ── Lectura con respaldo ───────────────────────────────────────────────────

export interface SermonLoadDeps {
    fetchLive: (id: string) => Promise<Sermon | null>;
    read: (id: string) => Promise<BriefcaseEntry | null>;
    write: (entry: BriefcaseEntry) => Promise<void>;
    deadlineMs: number;
    now?: () => Date;
}

export interface SermonLoad {
    sermon: Sermon | null;
    origin: Origin;
    savedAt?: string;
}

/**
 * El sermón: de la red si contesta; si no, del maletín.
 *
 * Con copia en el maletín, la red tiene `deadlineMs` para contestar. Sin
 * copia, se espera lo que haga falta: el SDK de Firestore ya responde desde
 * su caché local cuando no hay red, y no hay otra cosa que mostrar.
 *
 * Cuando la red contesta y el sermón está en el maletín, la copia se renueva:
 * preparar una vez alcanza aunque después se corrija el texto en la web.
 */
export async function loadSermon(id: string, deps: SermonLoadDeps): Promise<SermonLoad> {
    const entry = await deps.read(id).catch(() => null);
    try {
        const live = await (entry ? withDeadline(deps.fetchLive(id), deps.deadlineMs) : deps.fetchLive(id));
        if (live && entry) {
            await deps
                .write({ sermon: live, savedAt: (deps.now?.() ?? new Date()).toISOString() })
                .catch(() => undefined);
        }
        return { sermon: live, origin: 'live' };
    } catch (error) {
        if (entry) return { sermon: entry.sermon, origin: 'briefcase', savedAt: entry.savedAt };
        throw error;
    }
}

export interface ListLoadDeps {
    fetchLive: () => Promise<SermonSummary[]>;
    readSnapshot: () => Promise<SermonSummary[] | null>;
    writeSnapshot: (summaries: SermonSummary[]) => Promise<void>;
    listBriefcase: () => Promise<BriefcaseEntry[]>;
    deadlineMs: number;
}

export interface ListLoad {
    summaries: SermonSummary[];
    origin: Origin;
}

/**
 * La lista: de la red; si no, la última que se vio, más lo que esté en el
 * maletín aunque esa lista no lo tuviera. Lo preparado SIEMPRE aparece: es la
 * promesa del check verde.
 */
export async function loadPublishedList(deps: ListLoadDeps): Promise<ListLoad> {
    try {
        const live = await withDeadline(deps.fetchLive(), deps.deadlineMs);
        await deps.writeSnapshot(live).catch(() => undefined);
        return { summaries: live, origin: 'live' };
    } catch (error) {
        const [snapshot, saved] = await Promise.all([
            deps.readSnapshot().catch(() => null),
            deps.listBriefcase().catch(() => []),
        ]);
        if (!snapshot && saved.length === 0) throw error;
        const byId = new Map((snapshot ?? []).map((s) => [s.id, s]));
        for (const entry of saved) {
            if (!byId.has(entry.sermon.id)) byId.set(entry.sermon.id, summaryFromSermon(entry.sermon));
        }
        return { summaries: [...byId.values()], origin: snapshot ? 'snapshot' : 'briefcase' };
    }
}
