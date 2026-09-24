import { fitPromptToCap } from '../../llm/promptBudget';
import {
    buildAcademicVoiceBlock,
    buildVerseCoverageContract,
    formatPassageReference,
    serializeAnalysis,
    verseSectionKey,
    type ComposeAcademicPaperInput,
    type ComposerSourceMetadata,
    type ExegeticalStrategy,
    type PaperRubric,
    type StyleGuideManifest,
} from '@dosfilos/domain';

/**
 * Prompt construction for the academic paper composer.
 *
 * Two-pronged like the analyzer:
 *   - System instruction defines the methodology + style-guide
 *     enforcement layer + TMS prose rules + non-negotiable
 *     commitments.
 *   - User message hands the actual data (verse analyses serialized
 *     as briefings + sources + style guide) and asks for the
 *     composition.
 *
 * The composer is NOT free-form. It works from structured analyses
 * already produced by `ICanonicalVerseAnalyzer`. Its job is to weave
 * them into prose, NOT to re-do the analysis. Hallucination guardrail:
 * only cite what the analyses cite; only commit to what the analyses
 * commit to.
 */

interface BuiltComposerPrompt {
    systemInstruction: string;
    userMessage: string;
}

const STYLE_GUIDE_BUDGET_CHARS = 25_000;

export function buildComposerPrompt(input: ComposeAcademicPaperInput): BuiltComposerPrompt {
    return {
        // La voz al final de la instrucción de sistema: es una regla de
        // REGISTRO, no material del pasaje.
        systemInstruction: [
            buildSystemInstruction(input),
            buildAcademicVoiceBlock(input.voiceSamples ?? [], input.language),
        ].filter(Boolean).join('\n\n'),
        userMessage: buildUserMessage(input),
    };
}

