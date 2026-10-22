import {
    candidateSheets,
    citationAnchorFor,
    searchTermsForCitation,
    sheetsAroundCitation,
    type CitationVerifierInput,
    type CitationVerifierOutput,
    type IBookSearch,
    type ICitationVerifier,
    type VerifiedCitation,
    type VerifierSource,
} from '@dosfilos/domain';

/**
 * Una cita no se declara «no encontrada» sin haber leído la página citada,
 * sus vecinas y el libro entero (TP #8, fase 8b, D1).
 *
 * El juez decidía con lo que tenía a mano —las hojas de la receta y los cinco
 * fragmentos más parecidos, recortados a 4.000 caracteres— y nunca pedía la
 * página citada aparte. Adamson 171 → 170 (TP #8) y McCartney 203 (TP #7)
 * salieron «no encontrada» con el texto a una página.
 *
 * Envuelve al verificador y sólo actúa sobre sus alarmas (`not-found`,
 * `fuzzy-low`) de una fuente reconocida:
 *   1. vuelve a juzgar con la página citada y dos vecinas a cada lado, enteras;
 *   2. si no, busca en el libro (frases de la cita textual, o las palabras
 *      distintivas de la paráfrasis) y vuelve a juzgar con las hojas que más
 *      coinciden: hallada en otra página, el veredicto es «página no
 *      coincide» con la página hallada;
 *   3. si no, el veredicto queda y la nota dice todo lo que se leyó.
 *
 * El segundo juicio va sin `userId`: el juez no recupera nada por su cuenta y
 * decide sólo con lo que se leyó.
 */
export class BookSearchBeforeAlarmVerifier implements ICitationVerifier {
    constructor(
        private readonly inner: ICitationVerifier,
        private readonly book: IBookSearch | null,
    ) { }

    async verify(input: CitationVerifierInput): Promise<CitationVerifierOutput> {
        const out = await this.inner.verify(input);
        if (!this.book) return out;
        const citations = await Promise.all(out.citations.map(v => this.revisar(v, input)));
        return { citations };
    }

    private async revisar(v: VerifiedCitation, input: CitationVerifierInput): Promise<VerifiedCitation> {
        // «Página no comprobable» también: la evidencia no traía página y leer
        // la citada la resuelve.
        if (v.status !== 'not-found' && v.status !== 'fuzzy-low' && v.status !== 'page-unverifiable') return v;
        const source = input.sources.find(s => s.corpusId === v.matchedCorpusId);
        // Sin fuente reconocida la alarma es de otra clase: la clave no existe.
        if (!source || !v.evidence?.trim()) return v;
        const lang = input.language ?? 'es';
        try {
            const cercanas = sheetsAroundCitation(v, source.numbering ?? null);
            if (cercanas.length > 0) {
                const r = await this.rejuzgar(v, source, cercanas, lang);
                if (r && (r.status === 'verified' || r.status === 'page-mismatch')) return { ...r, bookSearch: 'cited-page' };
            }

            const terminos = searchTermsForCitation(v.evidence, v.evidenceIsQuoted);
            if (terminos.length > 0) {
                const hits = await Promise.all(terminos.map(t =>
                    this.book!.sheetsWithTerm(source.corpusId, t).catch(() => [] as ReadonlyArray<{ sheet: number; count: number }>)));
                const candidatas = candidateSheets(hits, new Set(cercanas));
                if (candidatas.length > 0) {
                    const r = await this.rejuzgar(v, source, candidatas, lang);
                    if (r && (r.status === 'verified' || r.status === 'page-mismatch')) {
                        // Hallada lejos de la página citada: es «página no coincide»,
                        // aunque el juez haya dado por buena la cita.
                        const etiqueta = r.matchedPageLabel ?? (r.matchedPage ? `p. ${r.matchedPage}` : null);
                        return {
                            ...r,
                            status: 'page-mismatch',
                            bookSearch: 'book',
                            note: notaDeHallazgo(lang, etiqueta, r.note),
                        };
                    }
                }
            }
            // No está en su libro: ¿lo dice otra fuente del corpus? (D4, causa 3:
            // «eso lo dice Mayor, no Adamson»).
            const otra = terminos.length > 0 ? await this.enOtraFuente(v, source, terminos, input, lang) : null;
            if (otra) {
                return {
                    ...v,
                    bookSearch: 'not-in-book',
                    foundInOtherSource: otra,
                    note: notaEnOtraFuente(lang, v.author, otra, v.note),
                };
            }
        } catch (err) {
            // Buscar es una mejora: si falla, queda el veredicto de la primera pasada.
            console.warn('[BookSearchBeforeAlarm] no se pudo buscar en el libro', { raw: v.raw, error: (err as Error).message });
            return v;
        }
        return { ...v, bookSearch: 'not-in-book', note: notaSinHallazgo(lang, v.note) };
    }

