import {
    buildVerseMorphologyBlock,
    formatPassageReference,
    type AnalyzeVerseInput,
    type CanonicalVerseAnalysis,
} from '@dosfilos/domain';
import { fitPromptToCap } from '../../llm/promptBudget';
import { voiceFor } from '../testamentVoice';

/**
 * Prompt construction for the canonical verse analyzer.
 *
 * Two-pronged approach:
 *   1. The `responseSchema` (in `responseSchema.ts`) constrains the
 *      output SHAPE — Gemini guarantees JSON conforming to the schema.
 *   2. This prompt enforces SUBSTANCE — the methodological rigor each
 *      field must reflect, citation discipline, hedge calibration,
 *      and the "no recap, no distant verses" rules for the verse
 *      thesis.
 *
 * Both layers matter. Schema without rigor produces structured
 * mediocrity; rigor without schema produces unparseable prose.
 */

interface BuiltAnalyzerPrompt {
    systemInstruction: string;
    userMessage: string;
}

const SOURCE_BUDGET_CHARS_TOTAL = 220_000;
const STYLE_GUIDE_BUDGET_CHARS = 20_000;
const PRIOR_ANALYSES_BUDGET_CHARS = 40_000;


export function buildAnalyzerPrompt(input: AnalyzeVerseInput): BuiltAnalyzerPrompt {
    return {
        systemInstruction: buildSystemInstruction(input),
        userMessage: buildUserMessage(input),
    };
}

