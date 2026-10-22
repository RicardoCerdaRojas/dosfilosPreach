import type { IProseReviewer, ProseReviewInput, ProseReviewOutput } from '@dosfilos/domain';
import { withGeminiRetry } from '../geminiRetry';
import { runLlmPromptWithUsage } from '../../llm/callableLlm';
import { PROSE_REVIEW_SCHEMA, buildProseReviewPrompt, parseProseReview } from './proseReviewPrompt';

/**
 * «Revisión antes de entregar»: la prosa de un versículo contra los criterios
 * del curso (TP #8, 8b, E3). Temperatura baja: dos pasadas sobre la misma
 * prosa tienen que señalar lo mismo, no inventar hallazgos por variar.
 */
export class GeminiProseReviewer implements IProseReviewer {
    private modelName: string;

    constructor(modelName?: string) {
        this.modelName = modelName || 'gemini-2.5-pro';
    }

    async review(input: ProseReviewInput): Promise<ProseReviewOutput> {
        const { systemInstruction, userMessage } = buildProseReviewPrompt(input);
        const { text, tokensUsed, model } = await withGeminiRetry(
            () => runLlmPromptWithUsage({
                feature: 'exegesis.reviewProse',
                model: this.modelName,
                system: systemInstruction,
                prompt: userMessage,
                responseMimeType: 'application/json',
                responseSchema: PROSE_REVIEW_SCHEMA,
                temperature: 0.2,
                topP: 0.9,
                maxOutputTokens: 8192,
            }),
            { contextLabel: 'GeminiProseReviewer' },
        );
        return {
            findings: parseProseReview(text, input.prose, input.criteria.length),
            tokensUsed: tokensUsed ?? null,
            modelId: model ?? this.modelName,
        };
    }
}

export { PROSE_REVIEW_SCHEMA, buildProseReviewPrompt, parseProseReview };
