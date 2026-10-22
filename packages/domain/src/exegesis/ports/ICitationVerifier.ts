import type { ParsedCitation, VerifiedCitation } from '../entities/CitationVerification';
import type { PageNumbering } from '../outline/pageNumbering';

/**
 * Source surface a verifier needs to match a citation against. Slim by
 * design — just enough to identify the source (lookup) and to inspect
 * its content (verification). Adapters in infrastructure project from
 * the richer `ProjectSource` + corpus content into this shape.
 */
export interface VerifierSource {
    corpusId: string;
    /** Short surname/key used in citations. Null when the user never set one. */
    citationKey: string | null;
    /** Full author / publisher line — used for surname extraction fallback. */
    fullAuthor: string | null;
    /** Display label used as title fallback. */
    displayLabel: string;
    /**
     * One verifiable chunk of source text. For `mode: 'extracted-excerpts'`
     * sources, one entry per excerpt with the excerpt's `sourceLocation`
     * as `pageHint`. For `mode: 'full-document'` sources, a single entry
     * with the whole text and a null `pageHint` (page-mismatch detection
     * is skipped for these).
     */
    chunks: ReadonlyArray<VerifierSourceChunk>;
    /**
     * Numeración impresa del recurso, cuando está confirmada.
     *
     * Viaja con la fuente porque el verificador consigue evidencia por su
     * cuenta —recupera fragmentos por embeddings— y esos fragmentos vienen
     * rotulados con la HOJA del archivo. Sin esto los rotula «p. N» y el
     * cotejo de página compara la página impresa que dice la cita contra la
     * hoja que dice el fragmento: dos unidades distintas, y toda cita correcta
     * de un libro con preliminares sale marcada como «página no coincide».
     */
    numbering?: PageNumbering | null;
}

export interface VerifierSourceChunk {
    text: string;
    /** "p. 47" or "comm. on v.1" — null when the source is full-document. */
    pageHint: string | null;
}

export interface CitationVerifierInput {
    /** The accepted/current step version's markdown. */
    markdown: string;
    /**
     * Citas ya reconocidas, cuando el llamador las tiene mejor que el
     * parser: el análisis canónico guarda cada cita estructurada (fuente,
     * página, afirmación y, a veces, la oración textual), y parsear un
     * markdown que no existe devolvía cero citas —verde por vacío—. Con
     * este campo el adaptador verifica ESTAS y no parsea el markdown.
     */
    citations?: ReadonlyArray<ParsedCitation>;
    /**
     * Idioma en que se redactan las notas de veredicto. Sin él, el adaptador
     * lo adivina a partir de la evidencia, que falla cuando la evidencia es
     * una oración textual en el idioma de la fuente.
     */
    language?: 'es' | 'en';
    /**
     * Las citas del análisis del mismo paso, para que las de la prosa hereden
     * lo ya resuelto: la oración textual y las otras fuentes (TP #8, 8b, D1).
     * Sólo con `markdown`, en el camino de la prosa.
     */
    inheritFrom?: ReadonlyArray<ParsedCitation>;
    /**
     * Tope de caracteres por fragmento. Sin él, el del adaptador (4.000). Al
     * releer la página citada se pasa uno mayor: una hoja densa perdía su
     * parte de abajo (revisión de 8b).
     */
    maxCharsPerChunk?: number;
    /** All citable sources attached to the paper. */
    sources: ReadonlyArray<VerifierSource>;
    /**
     * Owner of the paper. Required by adapters that do per-citation
     * embedding retrieval against the user's library (the
     * `retrieveChunks` callable scopes by userId server-side). Token-
     * overlap adapters ignore it.
     */
    userId?: string;
}

export interface CitationVerifierOutput {
    citations: VerifiedCitation[];
}

/**
 * Programmatic citation verifier. Returns one verdict per detected
 * citation. No side effects (the use case persists the summary).
 *
 * Async because the v2 LLM-based adapter needs to make per-citation
 * model calls (to support cross-language verification — a Spanish
 * paper paraphrasing English commentary won't match on token overlap
 * but a multilingual LLM handles it natively). The legacy
 * `FuzzyCitationVerifier` simply wraps its sync verdict in
 * `Promise.resolve(...)` so existing callers stay valid.
 */
export interface ICitationVerifier {
    verify(input: CitationVerifierInput): Promise<CitationVerifierOutput>;
}

/**
 * Leer el libro de una fuente para ubicar una cita antes de alarmar (TP #8,
 * fase 8b, D1). Lo implementa infraestructura con las callables de búsqueda y
 * de fragmentos; el verificador no sabe de Firestore.
 */
export interface IBookSearch {
    /** Las hojas donde aparece el término (búsqueda de texto plegado, el libro entero). */
    sheetsWithTerm(resourceId: string, term: string): Promise<{
        hits: ReadonlyArray<{ sheet: number; count: number }>;
        /** El servidor cortó la lista: lo que no vino puede estar en el libro. */
        truncated: boolean;
    }>;
    /** El texto entero de unas hojas, una entrada por hoja. */
    readSheets(resourceId: string, sheets: ReadonlyArray<number>): Promise<ReadonlyArray<{ sheet: number; text: string; section: string | null }>>;
}
