import type { VerifierSource, VerifierSourceChunk } from '../ports/ICitationVerifier';
import type { VerifiedCitation } from '../entities/CitationVerification';

/**
 * Ordena la evidencia de una fuente para verificar UNA cita: primero los
 * fragmentos de la página citada y sus vecinas, después el resto en su
 * orden original.
 *
 * Existe por una medición. El verificador recortaba la evidencia a los
 * primeros fragmentos de la fuente en orden de hoja, sin mirar la página
 * citada, y el modelo contestaba —con razón— «los fragmentos llegan hasta
 * la página 205» sobre una cita a la 206. En Sal 23:1, 10 de 14 citas
 * correctas salieron «no encontrada» por eso. Un verificador que juzga una
 * cita a la p. 560 con las pp. 553–557 no verifica: reprueba a ciegas.
 *
 * `window` es cuántas páginas a cada lado cuentan como vecinas: una cita
 * suele apoyarse en la página anterior o siguiente cuando el argumento
 * cruza el corte de página.
 *
 * Dentro de las cercanas, la citada va PRIMERO. Iban en orden de hoja, así
 * que una cita a la 204 recibía antes los fragmentos de la 203, y el tope de
 * fragmentos podía dejar fuera los de la 204: en el TP #7 «McCartney, 204»
 * salió «no encontrada» («los fragmentos de la página 204 tratan otros
 * asuntos») y el fundador la halló en la 204 impresa (#33).
 */
export function prioritizeChunksForCitedPage(
    chunks: ReadonlyArray<VerifierSourceChunk>,
    citedPages: string | null,
    window = 1,
): VerifierSourceChunk[] {
    const range = parsePageRange(citedPages);
    if (!range) return [...chunks];
    const cited: VerifierSourceChunk[] = [];
    const near: VerifierSourceChunk[] = [];
    const rest: VerifierSourceChunk[] = [];
    for (const chunk of chunks) {
        const page = pageNumberOfHint(chunk.pageHint);
        if (page !== null && page >= range.start && page <= range.end) cited.push(chunk);
        else if (page !== null && page >= range.start - window && page <= range.end + window) near.push(chunk);
        else rest.push(chunk);
    }
    return [...cited, ...near, ...rest];
}

/** Si el fragmento es de una página que la cita nombra (no una vecina). */
export function isOnCitedPage(chunk: VerifierSourceChunk, citedPages: string | null): boolean {
    const range = parsePageRange(citedPages);
    const page = pageNumberOfHint(chunk.pageHint);
    return range !== null && page !== null && page >= range.start && page <= range.end;
}

/** Primer número de un rótulo de página: «p. 559» → 559, «hoja 12» → 12, «p. ccxxii» → null. */
export function pageNumberOfHint(hint: string | null): number | null {
    if (!hint) return null;
    const m = hint.match(/(\d+)/);
    return m ? parseInt(m[1]!, 10) : null;
}

/**
 * «559», «559–60», «559-561» → el tramo. Una lista de páginas CONTIGUAS,
 * «170, 171», es un solo tramo (TP #8, 8b, D1): antes se quedaba con la
 * primera y una cita a dos páginas se cotejaba contra una. Una lista con
 * saltos, «203, 206», da su primer tramo; el cotejo mira cada uno
 * (`parsePageSpans`, `pagesOverlap`).
 */
export function parsePageRange(raw: string | null): { start: number; end: number } | null {
    const tramos = parsePageSpans(raw);
    return tramos[0] ?? null;
}

/** Los tramos de una lista de páginas, ordenados y con los contiguos fundidos. */
export function parsePageSpans(raw: string | null): Array<{ start: number; end: number }> {
    if (!raw) return [];
    const tramos = raw.replace(/\s+/g, '').replace(/[–—]/g, '-').split(/[,;&]+/).map(tramoDePaginas).filter(
        (t): t is { start: number; end: number } => t !== null);
    // En el orden escrito: el primero es el que se abre y el que se cita.
    const out: Array<{ start: number; end: number }> = [];
    for (const t of tramos) {
        const ultimo = out[out.length - 1];
        if (ultimo && t.start <= ultimo.end + 1 && t.end >= ultimo.start) ultimo.end = Math.max(ultimo.end, t.end);
        else out.push({ ...t });
    }
    return out;
}

