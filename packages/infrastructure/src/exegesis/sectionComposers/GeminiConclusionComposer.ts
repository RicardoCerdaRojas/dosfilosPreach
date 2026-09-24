import {
    buildAcademicVoiceBlock,
    formatPassageReference,
    serializeAnalysis,
    type ComposeConclusionInput,
    type ComposeConclusionOutput,
    type ComposerSourceMetadata,
    type IConclusionComposer,
    type StyleGuideManifest,
} from '@dosfilos/domain';
import { withGeminiRetry } from '../geminiRetry';
import { runLlmPromptWithUsage } from '../../llm/callableLlm';
import { fitPromptToCap } from '../../llm/promptBudget';
import { formatPaperRubric, formatStrategy } from '../composer/composerPrompts';

/**
 * Gemini implementation of `IConclusionComposer`.
 *
 * Composes the conclusion section from the body's accepted verse
 * analyses. The prompt enforces academic methodology: no new
 * arguments, no new sources, no new analytic frame — synthesize
 * what the body established and articulate the thesis it actually
 * demonstrated.
 *
 * Output: 2-3 paragraphs of TMS-style academic prose. The use case
 * runs the deterministic style formatter post-composition.
 *
 * Configuration:
 *   - Model: Pro 2.5 by default. Synthesis benefits from Pro's
 *     reasoning.
 *   - Temperature: 0.4. Modest variation in connective tissue
 *     between paragraphs without drifting into invention.
 *   - Output tokens: 8k. Conclusions are SHORT — 8k provides ample
 *     headroom for 2-3 paragraphs even in dense Spanish prose.
 */
export class GeminiConclusionComposer implements IConclusionComposer {
    private modelName: string;

    constructor(modelName?: string) {
        this.modelName = modelName || 'gemini-2.5-pro';
    }

    async composeConclusion(input: ComposeConclusionInput): Promise<ComposeConclusionOutput> {
        const { systemInstruction, userMessage } = buildConclusionPrompt(input);

        console.log('[GeminiConclusionComposer] composing', {
            verseCount: input.verseAnalyses.length,
            sourceCount: input.sources.length,
            hasStyleGuide: Boolean(input.styleGuideContent || input.styleGuideManifest),
            language: input.language,
            pinnedKeysInPrompt: input.pinnedSourceKeys,
        });

        const { text: markdown, tokensUsed } = await withGeminiRetry(
            () => runLlmPromptWithUsage({
                feature: 'exegesis.composeConclusion',
                model: this.modelName,
                system: systemInstruction,
                prompt: userMessage,
                temperature: 0.4,
                topP: 0.9,
                maxOutputTokens: 8192,
            }),
            { contextLabel: 'GeminiConclusionComposer' },
        );

        return {
            markdown,
            modelId: this.modelName,
            tokensUsed,
            // Adapter doesn't run the deterministic formatter — that's
            // the use case's job. Always reports 'skipped' here; the
            // use case overrides to 'applied' / 'error'.
            formatterStatus: 'skipped',
        };
    }
}

// ── Prompt construction ─────────────────────────────────────────────────

