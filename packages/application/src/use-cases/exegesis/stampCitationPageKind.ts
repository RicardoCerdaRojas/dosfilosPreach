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
 * dio a leer: `citationAnchorFor` nunca mezcla las dos formas dentro de una
 * misma fuente —emite `p. N` cuando la numeración resuelve, sólo la sección
 * cuando el tramo no tiene folio arábigo, y `hoja N` únicamente cuando el
 * recurso no declara numeración—, así que basta con saber si esa fuente tenía
 * numeración para saber qué es el número que el modelo copió.
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
        kindByCitationKey.set(
            source.citationKey,
            numberings.get(source.id) ? 'printed' : 'sheet',
        );
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
