import {
    formatPassageReference,
    serializeAnalysis,
    type ComposeStudyGuideInput,
    type ComposeStudyGuideOutput,
    type IStudyGuideComposer,
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
 * Gemini implementation of `IStudyGuideComposer`.
 *
 * Produces an inductive Bible study guide following the
 * Observation → Interpretation → Application (OIA) framework.
 * Audience drives the depth and tone of questions.
 *
 * Length cap: 16k tokens.
 */
export class GeminiStudyGuideComposer implements IStudyGuideComposer {
    private modelName: string;

    constructor(modelName?: string) {
        this.modelName = modelName || 'gemini-2.5-pro';
    }

    async composeStudyGuide(input: ComposeStudyGuideInput): Promise<ComposeStudyGuideOutput> {
        const { systemInstruction, userMessage } = buildStudyGuidePrompt(input);

        console.log('[GeminiStudyGuideComposer] composing', {
            audience: input.audience,
            verseCount: input.verseAnalyses.length,
            language: input.language,
        });

        const { text: markdown, tokensUsed } = await withGeminiRetry(
            () => runLlmPromptWithUsage({
                feature: 'exegesis.composeStudyGuide',
                model: this.modelName,
                system: systemInstruction,
                prompt: userMessage,
                temperature: 0.45,
                topP: 0.92,
                maxOutputTokens: 16384,
            }, { timeoutMs: LONG_GENERATION_TIMEOUT_MS }),
            { contextLabel: 'GeminiStudyGuideComposer' },
        );

        return { markdown, modelId: this.modelName, tokensUsed };
    }
}

function buildStudyGuidePrompt(input: ComposeStudyGuideInput): { systemInstruction: string; userMessage: string } {
    const lang = input.language;
    const passage = formatPassageReference(input.paperPassage, lang);
    const briefBlock = formatAssignmentBrief(input.assignmentBrief, lang);
    const audienceBlock = (lang === 'en') ? audienceInstructionsEn(input.audience) : audienceInstructionsEs(input.audience);

    const system = lang === 'en'
        ? [
            `You compose inductive Bible study guides from PRE-COMPLETED canonical verse analyses. The exegetical work is done — your job is to translate the findings into well-crafted OIA questions (Observation → Interpretation → Application) appropriate to the audience.`,
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
            `## OIA framework`,
            `- **Observation**: what the text says (questions about words, structure, repetitions, contrasts grounded in the syntactic + lexical analyses).`,
            `- **Interpretation**: what the text means (questions that draw out the verseTheses, translation commitments, and historical/cultural background — anchored in the analyses, never speculative).`,
            `- **Application**: how the text changes the reader (questions that invite response, anchored in the theologicalHooks each analysis surfaces).`,
            ``,
            `## Output`,
            `Single markdown document with this structure:`,
            `  # Title (clear, descriptive — names the passage's central concern)`,
            `  ## Read the passage`,
            `  > {full passage text in the user's language; mark each verse}`,
            `  ## Observation`,
            `    - Question 1...`,
            `    - Question 2...`,
            `    (4-6 questions)`,
            `  ## Interpretation`,
            `    - Question 1...`,
            `    (4-6 questions; for each, briefly indicate the analysis or commitment that grounds the answer — leader's note in italics)`,
            `  ## Application`,
            `    - Question 1...`,
            `    (3-4 questions)`,
            `  ## Leader notes (optional, only when audience='small-group' or 'sunday-school')`,
            `    - Brief guidance for the leader on common misreadings + the answers the analyses support.`,
            ``,
            `Questions are open-ended (avoid yes/no). The leader's notes never spoiler-state — they orient the leader without dictating answers.`,
        ].filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n')
        : [
            `Componés guías de estudio bíblico inductivo a partir de análisis canónicos PRE-COMPLETADOS. El trabajo exegético está hecho — tu tarea es traducir los hallazgos en preguntas OIA bien construidas (Observación → Interpretación → Aplicación) apropiadas a la audiencia.`,
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
            `## Marco OIA`,
            `- **Observación**: qué dice el texto (preguntas sobre palabras, estructura, repeticiones, contrastes ancladas en los análisis sintáctico + léxico).`,
            `- **Interpretación**: qué significa el texto (preguntas que extraen las verseTheses, compromisos de traducción y trasfondo histórico/cultural — ancladas en los análisis, nunca especulativas).`,
            `- **Aplicación**: cómo el texto transforma al lector (preguntas que invitan respuesta, ancladas en los theologicalHooks que cada análisis surfacea).`,
            ``,
            `## Salida`,
            `Un único documento markdown con esta estructura:`,
            `  # Título (claro, descriptivo — nombra la preocupación central del pasaje)`,
            `  ## Lee el pasaje`,
            `  > {texto completo del pasaje en el idioma del usuario; marcá cada versículo}`,
            `  ## Observación`,
            `    - Pregunta 1...`,
            `    - Pregunta 2...`,
            `    (4-6 preguntas)`,
            `  ## Interpretación`,
            `    - Pregunta 1...`,
            `    (4-6 preguntas; para cada una, indicá brevemente el análisis o compromiso que ancla la respuesta — nota del líder en itálicas)`,
            `  ## Aplicación`,
            `    - Pregunta 1...`,
            `    (3-4 preguntas)`,
            `  ## Notas del líder (opcional, solo si audience='small-group' o 'sunday-school')`,
            `    - Orientación breve para el líder sobre malas lecturas comunes + las respuestas que los análisis sostienen.`,
            ``,
            `Las preguntas son abiertas (evitá sí/no). Las notas del líder nunca spoilean — orientan sin dictar respuestas.`,
        ].filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n');

    const briefings = input.verseAnalyses.map(a => serializeAnalysis(a, lang)).join('\n\n');
    const sourcesBlock = formatSourceRegistry(input.sources, lang);
    const briefingsHeading = lang === 'en'
        ? '### Verse analysis briefings (the data your questions must be grounded in)'
        : '### Briefings de análisis (los datos en los que tus preguntas deben anclarse)';
    const sourcesHeading = lang === 'en'
        ? '### Source registry (study guides usually cite no commentators in the questions themselves)'
        : '### Registro de fuentes (las guías de estudio usualmente no citan comentaristas en las preguntas)';

    const user = [
        lang === 'en'
            ? `Compose the inductive study guide for **${passage}** for '${input.audience}' audience.`
            : `Componé la guía de estudio inductivo para **${passage}** para audiencia '${input.audience}'.`,
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
        lang === 'en' ? `Now produce the study guide markdown.` : `Ahora producí la guía de estudio en markdown.`,
    ].join('\n');

    return { systemInstruction: system, userMessage: user };
}

function audienceInstructionsEs(audience: ComposeStudyGuideInput['audience']): string {
    if (audience === 'small-group') {
        return [
            `**Pequeño grupo**: adultos con formación bíblica básica. Discusión guiada por un líder.`,
            `- Preguntas que generan conversación honesta, no sólo respuestas correctas.`,
            `- Incluí "Notas del líder" para orientación.`,
        ].join('\n');
    }
    if (audience === 'sunday-school') {
        return [
            `**Escuela Dominical**: clase con instructor formado, edades mixtas o adultos.`,
            `- Preguntas más estructuradas, ritmo de clase (45-60 min).`,
            `- Notas del líder más detalladas con anclas a los análisis.`,
        ].join('\n');
    }
    return [
        `**Estudio individual**: lector con voluntad de profundizar pero solo.`,
        `- Preguntas que el lector se hace a sí mismo.`,
        `- Sin notas del líder; cada pregunta carga su propia orientación implícita.`,
    ].join('\n');
}

function audienceInstructionsEn(audience: ComposeStudyGuideInput['audience']): string {
    if (audience === 'small-group') {
        return [
            `**Small group**: adults with basic biblical formation. Discussion led by a leader.`,
            `- Questions that generate honest conversation, not only correct answers.`,
            `- Include "Leader notes" for guidance.`,
        ].join('\n');
    }
    if (audience === 'sunday-school') {
        return [
            `**Sunday school**: class with a formed instructor, mixed ages or adults.`,
            `- More structured questions, class pacing (45-60 min).`,
            `- Detailed leader notes anchored to the analyses.`,
        ].join('\n');
    }
    return [
        `**Individual study**: reader with desire to dig deeper, alone.`,
        `- Questions the reader asks themselves.`,
        `- No leader notes; each question carries its own implicit guidance.`,
    ].join('\n');
}