export function buildConclusionPrompt(input: ComposeConclusionInput): { systemInstruction: string; userMessage: string } {
    const lang = input.language;
    const passage = formatPassageReference(input.paperPassage, lang);
    const styleGuideBlock = formatStyleGuide(input.styleGuideContent, input.styleGuideManifest, lang);
    const briefBlock = formatAssignmentBrief(input.assignmentBrief, lang);
    const rubricBlock = formatPaperRubric(input.paperRubric, lang, 'conclusion');
    const strategyBlock = formatStrategy(input.exegeticalStrategy, lang);
    const fallback = !input.styleGuideContent && !input.styleGuideManifest;

    const system = lang === 'en'
        ? [
            `You are an academic writer composing the CONCLUSION section of a TMS-style exegetical research paper.`,
            ``,
            `## Paper`,
            `Passage: **${passage}**`,
            briefBlock,
            strategyBlock,
            rubricBlock,
            ``,
            `## Mandatory style guide`,
            fallback
                ? `(NO style guide attached. Apply The Master's Seminary / Turabian conventions explicitly: footnotes for citations, French quotation marks «...», italics for foreign-language terms, sober academic register.)`
                : styleGuideBlock,
            ``,
            `## Hard rules for the conclusion`,
            `- Synthesize what the body's verse analyses ACTUALLY ESTABLISHED. Do NOT introduce new arguments, new sources, or new lines of inquiry.`,
            `- Restate the paper's thesis in the form the body demonstrated it — not the form the author originally hoped for.`,
            `- 2-3 paragraphs. NOT a checklist. Continuous academic prose.`,
            `- Citations sparingly: only when restating an exact verse-level claim that benefits from anchor citation. The bibliographic apparatus belongs to the body, not the conclusion.`,
            `- NO devotional language, NO pastoral application, NO modern relevance. Pure synthesis of what the analysis established.`,
            ``,
            `## Hallucination guardrail`,
            `- Only refer to ideas, decisions, and citations present in the verse analyses below. NEVER invent claims, citations, or commitments.`,
            `- Translation commitments mentioned in the conclusion must be ones the body's analyses actually adopted (in their \`translationCruxes.commitment\`).`,
            ``,
            `## Output`,
            `Single markdown block, 2-3 paragraphs. Start the section with a heading "## Conclusion" (English) or "## Conclusión" (Spanish), then the prose. No "##" sub-headings within.`,
        ].filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n')
        : [
            `Sos un redactor académico componiendo la sección de CONCLUSIÓN de un trabajo exegético TMS-style.`,
            ``,
            `## Paper`,
            `Pasaje: **${passage}**`,
            briefBlock,
            strategyBlock,
            rubricBlock,
            ``,
            `## Guía de estilo obligatoria`,
            fallback
                ? `(SIN guía de estilo adjunta. Aplicá explícitamente convenciones The Master's Seminary / Turabian: notas al pie para citas, comillas francesas «...», itálicas para términos en lenguas extranjeras, registro académico sobrio.)`
                : styleGuideBlock,
            ``,
            `## Reglas duras para la conclusión`,
            `- Sintetizá lo que los análisis verso por verso EFECTIVAMENTE ESTABLECIERON. NO introduzcas argumentos nuevos, fuentes nuevas, ni líneas de indagación nuevas.`,
            `- Reformulá la tesis del paper en la forma que el cuerpo demostró — no la forma que el autor inicialmente esperaba.`,
            `- 2-3 párrafos. NO un checklist. Prosa académica continua.`,
            `- Citas con moderación: solo al reformular un compromiso específico del cuerpo que se beneficia de cita ancla. El aparato bibliográfico pertenece al cuerpo, no a la conclusión.`,
            `- SIN lenguaje devocional, SIN aplicación pastoral, SIN relevancia contemporánea. Síntesis pura de lo que el análisis estableció.`,
            ``,
            `## Salvaguarda contra alucinación`,
            `- Solo referenciá ideas, decisiones y citas presentes en los análisis abajo. NUNCA inventes afirmaciones, citas o compromisos.`,
            `- Los compromisos de traducción mencionados deben ser los que los análisis del cuerpo efectivamente adoptaron (en su \`translationCruxes.commitment\`).`,
            ``,
            `## Salida`,
            `Un único bloque markdown, 2-3 párrafos. Comenzá la sección con un heading "## Conclusión", después la prosa. Sin sub-headings "##" adentro.`,
        ].filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n');

    // La voz del autor, al final de la instrucción de sistema y no en el
    // mensaje: es una regla de REGISTRO, no material del pasaje, y mezclarla
    // con los briefings la deja compitiendo con el contenido.
    const conVoz = [system, buildAcademicVoiceBlock(input.voiceSamples ?? [], lang)]
        .filter(Boolean).join('\n\n');

    const briefings = input.verseAnalyses.map(a => serializeAnalysis(a, lang)).join('\n\n');
    const pinnedBlock = formatPinnedContract(input.pinnedSourceKeys, lang);
    const hint = input.regenerationHint
        ? (lang === 'en'
            ? `\n\n### Regeneration hint\n${input.regenerationHint}\n`
            : `\n\n### Hint de regeneración\n${input.regenerationHint}\n`)
        : '';

    const userPrefix = lang === 'en'
        ? `Compose the conclusion section for the paper on **${passage}**.`
        : `Componé la sección de conclusión del paper sobre **${passage}**.`;
    const briefingsHeading = lang === 'en'
        ? '### Body — accepted verse analyses (synthesize from these only)'
        : '### Cuerpo — análisis verso por verso aceptados (sintetizá solo desde estos)';
    const sourcesHeading = lang === 'en'
        ? '### Source registry (cite only these keys)'
        : '### Registro de fuentes (citá solo estas claves)';

    const renderUser = (sourcesBlock: string) => [
        userPrefix,
        ``,
        pinnedBlock,
        briefingsHeading,
        ``,
        briefings,
        ``,
        sourcesHeading,
        ``,
        sourcesBlock,
        hint,
        ``,
        lang === 'en'
            ? `Now produce the conclusion. 2-3 paragraphs of continuous academic prose, opening with "## Conclusion".`
            : `Ahora producí la conclusión. 2-3 párrafos de prosa académica continua, abriendo con "## Conclusión".`,
    ].filter(Boolean).join('\n');

    // El contenido de las fuentes asignadas es lo único que se recorta: los
    // análisis aceptados y el hint del usuario entran siempre. Con dos fuentes
    // asignadas a 80.000 caracteres cada una, el mensaje pasaba el tope del
    // servidor y el paso fallaba con «prompt excede 200000 caracteres».
    const user = fitPromptToCap(
        renderUser,
        budget => formatSourceRegistry(input.sources, lang, budget),
        PREFERRED_PINNED_CONTENT_BUDGET,
        'GeminiConclusionComposer',
    );

    return { systemInstruction: conVoz, userMessage: user };
}

