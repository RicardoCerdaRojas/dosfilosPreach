import { hasResolvedNumbering } from '@dosfilos/domain';
import type {
    CanonicalVerseAnalysis,
    CitationPageKind,
    PageNumbering,
    ProjectSource,
} from '@dosfilos/domain';

/**
 * Marca cada cita del análisis según qué clase de número lleva.
 *
 * No se le pregunta al modelo. Se deduce de lo que el propio caso de uso le
 * dio a leer: `citationAnchorFor` emite `p. N` donde la numeración resuelve la
 * hoja y `hoja N` donde no.
 *
 * La deducción mira LAS HOJAS QUE ESTA FUENTE OFRECE, no si el libro resuelve
 * alguna. Antes alcanzaba con lo segundo porque un tramo sin folio devolvía el
 * ancla vacía y no había número que sellar. Ahora ese tramo dice `hoja N`, así
 * que un libro con preliminares en romanos y cuerpo numerado —Mayor: hojas
 * 1-316 sin folio, 317-540 con −278— emite las DOS formas, y preguntarle al
 * libro si numera «alguna» página sellaría como impresa una hoja.
 *
 * Deducirlo en vez de pedirlo importa: el modelo ya demostró que copia el
 * rótulo que se le da sin cuestionarlo, y esa obediencia es justamente lo que
 * produjo el defecto. Un campo que dependiera de su criterio heredaría el
 * mismo problema.
 */
export function stampCitationPageKind(
    analysis: CanonicalVerseAnalysis,
    sources: ReadonlyArray<ProjectSource>,
    numberings: ReadonlyMap<string, PageNumbering | null>,
): CanonicalVerseAnalysis {
    const kindByCitationKey = new Map<string, CitationPageKind>();
    for (const source of sources) {
        if (!source.citationKey) continue;
        kindByCitationKey.set(source.citationKey, kindFor(source, numberings.get(source.id)));
    }
    if (kindByCitationKey.size === 0) return analysis;

    const kindOf = (sourceKey: string): CitationPageKind =>
        kindByCitationKey.get(sourceKey) ?? 'sheet';
    const stamp = <T extends { sourceKey: string }>(cite: T): T =>
        ({ ...cite, pageKind: kindOf(cite.sourceKey) });

    return {
        ...analysis,
        commentatorEngagement: analysis.commentatorEngagement.map(stamp),
        translationCruxes: analysis.translationCruxes.map(crux => ({
            ...crux,
            commentatorPositions: crux.commentatorPositions.map(stamp),
        })),
        lexicalAnalyses: analysis.lexicalAnalyses.map(lex => ({
            ...lex,
            generalSemanticRange: {
                ...lex.generalSemanticRange,
                sources: lex.generalSemanticRange.sources.map(stamp),
            },
            loadingSources: lex.loadingSources.map(stamp),
        })),
        footnoteExtensions: analysis.footnoteExtensions.map(note => ({
            ...note,
            sources: note.sources.map(stamp),
        })),
        oldTestamentLinks: analysis.oldTestamentLinks.map(link => ({
            ...link,
            sources: link.sources.map(stamp),
        })),
        historicalContext: analysis.historicalContext.map(item => ({
            ...item,
            sources: item.sources.map(stamp),
        })),
    };
}

/**
 * Qué clase de número va a copiar el modelo de las anclas de ESTA fuente.
 *
 * `printed` sólo si todas las hojas que la fuente ofrece resuelven su página
 * impresa. Si alguna no resuelve, sus anclas dicen `hoja N` y sellar la fuente
 * entera como impresa pondría el rótulo de verificado sobre un número que
 * nadie puede comprobar —que es el defecto que este archivo existe para
 * cerrar—.
 *
 * Sin tramos elegidos no hay con qué acotar y se pregunta por el libro, que es
 * como venía: `hasResolvedNumbering` y no la verdad del objeto, porque la
 * «Gramática Griega» TIENE numeración guardada y esa numeración no resuelve
 * una sola página —un tramo único, hojas 1-711, sin folio—.
 */
function kindFor(source: ProjectSource, numbering: PageNumbering | null | undefined): CitationPageKind {
    const ranges = source.excerptRecipe?.sheetRanges ?? [];
    if (ranges.length === 0) return hasResolvedNumbering(numbering) ? 'printed' : 'sheet';
    if (!numbering) return 'sheet';
    // Se miran los SEGMENTOS que el tramo toca, no sus dos extremos: un tramo
    // 50-250 sobre un libro que no numera las hojas 101-200 tiene los dos
    // extremos resueltos y un hueco en el medio.
    const cubierto = (r: { start: number; end: number }) => {
        const tocados = numbering.segments.filter(g => g.fromSheet <= r.end && g.toSheet >= r.start);
        if (tocados.length === 0) return false;
        // Un hueco entre segmentos declarados tampoco resuelve.
        const declarado = tocados.reduce(
            (n, g) => n + (Math.min(g.toSheet, r.end) - Math.max(g.fromSheet, r.start) + 1),
            0,
        );
        return declarado === r.end - r.start + 1 && tocados.every(g => g.offset !== null);
    };
    return ranges.every(cubierto) ? 'printed' : 'sheet';
}
