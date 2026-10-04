import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buildAnnotationAnchor, resolveAnnotationAnchor } from '@dosfilos/domain';
import type { InkColor, InkNote, InkStroke, InkTool } from '@dosfilos/domain';

import { SermonSection } from '@/core/utils/sermonSections';
import { AnnotationRepositoryImpl } from '@/data/repositories/annotation.repository.impl';
import type { AnchorRect } from '@/presentation/components/preach/InkLayer';
import { noteWithStroke, withStrokeRestored, withoutStroke } from '@/presentation/components/preach/inkGeometry';
import { useInkHistory } from '@/presentation/hooks/useInkHistory';

const repository = new AnnotationRepositoryImpl();

/** Grosor del lápiz: fino o grueso (el resaltador tiene el suyo). */
export type PenWidth = 'fine' | 'bold';

/**
 * Notas de tinta ancladas al texto.
 *
 * El hook sostiene el mapa de dónde está cada oración en pantalla —lo reporta
 * el cuerpo mientras se dibuja— y con eso resuelve dos cosas: dónde pintar
 * una nota guardada, y a qué oración anclar un trazo nuevo.
 *
 * Desde la fase «Atril: tinta y lectura» también lleva el historial (deshacer
 * y rehacer, T-5) y la limpieza de una página o del sermón entero (T-6). Toda
 * escritura pasa PRIMERO por la caché de react-query: la tinta aparece y
 * desaparece bajo el dedo, con red o sin ella.
 */
