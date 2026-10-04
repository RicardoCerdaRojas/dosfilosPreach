import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buildAnnotationAnchor, resolveAnnotationAnchor } from '@dosfilos/domain';
import type { InkColor, InkNote, InkStroke } from '@dosfilos/domain';

import { SermonSection } from '@/core/utils/sermonSections';
import { AnnotationRepositoryImpl } from '@/data/repositories/annotation.repository.impl';
import type { AnchorRect } from '@/presentation/components/preach/InkLayer';
import { withoutStroke } from '@/presentation/components/preach/inkGeometry';

const repository = new AnnotationRepositoryImpl();

/**
 * Notas de tinta ancladas al texto.
 *
 * El hook sostiene el mapa de dónde está cada palabra en pantalla —lo reporta
 * el cuerpo mientras se dibuja— y con eso resuelve dos cosas: dónde pintar
 * una nota guardada, y a qué palabra anclar un trazo nuevo.
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
    const [penActive, setPenActive] = useState(false);
    const [penColor, setPenColor] = useState<InkColor>('ink');
    const [eraser, setEraser] = useState(false);

    /** layoutKey → (offset del párrafo → rectángulo en pantalla). */
    const blockRects = useRef<Map<string, Map<number, AnchorRect>>>(new Map());
    /** Nota abierta por ancla, para que trazos seguidos no creen documentos sueltos. */
    const noteByOffset = useRef<Map<number, string>>(new Map());

    const { data: notes } = useQuery({
        queryKey: ['ink', sermonId],
        queryFn: () => repository.listInk(sermonId),
        enabled: !!sermonId,
        staleTime: Infinity,
    });

    const sectionNotes = section
        ? (notes ?? []).filter((n) => n.sectionSlug === section.slug)
        : [];

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

    /** Párrafo más cercano a un punto de pantalla, para anclar un trazo nuevo. */
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
        if (!note) return null;
        if (!section) return null;
        // El ancla se re-resuelve contra el texto ACTUAL: si el sermón se editó
        // en la web, la nota sigue encontrando su pasaje.
        const at = resolveAnnotationAnchor(note, section.body);
        if (!at) return null;
        // Sólo las posiciones de ESTE layout: las de otros quedan guardadas
        // aparte y no pueden dibujar tinta de una página sobre otra.
        return rectsForLayout().get(at.start) ?? null;
    };

    const append = useMutation({
        // Se agrega el trazo a la caché ANTES de que Firestore conteste. Sin
        // esto el trazo desaparece al soltar el dedo y reaparece cuando vuelve
        // la consulta: el parpadeo que se veía al terminar de escribir.
        onMutate: ({ offset, stroke }) => {
            if (!section) return;
            const existing = noteByOffset.current.get(offset);
            queryClient.setQueryData<InkNote[]>(['ink', sermonId], (current) => {
                const list = current ?? [];
                if (existing) {
                    return list.map((n) =>
                        n.id === existing ? { ...n, strokes: [...n.strokes, stroke] } : n,
                    );
                }
                const anchor = buildAnnotationAnchor(
                    section.slug,
                    section.body,
                    offset,
                    Math.min(offset + 24, section.body.length),
                );
                const optimisticId = `pending-${offset}-${list.length}`;
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
            if (!section) return;
            const pending = noteByOffset.current.get(offset);
            // El id optimista no existe en Firestore: se crea de verdad.
            const existing = pending?.startsWith('pending-') ? undefined : pending;
            const anchor = buildAnnotationAnchor(
                section.slug,
                section.body,
                offset,
                Math.min(offset + 24, section.body.length),
            );
            const id = await repository.appendInkStroke(sermonId, anchor, stroke, existing);
            noteByOffset.current.set(offset, id);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ink', sermonId] }),
    });

    /**
     * Borra UN trazo —el trazo mismo, no su número—. Si era el último de la
     * nota, se va la nota.
     *
     * Antes la goma se llevaba la nota entera —todo lo escrito sobre ese
     * párrafo— por tocar una sola raya. Una goma borra lo que toca.
     */
    const erase = useMutation({
        onMutate: ({ noteId, stroke }: { noteId: string; stroke: InkStroke }) => {
            queryClient.setQueryData<InkNote[]>(['ink', sermonId], (current) =>
                withoutStroke(current ?? [], noteId, stroke),
            );
        },
        mutationFn: async ({ noteId }: { noteId: string; stroke: InkStroke }) => {
            const remaining =
                queryClient
                    .getQueryData<InkNote[]>(['ink', sermonId])
                    ?.find((n) => n.id === noteId)?.strokes ?? [];
            if (!remaining.length) {
                for (const [offset, id] of noteByOffset.current.entries()) {
                    if (id === noteId) noteByOffset.current.delete(offset);
                }
                await repository.deleteAnnotation(sermonId, noteId);
                return;
            }
            await repository.replaceInkStrokes(sermonId, noteId, remaining);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ink', sermonId] }),
    });

    return {
        notes: sectionNotes,
        penActive,
        setPenActive,
        penColor,
        setPenColor,
        eraser,
        setEraser,
        eraseStroke: (noteId: string, stroke: InkStroke) => erase.mutate({ noteId, stroke }),
        rememberBlock,
        anchorAt,
        anchorRectFor,
        addStroke: (offset: number, stroke: InkStroke) => append.mutate({ offset, stroke }),
    };
}
