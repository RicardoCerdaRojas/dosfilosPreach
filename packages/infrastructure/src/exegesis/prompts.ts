import {
    formatPassageReference,
    type ExegesisGenerationInput,
    type ExegesisPriorStep,
    type ExegesisSourceContext,
    type MissingSourceTypeRequirement,
    type SourceType,
    type StepEmphasis,
} from '@dosfilos/domain';
import { fitPromptToCap } from '../llm/promptBudget';
import { voiceFor } from './testamentVoice';

/**
 * Prompt templates for exegetical step generation.
 *
 * Distilled from the user's TMS-style template prompt for Hebrews 1:1-4
 * but generalized so a single set of templates serves any single-chapter
 * passage. Per-step-kind variants emphasize different exegetical work:
 *
 *   verse        — translation + decisions + morphology + syntax + source
 *                  interaction + own position + a verse-specific thesis
 *                  (NOT a passage summary — that's the conclusion step's job)
 *   conclusion   — synthesizes accepted verses; introduces NO new arguments
 *   introduction — written last; presents thesis derived from the body,
 *                  brief methodology, and direction of argument
 *
 * Citation discipline is encoded throughout: every assertion that comes
 * from a source must include `(Author, "Title", p. N)`; verbatim quotes
 * use exact strings; paraphrases never use quotes; 'model-paper' role
 * sources are consumed for STYLE only and explicitly NOT cited inline.
 *
 * Output language is enforced both via the system prompt and the user
 * message preamble (defense-in-depth) — the model emits Spanish or
 * English regardless of which language the corpus chunks are in.
 */

const STYLE_GUIDE_BUDGET_CHARS = 30_000;
const SOURCE_BUDGET_CHARS_TOTAL = 250_000;

interface BuiltPrompt {
    systemInstruction: string;
    userMessage: string;
}

export function buildPrompt(input: ExegesisGenerationInput): BuiltPrompt {
    return {
        systemInstruction: buildSystemInstruction(input),
        userMessage: buildUserMessage(input),
    };
}

// ── System instruction ──────────────────────────────────────────────────

function buildSystemInstruction(input: ExegesisGenerationInput): string {
    const lang = input.language;
    // Mismo motivo que en el analizador canónico: un pasaje del AT se exegeta
    // en hebreo, y pedirle "el texto griego" hace que el modelo saque la LXX
    // de memoria e ignore el texto masorético que se le dio como base.
    const voice = voiceFor(input.paperPassage.bookId);
    const passage = formatPassageReference(input.paperPassage, lang);
    const styleGuideBlock = formatStyleGuide(input.styleGuideContent, lang);
    const briefBlock = formatAssignmentBrief(input.assignmentBrief, lang);
    const corpusGapsBlock = formatCorpusGaps(input.missingSourceTypes, lang);

    if (lang === 'en') {
        return [
            `You are an academic assistant in ${voice.testamentEn} exegesis, ${voice.expertEn}, morphological/syntactic analysis, textual criticism, biblical theology, and academic writing in The Master's Seminary style.`,
            ``,
            `## Your task`,
            `Produce an integrated translation and exegetical analysis on **${passage}**, working ${stepKindDescription(input.kind, lang)}.`,
            briefBlock,
            ``,
            `## Hermeneutic stance`,
            `Historical-grammatical-literal. Prioritize: authorial sense, ${voice.languageEn} grammar, clause syntax, argumentative flow of the book, immediate literary context, OT intertextuality, biblical theology that emerges from the passage. NO allegorizing. NO doctrinal conclusions not supported by the text.`,
            ``,
            `## Citation discipline (NON-NEGOTIABLE)`,
            `- Every claim drawn from a source MUST include an inline citation in the format: \`(Author, "Title", p. N)\`. If page is unavailable: \`(Author, "Title")\`.`,
            // El ancla del fragmento ya viene resuelta: dice `p. N` cuando se
            // pudo traducir la hoja del archivo al número que el libro
            // imprime, y `hoja N` cuando no. Copiarla verbatim es lo que
            // impide que una hoja termine citada como página — que es como
            // un trabajo real salió con diez citas apuntando a páginas
            // equivocadas, todas verosímiles.
            `- COPY the anchor of the excerpt EXACTLY as given (\`p. N\` or \`hoja N\`). NEVER convert one into the other, and NEVER invent a page for an excerpt whose anchor carries none: an anchor that says \`hoja N\` means the printed page of that book is unknown, and writing \`p. N\` there would send the reader to a different page.`,
            `- Verbatim quotes are only allowed when wrapped in double quotes AND the exact wording appears in the cited source. If you are paraphrasing, do NOT use quotes.`,
            `- NEVER attribute to an author a conclusion they don't explicitly state. If a source merely *suggests*, write "X suggests" — not "X demonstrates".`,
            `- NEVER cite yourself as a source. You are a tutor, not a bibliography entry.`,
            `- 'Model paper' sources (when present) are STYLE templates only. NEVER produce inline citations from them.`,
            `- For ideas drawn from your own general knowledge (not from the configured corpus), use language like "according to theological tradition…" or "classical commentators hold…".`,
            corpusGapsBlock,
            ``,
            `## Style guide (MUST follow strictly)`,
            styleGuideBlock,
            ``,
            `## Tone and register`,
            `A diligent seminary student doing rigorous exegesis. Sober academic prose. Avoid devotional language as a substitute for analysis.`,
        ].filter(line => line !== '').join('\n').replace(/\n{3,}/g, '\n\n');
    }

    return [
        `Sos un asistente académico experto en exégesis ${voice.testamentEs}, ${voice.expertEs}, análisis morfológico/sintáctico, crítica textual, teología bíblica y redacción académica en estilo The Master's Seminary.`,
        ``,
        `## Tu tarea`,
        `Producir traducción y análisis exegético integrado sobre **${passage}**, trabajando ${stepKindDescription(input.kind, lang)}.`,
        briefBlock,
        ``,
        `## Postura hermenéutica`,
        `Histórico-gramatical-literal. Priorizá: sentido autoral, gramática ${voice.languageAdjEs}, sintaxis de cláusulas, flujo argumentativo del libro, contexto literario inmediato, intertextualidad con el AT, teología bíblica que emerge del pasaje. NO alegorices. NO fuerces conclusiones doctrinales que no estén sustentadas por el texto.`,
        ``,
        `## Disciplina de citación (NO NEGOCIABLE)`,
        `- Toda afirmación derivada de una fuente DEBE incluir cita inline en formato: \`(Autor, "Título", p. N)\`. Si no hay página disponible: \`(Autor, "Título")\`.`,
        `- Las citas verbatim solo van entre comillas dobles Y cuando la frase exacta aparece en la fuente citada. Si parafraseás, NO uses comillas.`,
        `- NUNCA atribuyas a un autor una conclusión que no afirma explícitamente. Si una fuente solo *sugiere*, escribí "X sugiere" — no "X demuestra".`,
        `- NUNCA te cites a ti mismo como fuente. Sos un tutor, no una entrada bibliográfica.`,
        `- Las fuentes con rol 'trabajo modelo' (cuando estén presentes) son plantillas de ESTILO únicamente. NUNCA produzcas citas inline desde ellas.`,
        `- Para ideas que provengan de tu conocimiento general (no del corpus configurado), usá frases como "según la tradición teológica…" o "los comentaristas clásicos sostienen…".`,
        corpusGapsBlock,
        ``,
        `## Guía de estilo (debe seguirse estrictamente)`,
        styleGuideBlock,
        ``,
        `## Tono y registro`,
        `Un estudiante de seminario diligente haciendo exégesis rigurosa. Prosa académica sobria. Evitá el lenguaje devocional como sustituto del análisis.`,
    ].filter(line => line !== '').join('\n').replace(/\n{3,}/g, '\n\n');
}