function buildSystemInstruction(input: AnalyzeVerseInput): string {
    const lang = input.language;
    const voice = voiceFor(input.verseRef.bookId);
    const verse = formatPassageReference(input.verseRef, lang);
    const passage = formatPassageReference(input.paperPassage, lang);
    const briefBlock = formatAssignmentBrief(input.assignmentBrief, lang);
    const styleGuideBlock = formatStyleGuide(input.styleGuideContent, lang);
    const corpusGapsBlock = formatCorpusGaps(input.missingSourceTypes, lang);
    const baseTextBlock = formatOriginalLanguageText(input.originalLanguageText, lang);
    const pericopeBlock = formatPericopeBlock(input.pericopeContext, lang);
    const planNoteBlock = formatPlanNote(input.planNote, lang);
    // La morfología tabulada va JUNTO al texto base, no en la guía de campos:
    // es parte de lo que el analizador lee, no de lo que tiene que producir.
    const morphologyBlock = buildVerseMorphologyBlock(input.verseMorphology ?? null, lang);

    if (lang === 'en') {
        return [
            `You are an expert exegete in ${voice.expertEn}, trained in the historical-grammatical-literal method as taught at evangelical seminaries (TMS, DTS, Westminster, Southern). Your task is to produce a CANONICAL STRUCTURED ANALYSIS of one verse, populating every field of the response schema with rigorous, source-grounded content.`,
            ``,
            `## Verse and paper`,
            `Verse: **${verse}**`,
            `Within paper passage: ${passage}`,
            baseTextBlock,
            morphologyBlock,
            pericopeBlock,
            briefBlock,
            planNoteBlock,
            ``,
            `## Methodological foundation`,
            `Apply the historical-grammatical-literal method documented in the platform's METODOLOGIA.md. Anchor your analysis in canonical authorities:`,
            `- ${voice.grammarsEn}`,
            `- ${voice.lexiconsEn}`,
            `- Discourse: Levinsohn, Runge`,
            `- ${voice.apparatusEn}`,
            `- Background: deSilva, Keener, ABD`,
            `- OT intertextuality: Beale & Carson, Hays`,
            ``,
            `## Five non-negotiable commitments`,
            `1. Author's intent (inspired by the Holy Spirit) is the locus of meaning.`,
            `2. Grammar/syntax/lexis grounds interpretation. Devotional intuition is not exegesis.`,
            `3. Historical-cultural context informs the original sense — without imposing modernity.`,
            `4. Theology emerges from the text. Do not impose systematic conclusions on the verse.`,
            `5. Scripture interprets Scripture, but only after exhausting the immediate text.`,
            ``,
            `## Citation discipline (NON-NEGOTIABLE)`,
            `- Every source citation in the structured output must reference a sourceKey that matches a configured source listed below in the user message.`,
            `- NEVER invent source keys, page numbers, or quotes. If you cannot back a claim with a configured source, mark it tentative in confidenceFlags or omit the claim entirely.`,
            `- For ideas drawn from your own general knowledge (not from the configured corpus), set the relevant confidenceFlag to "tentative" — do not fabricate citations.`,
            corpusGapsBlock,
            ``,
            `## Style guide constraints`,
            styleGuideBlock,
            ``,
            `## Output format`,
            `Output MUST be a JSON object conforming exactly to the schema you have been given via responseSchema. Every required field must be present. Optional fields can be empty strings or empty arrays when not applicable.`,
            ``,
            `Tone: sober academic. Avoid devotional language. Match the analytical register of a seminary research paper.`,
        ].filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n');
    }

    return [
        `Sos un exégeta experto en ${voice.expertEs}, formado en el método histórico-gramatical-literal según se enseña en seminarios evangélicos rigurosos (TMS, DTS, Westminster, Southern). Tu tarea es producir un ANÁLISIS CANÓNICO ESTRUCTURADO de un solo versículo, poblando cada campo del response schema con contenido riguroso anclado en fuentes.`,
        ``,
        `## Versículo y paper`,
        `Versículo: **${verse}**`,
        `Dentro del pasaje del paper: ${passage}`,
        baseTextBlock,
        morphologyBlock,
        pericopeBlock,
        briefBlock,
        planNoteBlock,
        ``,
        `## Fundamento metodológico`,
        `Aplicá el método histórico-gramatical-literal documentado en METODOLOGIA.md de la plataforma. Anclá tu análisis en autoridades canónicas:`,
        `- ${voice.grammarsEs}`,
        `- ${voice.lexiconsEs}`,
        `- Discurso: Levinsohn, Runge`,
        `- ${voice.apparatusEs}`,
        `- Trasfondo: deSilva, Keener, ABD`,
        `- Intertextualidad AT: Beale & Carson, Hays`,
        ``,
        `## Cinco compromisos no-negociables`,
        `1. La intención del autor (inspirado por el Espíritu Santo) es el locus del significado.`,
        `2. La gramática/sintaxis/léxico fundamenta la interpretación. La intuición devocional no es exégesis.`,
        `3. El contexto histórico-cultural informa el sentido original — sin imponer modernidad.`,
        `4. La teología emerge del texto. No impongas conclusiones sistemáticas sobre el verso.`,
        `5. Scripture interprets Scripture, pero solo después de agotar el texto inmediato.`,
        ``,
        `## Disciplina de citación (NO NEGOCIABLE)`,
        `- Toda cita de fuente en el output estructurado debe referenciar un sourceKey que coincida con una fuente configurada listada abajo en el mensaje del usuario.`,
        `- NUNCA inventes claves de fuente, números de página o citas verbatim. Si no podés respaldar una afirmación con una fuente configurada, marcala como tentative en confidenceFlags u omitila completamente.`,
        `- Para ideas que provengan de tu conocimiento general (no del corpus configurado), poné el confidenceFlag relevante en "tentative" — NO fabriques citas.`,
        corpusGapsBlock,
        ``,
        `## Restricciones de la guía de estilo`,
        styleGuideBlock,
        ``,
        `## Formato de salida`,
        `La salida DEBE ser un objeto JSON que se conforma exactamente al schema que recibiste vía responseSchema. Todos los campos requeridos deben estar presentes. Los campos opcionales pueden ser strings vacíos o arrays vacíos cuando no apliquen.`,
        ``,
        `Tono: académico sobrio. Evitá lenguaje devocional. Igualá el registro analítico de un trabajo de investigación de seminario.`,
    ].filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * El corpus se recorta a lo que quede libre bajo el tope del proxy en vez de a
 * `SOURCE_BUDGET_CHARS_TOTAL` a secas: ese número estaba POR ENCIMA del tope
 * del servidor y un paper con cuatro comentarios extraídos completos hacía
 * fallar toda generación con `prompt excede 200000 caracteres`.
 */
function buildUserMessage(input: AnalyzeVerseInput): string {
    return fitPromptToCap(
        sourcesBlock => renderUserMessage(input, sourcesBlock),
        budget => formatSources(input.sources, input.language, budget),
        SOURCE_BUDGET_CHARS_TOTAL,
        'GeminiCanonicalVerseAnalyzer',
    );
}

function renderUserMessage(input: AnalyzeVerseInput, sourcesBlock: string): string {
    const lang = input.language;
    const voice = voiceFor(input.verseRef.bookId);
    const verse = formatPassageReference(input.verseRef, lang);
    const priorAnalysesBlock = formatPriorAnalyses(input.priorAcceptedAnalyses, lang);
    const emphasisBlock = formatStepEmphasis(input.stepEmphasis, lang);
    const hint = input.regenerationHint
        ? (lang === 'en'
            ? `\n\n### Regeneration hint from the user\n${input.regenerationHint}\n`
            : `\n\n### Hint de regeneración del usuario\n${input.regenerationHint}\n`)
        : '';

    if (lang === 'en') {
        return [
            `Analyze ${verse} according to the methodology in the system instruction. Populate every field of the response schema.`,
            ``,
            `## Field-by-field methodological reminders`,
            ``,
            `**textualCriticism** — ALWAYS populate. When no significant variants exist in the apparatus, set "note" to confirm review explicitly (e.g., "No significant variants in the apparatus for this verse.") and leave "variants" empty. When variants exist, document witnesses (${voice.witnessesEn}), the adopted reading, and rationale grounded in textual-critical canons.`,
            ``,
            `**syntacticAnalysis.mainVerb** — Identify the main verb of the sentence containing this verse. Set to null when the verse is part of a longer sentence whose main verb lives elsewhere (participial chains, μέν…δέ pairs, periodic sentences); when null, populate "mainVerbNote" to explain.`,
            ``,
            `**syntacticAnalysis.keyConstructions** — Each participle, relative clause, prepositional phrase, genitive construction. Each entry: text + morphology (in natural language: "${voice.morphologyEn}") + syntactic function (Wallace's categories) + interpretive significance.`,
            ``,
            `**syntacticAnalysis.discourseParticles** — δέ, γάρ, οὖν, μέν, καί, ἀλλά, ὅτι and others when their argumentative function is notable. Use Levinsohn / Runge categories.`,
            ``,
            `**lexicalAnalyses** — One entry per key term. CRITICAL: separate "generalSemanticRange" (full lexicographic range with sources) from "verseSpecificLoading" (how this verse's context selects from the range). This is Differentiator 1 — guards against Carson's "transferred totality" fallacy.`,
            ``,
            `**argumentativeRole** — 1-2 sentences. What does THIS verse DO in the pericope's argument? (establishes thesis / develops / contrasts / exemplifies / transitions / concludes). Differentiator 2.`,
            ``,
            `**historicalContext** — Empty array unless the verse genuinely requires extra-textual background. NOT decorative.`,
            ``,
            `**oldTestamentLinks** — Use Hays' taxonomy: 'quotation' (with formula like γέγραπται), 'allusion', 'echo'. Empty when the verse has no canonical resonance.`,
            ``,
            `**commentatorEngagement** — NOT a citation list. POSITIONS. What each commentator argues about THIS verse, paraphrased in your voice. The 'role' field: when the source block says "role assigned by the plan", COPY that role — the strategy is already decided and re-deciding it silently overrides the author. Classify yourself ('anchor' / 'contrast' / 'technical') only for sources without an assigned role.`,
            ``,
            `**translationCruxes** — One entry per genuinely contested translation decision. Each: phrase + description + options + commentator positions (with 'supports' index pointing to the chosen option) + commitment with rationale derived from the analysis above.`,
            `  Every commentatorPosition MUST carry \`verbatimQuote\`: the sentence from that source's provided text on which your summary rests, copied EXACTLY. Enlisting an author as a witness FOR an option is the strongest claim you make about someone else's work — you must be able to point at the words. If the provided text does not contain a sentence supporting the position, OMIT the position. Do not reconstruct it from memory of the work.`,
            `  A crux whose witnesses all back the SAME option is not a crux — it is a conclusion with decoration. Either the opposing option has a witness in the provided texts and you missed it, or the decision was never contested and does not belong here. Never leave a crux one-sided.`,
            `  Beware the background section: a dictionary or commentary often surveys a term's harsher or older usage before arguing its own conclusion. Quoting the survey and reporting it as the author's position inverts their argument. Read to the end of the provided text before assigning 'supports'.`,
            ``,
            `**initialTranslation** — Working translation BEFORE crux resolution.`,
            ``,
            `**finalTranslation** — Translation AFTER crux resolution. Equal to initialTranslation when no cruxes.`,
            ``,
            `**verseThesis** — 1-3 sentences. What THIS verse establishes. May reference the IMMEDIATELY adjacent verse only when the grammar of ${verse} demands it (μέν…δέ, participial chains, comparative pairs). NEVER mention verses more than one step away. NEVER recap the pericope.`,
            ``,
            `**theologicalHooks** — Loci touched (cristologia, soteriologia, etc.). Used by sermon/devotional composers, NOT by the academic composer. Empty if no clear loci.`,
            ``,
            `**confidenceFlags** — Calibrate hedge language. Mark each non-trivial claim with high/medium/tentative + preferred hedge phrases. Required when corpus gaps force tentative claims.`,
            ``,
            `**footnoteExtensions** — Anchor extensions (1-3 sentences) to phrases in your prose-bearing fields. Compose-time fuzzy-match places markers. 2-5 footnotes typical.`,
            ``,
            emphasisBlock,
            `### Sources at your disposal`,
            sourcesBlock,
            ``,
            priorAnalysesBlock,
            hint,
        ].filter(Boolean).join('\n');
    }

    return [
        `Analizá ${verse} según la metodología del system instruction. Poblá cada campo del response schema.`,
        ``,
        `## Recordatorios metodológicos por campo`,
        ``,
        `**textualCriticism** — SIEMPRE poblar. Cuando no hay variantes significativas en el aparato, poné "note" confirmando la revisión explícitamente (ej. "Sin variantes significativas en el aparato para este verso.") y dejá "variants" vacío. Cuando hay variantes, documentá testigos (${voice.witnessesEs}), la lectura adoptada y la justificación anclada en cánones de crítica textual.`,
        ``,
        `**syntacticAnalysis.mainVerb** — Identificá el verbo principal de la oración que contiene este verso. Poné null cuando el verso es parte de una oración cuyo verbo principal vive en otro lado (cadenas participiales, pares μέν…δέ, oraciones periódicas); cuando es null, poblá "mainVerbNote" para explicar.`,
        ``,
        `**syntacticAnalysis.keyConstructions** — Cada participio, cláusula relativa, frase preposicional, construcción de genitivo. Cada entrada: text + morphology (en lenguaje natural: "${voice.morphologyEs}") + syntacticFunction (categorías de Wallace) + interpretiveSignificance.`,
        ``,
        `**syntacticAnalysis.discourseParticles** — δέ, γάρ, οὖν, μέν, καί, ἀλλά, ὅτι y otras cuando su función argumentativa es notable. Usá categorías de Levinsohn / Runge.`,
        ``,
        `**lexicalAnalyses** — Una entrada por término clave. CRÍTICO: separá "generalSemanticRange" (rango lexicográfico completo con fuentes) de "verseSpecificLoading" (cómo el contexto del verso selecciona del rango). Este es el Diferenciador 1 — salvaguarda contra la falacia de "totalidad transferida" de Carson.`,
        ``,
        `**argumentativeRole** — 1-2 oraciones. ¿Qué HACE ESTE verso en el argumento de la pericopa? (establece tesis / desarrolla / contrasta / ejemplifica / transiciona / concluye). Diferenciador 2.`,
        ``,
        `**historicalContext** — Array vacío salvo que el verso genuinamente requiera trasfondo extra-textual. NO decorativo.`,
        ``,
        `**oldTestamentLinks** — Usá la taxonomía de Hays: 'quotation' (con fórmula tipo γέγραπται), 'allusion', 'echo'. Vacío cuando el verso no tiene resonancia canónica.`,
        ``,
        `**commentatorEngagement** — NO es lista de citas. POSICIONES. Qué argumenta cada comentarista sobre ESTE verso, parafraseado en tu voz. El campo 'role': cuando la ficha de la fuente diga «rol asignado por el plan», COPIÁ ese rol — la estrategia ya está decidida y volver a decidirla pisa al autor en silencio. Clasificá vos ('anchor' / 'contrast' / 'technical') sólo las fuentes sin rol asignado.`,
        ``,
        `**translationCruxes** — Una entrada por decisión de traducción genuinamente contestada. Cada uno: phrase + description + options + commentatorPositions (con índice 'supports' apuntando a la opción elegida) + commitment con justificación derivada del análisis previo.`,
        `  Cada commentatorPosition DEBE llevar \`verbatimQuote\`: la oración del texto provisto de esa fuente sobre la que se apoya tu summary, copiada EXACTA. Alistar a un autor como testigo A FAVOR de una opción es la afirmación más fuerte que hacés sobre el trabajo ajeno — tenés que poder señalar las palabras. Si el texto provisto no contiene una oración que sostenga la posición, OMITÍ la posición. No la reconstruyas de tu memoria de la obra.`,
        `  Un cruce cuyos testigos apoyan TODOS la misma opción no es un cruce: es una conclusión con adorno. O la opción contraria tiene testigo en los textos provistos y se te pasó, o la decisión nunca estuvo contestada y no va aquí. Nunca dejes un cruce con testigos de un solo lado.`,
        `  Cuidado con la sección de trasfondo: un diccionario o comentario suele recorrer el uso más duro o más antiguo de un término ANTES de argumentar su propia conclusión. Citar ese recorrido y reportarlo como la posición del autor invierte su argumento. Leé hasta el final del texto provisto antes de asignar 'supports'.`,
        ``,
        `**initialTranslation** — Traducción de trabajo ANTES de resolver los cruces.`,
        ``,
        `**finalTranslation** — Traducción DESPUÉS de resolver los cruces. Igual a initialTranslation cuando no hay cruces.`,
        ``,
        `**verseThesis** — 1-3 oraciones. Qué establece ESTE verso. Puede referenciar el verso INMEDIATAMENTE adyacente solo cuando la gramática de ${verse} lo exige (μέν…δέ, cadenas participiales, pares comparativos). NUNCA menciones versos a más de un paso. NUNCA recapitules la pericopa.`,
        ``,
        `**theologicalHooks** — Loci tocados (cristologia, soteriologia, etc.). Usado por composers sermón/devocional, NO por el composer académico. Vacío si no hay loci claros.`,
        ``,
        `**confidenceFlags** — Calibrá el lenguaje hedge. Marcá cada afirmación no-trivial con high/medium/tentative + frases hedge preferidas. Obligatorio cuando huecos del corpus fuerzan afirmaciones tentativas.`,
        ``,
        `**footnoteExtensions** — Extensiones ancladas (1-3 oraciones) a frases en tus campos prosaicos. Compose-time fuzzy-match coloca los marcadores. 2-5 notas típicas.`,
        ``,
        emphasisBlock,
        `### Fuentes a tu disposición`,
        sourcesBlock,
        ``,
        priorAnalysesBlock,
        hint,
    ].filter(Boolean).join('\n');
}

// ── Formatters ──────────────────────────────────────────────────────────

function formatAssignmentBrief(brief: string | null, lang: 'es' | 'en'): string {
    if (!brief || !brief.trim()) return '';
    const heading = lang === 'en' ? '## Paper framing' : '## Encuadre del paper';
    return [``, heading, brief.trim()].join('\n');
}

/**
 * Surfaces the verse's original-language text (Greek for NT via SBL
 * GNT, Hebrew for OT via WLC) as the authoritative base text for
 * every grammatical / lexical / syntactic decision the analyzer
 * documents. When null (no provider, unsupported book, or fetch
 * failed), emits an empty string and the analyzer falls back to
 * its training memory of the text.
 */
function formatOriginalLanguageText(text: string | null, lang: 'es' | 'en'): string {
    if (!text || !text.trim()) return '';
    const heading = lang === 'en' ? '## Base text (SBL GNT / WLC)' : '## Texto base (SBL GNT / WLC)';
    const note = lang === 'en'
        ? 'This is the authoritative base text for the verse. Every grammatical, lexical, and syntactic claim you make MUST square with the wording below; do not paraphrase from memory.'
        : 'Este es el texto base autoritativo del versículo. Toda afirmación gramatical, léxica y sintáctica que hagas DEBE coincidir con la redacción de abajo; no parafrasees desde memoria.';
    return [``, heading, '```', text.trim(), '```', note].join('\n');
}

/**
 * El entorno del versículo, con el analizado señalado.
 *
 * Va DESPUÉS del texto base y dice explícitamente qué es y qué no es. Sin esa
 * frase el modelo recibe seis versículos de griego y analiza los seis: el
 * contexto se vuelve tarea, que es el defecto contrario al que esto arregla.
 */
function formatPericopeBlock(text: string | null, lang: 'es' | 'en'): string {
    if (!text || !text.trim()) return '';
    const heading = lang === 'en' ? '## Surrounding text' : '## Texto del entorno';
    const note = lang === 'en'
        ? 'Context ONLY. The verse to analyze is the one marked with \u25ba; do not analyze the others. Greek syntax does not respect verse divisions: use this to find antecedents and consequents \u2014 a protasis whose apodosis lands two verses later, a particle whose contrast sits just before, a participle whose argument continues after. When a construction reaches beyond the marked verse, say so and cite the verse where the evidence is.'
        : 'Contexto SOLAMENTE. El vers\u00edculo a analizar es el marcado con \u25ba; no analices los otros. La sintaxis griega no respeta la divisi\u00f3n en vers\u00edculos: us\u00e1 esto para hallar antecedentes y consecuentes \u2014una pr\u00f3tasis cuya ap\u00f3dosis cae dos vers\u00edculos despu\u00e9s, una part\u00edcula cuyo contraste est\u00e1 justo antes, un participio cuyo argumento sigue adelante\u2014. Cuando una construcci\u00f3n se extienda m\u00e1s all\u00e1 del vers\u00edculo marcado, decilo y cit\u00e1 el vers\u00edculo donde est\u00e1 la evidencia.';
    return [``, heading, '```', text.trim(), '```', note].join('\n');
}

function formatStyleGuide(content: string, lang: 'es' | 'en'): string {
    if (!content || !content.trim()) {
        return lang === 'en'
            ? '(No style guide attached. Default to TMS conventions for citations and footnotes.)'
            : '(No hay guía de estilo adjunta. Aplicá por defecto convenciones TMS para citas y notas al pie.)';
    }
    const truncated = truncate(content, STYLE_GUIDE_BUDGET_CHARS);
    return ['```', truncated, '```'].join('\n');
}

function formatSources(
    sources: ReadonlyArray<AnalyzeVerseInput['sources'][number]>,
    lang: 'es' | 'en',
    budgetChars: number,
): string {
    if (sources.length === 0) {
        return lang === 'en'
            ? '(No sources configured. Lean on general knowledge but mark every claim as tentative in confidenceFlags.)'
            : '(Sin fuentes configuradas. Apoyate en conocimiento general pero marcá toda afirmación como tentative en confidenceFlags.)';
    }
    const perSourceBudget = Math.floor(budgetChars / sources.length);

    // v1.7+: lead the source block with a directive that names the
    // pinned sourceKeys so the model treats them as a contract, not a
    // suggestion. The structured analysis has explicit slots for
    // commentator engagement (commentatorEngagement) and lexis
    // sources — pinned sources MUST appear in at least one of those
    // slots when their content bears on this verse.
    const pinnedKeys = sources
        .filter(s => s.priority === 'primary' && s.citationKey)
        .map(s => s.citationKey!);
    let directive = '';
    if (pinnedKeys.length > 0) {
        directive = lang === 'en'
            ? [
                '## Pinned-source contract for THIS verse',
                '',
                `The student's corpus plan pins the following \`sourceKey\`s to this verse. You MUST reference each one at least once in your structured analysis — typically inside \`commentatorEngagement\` (with \`role\` set to anchor / contrast / technical) or \`lexicalAnalyses[*].generalSemanticRange.sources\` / \`loadingSources\` for lexicons / grammars:`,
                '',
                ...pinnedKeys.map(k => `- \`${k}\``),
                '',
                'Skipping a pinned source is a critical failure of the plan. Non-pinned sources may also appear when they strengthen the analysis — but never as a SUBSTITUTE for a pinned one.',
                '',
            ].join('\n') + '\n'
            : [
                '## Contrato de fuentes asignadas para ESTE verso',
                '',
                `El plan de corpus del alumno asigna los siguientes \`sourceKey\` a este verso. DEBES referenciar cada uno al menos una vez en tu análisis estructurado — típicamente dentro de \`commentatorEngagement\` (con \`role\` en anchor / contrast / technical) o \`lexicalAnalyses[*].generalSemanticRange.sources\` / \`loadingSources\` para léxicos / gramáticas:`,
                '',
                ...pinnedKeys.map(k => `- \`${k}\``),
                '',
                'Saltarse una fuente asignada es una falla crítica del plan. Las no-asignadas pueden aparecer cuando refuercen el análisis — pero nunca como SUSTITUTO de una asignada.',
                '',
            ].join('\n') + '\n';
    }

    /** Los tres roles, con el nombre que el autor lee en pantalla. */
const ROL_ES: Record<string, string> = { anchor: 'ancla', contrast: 'contraste', technical: 'técnica' };

const blocks = sources
        .map(s => {
            const truncated = truncate(s.textContent, perSourceBudget);
            const keyLine = s.citationKey ? `sourceKey: \`${s.citationKey}\`` : `(no citation key)`;
            const typeLine = s.sourceType;
            const pinnedBadge = s.priority === 'primary'
                ? (lang === 'en' ? '⭐ PINNED — MUST cite. ' : '⭐ ASIGNADA — DEBES citarla. ')
                : '';
            // El rol que YA decidió el plan de corpus. Sin esto, el prompt le
            // pedía al modelo clasificar a cada comentarista en estos mismos
            // tres roles desde cero, rehaciendo una decisión tomada.
            const roleLine = s.plannedRole
                ? (lang === 'en'
                    ? ` · role assigned by the plan: **${s.plannedRole}**`
                    : ` · rol asignado por el plan: **${ROL_ES[s.plannedRole]}**`)
                : '';
            return [
                `### ${pinnedBadge}${s.displayLabel}`,
                `_${keyLine} · type: ${typeLine}${roleLine}_`,
                '```',
                truncated || (lang === 'en' ? '(content not yet extracted)' : '(contenido aún no extraído)'),
                '```',
            ].join('\n');
        })
        .join('\n\n');

    return directive + blocks;
}

function formatPriorAnalyses(
    priorAnalyses: ReadonlyArray<CanonicalVerseAnalysis>,
    lang: 'es' | 'en',
): string {
    if (priorAnalyses.length === 0) return '';
    // Compact representation — we want the model to know what was
    // already established without re-feeding full structured data.
    const heading = lang === 'en'
        ? '### Prior accepted verse analyses (for continuity)'
        : '### Análisis verso a verso aceptados previamente (para continuidad)';
    const items = priorAnalyses.map(a => {
        const ref = formatPassageReference(a.reference, lang);
        const tx = a.finalTranslation || a.initialTranslation;
        const thesis = a.verseThesis;
        const commitments = a.translationCruxes
            .map(c => `  · "${c.phrase}" → "${c.commitment.chosen}"`)
            .join('\n');
        return [
            `**${ref}**`,
            `Translation: ${tx}`,
            `Thesis: ${thesis}`,
            commitments ? (lang === 'en' ? `Translation commitments:\n${commitments}` : `Compromisos de traducción:\n${commitments}`) : '',
        ].filter(Boolean).join('\n');
    });
    const joined = items.join('\n\n');
    return [heading, '', truncate(joined, PRIOR_ANALYSES_BUDGET_CHARS)].join('\n');
}

function formatStepEmphasis(
    emphasis: AnalyzeVerseInput['stepEmphasis'],
    lang: 'es' | 'en',
): string {
    if (!emphasis) return '';
    const e = emphasis.emphasizedTypes.join(', ');
    const d = emphasis.deemphasizedTypes.join(', ');
    if (!e && !d) return '';
    if (lang === 'en') {
        const lines = [`### Per-step emphasis (from rubric/strategy)`];
        if (e) lines.push(`- Prioritize types: ${e}.`);
        if (d) lines.push(`- De-emphasize types: ${d}.`);
        lines.push(``);
        return lines.join('\n');
    }
    const lines = [`### Énfasis para este paso (de la rúbrica/estrategia)`];
    if (e) lines.push(`- Priorizá tipos: ${e}.`);
    if (d) lines.push(`- Desénfasis en tipos: ${d}.`);
    lines.push(``);
    return lines.join('\n');
}

function formatCorpusGaps(
    missing: ReadonlyArray<{ sourceType: string; minimum: number; have: number }>,
    lang: 'es' | 'en',
): string {
    if (missing.length === 0) return '';
    const heading = lang === 'en'
        ? '## Corpus limitations (calibrate confidence flags accordingly)'
        : '## Limitaciones del corpus (calibrá confidence flags acordemente)';
    const intro = lang === 'en'
        ? 'The following source types the rubric expects are missing or insufficient. ANY claim in your output that would normally rest on a missing type MUST be flagged in confidenceFlags as "tentative" with appropriate hedge phrases. NEVER fabricate citations to replace missing sources.'
        : 'Los siguientes tipos de fuente esperados por la rúbrica faltan o son insuficientes. CUALQUIER afirmación en tu output que normalmente descansaría en un tipo faltante DEBE flagearse en confidenceFlags como "tentative" con frases hedge apropiadas. NUNCA fabriqués citas para reemplazar fuentes faltantes.';
    const items = missing.map(m => `- ${m.sourceType} (${m.have}/${m.minimum})`);
    return ['', heading, intro, ...items].join('\n');
}

function truncate(text: string, maxChars: number): string {
    if (!text) return '';
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + '\n\n[…contenido truncado para encajar en el contexto…]';
}


/**
 * Por qué el plan de corpus eligió estas fuentes para este paso.
 *
 * `StepSourcePlanEntry.note` llevaba escrito desde su primer día que era
 * «useful at generation time (the note is mentioned in the prompt)». No lo
 * era: ningún constructor de prompt la leía, y 108 de los 108 pasos con plan
 * en producción tienen una escrita.
 *
 * Entra rotulada como CONTEXTO y no como orden, a propósito. Dice cosas como
 * «Ancla: Mayor ofrece una perspectiva sintética del argumento», que explica
 * la estrategia del corpus; lo que el análisis AFIRME lo siguen decidiendo las
 * fuentes, no esta nota. Sin ese rótulo, una frase así se lee como una tesis
 * a defender.
 */
function formatPlanNote(note: string | null | undefined, lang: 'es' | 'en'): string {
    const texto = (note ?? '').trim();
    if (!texto) return '';
    return lang === 'en'
        ? `**Why this corpus for this step** (context for reading the sources, NOT a thesis to defend): ${texto}`
        : `**Por qué este corpus para este paso** (contexto para leer las fuentes, NO una tesis a defender): ${texto}`;
}