function tramoDePaginas(cleaned: string): { start: number; end: number } | null {
    const m = cleaned.match(/^(\d+)(?:-(\d+))?/);
    if (!m) return null;
    const start = parseInt(m[1]!, 10);
    let end = m[2] ? parseInt(m[2]!, 10) : start;
    // «559-61» abrevia «559-561».
    if (m[2] && m[2].length < m[1]!.length) {
        end = parseInt(m[1]!.slice(0, m[1]!.length - m[2].length) + m[2], 10);
    }
    return end >= start ? { start, end } : { start, end: start };
}

/**
 * Si dos rótulos de página pueden estar hablando del mismo sitio.
 *
 * Lo usan los tres verificadores para decidir «página no coincide». Vivía
 * copiado en cada uno, y las copias no sabían leer «559–61»: al abreviar,
 * el final salía 61, menor que el inicio, y una cita correcta a un rango
 * quedaba marcada como página equivocada.
 *
 * Cuando alguno de los dos rótulos no trae número —«ad loc.», «ci»— se
 * comparan como texto: es lo único honesto que se puede hacer.
 */
export function pagesOverlap(citedRaw: string | null, matchedRaw: string | null): boolean {
    const cited = parsePageSpans(citedRaw);
    const matched = parsePageSpans(matchedRaw);
    if (cited.length === 0 || matched.length === 0) return citedRaw === matchedRaw;
    // Cada tramo de la cita contra cada tramo hallado: «203, 206» no cubre la 204.
    return cited.some(c => matched.some(m => c.start <= m.end && m.start <= c.end));
}

/**
 * Qué se puede decir de la página de una cita, mirando la del fragmento que
 * la respalda.
 *
 * Vive aquí, en una sola función, porque la regla estaba escrita dos veces —una
 * en cada verificador— y dos copias de una regla son dos reglas apenas alguien
 * toca una. El defecto que cierra vivía justamente en las dos: ambas
 * condicionaban el cotejo a que el fragmento trajera número (`&& matchedPage`),
 * de modo que la falta de número cancelaba la comprobación entera y dejaba la
 * cita en verde.
 *
 *   - `ok`         — la cita no afirma página, o afirma una que el fragmento
 *                    respalda. No hay nada que reprochar.
 *   - `mismatch`   — hay dos números comparables y no se tocan.
 *   - `unverifiable` — la cita afirma una página y el fragmento no trae
 *                    ninguna. No es que discrepen: es que no hay con qué
 *                    comparar, y ese es el caso peor, porque un fragmento sin
 *                    ancla llega al modelo sin página y el número de la cita
 *                    no lo copió de ningún rótulo.
 */
export type PageVerdict = 'ok' | 'mismatch' | 'unverifiable';

export function pageVerdictFor(
    citedPages: string | null | undefined,
    matchedPage: string | null | undefined,
): PageVerdict {
    if (!citedPages) return 'ok';
    if (!matchedPage) return 'unverifiable';
    return pagesOverlap(citedPages, matchedPage) ? 'ok' : 'mismatch';
}

/**
 * La prosa hereda lo que el análisis ya resolvió para la misma cita (TP #8,
 * fase 8b, D1): misma fuente y páginas que se tocan. Wallace 662 pasó en el
 * análisis, con su oración textual, y falló en el documento, donde se juzgó
 * la paráfrasis de la prosa contra lo que el juez alcanzó a ver.
 *
 * Hereda SOLO las otras fuentes de una afirmación de síntesis. La oración
 * textual no: reemplazar la evidencia de la prosa con la del análisis hacía
 * que el juez nunca viera lo que la prosa afirma, y la frase heredada salía
 * verde sin juicio (revisión de 8b). El llamador pasa solo las citas del
 * análisis que se verificaron.
 */
export function inheritFromAnalysisCitations<T extends {
    author: string; pages: string | null; evidence: string; evidenceIsQuoted: boolean; otherSources?: string[];
}>(
    prose: ReadonlyArray<T>,
    analysis: ReadonlyArray<{ author: string; pages: string | null; evidence: string; evidenceIsQuoted: boolean; otherSources?: string[] }>,
): T[] {
    const clave = (k: string) => k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    return prose.map(c => {
        const par = analysis.find(a => clave(a.author) === clave(c.author) && pagesOverlap(a.pages, c.pages));
        if (!par) return c;
        const otras = [...new Set([...(c.otherSources ?? []), ...(par.otherSources ?? [])])]
            .filter(o => clave(o) !== clave(c.author));
        return otras.length > 0 ? { ...c, otherSources: otras } : c;
    });
}

