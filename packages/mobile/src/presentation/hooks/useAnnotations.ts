import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    GlyphMark,
    HighlightColor,
    PreacherGlyph,
    MarkStyle,
    SermonAnnotation,
    SermonAnnotationAnchor,
} from '@dosfilos/domain';

import { AnnotationRepositoryImpl } from '@/data/repositories/annotation.repository.impl';
import { PREVIEW_SERMON_ID } from '@/core/dev/previewSermon';

const repository = new AnnotationRepositoryImpl();

/**
 * En la vista previa las marcas viven solo en la caché de react-query: sin
 * login no hay Firestore, y el punto es ver cómo se PINTAN, no persistirlas.
 */
const isPreview = (sermonId: string) => __DEV__ && sermonId === PREVIEW_SERMON_ID;

let previewSeq = 0;

const keyOf = (sermonId: string) => ['annotations', sermonId];

/** Marcas del predicador sobre un sermón (plan Púlpito M-05). */
export const useAnnotations = (sermonId: string) =>
    useQuery({
        queryKey: keyOf(sermonId),
        queryFn: () => (isPreview(sermonId) ? [] : repository.list(sermonId)),
        enabled: !!sermonId,
        // El púlpito no vuelve a la red a mitad de sermón: la caché del SDK
        // ya es la fuente y la lista se actualiza por mutación.
        staleTime: Infinity,
    });

/**
 * Alta, cambio de color y borrado de resaltados. Las tres mutaciones
 * escriben en la caché de react-query PRIMERO: en el púlpito el resaltado
 * tiene que aparecer bajo el dedo, no cuando conteste Firestore.
 */
export const useHighlightMutations = (sermonId: string) => {
    const queryClient = useQueryClient();
    const key = keyOf(sermonId);

    const write = (updater: (current: SermonAnnotation[]) => SermonAnnotation[]) =>
        queryClient.setQueryData<SermonAnnotation[]>(key, (current) => updater(current ?? []));

    const create = useMutation({
        mutationFn: async ({
            anchor,
            color,
            style,
        }: {
            anchor: SermonAnnotationAnchor;
            color: HighlightColor;
            style: MarkStyle;
        }): Promise<SermonAnnotation> => {
            if (isPreview(sermonId)) {
                const now = new Date();
                previewSeq += 1;
                return {
                    ...anchor,
                    id: `preview-${previewSeq}`,
                    type: 'highlight',
                    color,
                    style,
                    createdAt: now,
                    updatedAt: now,
                    updatedBy: 'mobile',
                };
            }
            return repository.createHighlight(sermonId, anchor, color, style);
        },
        onSuccess: (created) => write((current) => [...current, created]),
    });

    const recolor = useMutation({
        mutationFn: ({ id, color, style }: { id: string; color: HighlightColor; style: MarkStyle }) =>
            isPreview(sermonId)
                ? Promise.resolve()
                : repository.updateMark(sermonId, id, color, style),
        onMutate: ({ id, color, style }) => {
            write((current) => current.map((a) => (a.id === id ? { ...a, color, style } : a)));
        },
    });

    const remove = useMutation({
        mutationFn: (id: string) =>
            isPreview(sermonId) ? Promise.resolve() : repository.remove(sermonId, id),
        onMutate: (id) => {
            write((current) => current.filter((a) => a.id !== id));
        },
    });

    return { create, recolor, remove };
};

const glyphKeyOf = (sermonId: string) => ['glyphs', sermonId];

/** Marcas de predicador sobre un sermón (C7). */
export const useGlyphs = (sermonId: string) =>
    useQuery({
        queryKey: glyphKeyOf(sermonId),
        queryFn: () => (isPreview(sermonId) ? [] : repository.listGlyphs(sermonId)),
        enabled: !!sermonId,
        staleTime: Infinity,
    });

/**
 * Poner, cambiar y quitar glifos. Igual que los resaltados: la caché de
 * react-query primero, para que el glifo aparezca bajo el dedo sin red.
 */
export const useGlyphMutations = (sermonId: string) => {
    const queryClient = useQueryClient();
    const key = glyphKeyOf(sermonId);
    const write = (updater: (current: GlyphMark[]) => GlyphMark[]) =>
        queryClient.setQueryData<GlyphMark[]>(key, (current) => updater(current ?? []));

    const create = useMutation({
        mutationFn: async ({ anchor, glyph }: { anchor: SermonAnnotationAnchor; glyph: PreacherGlyph }) => {
            if (isPreview(sermonId)) {
                const now = new Date();
                previewSeq += 1;
                const mark: GlyphMark = {
                    ...anchor,
                    id: `preview-glyph-${previewSeq}`,
                    type: 'glyph',
                    glyph,
                    createdAt: now,
                    updatedAt: now,
                    updatedBy: 'mobile',
                };
                return mark;
            }
            return repository.createGlyph(sermonId, anchor, glyph);
        },
        onSuccess: (created) => write((current) => [...current, created]),
    });

    const change = useMutation({
        mutationFn: ({ id, glyph }: { id: string; glyph: PreacherGlyph }) =>
            isPreview(sermonId) ? Promise.resolve() : repository.updateGlyph(sermonId, id, glyph),
        onMutate: ({ id, glyph }) => {
            write((current) => current.map((g) => (g.id === id ? { ...g, glyph } : g)));
        },
    });

    const remove = useMutation({
        mutationFn: (id: string) =>
            isPreview(sermonId) ? Promise.resolve() : repository.deleteAnnotation(sermonId, id),
        onMutate: (id) => {
            write((current) => current.filter((g) => g.id !== id));
        },
    });

    return { create, change, remove };
};