// ── User message ────────────────────────────────────────────────────────

/**
 * El corpus se recorta a lo que quede libre bajo el tope del proxy en vez de a
 * `SOURCE_BUDGET_CHARS_TOTAL` a secas: ese número estaba POR ENCIMA del tope
 * del servidor y un paper con comentarios extraídos completos hacía fallar
 * toda generación con `prompt excede 200000 caracteres`.
 */
function buildUserMessage(input: ExegesisGenerationInput): string {
    return fitPromptToCap(
        sourcesBlock => renderUserMessage(input, sourcesBlock),
        budget => formatSources(input.sources, input.language, input.stepEmphasis, budget),
        SOURCE_BUDGET_CHARS_TOTAL,
        'GeminiExegesisOrchestrator',
    );
}

function renderUserMessage(input: ExegesisGenerationInput, sources: string): string {
    const lang = input.language;
    const voice = voiceFor(input.paperPassage.bookId);
    const priorBlock = formatPriorSteps(input.priorAcceptedSteps, lang);
    const emphasisBlock = formatStepEmphasis(input.stepEmphasis, lang);
    const hint = input.regenerationHint
        ? (lang === 'en'
            ? `\n\n### Regeneration hint from the user\n${input.regenerationHint}\n`
            : `\n\n### Hint de regeneración del usuario\n${input.regenerationHint}\n`)
        : '';

    if (input.kind === 'verse' && input.verseRef) {
        const verse = formatPassageReference(input.verseRef, lang);
        // INTERIM PROMPT — see docs/exegesis/METODOLOGIA.md and the
        // VerseAnalysis schema in @dosfilos/domain. The verse step
        // currently emits markdown directly; the architectural target
        // is to emit a structured `VerseAnalysis` object that
        // composers (academic / sermon / devotional) consume. This
        // 8-step structure is preserved as study-mode output until
        // the structured pipeline lands. Do NOT iterate further on
        // this prompt — invest in the schema migration instead.
        const expected = lang === 'en'
            ? [
                `**Internal order BEFORE writing**: do the morphological + syntactic + lexical analysis MENTALLY first. The translation you present in section 2 must be the OUTPUT of that analysis, not a guess justified afterwards. The reader sees translation-then-defense (sections 2-5), but you must derive it analysis-first.`,
                ``,
                `1. Present the ${voice.languageEn} text of ${verse}.`,
                `2. Present your own translation (derived from the mental analysis below).`,
                `3. Explain the main translation decisions.`,
                `4. Morphological analysis of relevant forms.`,
                `5. Syntactic analysis of clauses, participles, genitives, prepositional phrases, modifiers, and internal relations.`,
                `6. Interact with the configured sources by name and page.`,
                `7. Take an explicit position on the main translation decisions.`,
                `8. **Final section — title MUST BE exactly "Tesis del verso" (in Spanish output) or "Verse thesis" (in English output). DO NOT use the word "Conclusion" / "Conclusión" anywhere.** 1-3 sentences. State what THIS specific verse establishes from the analysis above.`,
                ``,
                `   What this section CAN do:`,
                `   - Articulate the verse's specific contribution (a thesis — what the verse asserts, given the grammar/lexis you analyzed).`,
                `   - Reference the IMMEDIATELY ADJACENT verse (the one immediately before or after ${verse}) ONLY when the verse forms an inseparable grammatical/argumentative unit with it — μέν...δέ contrasts, participial chains spanning two verses, comparative pairs whose conclusion requires naming both members. The reference must be DEMANDED BY THE GRAMMAR of ${verse} itself, not added to summarize.`,
                ``,
                `   HARD PROHIBITIONS:`,
                `   - Do NOT mention verses more than ONE verse away from ${verse}. The whole-passage range, distant verses inside the pericope, and chains of references like "vv. N-M, v. P, v. Q" are forbidden. Only the immediate neighbor (and only when grammatically required) is allowed.`,
                `   - Do NOT recap the pericope's overall structure. Verbs like "transitions to", "introduces the section", "marks the inflection point", "develops the theme", "constitutes the climax of", "completes the structure that began in..." signal recap mode and are banned.`,
                `   - Do NOT describe how this verse fits the paper's full argument — that synthesis is the JOB OF THE PAPER'S CONCLUSION STEP.`,
                `   - Do NOT restate the translation or re-quote ${voice.languageEn} terms already discussed above.`,
                ``,
                `   Correct mold (when ${verse} stands grammatically alone): "Verse ${verse} establishes that X, given that the grammatical/lexical analysis demonstrates Y."`,
                `   Correct mold (when ${verse} is grammatically inseparable from its neighbor): "Verse ${verse} establishes X, setting up [or completing] the contrast with the immediately adjacent verse where Y." (Name the neighbor verse only if the grammar demands it.)`,
            ].join('\n')
            : [
                `**Orden interno ANTES de escribir**: hacé el análisis morfológico + sintáctico + léxico MENTALMENTE primero. La traducción que presentás en la sección 2 debe ser la SALIDA de ese análisis, no una conjetura justificada después. El lector ve traducción-y-defensa (secciones 2-5), pero vos derivás análisis-primero.`,
                ``,
                `1. Presentá el texto ${voice.language} de ${verse}.`,
                `2. Presentá tu traducción propia (derivada del análisis mental que sigue).`,
                `3. Explicá las decisiones principales de traducción.`,
                `4. Análisis morfológico de las formas relevantes.`,
                `5. Análisis sintáctico de cláusulas, participios, genitivos, frases preposicionales, modificadores y relaciones internas.`,
                `6. Interactuá con las fuentes configuradas por nombre y página.`,
                `7. Tomá posición explícita sobre las principales decisiones de traducción.`,
                `8. **Sección final — el título debe ser exactamente "Tesis del verso" (en salida español) o "Verse thesis" (en salida inglés). NO uses la palabra "Conclusión" / "Conclusion" en ningún lado.** 1-3 oraciones. Decí qué establece ESTE verso específicamente a partir del análisis anterior.`,
                ``,
                `   Lo que esta sección PUEDE hacer:`,
                `   - Articular el aporte específico del verso (una tesis — qué afirma el verso, dado el análisis gramatical/léxico).`,
                `   - Referenciar al verso INMEDIATAMENTE ADYACENTE (el de inmediatamente antes o después de ${verse}) SOLO cuando el verso forma una unidad gramatical/argumentativa inseparable con él — contrastes μέν...δέ, cadenas participiales que cruzan dos versos, pares comparativos cuya conclusión exige nombrar ambos miembros. La referencia debe estar EXIGIDA POR LA GRAMÁTICA misma de ${verse}, no agregada para resumir.`,
                ``,
                `   PROHIBICIONES DURAS:`,
                `   - NO menciones versos a más de UN verso de distancia de ${verse}. El rango completo del pasaje, versos distantes dentro de la pericopa y cadenas de referencias tipo "vv. N-M, v. P, v. Q" están prohibidos. Solo el vecino inmediato (y solo cuando la gramática lo exige) está permitido.`,
                `   - NO recapitules la estructura global de la pericopa. Verbos como "transita a", "introduce la sección", "marca el punto de inflexión", "desarrolla el tema", "constituye el clímax de", "completa la estructura que comenzó en..." señalan modo recap y están vetados.`,
                `   - NO describas cómo este verso encaja en el argumento del paper completo — esa síntesis es TRABAJO DEL PASO CONCLUSIÓN DEL PAPER.`,
                `   - NO repitas la traducción ni cites términos en ${voice.language} ya discutidos arriba.`,
                ``,
                `   Molde correcto (cuando ${verse} se sostiene gramaticalmente solo): "El verso ${verse} establece que X, dado que el análisis gramatical/léxico demuestra Y."`,
                `   Molde correcto (cuando ${verse} es gramaticalmente inseparable de su vecino): "El verso ${verse} establece X, preparando [o completando] el contraste con el verso inmediatamente adyacente donde Y." (Nombrá al verso vecino solo si la gramática lo exige.)`,
            ].join('\n');
        return [
            lang === 'en'
                ? `Generate the section for **${verse}**, in the integrated style described in the system prompt.`
                : `Generá la sección para **${verse}**, en el estilo integrado descripto en el system prompt.`,
            '',
            emphasisBlock,
            lang === 'en' ? '### Sources at your disposal' : '### Fuentes disponibles',
            sources,
            '',
            lang === 'en' ? '### Expected structure' : '### Estructura esperada',
            expected,
            hint,
        ].filter(Boolean).join('\n');
    }

    if (input.kind === 'conclusion') {
        return [
            lang === 'en'
                ? `Write the **Conclusion** for the paper on ${formatPassageReference(input.paperPassage, lang)}.`
                : `Escribí la **Conclusión** del trabajo sobre ${formatPassageReference(input.paperPassage, lang)}.`,
            '',
            lang === 'en'
                ? `**Hard rules for the conclusion:**\n- Summarize the actual results of the verse-by-verse analyses below.\n- Do NOT introduce new arguments.\n- Show how the passage develops its main themes (identity, work, theological emphasis).\n- Respond to the working thesis the body's analyses have built.`
                : `**Reglas duras para la conclusión:**\n- Resumí los resultados reales de los análisis verso a verso de abajo.\n- NO introduzcas argumentos nuevos.\n- Mostrá cómo el pasaje desarrolla sus temas principales (identidad, obra, énfasis teológico).\n- Respondé a la tesis de trabajo que los análisis del cuerpo construyeron.`,
            '',
            emphasisBlock,
            lang === 'en' ? '### Accepted verse-level analyses' : '### Análisis verso a verso aceptados',
            priorBlock,
            '',
            lang === 'en' ? '### Sources at your disposal (use sparingly here)' : '### Fuentes disponibles (usalas con moderación acá)',
            sources,
            hint,
        ].filter(Boolean).join('\n');
    }

    // introduction
    return [
        lang === 'en'
            ? `Write the **Introduction** for the paper on ${formatPassageReference(input.paperPassage, lang)}.`
            : `Escribí la **Introducción** del trabajo sobre ${formatPassageReference(input.paperPassage, lang)}.`,
        '',
        lang === 'en'
            ? `**Hard rules for the introduction:**\n- Written LAST so it reflects what the paper actually demonstrated.\n- Present the passage and its importance within its book.\n- State a precise thesis derived from the body's analyses.\n- Briefly state methodology (morphological, syntactic, lexical, intertextual, theological).\n- Sketch the direction of the argument.\n- Do NOT promise topics that the body did not develop.`
            : `**Reglas duras para la introducción:**\n- Se redacta AL FINAL para reflejar lo que el trabajo efectivamente demostró.\n- Presentá el pasaje y su importancia dentro del libro.\n- Enunciá una tesis precisa derivada de los análisis del cuerpo.\n- Declará brevemente la metodología (morfológica, sintáctica, léxica, intertextual, teológica).\n- Esbozá la dirección del argumento.\n- NO prometas temas que el cuerpo no desarrolló.`,
        '',
        emphasisBlock,
        lang === 'en' ? '### Accepted body (verses + conclusion)' : '### Cuerpo aceptado (versos + conclusión)',
        priorBlock,
        '',
        lang === 'en' ? '### Sources at your disposal (background context only)' : '### Fuentes disponibles (solo como contexto de fondo)',
        sources,
        hint,
    ].filter(Boolean).join('\n');
}

