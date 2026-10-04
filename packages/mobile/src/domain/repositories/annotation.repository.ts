import type {
    GlyphMark,
    HighlightColor,
    PreacherGlyph,
    MarkStyle,
    SermonAnnotation,
    SermonAnnotationAnchor,
} from '@dosfilos/domain';

/**
 * Puerto de las marcas del predicador sobre su sermón (plan Púlpito M-05).
 * F1 solo escribe resaltados; la tinta y los glifos de F2 entran por aquí.
 */
export interface AnnotationRepository {
    /** Todas las anotaciones del sermón, de todas las secciones. */
    list(sermonId: string): Promise<SermonAnnotation[]>;
    /** Crea un resaltado y devuelve el registro ya con id. */
    createHighlight(
        sermonId: string,
        anchor: SermonAnnotationAnchor,
        color: HighlightColor,
        style: MarkStyle,
    ): Promise<SermonAnnotation>;
    /** Cambia color o trazo de una marca existente (LWW por `updatedAt`). */
    updateMark(
        sermonId: string,
        annotationId: string,
        color: HighlightColor,
        style: MarkStyle,
    ): Promise<void>;
    remove(sermonId: string, annotationId: string): Promise<void>;
    /** Marcas de predicador (C7): `type: 'glyph'` en la misma subcolección. */
    listGlyphs(sermonId: string): Promise<GlyphMark[]>;
    createGlyph(sermonId: string, anchor: SermonAnnotationAnchor, glyph: PreacherGlyph): Promise<GlyphMark>;
    updateGlyph(sermonId: string, annotationId: string, glyph: PreacherGlyph): Promise<void>;
    /** Borra cualquier anotación por id — marca o nota de tinta. */
    deleteAnnotation(sermonId: string, annotationId: string): Promise<void>;
}
