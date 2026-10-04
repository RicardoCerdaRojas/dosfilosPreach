import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    serverTimestamp,
    setDoc,
} from '@react-native-firebase/firestore';
import type { InkColor, InkStroke } from '@dosfilos/domain';

import { getFirebaseAuth, getFirebaseDb } from '@/data/sources/firebase.source';
import type { AnchorRect } from '@/presentation/components/preach/InkLayer';
import { withoutStroke } from '@/presentation/components/preach/inkGeometry';

/**
 * Una nota manuscrita sobre el texto bíblico, anclada a un VERSÍCULO.
 *
 * El sermón necesita reanclar sus notas por texto exacto porque el sermón se
 * edita. La Biblia no: `(libro, capítulo, versículo)` es una dirección que no
 * cambia nunca. Por eso acá el ancla es un número y no hace falta nada del
 * andamiaje de reanclado del púlpito.
 */
export interface BibleInkNote {
    id: string;
    bookId: string;
    chapter: number;
    verse: number;
    strokes: InkStroke[];
}

const inkRef = () => {
    const uid = getFirebaseAuth().currentUser?.uid;
    if (!uid) return null;
    return collection(getFirebaseDb(), 'users', uid, 'bibleInk');
};

const noteId = (bookId: string, chapter: number, verse: number) =>
    `${bookId}.${chapter}.${verse}`;

/**
 * Tinta sobre la Biblia.
 *
 * Guarda un documento por versículo escrito, igual que el sermón guarda uno
 * por párrafo: trazos seguidos sobre el mismo versículo se acumulan en la
 * misma nota en vez de dejar documentos sueltos.
 */
export function useBibleInk(bookId: string, chapter: number, layoutKey: string) {
    const queryClient = useQueryClient();
    const [penActive, setPenActive] = useState(false);
    const [penColor, setPenColor] = useState<InkColor>('ink');
    const [eraser, setEraser] = useState(false);

    /** layoutKey → (versículo → rectángulo en pantalla). */
    const verseRects = useRef<Map<string, Map<number, AnchorRect>>>(new Map());

    const { data: notes } = useQuery({
        queryKey: ['bibleInk'],
        queryFn: async (): Promise<BibleInkNote[]> => {
            const ref = inkRef();
            if (!ref) return [];
            const snap = await getDocs(ref);
            return snap.docs.map((d) => {
                const data = d.data() as any;
                return {
                    id: d.id,
                    bookId: String(data.bookId ?? ''),
                    chapter: Number(data.chapter ?? 0),
                    verse: Number(data.verse ?? 0),
                    strokes: (data.strokes ?? []) as InkStroke[],
                };
            });
        },
        staleTime: Infinity,
    });

    const chapterNotes = (notes ?? []).filter(
        (n) => n.bookId === bookId && n.chapter === chapter,
    );

    const rectsForLayout = () => {
        let map = verseRects.current.get(layoutKey);
        if (!map) {
            map = new Map();
            verseRects.current.set(layoutKey, map);
        }
        return map;
    };

    const rememberVerse = (verse: number, rect: AnchorRect) => {
        rectsForLayout().set(verse, rect);
    };

    /** Versículo más cercano al punto donde empezó el trazo. */
    const anchorAt = (screenX: number, screenY: number) => {
        let bestVerse: number | null = null;
        let bestRect: AnchorRect | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const [verse, rect] of rectsForLayout().entries()) {
            // Se mide contra el renglón, no contra el punto exacto: se escribe
            // AL LADO de lo que se anota, no encima.
            const dy = Math.abs(screenY - (rect.y + rect.height / 2));
            const dx = Math.max(0, rect.x - screenX);
            const distance = dy * 3 + dx;
            if (distance < bestDistance) {
                bestDistance = distance;
                bestVerse = verse;
                bestRect = rect;
            }
        }
        return bestVerse !== null && bestRect ? { offset: bestVerse, rect: bestRect } : null;
    };

    const anchorRectFor = (drawable: { id: string }): AnchorRect | null => {
        const note = chapterNotes.find((n) => n.id === drawable.id);
        if (!note) return null;
        return rectsForLayout().get(note.verse) ?? null;
    };

    const append = useMutation({
        // El trazo entra a la caché ANTES de que Firestore conteste: sin esto
        // desaparece al soltar el dedo y vuelve cuando responde la consulta.
        onMutate: ({ verse, stroke }: { verse: number; stroke: InkStroke }) => {
            const id = noteId(bookId, chapter, verse);
            queryClient.setQueryData<BibleInkNote[]>(['bibleInk'], (current) => {
                const list = current ?? [];
                const existing = list.find((n) => n.id === id);
                if (existing) {
                    return list.map((n) =>
                        n.id === id ? { ...n, strokes: [...n.strokes, stroke] } : n,
                    );
                }
                return [...list, { id, bookId, chapter, verse, strokes: [stroke] }];
            });
        },
        mutationFn: async ({ verse, stroke }: { verse: number; stroke: InkStroke }) => {
            const ref = inkRef();
            if (!ref) return;
            const id = noteId(bookId, chapter, verse);
            const existing =
                queryClient
                    .getQueryData<BibleInkNote[]>(['bibleInk'])
                    ?.find((n) => n.id === id)?.strokes ?? [stroke];
            await setDoc(doc(ref, id), {
                bookId,
                chapter,
                verse,
                strokes: existing,
                updatedAt: serverTimestamp(),
            });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bibleInk'] }),
    });

    /** Quita un trazo; si era el último, el documento se va con él. */
    const erase = useMutation({
        onMutate: ({ id, stroke }: { id: string; stroke: InkStroke }) => {
            queryClient.setQueryData<BibleInkNote[]>(['bibleInk'], (current) =>
                withoutStroke(current ?? [], id, stroke),
            );
        },
        mutationFn: async ({ id }: { id: string; stroke: InkStroke }) => {
            const ref = inkRef();
            if (!ref) return;
            const remaining =
                queryClient.getQueryData<BibleInkNote[]>(['bibleInk'])?.find((n) => n.id === id)
                    ?.strokes ?? [];
            if (!remaining.length) {
                await deleteDoc(doc(ref, id));
                return;
            }
            await setDoc(doc(ref, id), {
                bookId,
                chapter,
                verse: Number(id.split('.').pop() ?? 0),
                strokes: remaining,
                updatedAt: serverTimestamp(),
            });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bibleInk'] }),
    });

    return {
        notes: chapterNotes,
        penActive,
        setPenActive,
        penColor,
        setPenColor,
        eraser,
        setEraser,
        rememberVerse,
        anchorAt,
        anchorRectFor,
        addStroke: (verse: number, stroke: InkStroke) => append.mutate({ verse, stroke }),
        eraseStroke: (id: string, stroke: InkStroke) => erase.mutate({ id, stroke }),
    };
}
