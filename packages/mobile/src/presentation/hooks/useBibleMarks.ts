import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    serverTimestamp,
    setDoc,
} from '@react-native-firebase/firestore';
import type { HighlightColor, MarkStyle } from '@dosfilos/domain';

import { getFirebaseAuth, getFirebaseDb } from '@/data/sources/firebase.source';
import { reportWriteFailure } from '@/core/errors/writeFailures';
import type { BibleMark, VerseWordRange } from '@/domain/bible/entities/BibleMark';
import { verseKey } from '@/domain/bible/entities/BibleMark';

/**
 * Marcas sobre el texto bíblico, por usuario.
 *
 * Viven en `users/{uid}/bibleMarks` y no en el sermón: una marca sobre Jonás
 * 1:3 es del pastor, no de un sermón en particular, y tiene que seguir ahí
 * cuando abra ese pasaje dos años después preparando otro.
 */
const marksRef = () => {
    const uid = getFirebaseAuth().currentUser?.uid;
    if (!uid) return null;
    return collection(getFirebaseDb(), 'users', uid, 'bibleMarks');
};

export const useBibleMarks = () => {
    const query = useQuery({
        queryKey: ['bibleMarks'],
        queryFn: async (): Promise<Map<string, BibleMark>> => {
            const ref = marksRef();
            if (!ref) return new Map();
            const snap = await getDocs(ref);
            const map = new Map<string, BibleMark>();
            snap.docs.forEach((d) => {
                const data = d.data() as any;
                const mark: BibleMark = {
                    id: d.id,
                    versionId: String(data.versionId ?? ''),
                    bookId: String(data.bookId ?? ''),
                    chapter: Number(data.chapter ?? 0),
                    verse: Number(data.verse ?? 0),
                    color: data.color,
                    style: data.style ?? 'highlight',
                    // `null` en Firestore y `undefined` acá: sin extremos, la
                    // marca cubre el versículo entero.
                    from: typeof data.from === 'number' ? data.from : undefined,
                    to: typeof data.to === 'number' ? data.to : undefined,
                    createdAt: data.createdAt?.toDate?.() ?? new Date(),
                };
                map.set(verseKey(mark.bookId, mark.chapter, mark.verse), mark);
            });
            return map;
        },
        staleTime: Infinity,
    });

    return query;
};

export interface SetMarksInput {
    versionId: string;
    bookId: string;
    chapter: number;
    /** Un rango por versículo; sin extremos, el versículo entero. */
    ranges: VerseWordRange[];
    color: HighlightColor;
    style: MarkStyle;
}

/** Las marcas con el cambio aplicado: lo que la pantalla muestra YA (C1). */
export function withMarks(current: Map<string, BibleMark> | undefined, input: SetMarksInput, now: Date): Map<string, BibleMark> {
    const next = new Map(current ?? []);
    for (const range of input.ranges) {
        const id = verseKey(input.bookId, input.chapter, range.verse);
        next.set(id, {
            id,
            versionId: input.versionId,
            bookId: input.bookId,
            chapter: input.chapter,
            verse: range.verse,
            color: input.color,
            style: input.style,
            from: range.from,
            to: range.to,
            createdAt: now,
        });
    }
    return next;
}

/** Las marcas sin esos versículos. */
export function withoutMarks(
    current: Map<string, BibleMark> | undefined,
    input: { bookId: string; chapter: number; verses: number[] },
): Map<string, BibleMark> {
    const next = new Map(current ?? []);
    for (const verse of input.verses) next.delete(verseKey(input.bookId, input.chapter, verse));
    return next;
}

/**
 * Marcar en la Biblia SIN RED (C1): antes se esperaba la escritura, y sin red
 * la promesa no resuelve hasta que el servidor confirma — la marca no
 * aparecía hasta reconectar. Ahora la caché se actualiza primero y la
 * escritura sube cuando haya red (como las marcas del sermón). Si el servidor
 * la rechaza, se avisa y se vuelve a leer.
 */
export const useBibleMarkMutations = () => {
    const queryClient = useQueryClient();
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['bibleMarks'] });

    const set = useMutation({
        onMutate: (input: SetMarksInput) => {
            queryClient.setQueryData<Map<string, BibleMark>>(['bibleMarks'], (current) =>
                withMarks(current, input, new Date()),
            );
        },
        mutationFn: async (input: SetMarksInput) => {
            const ref = marksRef();
            if (!ref) return;
            // Un documento por versículo: el id ES la dirección, así que
            // volver a marcar el mismo versículo reemplaza en vez de duplicar.
            // Sin `await`: sin red no resuelve hasta que el servidor confirma.
            void Promise.all(
                input.ranges.map((range) => {
                    const id = verseKey(input.bookId, input.chapter, range.verse);
                    return setDoc(doc(ref, id), {
                        versionId: input.versionId,
                        bookId: input.bookId,
                        chapter: input.chapter,
                        verse: range.verse,
                        color: input.color,
                        style: input.style,
                        // `null` y no ausente: Firestore con merge no borra una
                        // clave que no viene, y una marca de versículo entero
                        // encima de una parcial tiene que limpiar los extremos.
                        from: range.from ?? null,
                        to: range.to ?? null,
                        createdAt: serverTimestamp(),
                    }).catch((error) => {
                        reportWriteFailure('bible_mark', { id, error });
                        refresh();
                    });
                }),
            );
        },
    });

    const clear = useMutation({
        onMutate: (input: { bookId: string; chapter: number; verses: number[] }) => {
            queryClient.setQueryData<Map<string, BibleMark>>(['bibleMarks'], (current) =>
                withoutMarks(current, input),
            );
        },
        mutationFn: async (input: { bookId: string; chapter: number; verses: number[] }) => {
            const ref = marksRef();
            if (!ref) return;
            void Promise.all(
                input.verses.map((verse) =>
                    deleteDoc(doc(ref, verseKey(input.bookId, input.chapter, verse))).catch((error) => {
                        reportWriteFailure('bible_mark', { verse, error });
                        refresh();
                    }),
                ),
            );
        },
    });

    return { set, clear };
};