// ── Formatters ──────────────────────────────────────────────────────────

function stepKindDescription(kind: ExegesisGenerationInput['kind'], lang: 'es' | 'en'): string {
    if (lang === 'en') {
        if (kind === 'verse') return `at the granularity of a single verse`;
        if (kind === 'conclusion') return `the conclusion of the paper, synthesizing the accepted verse-level analyses without introducing new arguments`;
        return `the introduction of the paper, written LAST so it reflects what the analysis actually demonstrated`;
    }
    if (kind === 'verse') return `a nivel de un solo verso`;
    if (kind === 'conclusion') return `la conclusión del trabajo, sintetizando los análisis verso a verso aceptados sin introducir argumentos nuevos`;
    return `la introducción del trabajo, escrita AL FINAL para reflejar lo que el análisis efectivamente demostró`;
}

function formatStyleGuide(content: string, lang: 'es' | 'en'): string {
    if (!content || !content.trim()) {
        return lang === 'en'
            ? `(No style guide attached. Default to The Master's Seminary conventions for footnotes, bibliography, and citation format.)`
            : `(No hay guía de estilo adjunta. Aplicá por defecto las convenciones de The Master's Seminary para notas al pie, bibliografía y formato de citas.)`;
    }
    const truncated = truncate(content, STYLE_GUIDE_BUDGET_CHARS);
    return ['```', truncated, '```'].join('\n');
}