    /**
     * Busca la afirmación en las OTRAS fuentes del corpus y juzga la que más
     * coincide (sólo una: es la causa 3 de «Diagnosticar», no un segundo
     * verificador). `null` si ninguna la sostiene.
     */
    private async enOtraFuente(
        v: VerifiedCitation,
        citada: VerifierSource,
        terminos: ReadonlyArray<string>,
        input: CitationVerifierInput,
        lang: 'es' | 'en',
    ): Promise<{ sourceKey: string; pageLabel: string | null } | null> {
        const otras = input.sources.filter(s => s.corpusId !== citada.corpusId && s.citationKey?.trim()).slice(0, MAX_OTRAS_FUENTES);
        let mejor: { fuente: VerifierSource; hojas: number[]; terminos: number } | null = null;
        for (const fuente of otras) {
            const hits = await Promise.all(terminos.map(t =>
                this.book!.sheetsWithTerm(fuente.corpusId, t).catch(() => [] as ReadonlyArray<{ sheet: number; count: number }>)));
            const hojas = candidateSheets(hits, new Set());
            const reunidos = hits.filter(h => h.some(x => hojas.includes(x.sheet))).length;
            if (hojas.length > 0 && (!mejor || reunidos > mejor.terminos)) mejor = { fuente, hojas, terminos: reunidos };
        }
        if (!mejor) return null;
        const r = await this.rejuzgar({ ...v, author: mejor.fuente.citationKey!, pages: null, evidencePage: null }, mejor.fuente, mejor.hojas, lang);
        if (!r || (r.status !== 'verified' && r.status !== 'page-mismatch')) return null;
        return { sourceKey: mejor.fuente.citationKey!, pageLabel: r.matchedPageLabel ?? null };
    }

    private async rejuzgar(
        v: VerifiedCitation,
        source: VerifierSource,
        sheets: ReadonlyArray<number>,
        lang: 'es' | 'en',
    ): Promise<VerifiedCitation | null> {
        const textos = await this.book!.readSheets(source.corpusId, sheets);
        if (textos.length === 0) return null;
        const numbering = source.numbering ?? null;
        const chunks = textos.map(t => ({
            text: t.text,
            pageHint: citationAnchorFor({ sheet: t.sheet, section: t.section }, numbering),
        }));
        // Offset 0: el verificador reordena por posición en la lista.
        const { citations } = await this.inner.verify({
            markdown: '',
            citations: [{ ...v, offset: 0 }],
            sources: [{ ...source, chunks }],
            language: lang,
        });
        const r = citations[0];
        return r ? { ...r, offset: v.offset } : null;
    }
}

function notaDeHallazgo(lang: 'es' | 'en', etiqueta: string | null, previa: string | null): string {
    const base = lang === 'en'
        ? `Not on the cited page: found ${etiqueta ? `on ${etiqueta}` : 'elsewhere in the book'} after searching the whole book.`
        : `No está en la página citada: se halló ${etiqueta ? `en ${etiqueta}` : 'en otra parte del libro'} al buscar en el libro entero.`;
    return previa?.trim() ? `${base} ${previa.trim()}` : base;
}

/** Otras fuentes del corpus en que se busca, como mucho. */
const MAX_OTRAS_FUENTES = 6;

function notaEnOtraFuente(lang: 'es' | 'en', autor: string, otra: { sourceKey: string; pageLabel: string | null }, previa: string | null): string {
    const donde = otra.pageLabel ? ` (${otra.pageLabel})` : '';
    const base = lang === 'en'
        ? `Not in ${autor} (cited page, neighbours and whole book searched); ${otra.sourceKey}${donde} says it.`
        : `No está en ${autor} (se buscó en la página citada, sus vecinas y el libro entero); lo dice ${otra.sourceKey}${donde}.`;
    return previa?.trim() ? `${base} ${previa.trim()}` : base;
}

function notaSinHallazgo(lang: 'es' | 'en', previa: string | null): string {
    const base = lang === 'en'
        ? 'Searched the cited page, its neighbours and the whole book without finding it.'
        : 'Se buscó en la página citada, sus vecinas y el libro entero sin hallarla.';
    return previa?.trim() ? `${base} ${previa.trim()}` : base;
}
