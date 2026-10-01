/**
 * Prompt scaffolding for `GeminiLlmCitationVerifier`. Per-citation
 * verification: the model receives the claim (in the paper's language)
 * + a set of source chunks (often in another language) and decides
 * whether the source supports the claim.
 *
 * Designed to defeat the cross-language false-negative the token-set
 * Jaccard verifier suffers when a Spanish paper paraphrases English
 * commentary. The model speaks both languages natively.
 */

const ES_INSTRUCTION = `Eres un verificador de citas académicas. Recibes UNA cita inline de un paper exegético (con la frase reclamada en su contexto) y los fragmentos del texto fuente que el autor citó.

Tu único trabajo: decidir si los fragmentos respaldan la cita.

Reglas:
- "verified" — los fragmentos respaldan la cita claramente, sea por cita verbatim o paráfrasis fiel. La idea/argumento aparece en la fuente, aunque las palabras difieran (incluso entre idiomas).
- "fuzzy-low" — hay relación temática parcial pero la afirmación específica no está respaldada explícitamente. Riesgo de sobre-extender la fuente.
- "not-found" — los fragmentos no contienen ni respaldan la afirmación. Posible cita inventada o fuera de scope de los fragmentos disponibles.

Cross-language es esperado: el paper puede estar en español y la fuente en inglés (o viceversa). Verifica el SIGNIFICADO, no la coincidencia léxica.

Si encontraste apoyo en un fragmento que tenía un \`pageHint\` (ej. "p. 47"), copia ese hint en \`bestPageHint\`. Si no hay pageHint disponible o no encontraste apoyo, devuelve string vacío.

Devuelve SOLO JSON conforme al schema. Razonamiento en una frase corta en español.`;

const EN_INSTRUCTION = `You are an academic citation verifier. You receive ONE inline citation from an exegetical paper (with the claimed phrase in context) and the source text chunks the author cited.

Your single job: decide whether the chunks support the claim.

Rules:
- "verified" — the chunks support the claim clearly, whether by verbatim quotation or faithful paraphrase. The idea/argument is present in the source, even if the wording differs (including across languages).
- "fuzzy-low" — there is partial thematic relation but the specific assertion is not explicitly supported. Risk of overreaching the source.
- "not-found" — the chunks do not contain or support the assertion. Possibly fabricated or outside the scope of the chunks provided.

Cross-language is expected: the paper may be in Spanish and the source in English (or vice versa). Verify MEANING, not lexical overlap.

If you found support in a chunk that carried a \`pageHint\` (e.g. "p. 47"), copy that hint into \`bestPageHint\`. If no pageHint was available or no support was found, return an empty string.

Return JSON only, conforming to the schema. Reasoning in one short English sentence.`;

export interface LlmVerifierPromptInput {
    /** Citation as written in the paper, e.g. `(Lane, "Hebrews 1-8", p. 47)`. */
    rawCitation: string;
    /** Surrounding evidence — quoted phrase or sentence containing the cite. */
    evidence: string;
    /** True when the evidence came from a `"..."` quote (high-confidence claim shape). */
    evidenceIsQuoted: boolean;
    /** Pages declared in the cite, when present. */
    citedPages: string | null;
    /** Matched source label for context. */
    matchedSourceLabel: string;
    /** Source chunks (text + optional pageHint), capped to keep tokens bounded. */
    chunks: ReadonlyArray<{ text: string; pageHint: string | null }>;
    /** Output language for `reasoning`. */
    language: 'es' | 'en';
    /**
     * Las otras fuentes que la misma afirmación sintetiza. Con ellas, se
     * juzga sólo la parte de ESTA fuente (ver `ParsedCitation.otherSources`).
     */
    otherSources?: ReadonlyArray<string>;
}

export function buildLlmVerifierPrompt(input: LlmVerifierPromptInput): {
    systemInstruction: string;
    userMessage: string;
} {
    const systemInstruction = input.language === 'en' ? EN_INSTRUCTION : ES_INSTRUCTION;

    const chunkBlocks = input.chunks.map((chunk, idx) => {
        const header = chunk.pageHint
            ? `--- CHUNK ${idx + 1} (pageHint: ${chunk.pageHint}) ---`
            : `--- CHUNK ${idx + 1} (no page hint — full document fallback) ---`;
        return [header, chunk.text].join('\n');
    }).join('\n\n');

    const evidenceLabel = input.language === 'en'
        ? (input.evidenceIsQuoted ? 'Quoted phrase from the paper' : 'Surrounding sentence from the paper')
        : (input.evidenceIsQuoted ? 'Frase entrecomillada del paper' : 'Oración del paper que rodea la cita');

    const userMessage = [
        input.language === 'en' ? `Citation: ${input.rawCitation}` : `Cita: ${input.rawCitation}`,
        input.language === 'en' ? `Source matched: ${input.matchedSourceLabel}` : `Fuente identificada: ${input.matchedSourceLabel}`,
        input.citedPages
            ? (input.language === 'en' ? `Cited pages: ${input.citedPages}` : `Páginas citadas: ${input.citedPages}`)
            : (input.language === 'en' ? 'Cited pages: (none)' : 'Páginas citadas: (ninguna)'),
        ...synthesisBlock(input),
        '',
        `${evidenceLabel}:`,
        '"""',
        input.evidence,
        '"""',
        '',
        input.language === 'en' ? 'SOURCE CHUNKS:' : 'FRAGMENTOS DE LA FUENTE:',
        chunkBlocks || (input.language === 'en' ? '(no chunks available)' : '(sin fragmentos disponibles)'),
    ].join('\n');

    return { systemInstruction, userMessage };
}

/**
 * Una afirmación que sintetiza varias fuentes se juzga por partes.
 *
 * «McCartney y Ropes prefieren la pasiva», citada a una página de McCartney,
 * no puede estar ENTERA en McCartney: la mitad es de Ropes. Exigir la
 * comparación completa daba «no encontrada» a una nota correcta y bloqueaba
 * aceptar el paso.
 */
function synthesisBlock(input: LlmVerifierPromptInput): string[] {
    const otras = (input.otherSources ?? []).filter(Boolean);
    if (otras.length === 0) return [];
    return input.language === 'en'
        ? [`This claim synthesizes several sources (${input.matchedSourceLabel} and ${otras.join(', ')}). Judge ONLY the part attributed to ${input.matchedSourceLabel}: if these chunks support that source's own position, it is "verified", even though the comparison with the other sources is not in them. The other sources are verified separately.`]
        : [`Esta afirmación sintetiza varias fuentes (${input.matchedSourceLabel} y ${otras.join(', ')}). Juzga SÓLO la parte que corresponde a ${input.matchedSourceLabel}: si estos fragmentos sostienen la posición de esa fuente, es "verified", aunque la comparación con las otras no esté en ellos. Las otras fuentes se verifican aparte.`];
}