/**
 * Una cita que no cambió no cambia de veredicto (TP #9, B46).
 *
 * El juez es un modelo y no responde dos veces igual: en la prosa de Stg 4:14,
 * «Varner, en cambio, distingue la relativa, una interrogación principal, y la
 * explicación final (Varner, 162)» salió verificada a las 19:46 y «página no
 * coincide: el pasaje de apoyo está en 163» a las 22:03, con el mismo texto
 * (solo se había editado OTRA oración del párrafo). Lo mismo «Kittel y
 * Friedrich, pp. 230–231» del análisis, que nadie tocó.
 *
 * Por cada cita devuelve el veredicto previo de una cita IDÉNTICA (misma
 * fuente, páginas, afirmación, marca de textual, otras fuentes y sitio del
 * análisis; y el contexto previo cuando la afirmación depende de él), o `null`
 * para juzgarla.
 *
 * SOLO LOS VERDES. El llamador pasa únicamente veredictos `verified`, y aquí
 * se vuelve a filtrar. Reusar también las alarmas congelaría una falsa
 * alarma: volver a verificar es justamente lo que hace el estudiante cuando
 * cree que el verificador se equivocó, y cada arreglo del verificador (leer
 * la página citada, el contexto de B35b) tiene que poder rescatarla. La
 * asimetría es a propósito: que una alarma pase a verde al repetir es una
 * mejora visible; que un verde pase a alarma sin tocar el texto es el defecto.
 *
 * Tampoco si la fuente cambió: el veredicto guarda la huella de la fuente con
 * que se juzgó (`sourceFingerprint`) y tiene que coincidir con la de ahora. Una
 * fuente que ya no está en el trabajo no tiene huella. Un veredicto sin huella
 * (anterior a esta regla) no se reusa: el primero que se juzgue la estampa.
 */
export function reuseIdenticalVerdicts<T extends ReusableCitationFields>(
    citations: ReadonlyArray<T>,
    previous: ReadonlyArray<ReusableCitationFields & VerdictFields>,
    /** corpusId → huella actual de cada fuente del trabajo. */
    fingerprints: ReadonlyMap<string, string>,
): Array<(T & VerdictFields) | null> {
    const porClave = new Map<string, ReusableCitationFields & VerdictFields>();
    for (const p of previous) {
        if (p.status !== 'verified' || !p.matchedCorpusId) continue;
        const huella = fingerprints.get(p.matchedCorpusId);
        if (!huella || p.sourceFingerprint !== huella) continue;
        const k = citationIdentity(p);
        if (!porClave.has(k)) porClave.set(k, p);
    }
    return citations.map(c => {
        const previo = porClave.get(citationIdentity(c));
        return previo ? { ...sinIndefinidos(c), ...soloVeredicto(previo) } : null;
    });
}

/** Lo que identifica a una cita para reusar su veredicto. */
export interface ReusableCitationFields {
    author: string;
    title: string;
    pages: string | null;
    evidencePage?: string | null;
    evidence: string;
    evidenceIsQuoted: boolean;
    evidenceContext?: string;
    otherSources?: string[];
    site?: string;
}

/** Los campos del veredicto (lo que añade `VerifiedCitation` a la cita). */
interface VerdictFields {
    status: VerifiedCitation['status'];
    matchedCorpusId: string | null;
    matchedSourceLabel: string | null;
    similarityScore: number | null;
    matchedPage: string | null;
    matchedPageLabel?: string | null;
    note: string | null;
    bookSearch?: VerifiedCitation['bookSearch'];
    takenFromSource?: string;
    supportingSpan?: VerifiedCitation['supportingSpan'];
    foundInOtherSource?: VerifiedCitation['foundInOtherSource'];
    notFromSource?: string;
    claimCoverage?: VerifiedCitation['claimCoverage'];
    sourceFingerprint?: string;
}

const CAMPOS_DEL_VEREDICTO = [
    'status', 'matchedCorpusId', 'matchedSourceLabel', 'similarityScore', 'matchedPage', 'matchedPageLabel',
    'note', 'bookSearch', 'takenFromSource', 'supportingSpan', 'foundInOtherSource', 'notFromSource',
    'claimCoverage', 'sourceFingerprint',
] as const;