/**
 * Renders the paper-level assignment brief into a labeled block for
 * the system prompt. Returns an empty string when no brief is set so
 * the prompt collapses cleanly with no orphan heading.
 *
 * The brief is the paper's narrative identity (what the professor
 * assigned + the angle the student is taking). Putting it right
 * after `## Your task` ensures every step generation reads it before
 * the more granular instructions about citation discipline and tone.
 */
function formatAssignmentBrief(brief: string | null, lang: 'es' | 'en'): string {
    if (!brief || !brief.trim()) return '';
    if (lang === 'en') {
        return [
            ``,
            `## Paper framing (assignment + student focus)`,
            `Treat the following as authoritative paper-level guidance. Every step you generate must stay aligned with this framing — the introduction states the thesis it implies, the verses build the argument toward it, and the conclusion synthesizes back to it.`,
            ``,
            brief.trim(),
        ].join('\n');
    }
    return [
        ``,
        `## Encuadre del trabajo (asignación + enfoque del alumno)`,
        `Tratá lo siguiente como guía autoritativa a nivel del paper. Cada paso que generes debe mantenerse alineado con este encuadre — la introducción presenta la tesis que se desprende, los versos construyen el argumento hacia ella, y la conclusión sintetiza de vuelta hacia el encuadre.`,
        ``,
        brief.trim(),
    ].join('\n');
}

