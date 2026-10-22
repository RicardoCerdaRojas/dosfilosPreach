import type {
    CitationVerifierInput,
    CitationVerifierOutput,
    ICitationVerifier,
    ParsedCitation,
    VerifiedCitation,
    VerifierSource,
} from '@dosfilos/domain';
import { findVerbatim, pagesOverlap } from '@dosfilos/domain';

/**
 * Verifica primero lo que se puede verificar sin juzgar.
 *
 * Cuando una cita trae la oración textual de la fuente, comprobarla es buscar
 * esa oración en las hojas de la fuente: sin modelo, sin costo y sin margen
 * de interpretación. Solo lo que no se encuentra —o no trae oración— pasa al
 * verificador de adentro, que juzga si la página sostiene la paráfrasis.
 *
 * Decorador sobre `ICitationVerifier`: el llamador no distingue cuál de los
 * dos emitió cada veredicto, y el de adentro sigue sirviendo solo.
 */
export class VerbatimFirstCitationVerifier implements ICitationVerifier {
    constructor(private readonly inner: ICitationVerifier) { }

    async verify(input: CitationVerifierInput): Promise<CitationVerifierOutput> {
        if (!input.citations) return this.inner.verify(input);

        const language = input.language ?? 'es';
        const byKey = new Map(input.sources.map(s => [normalize(s.citationKey ?? ''), s] as const));
        const resolved = new Map<number, VerifiedCitation>();
        const pending: ParsedCitation[] = [];

        input.citations.forEach(citation => {
            const verdict = citation.evidenceIsQuoted
                ? verifyByVerbatim(citation, byKey.get(normalize(citation.author)) ?? null, language)
                : null;
            if (verdict) resolved.set(citation.offset, verdict);
            else pending.push(citation);
        });

        const judged = pending.length > 0
            ? (await this.inner.verify({ ...input, citations: pending })).citations
            : [];
        // Cada veredicto vuelve a su cita por `offset`, que el de adentro
        // conserva. Por posición en la lista no: re-verificar UNA cita de un
        // análisis (`CorrectCitationUseCase`) le pasa su offset original, que
        // no es 0, y el veredicto se perdía (revisión de 8b).
        for (const v of judged) resolved.set(v.offset, v);

        return {
            citations: input.citations.map(c => resolved.get(c.offset)).filter((v): v is VerifiedCitation => !!v),
        };
    }
}

/**
 * `null` cuando la oración no aparece: ahí no hay veredicto barato posible y
 * decide el verificador de adentro con la misma cita.
 */
function verifyByVerbatim(
    citation: ParsedCitation,
    source: VerifierSource | null,
    language: 'es' | 'en',
): VerifiedCitation | null {
    if (!source) return null;
    const match = findVerbatim(citation.evidence, source.chunks);
    if (!match) return null;
    // Hallada en el texto completo, sin página: la oración existe pero la
    // página citada no se comprobó. Decide el juez, y antes de alarmar se lee
    // la página citada (D1). Antes salía «verificada» con cualquier página.
    if (match.pageHint === null && citation.pages !== null) return null;

    const matchedPage = pageNumberOf(match.pageHint);
    const mismatch = citation.pages !== null && matchedPage !== null && !pagesOverlap(citation.pages, matchedPage);
    return {
        ...citation,
        status: mismatch ? 'page-mismatch' : 'verified',
        matchedCorpusId: source.corpusId,
        matchedSourceLabel: source.displayLabel,
        similarityScore: match.score,
        matchedPage,
        matchedPageLabel: match.pageHint,
        note: mismatch
            ? (language === 'en'
                ? `The quoted sentence is in the source, but at ${match.pageHint}, not p. ${citation.pages}.`
                : `La oración citada está en la fuente, pero en ${match.pageHint}, no en p. ${citation.pages}.`)
            : (language === 'en'
                ? `Quoted sentence found verbatim${match.pageHint ? ` at ${match.pageHint}` : ''}.`
                : `Oración citada hallada textualmente${match.pageHint ? ` en ${match.pageHint}` : ''}.`),
    };
}

function normalize(s: string): string {
    return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function pageNumberOf(hint: string | null): string | null {
    if (!hint) return null;
    const m = hint.match(/(\d+(?:\s*[–\-—]\s*\d+)?)/);
    return m ? m[1]!.replace(/\s+/g, '') : null;
}


