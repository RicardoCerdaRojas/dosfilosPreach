import {
    type IIdeaPlacer,
    type PlaceIdeaInput,
    type PlaceIdeaOutput,
} from '@dosfilos/domain';
import { IDEA_PLACEMENT_SCHEMA, buildIdeaPlacementPrompt, parseIdeaPlacement } from './ideaPlacementPrompt';
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

export { IDEA_PLACEMENT_SCHEMA, buildIdeaPlacementPrompt, parseIdeaPlacement };