function formatSources(
    sources: ExegesisSourceContext[],
    lang: 'es' | 'en',
    emphasis: StepEmphasis | null,
    budgetChars: number,
): string {
    if (sources.length === 0) {
        return lang === 'en'
            ? `(No sources configured for this paper. Lean on your general knowledge and signal it with "according to theological tradition…" / "classical commentators hold…".)`
            : `(Sin fuentes configuradas para este trabajo. Apoyate en tu conocimiento general y señalalo con "según la tradición teológica…" / "los comentaristas clásicos sostienen…".)`;
    }

    // Allocate budget per source proportionally. The base weight comes
    // from the type catalog (critical commentaries > expository > misc).
    // The student's plan emphasis multiplies that base: emphasized
    // types get ~2.5x the room, deemphasized types get ~0.4x. Style-
    // only sources (`style-template-paper`) keep their small slice
    // regardless — the model only needs to absorb their SHAPE.
    const totalBudget = budgetChars;
    const weights = sources.map(s => effectiveSourceTypeWeight(s.sourceType, emphasis));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;
    const budgets = weights.map(w => Math.floor(totalBudget * (w / totalWeight)));

    const blocks = sources.map((s, i) => {
        const truncated = truncate(s.textContent, budgets[i]!);
        const typeLabel = lang === 'en' ? englishTypeLabel(s.sourceType) : spanishTypeLabel(s.sourceType);
        const citationKey = s.citationKey ? ` · key: ${s.citationKey}` : '';
        const usageNote = s.sourceType === 'style-template-paper'
            ? (lang === 'en' ? ' · STYLE TEMPLATE ONLY — do NOT cite inline' : ' · SOLO PLANTILLA DE ESTILO — NO citar inline')
            : '';
        // Curated-excerpts sources carry per-anchor labels emitted by
        // the use case (one per chunk the student accepted in review).
        // Surfacing them in the source header — and instructing the
        // model to cite using those EXACT anchors — preserves the
        // visibility promise of the v1.5 extraction flow: the user
        // approved THESE pieces, the citations should reference THESE
        // pieces, not the underlying full document.
        const excerptNote = (s.excerptAnchors && s.excerptAnchors.length > 0)
            ? (lang === 'en'
                ? `\n_Curated excerpts only. Cite using the anchors that prefix each block (e.g. \`(${s.citationKey ?? 'Author'}, "${s.displayLabel}", ${s.excerptAnchors[0]})\`). Do NOT invent pages outside these anchors._`
                : `\n_Solo excerpts curados. Citá usando los anchors que prefijan cada bloque (ej. \`(${s.citationKey ?? 'Autor'}, "${s.displayLabel}", ${s.excerptAnchors[0]})\`). NO inventes páginas fuera de esos anchors._`)
            : '';
        // v1.7+: surface plan-pinned sources with an explicit imperative
        // marker. The student's plan listed THIS source as required for
        // THIS step — the LLM must cite it, paraphrase or quote, before
        // wandering to the secondary corpus.
        const pinnedBadge = s.priority === 'primary'
            ? (lang === 'en'
                ? '⭐ PINNED FOR THIS STEP — MUST cite at least once. '
                : '⭐ FUENTE ASIGNADA PARA ESTE PASO — DEBES citarla al menos una vez. ')
            : '';
        return [
            `### ${pinnedBadge}${s.displayLabel}`,
            `_${typeLabel}${citationKey}${usageNote}_${excerptNote}`,
            '```',
            truncated || (lang === 'en' ? '(extraction not yet available)' : '(extracción aún no disponible)'),
            '```',
        ].join('\n');
    });

    // Lead the source block with a directive listing the pinned keys
    // (when any) so the model sees the contract before wading into
    // text. Skipping a pinned source = critical plan failure; cross-
    // pollinating with a non-pinned source where a pinned one fits =
    // also a failure. Cite extras only when they genuinely strengthen
    // the argument beyond the pinned set.
    const pinnedKeys = sources
        .filter(s => s.priority === 'primary')
        .map(s => s.citationKey || s.displayLabel);
    let directive = '';
    if (pinnedKeys.length > 0) {
        directive = lang === 'en'
            ? [
                '## Pinned-source contract for THIS step',
                '',
                `The student's corpus plan pins the following sources to this step. You MUST cite each one at least once in your output (paraphrase or verbatim, your choice — but they MUST appear):`,
                '',
                ...pinnedKeys.map(k => `- ${k}`),
                '',
                'Skipping a pinned source is a critical failure of the plan. You may also cite non-pinned sources from the corpus when they strengthen the argument — but never as a SUBSTITUTE for a pinned source.',
                '',
            ].join('\n')
            : [
                '## Contrato de fuentes asignadas para ESTE paso',
                '',
                `El plan de corpus del alumno asigna las siguientes fuentes a este paso. DEBES citar cada una al menos una vez en tu output (parafraseo o verbatim, tu elección — pero TIENEN que aparecer):`,
                '',
                ...pinnedKeys.map(k => `- ${k}`),
                '',
                'Saltarse una fuente asignada es una falla crítica del plan. Podés también citar fuentes no-asignadas del corpus cuando refuercen el argumento — pero nunca como SUSTITUTO de una asignada.',
                '',
            ].join('\n');
    }

    return directive + blocks.join('\n\n');
}

