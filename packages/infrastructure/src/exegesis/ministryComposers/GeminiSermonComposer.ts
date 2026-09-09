import {
    formatPassageReference,
    serializeAnalysis,
    type ComposeSermonInput,
    type ComposeSermonOutput,
    type ISermonComposer,
} from '@dosfilos/domain';
import { withGeminiRetry } from '../geminiRetry';
import { runLlmPromptWithUsage } from '../../llm/callableLlm';
import { LONG_GENERATION_TIMEOUT_MS } from '../../llm/llmTimeouts';
import {
    commonGuardrails,
    formatAssignmentBrief,
    formatSourceRegistry,
    regenerationHintBlock,
} from './sharedPromptBlocks';

/**
 * Gemini implementation of `ISermonComposer`.
 *
 * Produces an expository sermon from accepted canonical verse
 * analyses. Tone-driven structure (pastoral / expositivo /
 * narrativo). Output: outline + manuscript markdown ready for the
 * pulpit, ~25-40 minutes of preaching.
 *
 * Output cap: 32k tokens. A full-manuscript sermon for a 4-7 verse
 * pericope runs 8-15 pages of markdown ≈ 12-20k tokens. 32k provides
 * headroom for richer treatments without truncation.
 */
export class GeminiSermonComposer implements ISermonComposer {
    private modelName: string;

    constructor(modelName?: string) {
        this.modelName = modelName || 'gemini-2.5-pro';
    }

    async composeSermon(input: ComposeSermonInput): Promise<ComposeSermonOutput> {
        const { systemInstruction, userMessage } = buildSermonPrompt(input);

        console.log('[GeminiSermonComposer] composing', {
            tone: input.tone,
            verseCount: input.verseAnalyses.length,
            language: input.language,
        });

        const { text: markdown, tokensUsed } = await withGeminiRetry(
            () => runLlmPromptWithUsage({
                feature: 'exegesis.composeSermon',
                model: this.modelName,
                system: systemInstruction,
                prompt: userMessage,
                // Higher than analyzer because sermon prose benefits
                // from rhetorical variation (illustrations, rhythm).
                // Still bounded — we want tone-faithful, not creative
                // license.
                temperature: 0.5,
                topP: 0.92,
                maxOutputTokens: 32768,
            }, { timeoutMs: LONG_GENERATION_TIMEOUT_MS }),
            { contextLabel: 'GeminiSermonComposer' },
        );

        return { markdown, modelId: this.modelName, tokensUsed };
    }
}

function buildSermonPrompt(input: ComposeSermonInput): { systemInstruction: string; userMessage: string } {
    const lang = input.language;
    const passage = formatPassageReference(input.paperPassage, lang);
    const briefBlock = formatAssignmentBrief(input.assignmentBrief, lang);

    const toneBlock = (lang === 'en')
        ? toneInstructionsEn(input.tone)
        : toneInstructionsEs(input.tone);

    const system = lang === 'en'
        ? [
            `You are a homiletician composing an expository sermon from PRE-COMPLETED canonical verse analyses. The exegetical work is done — your job is faithful homiletic composition for the chosen tone.`,
            ``,
            `## Passage`,
            `**${passage}**`,
            briefBlock,
            ``,
            `## Sermon tone`,
            toneBlock,
            ``,
            commonGuardrails(lang),
            ``,
            `## Output format`,
            `Single markdown document with this structure:`,
            `  # Title (specific, sermon-worthy — not a generic restatement of the passage)`,
            `  *Big idea*: one-sentence proposition the sermon argues.`,
            `  ## Outline`,
            `    - I. ${'<'}main movement 1${'>'}`,
            `    - II. ${'<'}main movement 2${'>'}`,
            `    - III. ${'<'}main movement 3${'>'} (typical 3-4 movements; tone-driven)`,
            `  ## Introduction (1 paragraph — hook + thesis)`,
            `  ## Body (movement-by-movement; each movement: explanation grounded in the verse analyses, illustration, application)`,
            `  ## Conclusion (call to response)`,
            ``,
            `Tone-faithful, doctrinally grounded, exegetically honest. Citations sparingly when a commentator's specific contribution helps the explanation; otherwise let the text speak.`,
        ].filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n')
        : [
            `Sos un homileta componiendo un sermón expositivo a partir de análisis canónicos PRE-COMPLETADOS. El trabajo exegético está hecho — tu tarea es composición homilética fiel para el tono escogido.`,
            ``,
            `## Pasaje`,
            `**${passage}**`,
            briefBlock,
            ``,
            `## Tono del sermón`,
            toneBlock,
            ``,
            commonGuardrails(lang),
            ``,
            `## Formato de salida`,
            `Un único documento markdown con esta estructura:`,
            `  # Título (específico, digno de sermón — no una repetición genérica del pasaje)`,
            `  *Gran idea*: la proposición que el sermón argumenta, en una oración.`,
            `  ## Bosquejo`,
            `    - I. ${'<'}movimiento principal 1${'>'}`,
            `    - II. ${'<'}movimiento principal 2${'>'}`,
            `    - III. ${'<'}movimiento principal 3${'>'} (típicamente 3-4 movimientos; depende del tono)`,
            `  ## Introducción (1 párrafo — gancho + tesis)`,
            `  ## Cuerpo (movimiento por movimiento; cada uno: explicación anclada en los análisis, ilustración, aplicación)`,
            `  ## Conclusión (llamado a respuesta)`,
            ``,
            `Fiel al tono, doctrinalmente fundado, exegéticamente honesto. Citas con moderación cuando la contribución específica de un comentarista ayude a la explicación; de lo contrario que el texto hable.`,
        ].filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n');

    const briefings = input.verseAnalyses.map(a => serializeAnalysis(a, lang)).join('\n\n');
    const sourcesBlock = formatSourceRegistry(input.sources, lang);
    const briefingsHeading = lang === 'en'
        ? '### Verse analysis briefings (the structured data you compose from)'
        : '### Briefings de análisis verso por verso (datos estructurados desde los que componés)';
    const sourcesHeading = lang === 'en'
        ? '### Source registry (cite only these sparingly)'
        : '### Registro de fuentes (citar con moderación)';

    const user = [
        lang === 'en'
            ? `Compose the sermon for **${passage}** in '${input.tone}' tone.`
            : `Componé el sermón para **${passage}** en tono '${input.tone}'.`,
        ``,
        briefingsHeading,
        ``,
        briefings,
        ``,
        sourcesHeading,
        ``,
        sourcesBlock,
        regenerationHintBlock(input.regenerationHint, lang),
        ``,
        lang === 'en' ? `Now produce the full sermon markdown.` : `Ahora producí el sermón completo en markdown.`,
    ].join('\n');

    return { systemInstruction: system, userMessage: user };
}