function buildSystemInstruction(input: ComposeAcademicPaperInput): string {
    const lang = input.language;
    const passage = formatPassageReference(input.paperPassage, lang);
    const styleGuideBlock = formatStyleGuide(input.styleGuideContent, input.styleGuideManifest, lang);
    const briefBlock = formatAssignmentBrief(input.assignmentBrief, lang);
    const rubricBlock = formatPaperRubric(input.paperRubric, lang);
    const strategyBlock = formatStrategy(input.exegeticalStrategy, lang);
    const fallbackDeclared = !input.styleGuideContent && !input.styleGuideManifest;

    if (lang === 'en') {
        return [
            `You are an academic writer producing a TMS-style exegetical research paper from PRE-COMPLETED structured verse analyses. The exegetical work is DONE — your job is composition, not analysis.`,
            ``,
            `## Paper`,
            `Passage: **${passage}**`,
            briefBlock,
            strategyBlock,
            rubricBlock,
            ``,
            `## Mandatory style-guide adherence`,
            fallbackDeclared
                ? `(NO style guide attached. Apply The Master's Seminary / Turabian conventions explicitly: footnotes for citations, Bibliographical entries with hanging indent, French quotation marks «...» for inline quotes, italics for foreign-language terms and book titles, sober academic register.)`
                : styleGuideBlock,
            ``,
            `## TMS academic prose rules (non-negotiable)`,
            `- CONTINUOUS PROSE in thematic paragraphs. NO numbered sections per verse ("1. Greek text", "2. Translation", etc.). NO bullet lists. NO morphology tables. Morphology integrates inline ("the masculine singular nominative «X» functions as a circumstantial temporal participle…").`,
            `- Each verse is composed as multiple thematic paragraphs (4-7 typical) closing with a SYNTHESIS PARAGRAPH that restates translation commitments + verse thesis. Use the formula: "For this reason, this paper will adopt the translation «X»…" → "In conclusion, [verse] presents…".`,
            `- Citations are inline and DISTRIBUTED across paragraphs, not batched. Format per the style guide; default to (Author, "Title", p. N) when no guide rules apply.`,
            `- Footnote markers \`[^N]\` placed at the anchor phrases specified in each verse's "Footnote extensions". Footnote definitions \`[^N]: ...\` go AT THE END of the paper, before the bibliography.`,
            `- Greek terms in French quotes «...» with translation in parentheses on first occurrence.`,
            `- Sober academic tone. No devotional language.`,
            ``,
            `## Nothing analyzed may be dropped (NON-NEGOTIABLE)`,
            `- Every briefing section — textual criticism, syntax, discourse particles, lexis, historical context, OT links, commentator positions, translation cruxes with their options and commitment, footnote extensions, verse thesis — MUST reach the paper. Weave them into the prose; do not summarize the verse by picking the three findings you liked best.`,
            `- What you leave out does not disappear: a deterministic pass measures each verse against its analysis and, where prose is missing content, REPLACES your entire verse section with a mechanical render of the structured data. Your prose survives only where it published everything.`,
            ``,
            `## Hallucination guardrail (NON-NEGOTIABLE)`,
            `- ONLY cite sources whose citation keys appear in the verse analyses' commentator engagement / lexical sources / footnote sources / historical context / OT-link sources. NEVER invent sources, page numbers, or quotes.`,
            `- ONLY commit to translation choices documented in each verse's "Translation cruxes". The closing synthesis paragraph restates THESE commitments — do not invent new ones.`,
            `- ONLY make claims supported by the structured analyses. The analyses include "Confidence flags" — match the hedge language to the level provided (high → "demonstrates"; medium → "argues"; tentative → "suggests").`,
            ``,
            `## Paper structure`,
            `Produce a single markdown document with this structure:`,
            `  # Title (the paper title or the formatted passage)`,
            `  ## Introduction (1-2 paragraphs presenting the passage's significance and the paper's thesis derived from the verse analyses' theses)`,
            `  ## Translation and exegetical analysis (verse-by-verse, prose, in canonical order; closing synthesis per verse)`,
            `    Each verse opens with its own heading \`### {verse reference}\`, spelled EXACTLY as the briefing's \`== Verse X ==\` label. The heading is a contract, not decoration: the pipeline reads it to check, verse by verse, that the analysis reached the page.`,
            `  ## Conclusion (1-2 paragraphs synthesizing the body's findings; no new arguments)`,
            `  [^N]: footnote bodies (anchored at \`[^N]\` markers in the prose)`,
            `  ## Bibliography (Turabian/SBL format per style guide; full entries for every cited source)`,
            ``,
            `Output MUST be a single markdown document, not JSON. Use semantic markdown headings (##, ###).`,
        ].filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n');
    }

    return [
        `Sos un redactor académico produciendo un trabajo exegético en estilo TMS a partir de análisis estructurados PRE-COMPLETADOS por verso. El trabajo exegético YA ESTÁ HECHO — tu tarea es composición, no análisis.`,
        ``,
        `## Paper`,
        `Pasaje: **${passage}**`,
        briefBlock,
        strategyBlock,
        rubricBlock,
        ``,
        `## Adherencia obligatoria a la guía de estilo`,
        fallbackDeclared
            ? `(SIN guía de estilo adjunta. Aplicá explícitamente convenciones The Master's Seminary / Turabian: notas al pie para citas, entradas bibliográficas con sangría francesa, comillas francesas «...» para citas inline, itálicas para términos en lenguas extranjeras y títulos de obras, registro académico sobrio.)`
            : styleGuideBlock,
        ``,
        `## Reglas de prosa académica TMS (no negociables)`,
        `- PROSA CONTINUA en párrafos temáticos. NO secciones numeradas por verso ("1. Texto Griego", "2. Traducción", etc.). NO listas con viñetas. NO tablas morfológicas. La morfología se integra inline ("el nominativo masculino singular «X» funciona como participio circunstancial temporal…").`,
        `- Cada verso se compone como varios párrafos temáticos (típicamente 4-7) cerrando con un PÁRRAFO DE SÍNTESIS que restablece compromisos de traducción + tesis del verso. Usá la fórmula: "Por esta razón, en este trabajo se adoptará la traducción «X»…" → "En conclusión, [verse] presenta…".`,
        `- Las citas son inline y DISTRIBUIDAS a lo largo de los párrafos, NO agrupadas. Formato según la guía de estilo; por defecto (Autor, "Título", p. N) cuando no hay reglas de la guía aplicables.`,
        `- Marcadores de nota al pie \`[^N]\` colocados en las frases ancla especificadas en "Footnote extensions" de cada verso. Las definiciones de notas \`[^N]: ...\` van AL FINAL del paper, antes de la bibliografía.`,
        `- Términos griegos entre comillas francesas «...» con traducción entre paréntesis en su primera ocurrencia.`,
        `- Tono académico sobrio. Sin lenguaje devocional.`,
        ``,
        `## Nada de lo analizado se descarta (NO NEGOCIABLE)`,
        `- Cada sección del briefing —crítica textual, sintaxis, partículas de discurso, léxico, contexto histórico, enlaces al AT, posiciones de comentaristas, cruces de traducción con sus opciones y su compromiso, extensiones de nota al pie, tesis del verso— TIENE que llegar al paper. Se integran en la prosa; el verso no se resume quedándose con los tres hallazgos que mejor suenan.`,
        `- Lo que dejes afuera no desaparece: un paso determinista mide cada verso contra su análisis y, donde la prosa no dice lo que el análisis afirmó, REEMPLAZA tu sección entera de ese verso por un render mecánico de los datos estructurados. Tu prosa sobrevive sólo donde publicó todo.`,
        ``,
        `## Salvaguarda contra alucinación (NO NEGOCIABLE)`,
        `- SOLO citá fuentes cuyas claves aparezcan en los análisis estructurados de los versos (commentator engagement / lexical sources / footnote sources / historical context / OT-link sources). NUNCA inventes fuentes, páginas o citas verbatim.`,
        `- SOLO comprometete con las traducciones documentadas en "Translation cruxes" de cada verso. El párrafo de cierre restablece ESOS compromisos — no inventes nuevos.`,
        `- SOLO hacé afirmaciones respaldadas por los análisis estructurados. Los análisis incluyen "Confidence flags" — calibrá el lenguaje hedge al nivel provisto (high → "demuestra"; medium → "sostiene"; tentative → "sugiere").`,
        ``,
        `## Estructura del paper`,
        `Producí un único documento markdown con esta estructura:`,
        `  # Título (el título del paper o el pasaje formateado)`,
        `  ## Introducción (1-2 párrafos presentando la significancia del pasaje y la tesis del paper derivada de las tesis de los versos)`,
        `  ## Traducción y análisis exegético (verso por verso, prosa, en orden canónico; párrafo de síntesis por verso)`,
        `    Cada verso abre con su propio encabezado \`### {referencia del verso}\`, escrito EXACTAMENTE como el rótulo \`== Verse X ==\` del briefing. El encabezado es un contrato, no decoración: la tubería lo lee para comprobar, verso por verso, que el análisis llegó a la página.`,
        `  ## Conclusión (1-2 párrafos sintetizando los hallazgos del cuerpo; sin argumentos nuevos)`,
        `  [^N]: cuerpos de notas al pie (anclados en los marcadores \`[^N]\` de la prosa)`,
        `  ## Bibliografía (formato Turabian/SBL según la guía de estilo; entradas completas para cada fuente citada)`,
        ``,
        `La salida DEBE ser un único documento markdown, NO JSON. Usá headings markdown semánticos (##, ###).`,
    ].filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * El mensaje del compositor, ajustado al tope del proxy.
 *
 * Lo que se recorta es el CONTENIDO de las fuentes fijadas, nunca los
 * briefings: los análisis son el trabajo que el alumno ya aceptó y son
 * irreemplazables, mientras que el texto de la fuente está para anclar
 * una cita y admite menos. El analizador ya se ajustaba así; este
 * compositor se había quedado con topes fijos que ignoraban el límite.
 */
function buildUserMessage(input: ComposeAcademicPaperInput): string {
    return fitPromptToCap(
        sourcesBlock => renderUserMessage(input, sourcesBlock),
        budget => formatSourceRegistry(input.sources, input.language, budget),
        PREFERRED_PINNED_CONTENT_BUDGET,
        'GeminiAcademicComposer',
    );
}

const PREFERRED_PINNED_CONTENT_BUDGET = 80_000;

function renderUserMessage(input: ComposeAcademicPaperInput, sourcesBlock: string): string {
    const lang = input.language;
    const passage = formatPassageReference(input.paperPassage, lang);

    const briefingsHeading = lang === 'en'
        ? '### Verse analysis briefings (the structured data you compose from)'
        : '### Briefings de análisis verso por verso (los datos estructurados desde los que componés)';
    // Las claves van junto al rótulo: sin ellas sólo se reetiquetan las
    // referencias estructuradas, y las menciones de página que el
    // análisis escribió en su prosa viajan con el número de hoja.
    const citableKeys = input.sources.map(s => s.citationKey).filter(Boolean);
    const briefings = input.verseAnalyses
        .map(a => serializeAnalysis(a, lang, { pageLabel: input.pageLabel, citableKeys }))
        .join('\n\n');

    const coverageContract = formatCoverageContract(input.verseAnalyses, lang);

    const sourcesHeading = lang === 'en'
        ? '### Source registry (use ONLY these citation keys)'
        : '### Registro de fuentes (usá SOLO estas claves de cita)';
    const pinnedBlock = formatPinnedContract(input.pinnedSourceKeys, lang);

    const titleLine = input.paperTitle && input.paperTitle.trim()
        ? input.paperTitle.trim()
        : passage;

    if (lang === 'en') {
        return [
            `Compose the academic paper for **${passage}**.`,
            `Title: ${titleLine}`,
            ``,
            pinnedBlock,
            briefingsHeading,
            ``,
            briefings,
            ``,
            coverageContract,
            sourcesHeading,
            ``,
            sourcesBlock,
            ``,
            `Now produce the full markdown document. Follow the system instruction's structure and rules without exception.`,
        ].filter(Boolean).join('\n');
    }

    return [
        `Componé el paper académico para **${passage}**.`,
        `Título: ${titleLine}`,
        ``,
        pinnedBlock,
        briefingsHeading,
        ``,
        briefings,
        ``,
        coverageContract,
        sourcesHeading,
        ``,
        sourcesBlock,
        ``,
        `Ahora producí el documento markdown completo. Seguí la estructura y reglas del system instruction sin excepción.`,
    ].filter(Boolean).join('\n');
}

/**
 * La materia que cada verso tiene que publicar, rotulada.
 *
 * Es la misma lista que después mide `enforceAnalysisCoverage`: el
 * compositor ve por adelantado con qué se lo va a medir, en vez de
 * enterarse cuando su sección ya fue reemplazada.
 */
function formatCoverageContract(
    analyses: ComposeAcademicPaperInput['verseAnalyses'],
    lang: 'es' | 'en',
): string {
    const blocks = analyses.map(analysis => {
        const items = buildVerseCoverageContract(analysis, lang);
        if (items.length === 0) return '';
        return [
            `#### ${verseSectionKey(analysis, lang)}`,
            ...items.map(i => `- ${i.label}`),
        ].join('\n');
    }).filter(Boolean);
    if (blocks.length === 0) return '';

    const heading = lang === 'en'
        ? '### Required material per verse (every point must appear in that verse\'s prose)'
        : '### Materia obligatoria por verso (cada punto tiene que aparecer en la prosa de su verso)';
    return [heading, '', ...blocks, ''].join('\n');
}

/**
 * Pinned-source contract block for the academic composer. Uses the
 * UNION of pinned keys across every step of the plan so the composer
 * verifies the global plan honor in one pass.
 */
function formatPinnedContract(keys: ReadonlyArray<string>, lang: 'es' | 'en'): string {
    if (keys.length === 0) return '';
    if (lang === 'en') {
        return [
            '### Plan-pinned source contract (CRITICAL — applies across the whole paper)',
            '',
            'The student\'s corpus plan pinned the following sourceKeys (union across intro / verses / conclusion). You MUST cite each one at least once across the full output (paraphrase or verbatim — the location is your choice, but every key MUST appear). Skipping any pinned source is a critical failure of the plan:',
            '',
            ...keys.map(k => `- \`${k}\``),
            '',
            'Non-pinned sources from the registry below may also appear when they strengthen the argument — but never as a SUBSTITUTE for a pinned one. The asymmetry rules (default 1 source for intro/conclusion, hard cap 2, never technical there; verses 2-3 with 4 ceiling) still hold.',
            '',
        ].join('\n');
    }
    return [
        '### Contrato global de fuentes asignadas (CRÍTICO — aplica a todo el paper)',
        '',
        'El plan de corpus del alumno asignó los siguientes sourceKeys (unión de intro / versos / conclusión). DEBES citar cada uno al menos una vez a lo largo del output completo (parafraseo o verbatim — la ubicación es tu elección, pero cada clave TIENE que aparecer). Saltarse una fuente asignada es una falla crítica del plan:',
        '',
        ...keys.map(k => `- \`${k}\``),
        '',
        'Las fuentes no-asignadas del registro abajo pueden aparecer cuando refuercen el argumento — pero nunca como SUSTITUTO de una asignada. Las reglas de asimetría (default 1 fuente para intro/conclusión, hard cap 2, nunca técnica ahí; versos 2-3 con techo 4) siguen aplicando.',
        '',
    ].join('\n');
}

// ── Formatters ──────────────────────────────────────────────────────────

function formatAssignmentBrief(brief: string | null, lang: 'es' | 'en'): string {
    if (!brief || !brief.trim()) return '';
    const heading = lang === 'en' ? '## Paper framing' : '## Encuadre del paper';
    return [``, heading, brief.trim()].join('\n');
}

/**
 * Renders the corpus-building strategy as a methodology block. The
 * dialectical mode tells the model the corpus was deliberately built
 * to balance anchors (lead reading) + contrasts (opposing voices) +
 * technical sources (lexicons / grammars), so prose should reflect
 * dialectical engagement rather than a flat citation list. Free mode
 * surfaces no methodology framing — the model treats sources as the
 * student supplied them.
 *
 * Exported because section composers build their prompts independently.
 */
export function formatStrategy(
    strategy: ExegeticalStrategy | null,
    lang: 'es' | 'en',
): string {
    if (strategy !== 'dialectical') return '';
    const heading = lang === 'en' ? '## Corpus methodology' : '## Metodología del corpus';
    if (lang === 'en') {
        return [
            ``,
            heading,
            `The student built the corpus dialectically — three roles in deliberate balance:`,
            `- **Anchors**: expository commentaries that supply the lead reading the paper engages.`,
            `- **Contrasts**: critical commentaries / monographs / theological dictionaries that surface alternative readings the paper must engage rather than dismiss.`,
            `- **Technical**: lexicons, grammars, and critical apparatus that ground word-level and syntactic claims.`,
            `Reflect this dialectical engagement in the prose: name competing readings explicitly when the body's analyses do, anchor lexical decisions in the technical sources, and present the synthesis as the resolution of a real interpretive tension rather than a flat assertion.`,
        ].join('\n');
    }
    return [
        ``,
        heading,
        `El alumno armó el corpus dialécticamente — tres roles en balance deliberado:`,
        `- **Anclas**: comentarios expositivos que aportan la lectura base que el paper engancha.`,
        `- **Contrastes**: comentarios críticos / monografías / diccionarios teológicos que surfacean lecturas alternativas que el paper debe enganchar, no descartar.`,
        `- **Técnicas**: léxicos, gramáticas y aparato crítico que anclan decisiones léxicas y sintácticas.`,
        `Reflejá ese engagement dialéctico en la prosa: nombrá lecturas competidoras explícitamente cuando los análisis del cuerpo lo hagan, anclá las decisiones léxicas en las fuentes técnicas, y presentá la síntesis como la resolución de una tensión interpretativa real — no como una aserción plana.`,
    ].join('\n');
}

/**
 * Renders the paper's rubric as a prompt block. Surfaces only the
 * fields the composer can act on: target length, citation standard,
 * source-type minimums (so the composer aims to engage them), and the
 * relevant section emphasis. Section composers (intro/conclusion)
 * filter `structuralExpectations` to their own section before
 * presenting; the academic composer surfaces all sections.
 *
 * Exported because section composers (Gemini Conclusion / Introduction)
 * build their prompts independently and need the same renderer.
 */
export function formatPaperRubric(
    rubric: PaperRubric | null,
    lang: 'es' | 'en',
    section?: 'introduction' | 'conclusion',
): string {
    if (!rubric) return '';
    const lines: string[] = [];
    const heading = lang === 'en' ? '## Rubric requirements' : '## Requisitos de la rúbrica';
    lines.push('', heading);

    if (rubric.description && rubric.description.trim()) {
        lines.push('', rubric.description.trim());
    }

    if (rubric.expectedLength) {
        const { unit, min, max } = rubric.expectedLength;
        const unitLabel = unit === 'pages'
            ? (lang === 'en' ? 'pages' : 'páginas')
            : (lang === 'en' ? 'words' : 'palabras');
        let range: string;
        if (min != null && max != null) range = `${min}–${max} ${unitLabel}`;
        else if (min != null) range = lang === 'en' ? `at least ${min} ${unitLabel}` : `al menos ${min} ${unitLabel}`;
        else if (max != null) range = lang === 'en' ? `up to ${max} ${unitLabel}` : `hasta ${max} ${unitLabel}`;
        else range = '';
        if (range) {
            lines.push(lang === 'en'
                ? `- **Target length**: ${range}. Calibrate paragraph density to land within this range.`
                : `- **Extensión esperada**: ${range}. Calibrá la densidad de los párrafos para caer dentro de este rango.`);
        }
    }

    if (rubric.citationStandard && rubric.citationStandard.trim()) {
        lines.push(lang === 'en'
            ? `- **Citation standard**: ${rubric.citationStandard.trim()}. Apply unless the attached style guide overrides it.`
            : `- **Estándar de citación**: ${rubric.citationStandard.trim()}. Aplicalo a menos que la guía de estilo adjunta lo sobrescriba.`);
    }

    if (rubric.sourceRequirements.length > 0) {
        const required = rubric.sourceRequirements.filter(r => r.minimum > 0);
        if (required.length > 0) {
            lines.push('');
            lines.push(lang === 'en'
                ? `**Source-type expectations** (the seminary requires the paper to engage these types — your prose should reflect that engagement, not just list them in the bibliography):`
                : `**Expectativas por tipo de fuente** (el seminario exige que el paper interactúe con estos tipos — tu prosa debe reflejar esa interacción, no solamente listarlos en la bibliografía):`);
            for (const req of required) {
                const range = req.maximum != null ? `${req.minimum}–${req.maximum}` : `≥${req.minimum}`;
                lines.push(`  - \`${req.sourceType}\` (${range}) — ${req.justification}`);
            }
        }
    }

    if (rubric.structuralExpectations.length > 0) {
        const relevant = section
            ? rubric.structuralExpectations.filter(e => e.section === section)
            : rubric.structuralExpectations;
        if (relevant.length > 0) {
            lines.push('');
            lines.push(lang === 'en'
                ? `**Section emphasis** (lead with these source types where applicable):`
                : `**Énfasis por sección** (priorizá estos tipos de fuente donde aplique):`);
            for (const exp of relevant) {
                const types = exp.emphasizedTypes.map(t => `\`${t}\``).join(', ');
                lines.push(`  - **${exp.section}**: ${types} — ${exp.justification}`);
            }
        }
    }

    // v1.7 qualitative grading criteria. When the rubric carries
    // levels-based criteria (Ejemplar / Competente / Aceptable /
    // Deficiente per dimension), surface them as a SEPARATE block
    // titled "Criterios cualitativos de evaluación" — distinct
    // semantically from the prescriptive expectations above. The
    // composer treats them as evaluation targets: the prose should
    // visibly satisfy the level descriptors of the "Ejemplar" (or
    // top) tier in each criterion.
    if (rubric.qualityCriteria.length > 0) {
        lines.push('');
        lines.push(lang === 'en'
            ? `## Qualitative grading criteria`
            : `## Criterios cualitativos de evaluación`);
        lines.push(lang === 'en'
            ? `The professor will grade this paper against the dimensions below. Target the TOP-LEVEL descriptor (first level in each list) — write prose that visibly satisfies it. The level descriptors are verbatim from the rubric; do not paraphrase them, but use them as benchmarks.`
            : `El profesor calificará este paper contra las siguientes dimensiones. Apuntá al descriptor de NIVEL SUPERIOR (primero de cada lista) — redactá prosa que lo satisfaga visiblemente. Los descriptores por nivel son textuales de la rúbrica; no los parafrasees, usalos como referencia.`);
        for (const crit of rubric.qualityCriteria) {
            lines.push('');
            const weight = typeof crit.maxPoints === 'number' ? ` (${crit.maxPoints} pts)` : '';
            lines.push(`### ${crit.name}${weight}`);
            if (crit.description) lines.push(crit.description);
            for (const level of crit.levels) {
                const pts = typeof level.points === 'number' ? ` — ${level.points} pts` : '';
                lines.push(`  - **${level.label}**${pts}: ${level.description}`);
            }
        }
    }

    return lines.length > 2 ? lines.join('\n') : '';
}

function formatStyleGuide(
    content: string,
    manifest: StyleGuideManifest | null,
    lang: 'es' | 'en',
): string {
    const lines: string[] = [];

    if (content && content.trim()) {
        const truncated = truncate(content, STYLE_GUIDE_BUDGET_CHARS);
        const heading = lang === 'en' ? `**Style guide content (verbatim)**` : `**Contenido de la guía de estilo (verbatim)**`;
        lines.push(heading);
        lines.push('```');
        lines.push(truncated);
        lines.push('```');
    }

    if (manifest) {
        const heading = lang === 'en' ? `**Structured manifest rules**` : `**Reglas estructuradas del manifest**`;
        lines.push('');
        lines.push(heading);
        lines.push('```json');
        lines.push(JSON.stringify(manifest, null, 2));
        lines.push('```');
        lines.push('');
        lines.push(lang === 'en'
            ? `Apply these rules in addition to the verbatim guide. The deterministic post-processor will rewrite citations per these templates after your composition — but produce prose that already follows them so the rewrites are minimal.`
            : `Aplicá estas reglas además de la guía verbatim. El post-procesador determinístico reescribirá las citas según estos templates después de tu composición — pero producí prosa que ya las siga para que las reescrituras sean mínimas.`);
    }

    if (lines.length === 0) {
        return lang === 'en'
            ? '(Style guide present but content empty. Apply TMS / Turabian defaults.)'
            : '(Guía de estilo presente pero contenido vacío. Aplicá defaults TMS / Turabian.)';
    }

    return lines.join('\n');
}

function formatSourceRegistry(
    sources: ReadonlyArray<ComposerSourceMetadata>,
    lang: 'es' | 'en',
    /**
     * Caracteres disponibles para el CONTENIDO de las fuentes fijadas,
     * repartidos entre ellas. Sin esto cada una traía hasta 80.000 por su
     * cuenta: con dos fijadas el mensaje pasaba el tope del servidor y el
     * paper no se podía componer —"prompt excede 200000 caracteres"— sin
     * que ningún tope individual pareciera excesivo.
     */
    pinnedContentBudget = 80_000,
): string {
    if (sources.length === 0) {
        return lang === 'en'
            ? '(No sources registered. Cite only what the analyses cite — but they should also be empty.)'
            : '(No hay fuentes registradas. Citá solamente lo que los análisis citen — aunque ellos también deberían estar vacíos.)';
    }
    const pinnedCount = sources.filter(s => s.isPinned && s.textContent?.trim()).length;
    const perPinned = pinnedCount > 0
        ? Math.max(0, Math.floor(pinnedContentBudget / pinnedCount))
        : 0;
    const blocks: string[] = [];
    for (const s of sources) {
        const parts: string[] = [`- **${s.citationKey}**${s.isPinned ? (lang === 'en' ? ' ⭐ PINNED' : ' ⭐ ASIGNADA') : ''}: ${s.author}, *${s.title}*`];
        if (s.seriesVolume) parts.push(`(${s.seriesVolume})`);
        if (s.edition) parts.push(`[${s.edition}]`);
        const pub: string[] = [];
        if (s.city) pub.push(s.city);
        if (s.publisher) pub.push(s.publisher);
        if (s.year) pub.push(String(s.year));
        if (pub.length > 0) parts.push(`(${pub.join(': ')})`);
        blocks.push(parts.join(' '));
        if (s.isPinned && s.textContent && s.textContent.trim()) {
            const truncated = s.textContent.length > perPinned
                ? s.textContent.slice(0, perPinned) + '\n[…content truncated…]'
                : s.textContent;
            const heading = lang === 'en'
                ? `\n  _Source content for grounding the pinned citation. Find the passage most relevant to ${s.citationKey}'s commentary on this paper's pericope and paraphrase or quote from there:_\n`
                : `\n  _Contenido de la fuente para anclar la cita asignada. Encontrá el pasaje más relevante del comentario de ${s.citationKey} sobre la perícopa de este paper y parafraseá o citá desde ahí:_\n`;
            blocks.push(heading + '  ```\n  ' + truncated.replace(/\n/g, '\n  ') + '\n  ```');
        }
    }
    return blocks.join('\n');
}

function truncate(text: string, maxChars: number): string {
    if (!text) return '';
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + '\n\n[…contenido truncado…]';
}