function formatPriorSteps(steps: ExegesisPriorStep[], lang: 'es' | 'en'): string {
    if (steps.length === 0) {
        return lang === 'en'
            ? `(No accepted prior steps yet — this should not happen for conclusion/introduction. Surface this as an error.)`
            : `(Aún no hay pasos previos aceptados — esto no debería pasar en conclusión/introducción. Reportalo como error.)`;
    }
    return steps.map(s => {
        const heading = s.kind === 'verse' && s.verseRef
            ? formatPassageReference(s.verseRef, lang)
            : (lang === 'en' ? capitalize(s.kind) : spanishKindHeading(s.kind));
        return `### ${heading}\n\n${s.markdown}`;
    }).join('\n\n---\n\n');
}

/**
 * Per-source-type budget weights for the inline-context allocation.
 * High-rigor academic types (critical commentaries, technical lexicons,
 * grammars) get the largest slice; supportive material gets less; the
 * style template gets the minimum just enough to communicate shape.
 *
 * Numbers are relative — only the ratios matter — and align with the
 * `rigorTier` field on `SOURCE_TYPE_CATALOG` but with finer
 * differentiation for the prompt's needs (e.g. `commentary-critical`
 * outranks `lexicon-technical` because critical commentaries carry
 * the exegetical argument; the lexicon supports it).
 */
function sourceTypeWeight(type: SourceType): number {
    switch (type) {
        case 'commentary-critical': return 4;
        case 'lexicon-technical': return 3;
        case 'theological-dictionary': return 3;
        case 'grammar-syntax': return 3;
        case 'critical-apparatus': return 3;
        case 'textual-commentary': return 3;
        case 'commentary-expository': return 2;
        case 'historical-background': return 2;
        case 'theological-monograph': return 2;
        case 'journal-article': return 2;
        case 'primary-source-ancient': return 2;
        case 'biblical-text-edition': return 2;
        case 'other': return 1;
        case 'style-template-paper': return 1;
    }
}

/**
 * Source-type weight that bakes in the student's per-step emphasis.
 * Multiplies the catalog base weight by 2.5x when the type is in
 * `emphasizedTypes`, by 0.4x when it's in `deemphasizedTypes`. The
 * style-template-paper type is exempt — its budget stays small
 * regardless because the model only consumes it for shape.
 *
 * Pure: same inputs, same output. Called once per source per
 * generation; no caching needed.
 */
function effectiveSourceTypeWeight(type: SourceType, emphasis: StepEmphasis | null): number {
    const base = sourceTypeWeight(type);
    if (type === 'style-template-paper' || !emphasis) return base;
    if (emphasis.emphasizedTypes.includes(type)) return base * 2.5;
    if (emphasis.deemphasizedTypes.includes(type)) return base * 0.4;
    return base;
}

/**
 * Renders the student's per-step emphasis as a directive block in
 * the user message. Sits BEFORE the source list so the model reads
 * "for this step, prioritize X and Y" right before being handed the
 * inline corpus. Returns an empty string when no emphasis is set OR
 * when both lists are empty — keeps the prompt clean for papers
 * generating against the rubric default with no overrides.
 */
function formatStepEmphasis(emphasis: StepEmphasis | null, lang: 'es' | 'en'): string {
    if (!emphasis) return '';
    const hasEmphasized = emphasis.emphasizedTypes.length > 0;
    const hasDeemphasized = emphasis.deemphasizedTypes.length > 0;
    if (!hasEmphasized && !hasDeemphasized) return '';

    const labelOf = (type: SourceType) =>
        lang === 'en' ? englishTypeLabel(type) : spanishTypeLabel(type);
    const emphasizedList = emphasis.emphasizedTypes.map(labelOf).join(', ');
    const deemphasizedList = emphasis.deemphasizedTypes.map(labelOf).join(', ');

    if (lang === 'en') {
        const lines = [
            `### Per-step source priority (set by the student)`,
            `For THIS step, follow the priority below when interacting with the configured corpus:`,
        ];
        if (hasEmphasized) lines.push(`- **Prioritize** these source types: ${emphasizedList}. Cite them generously where they bear on the analysis.`);
        if (hasDeemphasized) lines.push(`- **De-emphasize** these source types: ${deemphasizedList}. They may appear briefly but should not lead the argument.`);
        lines.push(`Source budgets in the listing below already reflect this priority — types you are asked to prioritize get more inline context.`);
        lines.push(``);
        return lines.join('\n');
    }

    const lines = [
        `### Prioridad de fuentes para este paso (configurada por el alumno)`,
        `Para ESTE paso, seguí la prioridad siguiente al interactuar con el corpus configurado:`,
    ];
    if (hasEmphasized) lines.push(`- **Priorizá** estos tipos de fuente: ${emphasizedList}. Citalos generosamente cuando aporten al análisis.`);
    if (hasDeemphasized) lines.push(`- **Desénfasis** en estos tipos de fuente: ${deemphasizedList}. Pueden aparecer brevemente, pero no deben liderar el argumento.`);
    lines.push(`Los presupuestos de fuente en la lista de abajo ya reflejan esta prioridad — los tipos que tenés que priorizar reciben más contexto inline.`);
    lines.push(``);
    return lines.join('\n');
}

