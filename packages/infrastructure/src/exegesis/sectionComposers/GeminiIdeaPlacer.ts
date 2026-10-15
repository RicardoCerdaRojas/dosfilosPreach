import {
    buildAcademicRegisterBlock,
    type IIdeaPlacer,
    type IdeaPlacement,
    type PlaceIdeaInput,
    type PlaceIdeaOutput,
} from '@dosfilos/domain';
import { withGeminiRetry } from '../geminiRetry';
import { runLlmPromptWithUsage } from '../../llm/callableLlm';

/**
 * «Agregar una idea a esta sección»: redacta la idea del estudiante en una o
 * dos oraciones y dice DÓNDE va. No devuelve la sección: la inserción la hace
 * `insertIdea`, sobre el texto original, para que nada más cambie.
 */
export class GeminiIdeaPlacer implements IIdeaPlacer {
    private modelName: string;

    constructor(modelName?: string) {
        this.modelName = modelName || 'gemini-2.5-pro';
    }

    async placeIdea(input: PlaceIdeaInput): Promise<PlaceIdeaOutput> {
        const { systemInstruction, userMessage } = buildIdeaPlacementPrompt(input);
        const { text, tokensUsed, model } = await withGeminiRetry(
            () => runLlmPromptWithUsage({
                feature: 'exegesis.placeIdea',
                model: this.modelName,
                system: systemInstruction,
                prompt: userMessage,
                responseMimeType: 'application/json',
                responseSchema: IDEA_PLACEMENT_SCHEMA,
                temperature: 0.3,
                topP: 0.9,
                // Una o dos oraciones. Con margen para el razonamiento de
                // Gemini, que sale del mismo tope (revisión de la fase TP #7).
                maxOutputTokens: 8192,
            }),
            { contextLabel: 'GeminiIdeaPlacer' },
        );
        return { placement: parseIdeaPlacement(text), tokensUsed: tokensUsed ?? 0, modelId: model ?? this.modelName };
    }
}

export const IDEA_PLACEMENT_SCHEMA = {
    type: 'object',
    properties: {
        paragraphIndex: { type: 'integer', description: 'Número del párrafo donde entra la idea (el que va entre corchetes).' },
        afterSentence: {
            type: 'string',
            description: 'La oración de ESE párrafo, copiada exacta, después de la cual entra la idea. Vacía para ponerla al final del párrafo.',
        },
        sentence: { type: 'string', description: 'La idea redactada: una o dos oraciones, con la cita del estudiante tal cual.' },
    },
    required: ['paragraphIndex', 'afterSentence', 'sentence'],
} as const;

export function buildIdeaPlacementPrompt(input: PlaceIdeaInput): { systemInstruction: string; userMessage: string } {
    const en = input.language === 'en';
    const reglas = en
        ? [
            'You add ONE idea to an academic section that the student already wrote. You do NOT rewrite the section.',
            '- Write the idea as one or two sentences that fit where they go: same register, a connector that ties them to the previous sentence.',
            '- Keep every citation the student wrote EXACTLY as written, in the same sentence as what it supports. Add no other citation and no source the student did not name.',
            '- Do not add content the student did not give: no new claims, no intensifiers.',
            '- Choose the paragraph where the idea belongs and the sentence after which it reads naturally. Copy that sentence exactly as it appears.',
        ]
        : [
            'Agregas UNA idea a una sección académica que el estudiante ya escribió. NO reescribes la sección.',
            '- Redacta la idea en una o dos oraciones que encajen donde van: el mismo registro, un conector que las ate a la oración anterior.',
            '- Conserva cada cita que escribió el estudiante TAL CUAL, en la misma oración que lo que respalda. No agregues otra cita ni una fuente que el estudiante no nombró.',
            '- No agregues contenido que el estudiante no dio: ni afirmaciones nuevas ni intensificadores.',
            '- Elige el párrafo donde la idea pertenece y la oración después de la cual se lee natural. Copia esa oración exacta, como aparece.',
        ];
    const systemInstruction = [...reglas, '', buildAcademicRegisterBlock(input.language)].join('\n');
    const parrafos = input.paragraphs.map((p, i) => `[${i}] ${p}`).join('\n\n');
    const userMessage = en
        ? `SECTION (numbered paragraphs):\n\n${parrafos}\n\nIDEA TO ADD:\n${input.idea.trim()}`
        : `SECCIÓN (párrafos numerados):\n\n${parrafos}\n\nIDEA QUE HAY QUE AGREGAR:\n${input.idea.trim()}`;
    return { systemInstruction, userMessage };
}

export function parseIdeaPlacement(raw: string): IdeaPlacement {
    const limpio = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const data = JSON.parse(limpio) as Partial<IdeaPlacement>;
    const sentence = typeof data.sentence === 'string' ? data.sentence.trim() : '';
    if (!sentence) throw new Error('GeminiIdeaPlacer: la respuesta no trae la oración');
    return {
        paragraphIndex: typeof data.paragraphIndex === 'number' ? data.paragraphIndex : 0,
        afterSentence: typeof data.afterSentence === 'string' ? data.afterSentence : '',
        sentence,
    };
}