function toneInstructionsEs(tone: ComposeSermonInput['tone']): string {
    if (tone === 'pastoral') {
        return [
            `Tono **pastoral**: cercano y orientado al cuidado de la grey. La voz del predicador se apoya en la autoridad del texto pero habla como pastor que conoce el rebaño.`,
            `- Aplicación rica, anclada en situaciones concretas de la vida congregacional.`,
            `- Lenguaje cálido pero no sentimental.`,
            `- Las decisiones exegéticas se mencionan brevemente, no se desarrollan extensivamente — el púlpito no es la cátedra.`,
        ].join('\n');
    }
    if (tone === 'expositivo') {
        return [
            `Tono **expositivo**: estructura clásica con divisiones claras. Cada sección del texto da forma a un punto del sermón.`,
            `- Bosquejo simétrico, transiciones explícitas.`,
            `- Explicación → ilustración → aplicación por cada movimiento.`,
            `- Las decisiones exegéticas clave (cruces de traducción, partículas discursivas) se nombran porque sirven a la claridad estructural.`,
        ].join('\n');
    }
    return [
        `Tono **narrativo**: construido sobre el arco del relato bíblico. Las divisiones siguen el flujo dramático del texto, no una estructura impuesta.`,
        `- El sermón tiene tensión narrativa: situación inicial → complicación → clímax → resolución.`,
        `- Aplicación emerge del arco, no como sección añadida al final.`,
        `- Cuidado de no abandonar la fidelidad exegética: el texto manda el arco, no la imaginación del predicador.`,
    ].join('\n');
}

function toneInstructionsEn(tone: ComposeSermonInput['tone']): string {
    if (tone === 'pastoral') {
        return [
            `**Pastoral** tone: close, shepherd-like. Preacher's voice rests on the text's authority but speaks as a pastor who knows the flock.`,
            `- Rich application anchored in concrete congregational realities.`,
            `- Warm but not sentimental.`,
            `- Exegetical decisions mentioned briefly, not developed at length — the pulpit isn't the lectern.`,
        ].join('\n');
    }
    if (tone === 'expositivo') {
        return [
            `**Expository** tone: classic outline with clear divisions. Each section of the text shapes a sermon point.`,
            `- Symmetric outline, explicit transitions.`,
            `- Explanation → illustration → application per movement.`,
            `- Key exegetical decisions (translation cruxes, discourse particles) named because they serve structural clarity.`,
        ].join('\n');
    }
    return [
        `**Narrative** tone: built on the biblical text's narrative arc. Divisions follow the dramatic flow, not an imposed structure.`,
        `- Sermon carries narrative tension: setup → complication → climax → resolution.`,
        `- Application emerges from the arc, not appended at the end.`,
        `- Careful not to abandon exegetical fidelity: the text drives the arc, not the preacher's imagination.`,
    ].join('\n');
}
