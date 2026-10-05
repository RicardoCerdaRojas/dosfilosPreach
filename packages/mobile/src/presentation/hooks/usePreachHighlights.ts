import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { buildAnnotationAnchor, glyphAction, resolveAnnotationAnchor } from '@dosfilos/domain';
import type { HighlightColor, MarkStyle, PreacherGlyph } from '@dosfilos/domain';

import { SermonSection } from '@/core/utils/sermonSections';
import { useAnnotations, useGlyphMutations, useGlyphs, useHighlightMutations } from '@/presentation/hooks/useAnnotations';
import { ResolvedGlyph, ResolvedHighlight } from '@/presentation/components/preach/PreachSectionBody';
import { SelectionRange } from '@/presentation/components/preach/SelectableParagraph';

/**
 * Marcas del predicador sobre el sermón (plan §6, M-05).
 *
 * La unidad de selección es el RANGO de caracteres en el cuerpo crudo de la
 * sección, no un índice de bloque. Antes se pasaban `(bloque, unidad)` y eso
 * se rompió apenas apareció la paginación: el cuerpo empezó a emitir índices
 * locales a la página mientras el hook los resolvía contra toda la sección.
 * Un rango de offsets no tiene ese problema — es la misma coordenada que usa
 * el ancla que se guarda.
 */
/** La primera palabra de un rango del cuerpo: hasta el primer espacio. */
export function firstWordOf(body: string, range: SelectionRange): SelectionRange {
    let start = range.start;
    while (start < range.end && /\s/.test(body[start] ?? '')) start++;
    let end = start;
    while (end < range.end && !/\s/.test(body[end] ?? '')) end++;
    return { start, end: Math.max(end, Math.min(start + 1, range.end)) };
}