function englishTypeLabel(type: SourceType): string {
    switch (type) {
        case 'biblical-text-edition': return 'Biblical text edition';
        case 'critical-apparatus': return 'Critical apparatus';
        case 'textual-commentary': return 'Commentary on the apparatus';
        case 'lexicon-technical': return 'Technical lexicon';
        case 'theological-dictionary': return 'Theological dictionary';
        case 'grammar-syntax': return 'Grammar / syntax';
        case 'commentary-critical': return 'Critical commentary';
        case 'commentary-expository': return 'Expository commentary';
        case 'historical-background': return 'Historical/cultural background';
        case 'theological-monograph': return 'Theological monograph';
        case 'journal-article': return 'Journal article';
        case 'primary-source-ancient': return 'Ancient primary source';
        case 'style-template-paper': return 'Style template (model paper)';
        case 'other': return 'Other';
    }
}

function spanishTypeLabel(type: SourceType): string {
    switch (type) {
        case 'biblical-text-edition': return 'Edición del texto bíblico';
        case 'critical-apparatus': return 'Aparato crítico';
        case 'textual-commentary': return 'Comentario del aparato';
        case 'lexicon-technical': return 'Léxico técnico';
        case 'theological-dictionary': return 'Diccionario teológico';
        case 'grammar-syntax': return 'Gramática / sintaxis';
        case 'commentary-critical': return 'Comentario crítico-técnico';
        case 'commentary-expository': return 'Comentario expositivo';
        case 'historical-background': return 'Contexto histórico/cultural';
        case 'theological-monograph': return 'Monografía teológica';
        case 'journal-article': return 'Artículo de revista';
        case 'primary-source-ancient': return 'Fuente primaria antigua';
        case 'style-template-paper': return 'Plantilla de estilo (trabajo modelo)';
        case 'other': return 'Otro';
    }
}

