/**
 * Per-citation result of running the verifier over a step version's
 * markdown. The aggregate counts live on `VerificationSummary` (in
 * `ExegeticalStep.ts`); this file models the granular per-citation
 * payload the UI needs to surface "this specific cite is suspect".
 *
 * Verifier never mutates markdown — it only inspects + reports. Edits
 * stay the user's job, which keeps the responsibility line clean and
 * mirrors how `DeterministicStyleFormatter` is plumbed elsewhere.
 */
export type CitationStatus =
    /** Source matched, claim text matched (≥ verifiedThreshold), page matches or not provided. */
    | 'verified'
    /** Source matched, text matched, but the cited page differs from the source excerpt's page. */
    | 'page-mismatch'
    /**
     * Either the source itself wasn't found among the paper's project
     * sources, OR the source matched but the claim text wasn't located
     * in the source's excerpts/full content. Both collapse here because
     * the user remediation is the same: open the source and check.
     */
    | 'not-found'
    /** Source matched, text similarity is between the low and verified thresholds — needs human review. */
    | 'fuzzy-low'
    /**
     * Citation pattern detected but couldn't be parsed (e.g. malformed
     * format the regex didn't fully extract). Manual review needed —
     * the verifier didn't reject it, it just couldn't speak to it.
     */
    | 'manual-pending';

/**
 * Citation as parsed from the markdown — purely lexical, no
 * domain matching yet.
 */
export interface ParsedCitation {
    /** The exact substring matched in the markdown (e.g. `(Lane, "Hebrews 1-8", p. 47)`). */
    raw: string;
    /** Author or short citation key as written in the citation. */
    author: string;
    /** Title fragment as written in the citation. */
    title: string;
    /** Page reference as written ("47", "47-50", "47, 50"). Null when omitted. */
    pages: string | null;
    /**
     * Character offset in the source markdown. Used by the UI to
     * highlight the cite's location and by the verifier to scope the
     * surrounding evidence window.
     */
    offset: number;
    /**
     * Best-guess "claim text" extracted from the markdown around the
     * citation: the closest preceding quoted phrase, or — when no
     * quote is nearby — the sentence containing the citation. The
     * verifier matches THIS against the source content.
     */
    evidence: string;
    /** True when `evidence` came from a `"..."` quote (high confidence claim). */
    evidenceIsQuoted: boolean;
}

/**
 * One citation after the verifier ran. Mirrors `ParsedCitation`'s
 * shape and adds the verification verdict + match details for the UI.
 */
export interface VerifiedCitation extends ParsedCitation {
    status: CitationStatus;
    /** corpusId of the matched ProjectSource, when one was found. */
    matchedCorpusId: string | null;
    /** Display label of the matched source (for the UI's per-row label). */
    matchedSourceLabel: string | null;
    /**
     * Similarity score (0..1) between the citation's `evidence` and
     * the best-matching excerpt. Null when no source matched at all.
     */
    similarityScore: number | null;
    /**
     * Page string parsed from the matched excerpt's `sourceLocation`
     * (e.g. "47" from "p. 47"). Null for full-document mode (no
     * per-chunk page anchoring) or when the source has no excerpts.
     */
    matchedPage: string | null;
    /**
     * El ancla del fragmento de apoyo tal como se escribe: `"p. 61"`,
     * `"hoja 16"`, `"p. ccxxii"`.
     *
     * Va aparte de `matchedPage` porque las dos sirven a cosas distintas y
     * confundirlas es el defecto que este campo cierra: `matchedPage` es un
     * número pelado porque el cotejo compara CANTIDADES, y la interfaz lo
     * rendía con un «p.» escrito a mano —afirmando una página impresa sobre
     * lo que podía ser una hoja, que es exactamente lo que el resto del
     * sistema dejó de hacer—.
     *
     * `null` cuando no hubo fragmento de apoyo con ancla.
     */
    matchedPageLabel?: string | null;
    /**
     * Optional human-readable note explaining the verdict. Surfaces
     * directly in the dialog row so the user understands why a
     * citation came back yellow vs red.
     */
    note: string | null;
}

/**
 * Default similarity thresholds for the fuzzy verifier. Tuned for
 * Jaccard token-set similarity over normalized prose:
 *   - ≥ 0.55: high overlap, treat as verified
 *   - ≥ 0.30: noticeable overlap but unsafe to bless — fuzzy-low
 *   - <  0.30: too low, mark as not-found
 *
 * Exposed as constants so the use case can override them in tests
 * or future tuning without reaching into the infra implementation.
 */
export const CITATION_VERIFY_THRESHOLD = 0.55;
export const CITATION_FUZZY_LOW_THRESHOLD = 0.3;
