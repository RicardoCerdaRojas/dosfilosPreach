/**
 * Púlpito M-05 — marks the preacher puts on his own sermon.
 *
 * Lives at `sermons/{sermonId}/annotations/{annotationId}`. F1 writes only
 * highlights (sentence/paragraph, long press on the tablet); F2 adds fine
 * selection, preacher glyphs and the ink canvas on the same collection.
 *
 * ANCHORING. An annotation points at the RAW markdown body of one section —
 * `(sectionSlug, offset)` — because that string is the one both the tablet
 * and the web derive identically from `sermon.content`. Rendered coordinates
 * are platform-specific and must never be persisted.
 *
 * The offset alone is not enough: the sermon can be edited on the web after
 * the highlight was made, and every offset past the edit shifts. So the
 * anchor carries the highlighted text plus a little context on each side
 * (the W3C Web Annotation quote+position pairing) and `resolveAnnotationAnchor`
 * re-finds it. An annotation that no longer matches is orphaned, not deleted:
 * the pastor's mark is his, and a bad re-anchor is worse than a hidden one.
 *
 * Conflict policy: last write wins per record (`updatedAt`). Records are
 * small and independent, so two devices never merge one mark.
 */

/** Highlight colors offered in the pulpit. Rendering is per reading mode. */
export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink'] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

/**
 * Cómo se dibuja la marca. Son tres gestos distintos del lápiz sobre el
 * papel y significan cosas distintas: el resaltado destaca, el subrayado
 * enfatiza sin tapar, y el tachado marca lo que se decidió NO decir — que en
 * un manuscrito de púlpito es información tan útil como el resto.
 */
export const MARK_STYLES = ['highlight', 'underline', 'strike'] as const;
export type MarkStyle = (typeof MARK_STYLES)[number];

/**
 * Marcas de predicador (C7 de la fase Púlpito premium): lo que el pastor
 * escribe a lápiz sobre una palabra del manuscrito para acordarse de CÓMO
 * decirla. Pausa, énfasis, bajar la voz, mirar a la congregación, «aquí va la
 * ilustración». Viven en la misma subcolección, con `type: 'glyph'`.
 */
export const PREACHER_GLYPHS = ['pause', 'emphasis', 'soft', 'look', 'illustration'] as const;
export type PreacherGlyph = (typeof PREACHER_GLYPHS)[number];

export interface GlyphMark extends SermonAnnotationAnchor {
    id: string;
    type: 'glyph';
    glyph: PreacherGlyph;
    createdAt: Date;
    updatedAt: Date;
    updatedBy: 'mobile' | 'web';
}

/**
 * Qué hace elegir un glifo sobre una palabra que ya puede tener uno: el mismo
 * lo quita (es un interruptor, como el lápiz), otro lo reemplaza, y sobre una
 * palabra sin glifo lo pone. Una palabra lleva un glifo, no una pila.
 */
export function glyphAction(
    existing: PreacherGlyph | null,
    picked: PreacherGlyph,
): 'create' | 'update' | 'remove' {
    if (existing === null) return 'create';
    return existing === picked ? 'remove' : 'update';
}

/** Characters of context kept on each side of the highlighted text. */
export const ANCHOR_CONTEXT_CHARS = 40;

export interface SermonAnnotationAnchor {
    /** Slug of the `##` section, as produced by the shared section splitter. */
    sectionSlug: string;
    /** Start offset in the raw markdown body of that section. A HINT. */
    offset: number;
    /** Length of the highlighted text in the raw body. */
    length: number;
    /** The highlighted text itself — the authority when offsets shift. */
    exact: string;
    /** Up to `ANCHOR_CONTEXT_CHARS` immediately before `exact`. */
    prefix: string;
    /** Up to `ANCHOR_CONTEXT_CHARS` immediately after `exact`. */
    suffix: string;
}