/**
 * Solo lo que el juez decidió: la cita (offset, `raw`, contexto) es la nueva.
 * Firestore rechaza `undefined`: no se copia ninguna clave que lo valga.
 */
function soloVeredicto(v: VerdictFields): VerdictFields {
    const out: Record<string, unknown> = {};
    for (const k of CAMPOS_DEL_VEREDICTO) {
        if (v[k] !== undefined) out[k] = v[k];
    }
    return out as unknown as VerdictFields;
}

function sinIndefinidos<T extends object>(o: T): T {
    return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/**
 * La clave de identidad. Autor y título sin tildes ni mayúsculas (la misma
 * fuente escrita igual); la afirmación tal cual, salvo espacios (una tilde
 * griega distinta es otra afirmación); las páginas sin espacios y con un solo
 * guion. El contexto previo entra solo si la afirmación depende de él: editar
 * la oración anterior no cambia «Varner distingue la relativa…», pero sí lo
 * que es «él» en «Robertson cita el versículo sin él».
 */
export function citationIdentity(c: ReusableCitationFields): string {
    const texto = (s: string | null | undefined) => (s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
    const clave = (s: string | null | undefined) => texto(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const paginas = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, '').replace(/[–—]/g, '-');
    return JSON.stringify([
        clave(c.author),
        clave(c.title),
        paginas(c.pages),
        paginas(c.evidencePage ?? null),
        texto(c.evidence),
        c.evidenceIsQuoted,
        [...new Set((c.otherSources ?? []).map(clave))].sort(),
        c.site ?? '',
        dependsOnContext(c.evidence) ? texto(c.evidenceContext) : '',
    ]);
}

/**
 * Si la afirmación tiene palabras que solo se entienden con lo anterior
 * («él», «esto», «este versículo», «aquí»). Pecar de más es seguro: una
 * afirmación marcada así solo deja de reusarse cuando cambia su contexto.
 */
export function dependsOnContext(evidence: string): boolean {
    return DEIXIS.test(evidence);
}

const DEIXIS = new RegExp(
    '(^|[^\\p{L}])(' + [
        // es
        'él', 'ella', 'ellos', 'ellas', 'ello', 'esto', 'eso', 'aquello', 'este', 'esta', 'estos', 'estas',
        'ese', 'esa', 'esos', 'esas', 'aquel', 'aquella', 'aquellos', 'aquellas', 'éste', 'ésta', 'ése', 'ésa',
        'dicho', 'dicha', 'dichos', 'dichas', 'tal', 'tales', 'aquí', 'ahí', 'allí', 'mismo', 'misma',
        // en. Sin «that» ni «there»: casi siempre son conjunción («argues that…»)
        // y existencial («there is…»), y marcarían casi toda afirmación en inglés.
        'it', 'its', 'this', 'these', 'those', 'he', 'she', 'they', 'them', 'here', 'such',
    ].join('|') + ')(?=$|[^\\p{L}])',
    'iu',
);

/**
 * La huella de una fuente tal como la ve el verificador: su numeración y el
 * texto y el rótulo de cada fragmento. Cambia si se recalibra la numeración
 * (hoja → página), si se re-extrae el libro (reproceso en lote) o si cambian
 * las hojas admitidas; en los tres casos un verde viejo ya no está probado.
 * FNV-1a de 32 bits: no es criptográfica, alcanza para notar un cambio.
 */
export function sourceFingerprint(source: Pick<VerifierSource, 'numbering' | 'chunks'>): string {
    let h = 0x811c9dc5;
    const mezclar = (t: string) => {
        for (let i = 0; i < t.length; i++) {
            h ^= t.charCodeAt(i);
            h = Math.imul(h, 0x01000193) >>> 0;
        }
        h ^= 0x1f; // separador: «ab»+«c» no es «a»+«bc»
        h = Math.imul(h, 0x01000193) >>> 0;
    };
    mezclar(JSON.stringify(source.numbering ?? null));
    for (const c of source.chunks) {
        mezclar(c.pageHint ?? '');
        mezclar(c.text);
    }
    return `${source.chunks.length}:${h.toString(16)}`;
}
