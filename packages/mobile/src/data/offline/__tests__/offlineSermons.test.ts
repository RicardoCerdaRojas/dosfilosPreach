import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Sermon } from '@dosfilos/domain';

import {
    clearOfflineData,
    listBriefcase,
    loadPublishedList,
    loadSermon,
    readBriefcase,
    readListSnapshot,
    writeBriefcase,
    writeListSnapshot,
    type BriefcaseEntry,
} from '../offlineSermons';
import type { SermonSummary } from '@/domain/models/sermon.model';

const sermon = (over: Partial<Sermon> = {}): Sermon =>
    ({
        id: 's1',
        userId: 'pastor',
        title: 'Compasión temporal',
        content: '## I. Dios prepara\n\nTexto.',
        status: 'published',
        bibleReferences: ['Jonás 4:5-11'],
        tags: [],
        createdAt: new Date('2026-10-01T10:00:00Z'),
        updatedAt: new Date('2026-10-02T10:00:00Z'),
        publishedAt: new Date('2026-10-02T10:00:00Z'),
        preachingHistory: [{ date: new Date('2026-10-04T15:00:00Z'), location: 'Central', durationMinutes: 38 }],
        isShared: false,
        authorName: 'Pastor',
        ...over,
    }) as Sermon;

const summary = (id: string): SermonSummary => ({
    id,
    title: `Sermón ${id}`,
    status: 'published',
    bibleReferences: [],
    tags: [],
    hasContent: true,
    publishedAt: new Date('2026-10-02T10:00:00Z'),
    timesPreached: 0,
});

const nunca = () => new Promise<never>(() => undefined);

beforeEach(async () => {
    await AsyncStorage.clear();
});

describe('maletín — almacenamiento', () => {
    it('lo guardado vuelve con sus fechas como fechas (JSON las convertía en texto)', async () => {
        await writeBriefcase({ sermon: sermon(), savedAt: '2026-10-03T20:00:00.000Z' });
        const leido = await readBriefcase('s1');
        expect(leido?.sermon.publishedAt).toBeInstanceOf(Date);
        expect(leido?.sermon.preachingHistory[0]!.date.getTime()).toBe(Date.parse('2026-10-04T15:00:00Z'));
    });

    it('lista sólo el maletín del usuario: una tablet compartida no muestra lo de otro', async () => {
        await writeBriefcase({ sermon: sermon({ id: 'a' }), savedAt: 'x' });
        await writeBriefcase({ sermon: sermon({ id: 'b', userId: 'otro' }), savedAt: 'x' });
        expect((await listBriefcase('pastor')).map((e) => e.sermon.id)).toEqual(['a']);
    });

    it('cerrar sesión borra el maletín y la lista guardada, y nada más', async () => {
        await writeBriefcase({ sermon: sermon(), savedAt: 'x' });
        await writeListSnapshot('pastor', [summary('a')]);
        await AsyncStorage.setItem('reader-settings-storage', '{}');
        await clearOfflineData();
        expect(await readBriefcase('s1')).toBeNull();
        expect(await readListSnapshot('pastor')).toBeNull();
        expect(await AsyncStorage.getItem('reader-settings-storage')).toBe('{}');
    });
});

describe('loadSermon — la red con plazo, el maletín de respaldo', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    const entry: BriefcaseEntry = { sermon: sermon({ title: 'Copia del maletín' }), savedAt: '2026-10-03T20:00:00.000Z' };

    it('sin red y con copia: el sermón sale del maletín', async () => {
        const r = await loadSermon('s1', {
            fetchLive: () => Promise.reject(new Error('unavailable')),
            read: async () => entry,
            write: async () => undefined,
            deadlineMs: 6000,
        });
        expect(r).toMatchObject({ origin: 'briefcase', savedAt: entry.savedAt });
        expect(r.sermon?.title).toBe('Copia del maletín');
    });

    it('red lenta y con copia: no espera más que el plazo', async () => {
        jest.useFakeTimers();
        const pendiente = loadSermon('s1', {
            fetchLive: nunca,
            read: async () => entry,
            write: async () => undefined,
            deadlineMs: 6000,
        });
        await jest.advanceTimersByTimeAsync(6000);
        await expect(pendiente).resolves.toMatchObject({ origin: 'briefcase' });
    });

    it('con red: el sermón vivo, y la copia del maletín se renueva', async () => {
        const escrito: BriefcaseEntry[] = [];
        const vivo = sermon({ title: 'Corregido en la web' });
        const r = await loadSermon('s1', {
            fetchLive: async () => vivo,
            read: async () => entry,
            write: async (e) => {
                escrito.push(e);
            },
            deadlineMs: 6000,
            now: () => new Date('2026-10-04T09:00:00Z'),
        });
        expect(r).toMatchObject({ origin: 'live' });
        expect(escrito).toEqual([{ sermon: vivo, savedAt: '2026-10-04T09:00:00.000Z' }]);
    });

    it('sin red y sin copia: el error llega a la pantalla (no un spinner eterno)', async () => {
        await expect(
            loadSermon('s1', {
                fetchLive: () => Promise.reject(new Error('unavailable')),
                read: async () => null,
                write: async () => undefined,
                deadlineMs: 6000,
            }),
        ).rejects.toThrow('unavailable');
    });
});

describe('loadPublishedList — la lista sin red', () => {
    const base = {
        writeSnapshot: async () => undefined,
        deadlineMs: 9000,
    };

    it('sin red: la última lista vista, más lo del maletín que no estaba en ella', async () => {
        const r = await loadPublishedList({
            ...base,
            fetchLive: () => Promise.reject(new Error('unavailable')),
            readSnapshot: async () => [summary('a')],
            listBriefcase: async () => [{ sermon: sermon({ id: 'nuevo' }), savedAt: 'x' }],
        });
        expect(r.origin).toBe('snapshot');
        expect(r.summaries.map((s) => s.id).sort()).toEqual(['a', 'nuevo']);
        expect(r.summaries.find((s) => s.id === 'nuevo')?.timesPreached).toBe(1);
    });

    it('app recién instalada, sin red, con sermones preparados: aparecen los del maletín', async () => {
        const r = await loadPublishedList({
            ...base,
            fetchLive: () => Promise.reject(new Error('unavailable')),
            readSnapshot: async () => null,
            listBriefcase: async () => [{ sermon: sermon(), savedAt: 'x' }],
        });
        expect(r).toMatchObject({ origin: 'briefcase' });
        expect(r.summaries).toHaveLength(1);
    });

    it('sin red y sin nada guardado: error, no una lista vacía que parece «no tienes sermones»', async () => {
        await expect(
            loadPublishedList({
                ...base,
                fetchLive: () => Promise.reject(new Error('unavailable')),
                readSnapshot: async () => null,
                listBriefcase: async () => [],
            }),
        ).rejects.toThrow('unavailable');
    });

    it('con red: la lista viva, y se guarda para la próxima vez', async () => {
        const guardadas: SermonSummary[][] = [];
        const r = await loadPublishedList({
            ...base,
            fetchLive: async () => [summary('a'), summary('b')],
            readSnapshot: async () => null,
            writeSnapshot: async (s) => {
                guardadas.push(s);
            },
            listBriefcase: async () => [],
        });
        expect(r.origin).toBe('live');
        expect(guardadas[0]!.map((s) => s.id)).toEqual(['a', 'b']);
    });
});
