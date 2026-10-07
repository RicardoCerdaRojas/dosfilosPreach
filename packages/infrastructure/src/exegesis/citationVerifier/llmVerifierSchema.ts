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
        // PRIMERO lo tomado, después el veredicto: el veredicto iba primero y
        // su descripción decía «si la fuente respalda la afirmación» —la frase
        // entera—, y el verificador le seguía exigiendo a la fuente el
        // análisis del autor aunque la regla dijera lo contrario (TP #6, 3:2:
        // «Adamson traduce “capaz de controlar”, pero no aborda la distinción
        // entre capacidad personal y posibilidad impersonal»).
        takenFromSource: {
            type: SchemaType.STRING,
            description: 'One sentence: what the paper sentence TAKES from the cited source — the fact, position or reading it attributes to it. Leave out the paper author\'s own analysis (grammatical reasoning, syntactic decision, translation choice, conclusions) and anything attributed to OTHER named authors.',
        },
        status: {
            type: SchemaType.STRING,
            enum: ['verified', 'fuzzy-low', 'not-found'],
            description: 'Whether the chunks support what is in takenFromSource — NOT the author\'s analysis. "verified" = they support it (paraphrase or quote). "fuzzy-low" = they touch the topic but do not support it. "not-found" = it does not appear.',
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
            description: 'One sentence in the requested language explaining the verdict about takenFromSource.',
        },
    },
    required: ['takenFromSource', 'status', 'confidence', 'bestPageHint', 'citedPageSupports', 'reasoning'],
    // Gemini ordena las propiedades alfabéticamente si no se le dice; el
    // orden importa: se escribe lo tomado antes de decidir.
    propertyOrdering: ['takenFromSource', 'status', 'confidence', 'bestPageHint', 'citedPageSupports', 'reasoning'],
} as const;
