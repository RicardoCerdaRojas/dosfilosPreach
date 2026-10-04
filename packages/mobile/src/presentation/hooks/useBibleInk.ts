import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    serverTimestamp,
    setDoc,
} from '@react-native-firebase/firestore';
import type { InkColor, InkStroke, InkTool } from '@dosfilos/domain';

import { reportWriteFailure } from '@/core/errors/writeFailures';
import { getFirebaseAuth, getFirebaseDb } from '@/data/sources/firebase.source';
import type { AnchorRect } from '@/presentation/components/preach/InkLayer';
import { noteWithStroke, withStrokeRestored, withoutStroke } from '@/presentation/components/preach/inkGeometry';
import { useInkHistory } from '@/presentation/hooks/useInkHistory';
import type { PenWidth } from '@/presentation/hooks/useInkNotes';

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

const noteId = (bookId: string, chapter: number, verse: number) => `${bookId}.${chapter}.${verse}`;

const KEY = ['bibleInk'];

/**
 * Sin red, la promesa de una escritura de Firestore no se resuelve hasta que
 * el servidor confirma. Esperarla congelaba la goma; se observa aparte, sólo
 * para avisar si falla.
 */
const settle = (write: Promise<unknown>, label: string) =>
    void write.catch((error) => reportWriteFailure('annotation', { label, error }));

/** Guarda la nota tal como está en la caché, o la borra si ya no tiene trazos. */
function persist(note: BibleInkNote | undefined, id: string) {
    const ref = inkRef();
    if (!ref) return;
    if (!note || !note.strokes.length) {
        settle(deleteDoc(doc(ref, id)), `bibleInk delete ${id}`);
        return;
    }
    settle(
        setDoc(doc(ref, id), {
            bookId: note.bookId,
            chapter: note.chapter,
            verse: note.verse,
            strokes: note.strokes,
            updatedAt: serverTimestamp(),
        }),
        `bibleInk set ${id}`,
    );
}

/**
 * Tinta sobre la Biblia.
 *
 * Guarda un documento por versículo escrito, igual que el sermón guarda uno
 * por oración: trazos seguidos sobre el mismo versículo se acumulan en la
 * misma nota en vez de dejar documentos sueltos. Con historial (deshacer y
 * rehacer) y limpieza del capítulo, como el púlpito.
 */
export function useBibleInk(bookId: string, chapter: number, layoutKey: string) {
    const queryClient = useQueryClient();
    // El historial es del capítulo que se está viendo.
    const history = useInkHistory(`${bookId}.${chapter}`);
    const [penActive, setPenActive] = useState(false);
    const [penColor, setPenColor] = useState<InkColor>('ink');
    const [tool, setTool] = useState<InkTool>('pen');
    const [width, setWidth] = useState<PenWidth>('fine');
    const [eraser, setEraser] = useState(false);

    /** layoutKey → (versículo → rectángulo en coordenadas del texto). */
    const verseRects = useRef<Map<string, Map<number, AnchorRect>>>(new Map());

    const { data: notes } = useQuery({
        queryKey: KEY,
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

    const chapterNotes = (notes ?? []).filter((n) => n.bookId === bookId && n.chapter === chapter);
    const current = () => queryClient.getQueryData<BibleInkNote[]>(KEY) ?? [];
    const write = (update: (list: BibleInkNote[]) => BibleInkNote[]) =>
        queryClient.setQueryData<BibleInkNote[]>(KEY, (list) => update(list ?? []));
    const saved = (id: string) => persist(current().find((n) => n.id === id), id);

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

    /** Agrega un trazo a la nota del versículo. Sin historial. */
    const appendStroke = (verse: number, stroke: InkStroke) => {
        const id = noteId(bookId, chapter, verse);
        write((list) =>
            list.some((n) => n.id === id)
                ? list.map((n) => (n.id === id ? { ...n, strokes: [...n.strokes, stroke] } : n))
                : [...list, { id, bookId, chapter, verse, strokes: [stroke] }],
        );
        saved(id);
    };

    /** Quita un trazo de su nota (o la nota, si era el último). Sin historial. */
    const removeStroke = (stroke: InkStroke) => {
        const note = noteWithStroke(current(), stroke);
        if (!note) return null;
        const index = note.strokes.findIndex((s) => s === stroke);
        write((list) => withoutStroke(list, note.id, stroke));
        saved(note.id);
        return { note, index: Math.max(0, index) };
    };

    const restoreStroke = (note: BibleInkNote, stroke: InkStroke, index: number) => {
        write((list) => withStrokeRestored(list, note, stroke, index));
        saved(note.id);
    };

    const removeNotes = (ids: Set<string>) => {
        write((list) => list.filter((n) => !ids.has(n.id)));
        ids.forEach((id) => saved(id));
    };

    const restoreNotes = (restored: BibleInkNote[]) => {
        write((list) => [...list.filter((n) => !restored.some((r) => r.id === n.id)), ...restored]);
        restored.forEach((n) => saved(n.id));
    };

    const addStroke = (verse: number, stroke: InkStroke) => {
        appendStroke(verse, stroke);
        history.record({ undo: () => removeStroke(stroke), redo: () => appendStroke(verse, stroke) });
    };

    const eraseStroke = (_id: string, stroke: InkStroke) => {
        const removed = removeStroke(stroke);
        if (!removed) return;
        history.record({
            undo: () => restoreStroke(removed.note, stroke, removed.index),
            redo: () => removeStroke(stroke),
        });
    };

    /** Borra la tinta de estas notas (el capítulo). Se puede deshacer. */
    const clearNotes = (targets: BibleInkNote[]) => {
        if (!targets.length) return;
        const snapshot = targets.map((n) => ({ ...n, strokes: [...n.strokes] }));
        const ids = new Set(snapshot.map((n) => n.id));
        removeNotes(ids);
        history.record({ undo: () => restoreNotes(snapshot), redo: () => removeNotes(ids) });
    };

    return {
        notes: chapterNotes,
        penActive,
        setPenActive,
        penColor,
        setPenColor,
        tool,
        setTool,
        width,
        setWidth,
        eraser,
        setEraser,
        rememberVerse,
        anchorAt,
        anchorRectFor,
        addStroke,
        eraseStroke,
        clearNotes,
        undo: history.undo,
        redo: history.redo,
        canUndo: history.canUndo,
        canRedo: history.canRedo,
    };
}
