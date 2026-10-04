import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import {
    arrayRemove,
    arrayUnion,
    doc,
    getDoc,
    serverTimestamp,
    updateDoc,
} from '@react-native-firebase/firestore';
import type { PreachingLog } from '@dosfilos/domain';

import { Sermon, SermonSummary } from '@/domain/models/sermon.model';
import { SermonRepository } from '@/domain/repositories/sermon.repository';
import { getFirebaseDb } from '@/data/sources/firebase.source';
import { reportWriteFailure } from '@/core/errors/writeFailures';
import { toFirestoreLog } from './preachingLogMapping';

/** Item crudo del callable getSermonsListSummary (fechas en milisegundos). */
interface RawSummary {
    id: string;
    title: string;
    status: Sermon['status'];
    bibleReferences?: string[];
    tags?: string[];
    seriesId?: string;
    hasContent?: boolean;
    publishedAt?: number;
    updatedAt?: number;
    versionOf?: string;
    sourceSermonId?: string;
    timesPreached?: number;
    lastPreachedAt?: number;
}

const toDate = (v: unknown): Date | undefined => {
    if (typeof v === 'number') return new Date(v);
    if (v && typeof (v as any).toDate === 'function') return (v as any).toDate();
    return undefined;
};

export class SermonRepositoryImpl implements SermonRepository {
    async getPublishedSummaries(): Promise<SermonSummary[]> {
        const callable = httpsCallable<{ status: string }, { sermons: RawSummary[] }>(
            getFunctions(getApp()),
            'getSermonsListSummary',
        );
        const res = await callable({ status: 'published' });
        return (res.data.sermons ?? []).map((s) => ({
            id: s.id,
            title: s.title,
            status: s.status,
            bibleReferences: s.bibleReferences ?? [],
            tags: s.tags ?? [],
            seriesId: s.seriesId,
            hasContent: Boolean(s.hasContent),
            publishedAt: toDate(s.publishedAt),
            updatedAt: toDate(s.updatedAt),
            versionOf: s.versionOf,
            sourceSermonId: s.sourceSermonId,
            timesPreached: s.timesPreached ?? 0,
            lastPreachedAt: toDate(s.lastPreachedAt),
        }));
    }

    async getSeriesTitles(seriesIds: string[]): Promise<Record<string, string>> {
        const db = getFirebaseDb();
        const unique = [...new Set(seriesIds)];
        const titles: Record<string, string> = {};
        await Promise.all(
            unique.map(async (id) => {
                try {
                    const snap = await getDoc(doc(db, 'series', id));
                    const title = snap.exists() ? (snap.data()?.title as string | undefined) : undefined;
                    if (title) titles[id] = title;
                } catch (error) {
                    // Una serie ilegible no tumba la lista: el grupo cae a "sin serie".
                    console.warn(`[sermons] series ${id} unreadable:`, error);
                }
            }),
        );
        return titles;
    }

    /**
     * Escribe título y cuerpo. La lista de campos es EXPLÍCITA a propósito:
     * un spread del sermón entero arrastraría `wizardProgress` y ahí vive la
     * política pastoral que la tablet no debe tocar (M-07).
     *
     * No se espera el ack: sin red la promesa no resuelve hasta que el
     * servidor confirma, y el pastor edita el miércoles en el sillón, no
     * necesariamente con señal. La caché local ya aplicó el cambio.
     */
    async updateSermonDraft(id: string, patch: { title: string; content: string }): Promise<void> {
        updateDoc(doc(getFirebaseDb(), 'sermons', id), {
            title: patch.title,
            content: patch.content,
            updatedAt: serverTimestamp(),
        }).catch((error) => reportWriteFailure('sermon', error));
    }

    /**
     * Suma una predicación al historial. `arrayUnion` en vez de leer-modificar
     * -escribir: si el pastor predica el mismo sermón en dos servicios y la
     * tablet sincroniza tarde, no se pisan los registros.
     */
    async addPreachingLog(id: string, log: PreachingLog): Promise<void> {
        updateDoc(doc(getFirebaseDb(), 'sermons', id), {
            preachingHistory: arrayUnion(toFirestoreLog(log)),
            updatedAt: serverTimestamp(),
        }).catch((error) => reportWriteFailure('preaching_log', error));
    }

    /**
     * Quita un registro: es el «Deshacer» de marcar predicado (A5). Tiene que
     * ser EL MISMO objeto que se agregó —arrayRemove compara el mapa entero—,
     * así que se arma con los mismos campos que `addPreachingLog`.
     */
    async removePreachingLog(id: string, log: PreachingLog): Promise<void> {
        updateDoc(doc(getFirebaseDb(), 'sermons', id), {
            preachingHistory: arrayRemove(toFirestoreLog(log)),
            updatedAt: serverTimestamp(),
        }).catch((error) => reportWriteFailure('preaching_log', error));
    }

    async getSermonById(id: string): Promise<Sermon | null> {
        return (await this.getSermonWithSource(id)).sermon;
    }

    /**
     * El sermón y si vino de la caché del SDK. Sin red, `getDoc` responde
     * desde la caché sin fallar: hay que saberlo para no decir «en vivo».
     */
    async getSermonWithSource(id: string): Promise<{ sermon: Sermon | null; fromCache: boolean }> {
        const snap = await getDoc(doc(getFirebaseDb(), 'sermons', id));
        const fromCache = snap.metadata.fromCache;
        return { sermon: this.toSermon(snap), fromCache };
    }

    private toSermon(snap: any): Sermon | null {
        if (!snap.exists()) return null;
        const d = snap.data() as any;
        return {
            ...d,
            id: snap.id,
            bibleReferences: d.bibleReferences ?? [],
            tags: d.tags ?? [],
            createdAt: toDate(d.createdAt) ?? new Date(),
            updatedAt: toDate(d.updatedAt) ?? new Date(),
            publishedAt: toDate(d.publishedAt),
            scheduledDate: toDate(d.scheduledDate),
            preachingHistory: (d.preachingHistory ?? []).map((p: any) => ({
                ...p,
                date: toDate(p.date) ?? new Date(),
            })),
        } as Sermon;
    }
}
