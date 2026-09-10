import type { VerifiedCitation } from '../entities/CitationVerification';
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
