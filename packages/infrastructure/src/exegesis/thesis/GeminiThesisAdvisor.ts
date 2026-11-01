import type { IThesisAdvisor, ThesisAdvisorInput, ThesisProposal, ThesisReview } from '@dosfilos/domain';
import { withGeminiRetry } from '../geminiRetry';
import { runLlmPromptWithUsage } from '../../llm/callableLlm';
import {
    THESIS_PROPOSAL_SCHEMA,
    THESIS_REVIEW_SCHEMA,
    buildThesisProposalPrompt,
    buildThesisReviewPrompt,
    fitThesisPrompt,
    parseThesisProposals,
    parseThesisReview,
} from './thesisPrompt';
import { HEADINGS_SCHEMA, buildHeadingsPrompt, parseHeadings } from './headingsPrompt';

/**
 * Proponer y revisar la tesis (fase «Lecciones del TI #2», etapa 3.3). El
 * modelo lo decide el ruteo (`exegesis.proposeThesis`, `exegesis.reviewThesis`);
 * se midió con gpt-6.1-sol y razonamiento bajo. Temperatura baja: dos
 * revisiones de la misma tesis tienen que decir lo mismo.
 */
export class GeminiThesisAdvisor implements IThesisAdvisor {
    private modelName: string;

    constructor(modelName?: string) {
        this.modelName = modelName || 'gemini-2.5-pro';
    }

    async propose(input: ThesisAdvisorInput): Promise<{ proposals: ThesisProposal[]; modelId: string; tokensUsed: number | null }> {
        const { system, user } = fitThesisPrompt(input, buildThesisProposalPrompt, 'GeminiThesisAdvisor.propose');
        const { text, tokensUsed, model } = await withGeminiRetry(
            () => runLlmPromptWithUsage({
                feature: 'exegesis.proposeThesis',
                model: this.modelName,
                system,
                prompt: user,
                responseMimeType: 'application/json',
                responseSchema: THESIS_PROPOSAL_SCHEMA as never,
                temperature: 0.3,
                topP: 0.9,
                maxOutputTokens: 8192,
            }),
            { contextLabel: 'GeminiThesisAdvisor.propose' },
        );
        return { proposals: parseThesisProposals(text), tokensUsed: tokensUsed ?? null, modelId: model ?? this.modelName };
    }

    async proposeHeadings(input: Parameters<IThesisAdvisor['proposeHeadings']>[0]): Promise<{ headings: Record<string, string>; modelId: string; tokensUsed: number | null }> {
        const { system, user } = fitThesisPrompt(input, buildHeadingsPrompt, 'GeminiThesisAdvisor.proposeHeadings');
        const { text, tokensUsed, model } = await withGeminiRetry(
            () => runLlmPromptWithUsage({
                feature: 'exegesis.proposeHeadings',
                model: this.modelName,
                system,
                prompt: user,
                responseMimeType: 'application/json',
                responseSchema: HEADINGS_SCHEMA as never,
                temperature: 0.3,
                topP: 0.9,
                maxOutputTokens: 2048,
            }),
            { contextLabel: 'GeminiThesisAdvisor.proposeHeadings' },
        );
        return { headings: parseHeadings(text, input.verses.map(v => v.key)), tokensUsed: tokensUsed ?? null, modelId: model ?? this.modelName };
    }

    async review(input: ThesisAdvisorInput & { thesis: string }): Promise<ThesisReview & { modelId: string; tokensUsed: number | null }> {
        const { system, user } = fitThesisPrompt(input, buildThesisReviewPrompt, 'GeminiThesisAdvisor.review');
        const { text, tokensUsed, model } = await withGeminiRetry(
            () => runLlmPromptWithUsage({
                feature: 'exegesis.reviewThesis',
                model: this.modelName,
                system,
                prompt: user,
                responseMimeType: 'application/json',
                responseSchema: THESIS_REVIEW_SCHEMA as never,
                temperature: 0.2,
                topP: 0.9,
                maxOutputTokens: 8192,
            }),
            { contextLabel: 'GeminiThesisAdvisor.review' },
        );
        return { ...parseThesisReview(text), tokensUsed: tokensUsed ?? null, modelId: model ?? this.modelName };
    }
}