export function usePreachHighlights(
    sermonId: string,
    /**
     * Los movimientos a la vista: el de la página, o todos en el sermón
     * continuo. Cada marca se resuelve contra el SUYO.
     */
    sections: readonly SermonSection[],
    hapticsEnabled: boolean,
) {
    /** Lo que el dedo está seleccionando ahora mismo, y en qué movimiento. */
    const [selection, setSelection] = useState<{ slug: string; range: SelectionRange } | null>(null);
    /** Selección confirmada, con la Y donde soltó, para colocar el popover. */
    const [pending, setPending] = useState<{ slug: string; range: SelectionRange; y: number } | null>(null);

    const { data: annotations } = useAnnotations(sermonId);
    const { create, recolor, remove } = useHighlightMutations(sermonId);
    const { data: glyphMarks } = useGlyphs(sermonId);
    const glyphMutations = useGlyphMutations(sermonId);

    const sectionOf = (slug: string) => sections.find((s) => s.slug === slug);

    // Las marcas se reanclan contra el cuerpo CRUDO de la sección: el sermón
    // pudo editarse en la web después de que se hicieron, y una que ya no
    // encuentra su texto se oculta sin borrarse (la marca es del pastor).
    const highlightsFor = (slug: string): ResolvedHighlight[] => {
        const section = sectionOf(slug);
        if (!section) return [];
        return (annotations ?? [])
            .filter((a) => a.sectionSlug === slug)
            .map((a) => {
                const at = resolveAnnotationAnchor(a, section.body);
                return at
                    ? {
                          id: a.id,
                          color: a.color,
                          style: a.style ?? 'highlight',
                          start: at.start,
                          end: at.end,
                      }
                    : null;
            })
            .filter((h): h is ResolvedHighlight => h !== null);
    };

    // Marcas de predicador (C7): se reanclan igual que los resaltados.
    const glyphsFor = (slug: string): ResolvedGlyph[] => {
        const section = sectionOf(slug);
        if (!section) return [];
        return (glyphMarks ?? [])
            .filter((g) => g.sectionSlug === slug)
            .map((g) => {
                const at = resolveAnnotationAnchor(g, section.body);
                return at ? { id: g.id, glyph: g.glyph, start: at.start } : null;
            })
            .filter((g): g is ResolvedGlyph => g !== null);
    };

    const pendingSection = pending ? sectionOf(pending.slug) : undefined;
    const pendingHighlights = pending ? highlightsFor(pending.slug) : [];
    const pendingMark = pending
        ? (pendingHighlights.find(
              (h) =>
                  Math.min(h.end, pending.range.end) - Math.max(h.start, pending.range.start) > 0,
          ) ?? null)
        : null;

    // El glifo va sobre la PRIMERA palabra de lo elegido, y se ancla sólo a
    // ella: anclado a toda la selección, editar en la web otra palabra de esa
    // selección lo hacía desaparecer (revisión adversarial de C7). El que ya
    // esté en esa palabra se cambia o se quita; uno en otra palabra de la
    // selección no se toca.
    const firstWord = pending && pendingSection ? firstWordOf(pendingSection.body, pending.range) : null;
    const pendingGlyph = firstWord && pending
        ? (glyphsFor(pending.slug).find((g) => g.start >= firstWord.start && g.start < firstWord.end) ?? null)
        : null;

    const applyGlyph = (glyph: PreacherGlyph) => {
        if (!pendingSection || !pending) return;
        const action = glyphAction(pendingGlyph?.glyph ?? null, glyph);
        if (action === 'remove' && pendingGlyph) glyphMutations.remove.mutate(pendingGlyph.id);
        else if (action === 'update' && pendingGlyph) glyphMutations.change.mutate({ id: pendingGlyph.id, glyph });
        else if (action === 'create' && firstWord) {
            glyphMutations.create.mutate({
                anchor: buildAnnotationAnchor(pendingSection.slug, pendingSection.body, firstWord.start, firstWord.end),
                glyph,
            });
        }
        close();
    };

    const beginSelection = (slug: string, range: SelectionRange | null) => {
        // El pulso confirma que el texto quedó agarrado: en el púlpito nadie
        // se queda mirando si la selección prendió. En e-ink no hay motor.
        if (range && !selection && hapticsEnabled) {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        setSelection(range ? { slug, range } : null);
    };

    const endSelection = (slug: string, range: SelectionRange, y: number) => {
        setSelection({ slug, range });
        setPending({ slug, range, y });
    };

    const applyMark = (color: HighlightColor, style: MarkStyle) => {
        if (!pendingSection || !pending) return;
        if (pendingMark) {
            if (pendingMark.color !== color || pendingMark.style !== style) {
                recolor.mutate({ id: pendingMark.id, color, style });
            }
        } else {
            create.mutate({
                anchor: buildAnnotationAnchor(
                    pendingSection.slug,
                    pendingSection.body,
                    pending.range.start,
                    pending.range.end,
                ),
                color,
                style,
            });
        }
        close();
    };

    const removeMark = () => {
        if (pendingMark) remove.mutate(pendingMark.id);
        close();
    };

    const close = () => {
        setPending(null);
        setSelection(null);
    };

    // Se entregan DATOS, no funciones: llamar en el render a una función que
    // devuelve un hook hace que el React Compiler dé por llamados en el
    // render a todos los manejadores de la pantalla (medido en el atril).
    const highlightsBySlug: Record<string, ResolvedHighlight[]> = {};
    const glyphsBySlug: Record<string, ResolvedGlyph[]> = {};
    for (const section of sections) {
        highlightsBySlug[section.slug] = highlightsFor(section.slug);
        glyphsBySlug[section.slug] = glyphsFor(section.slug);
    }

    return {
        highlightsBySlug,
        glyphsBySlug,
        pendingGlyph: pendingGlyph?.glyph ?? null,
        applyGlyph,
        /** La selección en curso, y en qué movimiento. */
        selection,
        beginSelection,
        endSelection,
        popoverOpen: pending !== null,
        popoverY: pending?.y ?? 0,
        pendingColor: pendingMark?.color ?? null,
        pendingStyle: pendingMark?.style ?? null,
        applyMark,
        removeMark,
        close,
    };
}
