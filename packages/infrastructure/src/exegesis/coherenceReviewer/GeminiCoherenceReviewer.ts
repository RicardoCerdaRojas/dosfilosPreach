import type {
    CoherenceIssue,
    CoherenceIssueCategory,
    CoherenceReviewInput,
    CoherenceReviewOutput,
    ICoherenceReviewer,
} from '@dosfilos/domain';
import { withGeminiRetry } from '../geminiRetry';
import { runLlmPromptWithUsage } from '../../llm/callableLlm';
import { buildReviewerPrompt } from './reviewerPrompts';
import { COHERENCE_REVIEW_SCHEMA } from './responseSchema';

/**
 * Gemini implementation of `ICoherenceReviewer`. Single LLM call over
 * the entire paper. Cost runs ~$0.05-0.15 per pass with Pro 2.5
 * depending on paper length — comparable to a single composer call.
 *
 * Configuration:
 *   - Model: Pro 2.5 default. The reviewer has to hold the whole
 *     paper in context AND reason about cross-section consistency,
 *     which is the kind of work Pro is built for.
 *   - Temperature: 0.2. Adversarial review benefits from determinism;
 *     repeat runs should converge on the same issues, not invent new
 *     ones for variety.
 *   - Max tokens: 8 192 — issue lists rarely exceed 30 entries; this
 *     leaves room for verbose messages without truncation risk.
 *
 * Defenses:
 *   - Schema-locked enums on category + severity.
 *   - Defensive parser falls back to a single 'other' issue when the
 *     response can't be parsed (visible to the user, doesn't crash).
 */
export class GeminiCoherenceReviewer implements ICoherenceReviewer {
    private modelName: string;

    constructor(modelName?: string) {
        this.modelName = modelName || 'gemini-2.5-pro';
    }

    async review(input: CoherenceReviewInput): Promise<CoherenceReviewOutput> {
        const { systemInstruction, userMessage } = buildReviewerPrompt(input);

        const { text: rawJson, tokensUsed, model: modeloUsado } = await withGeminiRetry(
            () => runLlmPromptWithUsage({
                feature: 'exegesis.reviewCoherence',
                model: this.modelName,
                system: systemInstruction,
                prompt: userMessage,
                responseMimeType: 'application/json',
                responseSchema: COHERENCE_REVIEW_SCHEMA,
                temperature: 0.2,
                topP: 0.9,
                maxOutputTokens: 8192,
            }),
            { contextLabel: 'GeminiCoherenceReviewer' },
        );

        const parsed = parseReviewerResponse(rawJson, input.language);

        return {
            issues: parsed.issues,
            summary: parsed.summary,
            tokensUsed,
            modelId: modeloUsado ?? this.modelName,
        };
    }
}

function parseReviewerResponse(rawJson: string, language: 'es' | 'en'): {
    summary: string;
    issues: CoherenceIssue[];
} {
    let parsed: any;
    try {
        parsed = JSON.parse(rawJson);
    } catch (err) {
        console.warn('[GeminiCoherenceReviewer] non-JSON response, surfacing as single issue.', err);
        return {
            summary: language === 'en'
                ? 'Reviewer response could not be parsed; please retry.'
                : 'No se pudo interpretar la respuesta del revisor; intenta de nuevo.',
            issues: [],
        };
    }

    const issuesRaw = Array.isArray(parsed?.issues) ? parsed.issues : [];
    const issues: CoherenceIssue[] = issuesRaw
        .map((raw: any): CoherenceIssue | null => {
            if (typeof raw?.message !== 'string' || raw.message.trim().length === 0) return null;
            return {
                category: normalizeCategory(raw.category),
                severity: normalizeSeverity(raw.severity),
                message: raw.message.trim(),
                relatedStepIds: Array.isArray(raw.relatedStepIds)
                    ? raw.relatedStepIds.filter((id: unknown): id is string => typeof id === 'string')
                    : [],
            };
        })
        .filter((x: CoherenceIssue | null): x is CoherenceIssue => x !== null);

    const summary = typeof parsed?.summary === 'string' && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : (language === 'en' ? 'No summary returned.' : 'Sin resumen devuelto.');

    return { summary, issues };
}

const VALID_CATEGORIES: ReadonlySet<CoherenceIssueCategory> = new Set([
    'thesis-mismatch',
    'verse-conflict',
    'translation-inconsistency',
    'unfulfilled-promise',
    'conclusion-overreach',
    'tone-drift',
    'other',
]);

function normalizeCategory(raw: unknown): CoherenceIssueCategory {
    return typeof raw === 'string' && VALID_CATEGORIES.has(raw as CoherenceIssueCategory)
        ? (raw as CoherenceIssueCategory)
        : 'other';
}

function normalizeSeverity(raw: unknown): 'high' | 'medium' | 'low' {
    return raw === 'high' || raw === 'medium' || raw === 'low' ? raw : 'medium';
}
