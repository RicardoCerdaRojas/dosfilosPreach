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

Qué se juzga: lo que la oración TOMA de la fuente citada —el dato, la posición o la lectura que se le atribuye—, no el análisis del autor del paper.
- Es del AUTOR y NO se le exige a la fuente: el razonamiento gramatical (concordancia, caso, dependencia), la decisión sintáctica, la elección de traducción, las conclusiones y la conexión entre ideas. Que la fuente no diga «la concordancia es masculina singular» o «la decisión sintáctica puede sostenerse» NO baja el veredicto.
- Tampoco se busca en estos fragmentos lo que la oración atribuye a OTRO autor u obra nombrados en ella («Mayor contempla…», «según el aparato de NA28…»).
- SÍ se exige, y entero: lo que la oración dice explícitamente que la fuente sostiene («Adamson subraya un ideal», «Porter define el infinitivo como…»), y el contenido sobre el texto que la cita viene a respaldar (que el hombre que no tropieza al hablar puede refrenar el cuerpo).
Antes del veredicto escribe en \`takenFromSource\` lo que la oración toma de la fuente, en una frase y sin el análisis del autor; después juzga SÓLO eso.
Veredicto: "verified" si la fuente sostiene lo que se le toma, aunque no diga el análisis del autor. "fuzzy-low" si la fuente trata el tema pero no sostiene lo que se le toma, o sostiene sólo una parte de lo que la oración le atribuye explícitamente. "not-found" si lo que se le toma no aparece.

Si encontraste apoyo en un fragmento que tenía un \`pageHint\` (ej. "p. 47"), copia ese hint en \`bestPageHint\`. Si no hay pageHint disponible o no encontraste apoyo, devuelve string vacío.

\`citedPageSupports\`: true si un fragmento cuyo pageHint es «p. N» con N una de las PÁGINAS CITADAS respalda la afirmación por sí solo, aunque otro fragmento la respalde mejor. Una cita a la p. 140 cuyo apoyo también aparece en la 141 está bien citada si la 140 la sostiene.

Devuelve SOLO JSON conforme al schema. Razonamiento en una frase corta en español.`;

const EN_INSTRUCTION = `You are an academic citation verifier. You receive ONE inline citation from an exegetical paper (with the claimed phrase in context) and the source text chunks the author cited.

Your single job: decide whether the chunks support the claim.

Rules:
- "verified" — the chunks support the claim clearly, whether by verbatim quotation or faithful paraphrase. The idea/argument is present in the source, even if the wording differs (including across languages).
- "fuzzy-low" — there is partial thematic relation but the specific assertion is not explicitly supported. Risk of overreaching the source.
- "not-found" — the chunks do not contain or support the assertion. Possibly fabricated or outside the scope of the chunks provided.

Cross-language is expected: the paper may be in Spanish and the source in English (or vice versa). Verify MEANING, not lexical overlap.

What you judge: what the sentence TAKES from the cited source —the fact, position or reading attributed to it—, not the paper author's analysis.
- It is the AUTHOR's and is NOT required of the source: grammatical reasoning (agreement, case, dependency), the syntactic decision, the translation choice, conclusions and the links between ideas. That the source does not say "the agreement is masculine singular" or "the syntactic decision holds" does NOT lower the verdict.
- Nor is anything the sentence attributes to ANOTHER author or work named in it looked for in these chunks ("Mayor allows…", "per the NA28 apparatus…").
- It IS required, in full: what the sentence explicitly says the source holds ("Adamson stresses an ideal", "Porter defines the infinitive as…"), and the content about the text that the citation is there to support (that the man who does not stumble in speech can bridle the body).
Before the verdict, write in \`takenFromSource\` what the sentence takes from the source, in one sentence and without the author's analysis; then judge ONLY that.
Verdict: "verified" if the source supports what is taken from it, even if it does not state the author's analysis. "fuzzy-low" if the source touches the topic but does not support what is taken from it, or supports only part of what the sentence explicitly attributes to it. "not-found" if what is taken from it does not appear.

If you found support in a chunk that carried a \`pageHint\` (e.g. "p. 47"), copy that hint into \`bestPageHint\`. If no pageHint was available or no support was found, return an empty string.

\`citedPageSupports\`: true when a chunk whose pageHint is "p. N" with N one of the CITED pages supports the claim on its own, even if another chunk supports it better. A cite to p. 140 whose support also appears on p. 141 is correctly cited if p. 140 holds it.

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
    /**
     * La copia extraída de la fuente no tiene ni una letra griega o hebrea,
     * pero la afirmación sí cita formas. Ver `lostScriptBlock`.
     */
    sourceLostOriginalScript?: boolean;
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
        ...lostScriptBlock(input),
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
 * La copia de la fuente perdió el griego al extraerse.
 *
 * Adamson (NICNT) llega sin una sola letra griega: donde el libro imprime
 * δέξασθε, la copia dice «6€§a00¢e». En el TP #6 una cita a la nota 28 de su
 * p. 145 —una nota casi toda en griego— volvió «no encontrada» y el libro la
 * decía palabra por palabra. Sin esta advertencia el modelo toma la ausencia
 * de la forma como ausencia de la idea.
 */
function lostScriptBlock(input: LlmVerifierPromptInput): string[] {
    if (!input.sourceLostOriginalScript) return [];
    return input.language === 'en'
        ? ['WARNING: the extracted copy of this source LOST its Greek/Hebrew characters (they are missing or appear as garbled symbols). Do not treat a missing Greek/Hebrew form as missing support: judge the rest of the content. If the support could only be in a passage that is mostly Greek/Hebrew, answer "fuzzy-low", not "not-found".']
        : ['ADVERTENCIA: la copia extraída de esta fuente PERDIÓ sus caracteres griegos/hebreos (faltan o aparecen como símbolos sin sentido). Que falte una forma griega o hebrea no es falta de respaldo: juzga el resto del contenido. Si el respaldo sólo podría estar en un pasaje mayormente en griego o hebreo, responde "fuzzy-low", no "not-found".'];
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