function formatAssignmentBrief(brief: string | null, lang: 'es' | 'en'): string {
    if (!brief || !brief.trim()) return '';
    const heading = lang === 'en' ? '## Paper framing' : '## Encuadre del paper';
    return [``, heading, brief.trim()].join('\n');
}

function formatStyleGuide(content: string, manifest: StyleGuideManifest | null, lang: 'es' | 'en'): string {
    const parts: string[] = [];
    if (content && content.trim()) {
        const truncated = content.length > 15_000 ? content.slice(0, 15_000) + '\n\n[…]' : content;
        parts.push(lang === 'en' ? '**Style guide (verbatim)**' : '**Guía de estilo (verbatim)**');
        parts.push('```');
        parts.push(truncated);
        parts.push('```');
    }
    if (manifest) {
        parts.push('');
        parts.push(lang === 'en' ? '**Structured manifest rules**' : '**Reglas estructuradas del manifest**');
        parts.push('```json');
        parts.push(JSON.stringify(manifest, null, 2));
        parts.push('```');
    }
    return parts.length === 0
        ? (lang === 'en'
            ? '(Style guide present but content empty. Apply TMS / Turabian defaults.)'
            : '(Guía de estilo presente pero contenido vacío. Aplicá defaults TMS / Turabian.)')
        : parts.join('\n');
}

/** Tope preferido para el contenido de TODAS las fuentes asignadas juntas. */
const PREFERRED_PINNED_CONTENT_BUDGET = 80_000;

function formatSourceRegistry(
    sources: ReadonlyArray<ComposerSourceMetadata>,
    lang: 'es' | 'en',
    /** Caracteres para el contenido de las fuentes asignadas, repartidos entre ellas. */
    pinnedContentBudget: number,
): string {
    if (sources.length === 0) {
        return lang === 'en' ? '(No sources configured.)' : '(Sin fuentes configuradas.)';
    }
    const pinnedCount = sources.filter(s => s.isPinned && s.textContent?.trim()).length;
    const perPinned = pinnedCount > 0 ? Math.max(0, Math.floor(pinnedContentBudget / pinnedCount)) : 0;
    const lines: string[] = [];
    for (const s of sources) {
        const badge = s.isPinned
            ? (lang === 'en' ? ' ⭐ PINNED' : ' ⭐ ASIGNADA')
            : '';
        lines.push(`- **${s.citationKey}**${badge}: ${s.author}, *${s.title}*`);
        if (s.isPinned && s.textContent && s.textContent.trim()) {
            // Se recorta DESPUÉS de sangrar: la sangría suma dos caracteres por
            // línea, y medir antes dejaba al bloque pasado de su presupuesto.
            const indented = s.textContent.replace(/\n/g, '\n  ');
            const truncated = indented.length > perPinned
                ? indented.slice(0, perPinned) + '\n  […content truncated to fit context window…]'
                : indented;
            const heading = lang === 'en'
                ? `\n  _Source content for grounding the pinned citation. Find the passage most relevant to ${s.citationKey}'s commentary on this paper's pericope and paraphrase or quote from there:_\n`
                : `\n  _Contenido de la fuente para anclar la cita asignada. Encontrá el pasaje más relevante del comentario de ${s.citationKey} sobre la perícopa de este paper y parafraseá o citá desde ahí:_\n`;
            lines.push(heading + '  ```\n  ' + truncated + '\n  ```');
        }
    }
    return lines.join('\n');
}

/**
 * Pinned-source contract block. Lists the keys the student's plan
 * pinned for the conclusion step and demands at least one citation
 * each. Empty string when no pinned keys (no plan ran or empty step
 * pin set).
 */
function formatPinnedContract(keys: ReadonlyArray<string>, lang: 'es' | 'en'): string {
    if (keys.length === 0) return '';
    if (lang === 'en') {
        return [
            '### Pinned-source contract for THIS conclusion (CRITICAL)',
            '',
            'The student\'s corpus plan pins the following sourceKeys to this conclusion step. You MUST cite each one at least once in the conclusion (paraphrase or verbatim). Skipping a pinned source is a critical failure of the plan; cross-pollinating with sources pinned for other steps does NOT count.',
            '',
            ...keys.map(k => `- \`${k}\``),
            '',
            'Asymmetry rules from the methodology still apply: default 1 source, hard cap 2, never technical (lexicons / grammars / apparatus). Pinned sources above respect those rules.',
            '',
        ].join('\n');
    }
    return [
        '### Contrato de fuentes asignadas para ESTA conclusión (CRÍTICO)',
        '',
        'El plan de corpus del alumno asigna los siguientes sourceKeys a este paso de conclusión. DEBES citar cada uno al menos una vez en la conclusión (parafraseo o verbatim). Saltarse una fuente asignada es una falla crítica del plan; cross-poll-inizar con fuentes asignadas a otros pasos NO cuenta.',
        '',
        ...keys.map(k => `- \`${k}\``),
        '',
        'Las reglas de asimetría de la metodología siguen aplicando: default 1 fuente, hard cap 2, nunca técnica (léxicos / gramáticas / aparato). Las fuentes asignadas arriba respetan esas reglas.',
        '',
    ].join('\n');
}