function spanishKindHeading(kind: ExegesisPriorStep['kind']): string {
    switch (kind) {
        case 'verse': return 'Verso';
        case 'conclusion': return 'Conclusión';
        case 'introduction': return 'Introducción';
        case 'assembly': return 'Ensamble';
    }
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function truncate(text: string, maxChars: number): string {
    if (!text) return '';
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + '\n\n[…content truncated to fit context window…]';
}

// ── Corpus-gap warnings ─────────────────────────────────────────────────
//
// When the user's corpus doesn't satisfy a rubric requirement, the
// orchestrator injects a "Limitaciones del corpus" block listing the
// missing types AND telling the LLM what kinds of claims to soften
// (or avoid) for each one. Without this, the LLM happily generates
// confident textual-criticism / lexical / syntactic claims even when
// it has no source to back them — the highest-risk hallucination
// vector for academic exegesis.
//
// Each gap has a per-type message. Generic gaps (no type-specific
// guidance) get a fallback line.

function formatCorpusGaps(
    missing: ReadonlyArray<MissingSourceTypeRequirement>,
    lang: 'es' | 'en',
): string {
    if (missing.length === 0) return '';
    const warnings = lang === 'en' ? CORPUS_GAP_WARNINGS_EN : CORPUS_GAP_WARNINGS_ES;
    const intro = lang === 'en'
        ? `## Corpus limitations (READ CAREFULLY)\nYour configured corpus does NOT include the following source types the rubric requires. Soften or skip claims that would normally rest on these — never invent citations to sources you don't have.`
        : `## Limitaciones del corpus (LEER CON ATENCIÓN)\nTu corpus configurado NO incluye los siguientes tipos de fuente que la rúbrica requiere. Atenuá o saltá las afirmaciones que normalmente se basarían en ellas — nunca inventes citas a fuentes que no tenés.`;
    const items = missing.map((req) => {
        const warning = warnings[req.sourceType] ?? warnings['__default__'];
        const ratio = `${req.have}/${req.minimum}`;
        return `- **${prettyTypeName(req.sourceType, lang)}** (${ratio}): ${warning}`;
    });
    return ['', intro, ...items].join('\n');
}

function prettyTypeName(t: SourceType, lang: 'es' | 'en'): string {
    if (lang === 'en') {
        const en: Record<SourceType, string> = {
            'biblical-text-edition': 'Biblical text edition',
            'critical-apparatus': 'Critical apparatus',
            'textual-commentary': 'Commentary on the apparatus',
            'lexicon-technical': 'Technical lexicon',
            'theological-dictionary': 'Theological dictionary',
            'grammar-syntax': 'Grammar / syntax',
            'commentary-critical': 'Critical-technical commentary',
            'commentary-expository': 'Expository commentary',
            'historical-background': 'Historical / cultural background',
            'theological-monograph': 'Theological monograph',
            'journal-article': 'Journal article',
            'primary-source-ancient': 'Ancient primary source',
            'style-template-paper': 'Style-template paper',
            'other': 'Other',
        };
        return en[t];
    }
    return spanishTypeLabel(t);
}

const CORPUS_GAP_WARNINGS_ES: Record<SourceType | '__default__', string> = {
    '__default__': 'Atenuá afirmaciones que dependerían de este tipo de fuente; marcalas como tentativas o de conocimiento general.',
    'biblical-text-edition': 'NO hagas afirmaciones específicas sobre el texto crítico (NA28/BHS/Rahlfs) — citá solo desde la traducción disponible y marcá explícitamente que es traducción.',
    'critical-apparatus': 'NO hagas afirmaciones sobre variantes textuales, manuscritos específicos (𝔓⁷², ℵ, A, B, etc.), ni decisiones de crítica textual sin marcarlas como tentativas que requieren consulta del aparato crítico.',
    'textual-commentary': 'NO afirmes qué testigos respaldan una lectura ni por qué se adoptó, sin marcarlo como tentativo: eso requiere un comentario del aparato (Metzger), y su cobertura es selectiva.',
    'lexicon-technical': 'NO hagas afirmaciones específicas sobre matices semánticos de términos griegos/hebreos sin marcarlas como generales que requieren consulta de un léxico técnico (BDAG, HALOT, LSJ).',
    'theological-dictionary': 'NO hagas afirmaciones sobre la trayectoria canónica de un término o el desarrollo de un campo semántico sin marcarlas como tentativas que requieren consulta de un diccionario teológico (TDNT, NIDNTTE, EDNT).',
    'grammar-syntax': 'NO hagas afirmaciones técnicas sobre sintaxis (categorías de genitivo, aspecto verbal, construcciones específicas) sin marcarlas como necesitando verificación con una gramática de referencia (BDF, Wallace, Robertson).',
    'commentary-critical': 'NO hagas afirmaciones técnicas detalladas (decisiones sintácticas finas, crítica textual del versículo, paralelos intertestamentarios precisos) sin marcarlas como necesitando verificación con un comentario crítico-técnico (WBC, NIGTC, Hermeneia, ICC).',
    'commentary-expository': 'NO hagas afirmaciones sobre la lectura teológica establecida del pasaje o aplicaciones tradicionales sin marcarlas como tentativas que requieren un comentario expositivo (NICOT/NICNT, BECNT, Pillar).',
    'historical-background': 'NO hagas afirmaciones sobre contexto greco-romano, costumbres del primer siglo, audiencia original o trasfondo del libro sin marcarlas como generales que requieren verificación con literatura de contexto (deSilva, Sanders, Keener IVP, ABD).',
    'theological-monograph': 'NO desarrolles ideas teológicas profundas que requerirían una monografía especializada sin marcarlas como tentativas.',
    'journal-article': 'NO cites desarrollos académicos recientes ni debates de campo sin marcarlos como tentativos.',
    'primary-source-ancient': 'NO hagas afirmaciones específicas sobre Josefo, Filón, Padres apostólicos o pseudoepígrafa sin marcarlas como necesitando verificación directa con la fuente primaria.',
    'style-template-paper': '',
    'other': '',
};

const CORPUS_GAP_WARNINGS_EN: Record<SourceType | '__default__', string> = {
    '__default__': 'Soften any claims that would rest on this source type; mark them as tentative or as general knowledge.',
    'biblical-text-edition': 'Do NOT make specific claims about the critical text (NA28/BHS/Rahlfs) — cite only from the available translation and mark it explicitly as a translation.',
    'critical-apparatus': 'Do NOT make claims about textual variants, specific manuscripts (𝔓⁷², ℵ, A, B, etc.), or textual-critical decisions without marking them as tentative and requiring critical-apparatus consultation.',
    'textual-commentary': 'Do NOT state which witnesses support a reading, or why it was adopted, without marking it as tentative: that requires a commentary on the apparatus (Metzger), whose coverage is selective.',
    'lexicon-technical': 'Do NOT make specific claims about semantic nuances of Greek/Hebrew terms without marking them as general and requiring consultation of a technical lexicon (BDAG, HALOT, LSJ).',
    'theological-dictionary': 'Do NOT make claims about a term\'s canonical trajectory or semantic-field development without marking them as tentative and requiring a theological dictionary (TDNT, NIDNTTE, EDNT).',
    'grammar-syntax': 'Do NOT make technical syntactic claims (genitive categories, verbal aspect, specific constructions) without marking them as needing verification against a reference grammar (BDF, Wallace, Robertson).',
    'commentary-critical': 'Do NOT make detailed technical claims (fine syntactic decisions, verse-level textual criticism, precise intertestamental parallels) without marking them as needing verification against a critical-technical commentary (WBC, NIGTC, Hermeneia, ICC).',
    'commentary-expository': 'Do NOT make claims about the established theological reading or traditional applications without marking them as tentative and needing an expository commentary (NICOT/NICNT, BECNT, Pillar).',
    'historical-background': 'Do NOT make claims about Greco-Roman context, first-century customs, original audience, or book background without marking them as general and needing verification against context literature (deSilva, Sanders, Keener IVP, ABD).',
    'theological-monograph': 'Do NOT develop deep theological ideas that would require a specialized monograph without marking them as tentative.',
    'journal-article': 'Do NOT cite recent academic developments or field debates without marking them as tentative.',
    'primary-source-ancient': 'Do NOT make specific claims about Josephus, Philo, Apostolic Fathers, or pseudepigrapha without marking them as needing direct verification against the primary source.',
    'style-template-paper': '',
    'other': '',
};