export function useInkNotes(
    sermonId: string,
    section: SermonSection | undefined,
    /**
     * Firma del layout vigente (cuerpo, sangría, colometría, página…). Las
     * posiciones se guardan bajo ESTA clave en vez de vaciarse al cambiar: si
     * se vacían, hace falta que `onLayout` vuelva a disparar para todo — y RN
     * sólo lo hace si la vista se movió. Apagar el tablero no mueve los
     * párrafos de arriba, así que nadie re-reportaba y la tinta desaparecía.
     */
    layoutKey: string,
) {
    const queryClient = useQueryClient();
    const history = useInkHistory();
    const key = ['ink', sermonId];
    const [penActive, setPenActive] = useState(false);
    const [penColor, setPenColor] = useState<InkColor>('ink');
    const [tool, setTool] = useState<InkTool>('pen');
    const [width, setWidth] = useState<PenWidth>('fine');
    const [eraser, setEraser] = useState(false);

    /** layoutKey → (comienzo de oración → rectángulo en pantalla). */
    const blockRects = useRef<Map<string, Map<number, AnchorRect>>>(new Map());
    /** Nota abierta por ancla, para que trazos seguidos no creen documentos sueltos. */
    const noteByOffset = useRef<Map<number, string>>(new Map());

    const { data: notes } = useQuery({
        queryKey: key,
        queryFn: () => repository.listInk(sermonId),
        enabled: !!sermonId,
        staleTime: Infinity,
    });

    const sectionNotes = section ? (notes ?? []).filter((n) => n.sectionSlug === section.slug) : [];
    const current = () => queryClient.getQueryData<InkNote[]>(key) ?? [];
    const write = (update: (list: InkNote[]) => InkNote[]) =>
        queryClient.setQueryData<InkNote[]>(key, (list) => update(list ?? []));

    const rectsForLayout = () => {
        let map = blockRects.current.get(layoutKey);
        if (!map) {
            map = new Map();
            blockRects.current.set(layoutKey, map);
        }
        return map;
    };

    const rememberBlock = (offset: number, rect: AnchorRect) => {
        rectsForLayout().set(offset, rect);
    };

    /** Oración más cercana a un punto de pantalla, para anclar un trazo nuevo. */
    const anchorAt = (screenX: number, screenY: number) => {
        if (!section) return null;
        let bestOffset: number | null = null;
        let bestRect: AnchorRect | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const [offset, rect] of rectsForLayout().entries()) {
            // Se mide contra el renglón, no contra el punto exacto: se escribe
            // AL LADO de lo que se anota, no encima.
            const dy = Math.abs(screenY - (rect.y + rect.height / 2));
            const dx = Math.max(0, rect.x - screenX);
            const distance = dy * 3 + dx;
            if (distance < bestDistance) {
                bestDistance = distance;
                bestOffset = offset;
                bestRect = rect;
            }
        }
        return bestOffset !== null && bestRect ? { offset: bestOffset, rect: bestRect } : null;
    };

    // Recibe la forma mínima que dibuja la capa; adentro se usa como nota del
    // sermón, que es lo que efectivamente guarda este hook.
    const anchorRectFor = (drawable: { id: string }): AnchorRect | null => {
        const note = sectionNotes.find((n) => n.id === drawable.id);
        if (!note || !section) return null;
        // El ancla se re-resuelve contra el texto ACTUAL: si el sermón se editó
        // en la web, la nota sigue encontrando su pasaje.
        const at = resolveAnnotationAnchor(note, section.body);
        if (!at) return null;
        // Sólo las posiciones de ESTE layout: las de otros quedan guardadas
        // aparte y no pueden dibujar tinta de una página sobre otra.
        return rectsForLayout().get(at.start) ?? null;
    };

    const anchorFor = (offset: number) =>
        section
            ? buildAnnotationAnchor(section.slug, section.body, offset, Math.min(offset + 24, section.body.length))
            : null;

    const append = useMutation({
        // Se agrega el trazo a la caché ANTES de que Firestore conteste. Sin
        // esto el trazo desaparece al soltar el dedo y reaparece cuando vuelve
        // la consulta: el parpadeo que se veía al terminar de escribir.
        onMutate: ({ offset, stroke }: { offset: number; stroke: InkStroke }) => {
            const anchor = anchorFor(offset);
            if (!anchor) return;
            const existing = noteByOffset.current.get(offset);
            write((list) => {
                if (existing && list.some((n) => n.id === existing)) {
                    return list.map((n) => (n.id === existing ? { ...n, strokes: [...n.strokes, stroke] } : n));
                }
                const optimisticId = `pending-${offset}-${list.length}-${Date.now()}`;
                noteByOffset.current.set(offset, optimisticId);
                return [
                    ...list,
                    {
                        ...anchor,
                        id: optimisticId,
                        type: 'ink' as const,
                        strokes: [stroke],
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        updatedBy: 'mobile' as const,
                    },
                ];
            });
        },
        mutationFn: async ({ offset, stroke }: { offset: number; stroke: InkStroke }) => {
            const anchor = anchorFor(offset);
            if (!anchor) return;
            const pending = noteByOffset.current.get(offset);
            // El id optimista no existe en Firestore: se crea de verdad.
            const existing = pending?.startsWith('pending-') ? undefined : pending;
            const id = await repository.appendInkStroke(sermonId, anchor, stroke, existing);
            noteByOffset.current.set(offset, id);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    });

    /** Quita un trazo de su nota (o la nota, si era el último). Sin historial. */
    const removeStroke = (stroke: InkStroke) => {
        const note = noteWithStroke(current(), stroke);
        if (!note) return null;
        const index = note.strokes.findIndex((s) => s === stroke);
        write((list) => withoutStroke(list, note.id, stroke));
        const remaining = current().find((n) => n.id === note.id)?.strokes ?? [];
        if (!remaining.length) {
            for (const [offset, id] of noteByOffset.current.entries()) {
                if (id === note.id) noteByOffset.current.delete(offset);
            }
            void repository.deleteAnnotation(sermonId, note.id);
        } else {
            void repository.replaceInkStrokes(sermonId, note.id, remaining);
        }
        return { note, index: Math.max(0, index) };
    };

    /** Vuelve a poner un trazo en su nota (o la nota, si se había ido). Sin historial. */
    const restoreStroke = (note: InkNote, stroke: InkStroke, index: number) => {
        write((list) => withStrokeRestored(list, note, stroke, index));
        const restored = current().find((n) => n.id === note.id);
        if (restored) {
            noteByOffset.current.set(note.offset, note.id);
            void repository.restoreInkNote(sermonId, restored);
        }
    };

    /** Saca notas enteras. Sin historial. */
    const removeNotes = (ids: Set<string>) => {
        write((list) => list.filter((n) => !ids.has(n.id)));
        for (const [offset, id] of noteByOffset.current.entries()) {
            if (ids.has(id)) noteByOffset.current.delete(offset);
        }
        ids.forEach((id) => void repository.deleteAnnotation(sermonId, id));
    };

    /** Vuelve a poner notas enteras, con sus ids. Sin historial. */
    const restoreNotes = (restored: InkNote[]) => {
        write((list) => [...list.filter((n) => !restored.some((r) => r.id === n.id)), ...restored]);
        restored.forEach((note) => {
            noteByOffset.current.set(note.offset, note.id);
            void repository.restoreInkNote(sermonId, note);
        });
    };

    const addStroke = (offset: number, stroke: InkStroke) => {
        append.mutate({ offset, stroke });
        history.record({
            undo: () => removeStroke(stroke),
            redo: () => append.mutate({ offset, stroke }),
        });
    };

    /**
     * Borra UN trazo —el trazo mismo, no su número—. Si era el último de la
     * nota, se va la nota.
     */
    const eraseStroke = (_noteId: string, stroke: InkStroke) => {
        const removed = removeStroke(stroke);
        if (!removed) return;
        history.record({
            undo: () => restoreStroke(removed.note, stroke, removed.index),
            redo: () => removeStroke(stroke),
        });
    };

    /** Borra estas notas (una página, o todo el sermón). Se puede deshacer. */
    const clearNotes = (targets: InkNote[]) => {
        if (!targets.length) return;
        const snapshot = targets.map((n) => ({ ...n, strokes: [...n.strokes] }));
        const ids = new Set(snapshot.map((n) => n.id));
        removeNotes(ids);
        history.record({
            undo: () => restoreNotes(snapshot),
            redo: () => removeNotes(ids),
        });
    };

    return {
        notes: sectionNotes,
        allNotes: notes ?? [],
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
        eraseStroke,
        clearNotes,
        undo: history.undo,
        redo: history.redo,
        canUndo: history.canUndo,
        canRedo: history.canRedo,
        rememberBlock,
        anchorAt,
        anchorRectFor,
        addStroke,
    };
}
