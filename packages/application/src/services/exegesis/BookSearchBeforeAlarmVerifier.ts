import {
    candidateSheets,
    findVerbatim,
    pagesOverlap,
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
        // Cada alarma puede costar hasta tres juicios más y una docena de
        // búsquedas en el libro entero: se memorizan las búsquedas, se revisan
        // pocas a la vez y como mucho `MAX_ALARMAS_RELEIDAS` por pasada
        // (revisión de 8b). Las que exceden quedan con su primer veredicto.
        const buscar = memoizar(this.book);
        // Topes separados: con uno solo, gastado en el orden del documento,
        // doce «página no coincide» antes de dos «no encontrada» dejaban las
        // dos sin releer y sin nota (revisión adversarial de B46).
        let alarmas = 0;
        let paginas = 0;
        const citations = await enTandas(out.citations, CONCURRENCIA, v => {
            if (esAlarma(v) && alarmas < MAX_ALARMAS_RELEIDAS) {
                alarmas++;
                return this.revisar(v, input, buscar);
            }
            if (esPaginaQueDecidioElJuez(v) && paginas < MAX_PAGINAS_RELEIDAS) {
                paginas++;
                return this.laCitadaLoSostiene(v, input);
            }
            return Promise.resolve(v);
        });
        return { citations };
    }

    private async revisar(v: VerifiedCitation, input: CitationVerifierInput, buscar: Buscador): Promise<VerifiedCitation> {
        const source = input.sources.find(s => s.corpusId === v.matchedCorpusId);
        // Sin fuente reconocida la alarma es de otra clase: la clave no existe.
        if (!source || !v.evidence?.trim()) return v;
        const lang = input.language ?? 'es';
        // «Página no comprobable»: el juez ya dijo que la fuente lo sostiene y
        // solo faltó la página. Leer la citada la resuelve; si no, se deja como
        // estaba: nunca «no está en el libro» ni «lo dice otra fuente».
        const soloPagina = v.status === 'page-unverifiable';
        try {
            const cercanas = sheetsAroundCitation(v, source.numbering ?? null);
            if (cercanas.length > 0) {
                const r = await this.rejuzgar(v, source, cercanas, lang, input.passageRef);
                if (r && (r.status === 'verified' || r.status === 'page-mismatch')) return { ...r, bookSearch: 'cited-page' };
            }

            const terminos = searchTermsForCitation(v.evidence, v.evidenceIsQuoted);
            let incompleta = false;
            if (terminos.length > 0) {
                const resultados = await Promise.all(terminos.map(t => buscar(source.corpusId, t)));
                incompleta = resultados.some(r => r.truncated);
                const candidatas = candidateSheets(resultados.map(r => r.hits), new Set(cercanas));
                if (candidatas.length > 0) {
                    const r = await this.rejuzgar(v, source, candidatas, lang, input.passageRef);
                    if (r && (r.status === 'verified' || r.status === 'page-mismatch')) {
                        // Hallada fuera de lo citado: «página no coincide». Si la
                        // página hallada SÍ es una de las citadas («203, 206»), o
                        // la cita no tenía página, el veredicto del juez vale.
                        const fuera = !!v.pages && !!r.matchedPage && !pagesOverlap(v.pages, r.matchedPage);
                        if (!fuera) return { ...r, bookSearch: 'book' };
                        const etiqueta = r.matchedPageLabel ?? `p. ${r.matchedPage}`;
                        return { ...r, status: 'page-mismatch', bookSearch: 'book', note: notaDeHallazgo(lang, etiqueta, r.note) };
                    }
                }
            }
            if (soloPagina) return v;
            // Una búsqueda que el servidor cortó no prueba ausencia: no se
            // afirma «no está en el libro» (y el diagnóstico no propone quitarla).
            if (incompleta) return { ...v, note: notaBusquedaIncompleta(lang, v.note) };
            // No está en su libro: ¿lo dice otra fuente del corpus? (D4, causa 3:
            // «eso lo dice Mayor, no Adamson»).
            const otra = terminos.length > 0 ? await this.enOtraFuente(v, source, terminos, input, lang, buscar) : null;
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
     * «Página no coincide» de la primera pasada: ¿la página citada, SOLA,
     * sostiene la afirmación? (TP #9, B46).
     *
     * El juez marca la página que MEJOR la respalda y, aparte, si la citada
     * también la sostiene (`citedPageSupports`); con ese sí la cita queda
     * verde (`citedPageSettlesIt`). Pero el sí depende del día: «Varner,
     * 162» salió verde con el apoyo en la 162 y, con el mismo texto, «el
     * pasaje de apoyo está en 163», porque la 163 lo repite con palabras más
     * parecidas a las de la oración. Kittel 230–231 → 229, igual: el mismo
     * tramo llegó rotulado 229 (un fragmento que empieza al pie de la 229) y
     * 230. Con la página vecina delante, el juez compara; sin ella, juzga.
     *
     * Se relee solo la citada, entera, sin vecinas. Si la sostiene, verde; si
     * no, queda el veredicto de la primera pasada tal cual.
     *
     * El verde exige además que el tramo de apoyo que copió el juez esté TAL
     * CUAL en la hoja citada (`findVerbatim`, sin modelo): sin la vecina
     * delante, un juez indulgente podría dar por buena una página que solo
     * trata el tema y tapar una página realmente equivocada.
     */
    private async laCitadaLoSostiene(v: VerifiedCitation, input: CitationVerifierInput): Promise<VerifiedCitation> {
        const source = input.sources.find(s => s.corpusId === v.matchedCorpusId);
        if (!source || !v.evidence?.trim()) return v;
        try {
            const citadas = sheetsAroundCitation(v, source.numbering ?? null, 0);
            if (citadas.length === 0) return v;
            const hojas = await this.hojasComoFragmentos(source, citadas);
            if (hojas.length === 0) return v;
            const r = await this.rejuzgarCon(v, source, hojas, input.language ?? 'es', input.passageRef);
            if (!r || r.status !== 'verified') return v;
            const tramo = r.supportingSpan?.text?.trim();
            if (!tramo || !findVerbatim(tramo, hojas)) return v;
            return { ...r, bookSearch: 'cited-page' };
        } catch (err) {
            console.warn('[BookSearchBeforeAlarm] no se pudo releer la página citada', { raw: v.raw, error: (err as Error).message });
            return v;
        }
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
        buscar: Buscador,
    ): Promise<{ sourceKey: string; pageLabel: string | null } | null> {
        // Las que la oración ya cita no son «otra» fuente: «(Mayor, 129;
        // Adamson, 166)» no es «lo dice Mayor, no Adamson» (revisión de 8b).
        const yaCitadas = new Set((v.otherSources ?? []).map(k => k.trim().toLowerCase()));
        const otras = input.sources
            .filter(s => s.corpusId !== citada.corpusId && s.citationKey?.trim() && !yaCitadas.has(s.citationKey.trim().toLowerCase()))
            .slice(0, MAX_OTRAS_FUENTES);
        let mejor: { fuente: VerifierSource; hojas: number[]; terminos: number } | null = null;
        for (const fuente of otras) {
            const hits = (await Promise.all(terminos.map(t => buscar(fuente.corpusId, t)))).map(r => r.hits);
            const hojas = candidateSheets(hits, new Set());
            const reunidos = hits.filter(h => h.some(x => hojas.includes(x.sheet))).length;
            if (hojas.length > 0 && (!mejor || reunidos > mejor.terminos)) mejor = { fuente, hojas, terminos: reunidos };
        }
        if (!mejor) return null;
        const r = await this.rejuzgar({ ...v, author: mejor.fuente.citationKey!, pages: null, evidencePage: null }, mejor.fuente, mejor.hojas, lang, input.passageRef);
        if (!r || (r.status !== 'verified' && r.status !== 'page-mismatch')) return null;
        return { sourceKey: mejor.fuente.citationKey!, pageLabel: r.matchedPageLabel ?? null };
    }

    private async rejuzgar(
        v: VerifiedCitation,
        source: VerifierSource,
        sheets: ReadonlyArray<number>,
        lang: 'es' | 'en',
        passageRef?: string,
    ): Promise<VerifiedCitation | null> {
        const chunks = await this.hojasComoFragmentos(source, sheets);
        if (chunks.length === 0) return null;
        return this.rejuzgarCon(v, source, chunks, lang, passageRef);
    }

    /** Las hojas, enteras, rotuladas con la página impresa cuando se puede. */
    private async hojasComoFragmentos(source: VerifierSource, sheets: ReadonlyArray<number>): Promise<Array<{ text: string; pageHint: string }>> {
        const textos = await this.book!.readSheets(source.corpusId, sheets);
        const numbering = source.numbering ?? null;
        return textos.map(t => ({
            text: t.text,
            pageHint: citationAnchorFor({ sheet: t.sheet, section: t.section }, numbering),
        }));
    }

    private async rejuzgarCon(
        v: VerifiedCitation,
        source: VerifierSource,
        chunks: ReadonlyArray<{ text: string; pageHint: string }>,
        lang: 'es' | 'en',
        passageRef?: string,
    ): Promise<VerifiedCitation | null> {
        // Offset 0: el verificador reordena por posición en la lista. Sin lo
        // que dejó la primera pasada (otra página, otro tramo): si el segundo
        // juicio no lo reemplaza, el visor resaltaría un texto ajeno. Y sin
        // las otras fuentes: aquí solo se lee esta.
        const { supportingSpan: _s, takenFromSource: _t, note: _n, otherSources: _o, ...limpia } = v;
        const { citations } = await this.inner.verify({
            markdown: '',
            citations: [{ ...limpia, offset: 0 }],
            sources: [{ ...source, chunks }],
            language: lang,
            ...(passageRef ? { passageRef } : {}),
            // La página citada se lee entera, sin el tope de 4.000 (D1.1).
            maxCharsPerChunk: MAX_CARACTERES_POR_HOJA,
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
/** Alarmas que se releen por pasada, y cuántas a la vez. */
export const MAX_ALARMAS_RELEIDAS = 12;
/** «Página no coincide» del juez que se releen con la página citada sola, por pasada. */
export const MAX_PAGINAS_RELEIDAS = 6;
const CONCURRENCIA = 3;
/** Una hoja densa (notas, griego) pasa de 4.000; esto la lee entera. */
const MAX_CARACTERES_POR_HOJA = 12_000;

const ALARMAS_RELEIBLES = new Set(['not-found', 'fuzzy-low', 'page-unverifiable']);
function esAlarma(v: VerifiedCitation): boolean {
    return ALARMAS_RELEIBLES.has(v.status);
}

/**
 * «Página no coincide» que decidió el juez comparando páginas, no un hecho:
 * una cita textual hallada en otra hoja (`VerbatimFirstCitationVerifier`)
 * está donde está, y una página que ya salió de buscar en el libro ya se
 * leyó. Sin página citada no hay qué releer.
 */
function esPaginaQueDecidioElJuez(v: VerifiedCitation): boolean {
    return v.status === 'page-mismatch' && !v.evidenceIsQuoted && !v.bookSearch && !!(v.pages ?? v.evidencePage);
}

type Resultado = { hits: ReadonlyArray<{ sheet: number; count: number }>; truncated: boolean };
type Buscador = (resourceId: string, term: string) => Promise<Resultado>;

/** La misma búsqueda una sola vez por pasada; un error cuenta como búsqueda incompleta. */
function memoizar(book: IBookSearch): Buscador {
    const cache = new Map<string, Promise<Resultado>>();
    return (resourceId, term) => {
        const k = `${resourceId}\u0000${term}`;
        if (!cache.has(k)) {
            cache.set(k, book.sheetsWithTerm(resourceId, term).catch(() => ({ hits: [], truncated: true })));
        }
        return cache.get(k)!;
    };
}

async function enTandas<T, R>(items: ReadonlyArray<T>, n: number, f: (x: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let i = 0;
    const trabajador = async () => {
        while (i < items.length) {
            const k = i++;
            out[k] = await f(items[k]!);
        }
    };
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, trabajador));
    return out;
}

function notaBusquedaIncompleta(lang: 'es' | 'en', previa: string | null): string {
    const base = lang === 'en'
        ? 'Read the cited page and its neighbours; the search of the whole book came back incomplete, so absence is not confirmed.'
        : 'Se leyó la página citada y sus vecinas; la búsqueda en el libro entero vino incompleta, así que no se confirma que no esté.';
    return previa?.trim() ? `${base} ${previa.trim()}` : base;
}

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
