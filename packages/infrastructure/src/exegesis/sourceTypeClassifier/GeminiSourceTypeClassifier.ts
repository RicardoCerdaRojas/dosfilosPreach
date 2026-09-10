import {
    SOURCE_TYPE_CATALOG,
    type ClassifySourceTypeInput,
    type ClassifySourceTypeOutput,
    type ISourceTypeClassifier,
    type SourceType,
} from '@dosfilos/domain';
import { withGeminiRetry } from '../geminiRetry';
import { runLlmPromptWithUsage } from '../../llm/callableLlm';
import { buildClassifierPrompt } from './classifierPrompts';
import { SOURCE_TYPE_CLASSIFIER_SCHEMA } from './responseSchema';

/**
 * Gemini implementation of `ISourceTypeClassifier`. Single LLM call
 * per resource — fast (~1-3s) and cheap (~$0.001 per classification
 * with Pro 2.5).
 *
 * Configuration:
 *   - Model: defaults to Gemini 2.5 Pro for accuracy on borderline
 *     cases (e.g. WBC vs NIGTC vs Anchor — all `commentary-critical`,
 *     same call). The caller can swap to Flash for cost tuning if the
 *     accuracy holds up in practice.
 *   - Temperature: 0.1. Classification wants determinism; the catalog
 *     enum already constrains the output shape, but low temperature
 *     keeps the chosen label stable across runs of the same input.
 *   - `responseSchema`: enum-constrained on `sourceType`. Gemini
 *     cannot return a label outside the catalog.
 *
 * Hard-codes a final defense even with the schema: if Gemini somehow
 * returns a string the catalog doesn't recognize, the classifier
 * falls back to `'other'` with `'low'` confidence rather than crashing.
 */
export class GeminiSourceTypeClassifier implements ISourceTypeClassifier {
    private modelName: string;

    constructor(modelName?: string) {
        this.modelName = modelName || 'gemini-2.5-pro';
    }

    async classify(input: ClassifySourceTypeInput): Promise<ClassifySourceTypeOutput> {
        const language = input.language ?? 'es';
        const { systemInstruction, userMessage } = buildClassifierPrompt({
            rawText: input.rawText,
            title: input.title,
            author: input.author,
            language,
        });

        const { text: rawJson, tokensUsed } = await withGeminiRetry(
            () => runLlmPromptWithUsage({
                feature: 'exegesis.classifySourceType',
                model: this.modelName,
                system: systemInstruction,
                prompt: userMessage,
                responseMimeType: 'application/json',
                // El enum del catálogo vive en el esquema: sin él, el modelo
                // puede devolver una etiqueta fuera de catálogo y todo cae al
                // `'other'` defensivo de más abajo sin que nadie lo note.
                responseSchema: SOURCE_TYPE_CLASSIFIER_SCHEMA,
                temperature: 0.1,
                topP: 0.9,
                // Mismo presupuesto compartido con el razonamiento del modelo
                // que dejó mudo al verificador de citas: `gemini-2.5-pro`
                // piensa antes de responder y esos tokens salen de acá. Con
                // 512 el cupo se agota pensando, la respuesta llega cortada y
                // el `catch` de abajo devuelve `'other'` —una clasificación
                // equivocada que no se distingue de una correcta—.
                maxOutputTokens: 8192,
            }),
            { contextLabel: 'GeminiSourceTypeClassifier' },
        );

        const parsed = parseClassifierResponse(rawJson);
        return {
            sourceType: parsed.sourceType,
            confidence: parsed.confidence,
            reasoning: parsed.reasoning,
            tokensUsed,
            modelId: this.modelName,
        };
    }
}

interface ParsedResponse {
    sourceType: SourceType;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
}

function parseClassifierResponse(rawJson: string): ParsedResponse {
    let parsed: any;
    try {
        parsed = JSON.parse(rawJson);
    } catch (err) {
        console.warn('[GeminiSourceTypeClassifier] non-JSON response, defaulting to "other".', err);
        return { sourceType: 'other', confidence: 'low', reasoning: '' };
    }
    const sourceType: SourceType = SOURCE_TYPE_CATALOG[parsed?.sourceType as SourceType]
        ? (parsed.sourceType as SourceType)
        : 'other';
    const confidence: 'high' | 'medium' | 'low' =
        parsed?.confidence === 'high' || parsed?.confidence === 'medium' || parsed?.confidence === 'low'
            ? parsed.confidence
            : 'low';
    const reasoning = typeof parsed?.reasoning === 'string' ? parsed.reasoning.trim() : '';
    return { sourceType, confidence, reasoning };
}
