import {
    formatPassageReference,
    serializeAnalysis,
    type ComposeDevotionalInput,
    type ComposeDevotionalOutput,
    type IDevotionalComposer,
} from '@dosfilos/domain';
import { withGeminiRetry } from '../geminiRetry';
import { runLlmPromptWithUsage } from '../../llm/callableLlm';
import {
    commonGuardrails,
    formatAssignmentBrief,
    formatSourceRegistry,
    regenerationHintBlock,
} from './sharedPromptBlocks';

/**
 * Gemini implementation of `IDevotionalComposer`.
 *
 * Produces an accessible devotional reflection (1-2 pages) anchored
 * in the verse analyses. Audience-driven: general audience leans
 * conversational; small-group adds discussion prompts; individual
 * leans contemplative.
 *
 * Length cap: 8k tokens. Devotionals are SHORT.
 */
export class GeminiDevotionalComposer implements IDevotionalComposer {
    private modelName: string;

    constructor(modelName?: string) {
        this.modelName = modelName || 'gemini-2.5-pro';
    }

    async composeDevotional(input: ComposeDevotionalInput): Promise<ComposeDevotionalOutput> {
        const { systemInstruction, userMessage } = buildDevotionalPrompt(input);

        console.log('[GeminiDevotionalComposer] composing', {
            audience: input.audience,
            verseCount: input.verseAnalyses.length,
            language: input.language,
        });

        const { text: markdown, tokensUsed } = await withGeminiRetry(
            () => runLlmPromptWithUsage({
                feature: 'exegesis.composeDevotional',
                model: this.modelName,
                system: systemInstruction,
                prompt: userMessage,
                temperature: 0.5,
                topP: 0.92,
                maxOutputTokens: 8192,
            }),
            { contextLabel: 'GeminiDevotionalComposer' },
        );

        return { markdown, modelId: this.modelName, tokensUsed };
    }
}

function buildDevotionalPrompt(input: ComposeDevotionalInput): { systemInstruction: string; userMessage: string } {
    const lang = input.language;
    const passage = formatPassageReference(input.paperPassage, lang);
    const briefBlock = formatAssignmentBrief(input.assignmentBrief, lang);
    const audienceBlock = (lang === 'en') ? audienceInstructionsEn(input.audience) : audienceInstructionsEs(input.audience);

    const system = lang === 'en'
        ? [
            `You compose devotional reflections from PRE-COMPLETED canonical verse analyses. The exegetical work is done — your job is to translate the findings into accessible spiritual reflection without losing fidelity.`,
            ``,
            `## Passage`,
            `**${passage}**`,
            briefBlock,
            ``,
            `## Audience`,
            audienceBlock,
            ``,
            commonGuardrails(lang),
            ``,
            `## Output`,
            `Single markdown document, 1-2 pages. Suggested structure:`,
            `  # Title (evocative, accessible — not academic)`,
            `  > Short scripture quote — one phrase from the passage that crystallizes the reflection.`,
            `  Body (3-5 paragraphs of reflection grounded in the analysis).`,
            `  Closing prayer or contemplation prompt (1 paragraph).`,
            ``,
            `Avoid jargon (greek terms only when truly needed and translated). Avoid moralizing. Anchor every claim in what the analyses establish.`,
        ].filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n')
        : [
            `Componés reflexiones devocionales a partir de análisis canónicos PRE-COMPLETADOS. El trabajo exegético está hecho — tu tarea es traducir los hallazgos en reflexión espiritual accesible sin perder fidelidad.`,
            ``,
            `## Pasaje`,
            `**${passage}**`,
            briefBlock,
            ``,
            `## Audiencia`,
            audienceBlock,
            ``,
            commonGuardrails(lang),
            ``,
            `## Salida`,
            `Un único documento markdown, 1-2 páginas. Estructura sugerida:`,
            `  # Título (evocador, accesible — no académico)`,
            `  > Cita bíblica breve — una frase del pasaje que cristaliza la reflexión.`,
            `  Cuerpo (3-5 párrafos de reflexión anclada en el análisis).`,
            `  Oración de cierre o prompt contemplativo (1 párrafo).`,
            ``,
            `Evita jerga (términos griegos solo cuando sean realmente necesarios y siempre traducidos). Evita moralización. Ancla cada afirmación en lo que los análisis establecen.`,
        ].filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n');

    const briefings = input.verseAnalyses.map(a => serializeAnalysis(a, lang)).join('\n\n');
    const sourcesBlock = formatSourceRegistry(input.sources, lang);
    const briefingsHeading = lang === 'en'
        ? '### Verse analysis briefings (compose from these only)'
        : '### Briefings de análisis (compón solo desde estos)';
    const sourcesHeading = lang === 'en'
        ? '### Source registry (devotionals usually cite none — use only if a particular phrasing is irreplaceable)'
        : '### Registro de fuentes (los devocionales usualmente no citan — usar solo si una formulación particular es irremplazable)';

    const user = [
        lang === 'en'
            ? `Compose the devotional for **${passage}** addressed to '${input.audience}' audience.`
            : `Compón el devocional para **${passage}** dirigido a audiencia '${input.audience}'.`,
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
        lang === 'en' ? `Produce the devotional now.` : `Produce el devocional ahora.`,
    ].join('\n');

    return { systemInstruction: system, userMessage: user };
}

function audienceInstructionsEs(audience: ComposeDevotionalInput['audience']): string {
    if (audience === 'small-group') {
        return [
            `**Pequeño grupo**: el devocional será leído en grupo y discutido. Estructura ligeramente más larga.`,
            `- Termina con 2-3 preguntas para guiar conversación honesta.`,
            `- Tono inclusivo (nosotros / juntos / en comunidad).`,
        ].join('\n');
    }
    if (audience === 'individual') {
        return [
            `**Reflexión individual**: contemplativa, para tiempo personal con Dios.`,
            `- Más espacio para silencio y meditación.`,
            `- Termina con un prompt contemplativo o de oración personal.`,
        ].join('\n');
    }
    return [
        `**Audiencia general**: lectores de un blog devocional o redes sociales. Accesible, sin asumir formación teológica.`,
        `- Lenguaje conversacional, párrafos cortos.`,
        `- Termina con una pregunta abierta o invitación a respuesta.`,
    ].join('\n');
}

function audienceInstructionsEn(audience: ComposeDevotionalInput['audience']): string {
    if (audience === 'small-group') {
        return [
            `**Small group**: the devotional is read together and discussed. Slightly longer structure.`,
            `- Ends with 2-3 questions to guide honest conversation.`,
            `- Inclusive tone (we / together / in community).`,
        ].join('\n');
    }
    if (audience === 'individual') {
        return [
            `**Individual reflection**: contemplative, for personal time with God.`,
            `- More space for silence and meditation.`,
            `- Ends with a contemplative prompt or personal prayer.`,
        ].join('\n');
    }
    return [
        `**General audience**: readers of a devotional blog or social media. Accessible, no theological formation assumed.`,
        `- Conversational language, short paragraphs.`,
        `- Ends with an open question or invitation to respond.`,
    ].join('\n');
}
