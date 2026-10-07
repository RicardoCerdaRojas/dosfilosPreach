import { SchemaType } from '../../llm/schemaType';

/**
 * JSON schema for the per-citation LLM verifier response. Locks the
 * status enum so Gemini cannot return labels outside the catalog. The
 * `bestPageHint` lets the model surface the page on which the support
 * was found (when extracted from the chunk's `pageHint`); the use
 * case uses it for the page-mismatch verdict.
 */
export const LLM_CITATION_VERIFIER_SCHEMA = {
    type: SchemaType.OBJECT,
    properties: {
        status: {
            type: SchemaType.STRING,
            enum: ['verified', 'fuzzy-low', 'not-found'],
            description: 'Whether the source supports the claim. "verified" = clear support (paraphrase or quote). "fuzzy-low" = partial / tangential support. "not-found" = no support.',
        },
        confidence: {
            type: SchemaType.NUMBER,
            description: 'Self-rated confidence 0..1.',
        },
        bestPageHint: {
            type: SchemaType.STRING,
            description: 'The pageHint of the chunk that supported the claim (verbatim from the input). Empty string when no chunk supported the claim or no pageHint was provided.',
        },
        citedPageSupports: {
            type: SchemaType.BOOLEAN,
            description: 'True when a chunk whose pageHint is one of the CITED pages supports the claim on its own, even if another chunk supports it better. False when no cited page was given or no chunk of a cited page supports it.',
        },
        reasoning: {
            type: SchemaType.STRING,
            description: 'One sentence in the requested language explaining the verdict.',
        },
    },
    required: ['status', 'confidence', 'bestPageHint', 'citedPageSupports', 'reasoning'],
} as const;
