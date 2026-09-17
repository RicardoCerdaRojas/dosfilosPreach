import type { CanonicalVerseAnalysis, CitationPageKind } from '../entities/CanonicalVerseAnalysis';
import type { ParsedCitation } from '../entities/CitationVerification';

/**
 * En cuál de los seis sitios del análisis vive la afirmación citada.
 * El sitio dice qué clase de afirmación es y, por eso, cuánto pesa que
 * no se pueda verificar: una postura de comentarista atribuye palabras a
 * un autor; un rango semántico solo apunta a una entrada de léxico.
 */
export type AnalysisClaimSite =
    | 'commentator'
    | 'crux'
    | 'lexical-range'
    | 'lexical-loading'
    | 'footnote'
    | 'ot-link'
    | 'historical';

/**
 * Una afirmación del análisis junto con la cita que la respalda.
 *
 * Es lo que un verificador necesita y `AnalysisCitation` no trae: QUÉ se
 * afirma (`claim`) y, cuando el analizador la copió, la oración textual de
 * la fuente (`verbatimQuote`). Con la oración textual la verificación es
 * mecánica; sin ella hay que juzgar si la página sostiene la paráfrasis.
 */
export interface AnalysisClaim {
    site: AnalysisClaimSite;
    /** Ruta dentro del análisis, para que la interfaz señale la entrada exacta. */
    path: string;
    sourceKey: string;
    page: number;
    pageKind?: CitationPageKind;
    locator?: string;
    /** La afirmación tal como la escribió el analizador, en el idioma del trabajo. */
    claim: string;
    /** Oración de la fuente que el analizador dijo haber copiado. `null` si no la dio. */
    verbatimQuote: string | null;
}

/**
 * Todas las afirmaciones citadas de un análisis, en el orden en que llegan
 * al documento.
 *
 * Único recorrido de los seis sitios: `collectAnalysisCitations` se deriva
 * de aquí para que ninguna de las dos listas pueda olvidar un sitio que la
 * otra sí cuenta.
 */
export function collectAnalysisClaims(analysis: CanonicalVerseAnalysis): AnalysisClaim[] {
    const out: AnalysisClaim[] = [];
    const push = (
        site: AnalysisClaimSite,
        path: string,
        c: { sourceKey?: string; page?: number; pageKind?: CitationPageKind; locator?: string },
        claim: string,
        verbatimQuote?: string | null,
    ) => {
        if (!c?.sourceKey || typeof c.page !== 'number' || !Number.isFinite(c.page)) return;
        const quote = typeof verbatimQuote === 'string' ? verbatimQuote.trim() : '';
        out.push({
            site,
            path,
            sourceKey: c.sourceKey,
            page: c.page,
            pageKind: c.pageKind,
            locator: c.locator,
            claim: (claim ?? '').trim(),
            verbatimQuote: quote.length > 0 ? quote : null,
        });
    };

    analysis.commentatorEngagement.forEach((c, i) =>
        push('commentator', `commentatorEngagement[${i}]`, c, c.position, c.verbatimQuote));
    analysis.translationCruxes.forEach((crux, i) =>
        crux.commentatorPositions.forEach((p, j) =>
            push('crux', `translationCruxes[${i}].commentatorPositions[${j}]`, p, p.summary, p.verbatimQuote)));
    analysis.lexicalAnalyses.forEach((l, i) => {
        // Análisis anteriores pueden traer el rango sin glosas: el sitio se
        // recorre igual, con la afirmación que haya.
        const glosses = l.generalSemanticRange?.glosses ?? [];
        const range = glosses.length > 0 ? `${l.term}: ${glosses.join(', ')}` : `${l.term}`;
        (l.generalSemanticRange?.sources ?? []).forEach((s, j) =>
            push('lexical-range', `lexicalAnalyses[${i}].generalSemanticRange.sources[${j}]`, s, range));
        (l.loadingSources ?? []).forEach((s, j) =>
            push('lexical-loading', `lexicalAnalyses[${i}].loadingSources[${j}]`, s, l.verseSpecificLoading));
    });
    analysis.footnoteExtensions.forEach((f, i) =>
        f.sources.forEach((s, j) => push('footnote', `footnoteExtensions[${i}].sources[${j}]`, s, f.text)));
    analysis.oldTestamentLinks.forEach((o, i) =>
        o.sources.forEach((s, j) => push('ot-link', `oldTestamentLinks[${i}].sources[${j}]`, s, o.interpretiveBearing)));
    analysis.historicalContext.forEach((h, i) =>
        h.sources.forEach((s, j) => push('historical', `historicalContext[${i}].sources[${j}]`, s, h.relevance)));
    return out;
}

/**
 * Las afirmaciones del análisis en la forma que consume el verificador.
 *
 * `pageFor` traduce la página de cada cita a la unidad en que el
 * verificador rotula su evidencia (la página impresa cuando el recurso está
 * calibrado). Devuelve `null` para dejar la cita sin página, que apaga el
 * cotejo de página en vez de compararla en la unidad equivocada.
 *
 * Con oración textual, la evidencia es esa oración y va marcada como cita;
 * sin ella, la evidencia es la paráfrasis del analizador. La distinción es
 * la que decide si la verificación puede ser mecánica.
 */
export function analysisClaimsToCitations(
    claims: ReadonlyArray<AnalysisClaim>,
    pageFor: (claim: AnalysisClaim) => string | null,
): ParsedCitation[] {
    return claims.map((claim, index) => {
        const pages = pageFor(claim);
        return {
            raw: `${claim.sourceKey}, ${pages ? `p. ${pages}` : `hoja ${claim.page}`} · ${claim.site}`,
            author: claim.sourceKey,
            title: '',
            pages,
            offset: index,
            evidence: claim.verbatimQuote ?? claim.claim,
            evidenceIsQuoted: claim.verbatimQuote !== null,
        };
    });
}