export interface SermonAnnotation extends SermonAnnotationAnchor {
    id: string;
    /** F1 ships `highlight`; F2 adds `glyph` and `ink` on this union. */
    type: 'highlight';
    /**
     * Trazo de la marca. Ausente en las anotaciones anteriores a este campo:
     * ausente significa `highlight`, que era lo único que existía. No se
     * adivina nada más.
     */
    style?: MarkStyle;
    color: HighlightColor;
    createdAt: Date;
    updatedAt: Date;
    /** Which surface wrote it last — for support, not for logic. */
    updatedBy: 'mobile' | 'web';
}

/** Build the anchor for the half-open range `[start, end)` of `body`. */
export function buildAnnotationAnchor(
    sectionSlug: string,
    body: string,
    start: number,
    end: number,
): SermonAnnotationAnchor {
    const from = Math.max(0, Math.min(start, body.length));
    const to = Math.max(from, Math.min(end, body.length));
    return {
        sectionSlug,
        offset: from,
        length: to - from,
        exact: body.slice(from, to),
        prefix: body.slice(Math.max(0, from - ANCHOR_CONTEXT_CHARS), from),
        suffix: body.slice(to, to + ANCHOR_CONTEXT_CHARS),
    };
}

/** Half-open range an anchor resolves to in the current body. */
export interface ResolvedAnchor {
    start: number;
    end: number;
}

/**
 * Re-find an anchor in `body`. Returns `null` when the highlighted text is
 * gone — the caller keeps the record and hides the mark.
 *
 * Order: the recorded offset if it still holds, otherwise the occurrence of
 * `exact` whose surrounding context agrees best, ties broken by proximity to
 * the recorded offset. Pure.
 */
export function resolveAnnotationAnchor(
    anchor: SermonAnnotationAnchor,
    body: string,
): ResolvedAnchor | null {
    if (!anchor.exact || !body) return null;

    // Fast path: nothing moved.
    if (body.startsWith(anchor.exact, anchor.offset)) {
        return { start: anchor.offset, end: anchor.offset + anchor.exact.length };
    }

    let best: ResolvedAnchor | null = null;
    let bestScore = -Infinity;
    let at = body.indexOf(anchor.exact);
    while (at !== -1) {
        const end = at + anchor.exact.length;
        const prefix = body.slice(Math.max(0, at - ANCHOR_CONTEXT_CHARS), at);
        const suffix = body.slice(end, end + ANCHOR_CONTEXT_CHARS);
        // Context agreement dominates; distance only breaks ties.
        const score =
            commonSuffixLength(prefix, anchor.prefix) +
            commonPrefixLength(suffix, anchor.suffix) -
            Math.abs(at - anchor.offset) / (body.length + 1);
        if (score > bestScore) {
            bestScore = score;
            best = { start: at, end };
        }
        at = body.indexOf(anchor.exact, at + 1);
    }
    return best;
}

function commonPrefixLength(a: string, b: string): number {
    const max = Math.min(a.length, b.length);
    let i = 0;
    while (i < max && a[i] === b[i]) i += 1;
    return i;
}

function commonSuffixLength(a: string, b: string): number {
    const max = Math.min(a.length, b.length);
    let i = 0;
    while (i < max && a[a.length - 1 - i] === b[b.length - 1 - i]) i += 1;
    return i;
}


/**
 * Corta un texto en palabras con sus offsets.
 *
 * La unidad de selección del púlpito es la PALABRA: con el dedo, a 28 pt y
 * de pie, apuntar a un carácter es una promesa que el atril no cumple. La
 * palabra es lo bastante fina para marcar lo que importa y lo bastante gruesa
 * para acertarle sin mirar.
 */
export interface WordSpan {
    text: string;
    start: number;
    end: number;
}

export function splitWords(text: string): WordSpan[] {
    const spans: WordSpan[] = [];
    const re = /\S+/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text ?? '')) !== null) {
        spans.push({ text: match[0], start: match.index, end: match.index + match[0].length });
    }
    return spans;
}
