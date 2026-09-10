import {
    type AnalyzeVerseInput,
    type AnalyzeVerseOutput,
    type CanonicalVerseAnalysis,
    type ICanonicalVerseAnalyzer,
} from '@dosfilos/domain';
import { withGeminiRetry } from '../geminiRetry';
import { runLlmPromptWithUsage } from '../../llm/callableLlm';
import { LONG_GENERATION_TIMEOUT_MS } from '../../llm/llmTimeouts';
import { buildAnalyzerPrompt } from './analyzerPrompts';
import { canonicalVerseAnalysisSchema } from './responseSchema';
import { voiceFor } from '../testamentVoice';

/**
 * Gemini implementation of `ICanonicalVerseAnalyzer`.
 *
 * Two-pronged constraint:
 *   1. `responseSchema` (server-side) — Gemini guarantees the output
 *      conforms to the schema shape. Eliminates parser brittleness.
 *   2. Prompt-side methodological rigor — the system instruction
 *      enforces canonical authorities, citation discipline, hedge
 *      calibration, and the "no recap, no distant verses" rule for
 *      verseThesis.
 *
 * Configuration choices:
 *   - Model: Pro 2.5 by default (configurable). The analysis is
 *     reasoning-heavy and benefits from Pro's depth over Flash's speed.
 *   - Temperature: 0.3. Low enough that regenerations are comparable;
 *     high enough that the model commits to assignments instead of
 *     hedging when the right call is borderline.
 *   - Output tokens: 32k cap. The structured JSON for a verse with
 *     full coverage runs ~3-6k tokens; 32k provides 4-6× headroom for
 *     dense verses with multiple cruxes + variants.
 *
 * Errors:
 *   - Gemini parse failures (malformed JSON despite responseSchema —
 *     rare but possible) bubble as errors with the raw response logged.
 *   - Schema-shape mismatches that survive Gemini's enforcement (e.g.,
 *     missing required field) throw with field-level detail.
 *   - The use case is responsible for sanitizing hallucinated source
 *     keys against the corpus and for stamping createdAt/updatedAt.
 */
export class GeminiCanonicalVerseAnalyzer implements ICanonicalVerseAnalyzer {
    private modelName: string;

    constructor(modelName?: string) {
        this.modelName = modelName || 'gemini-2.5-pro';
    }

    async analyzeVerse(input: AnalyzeVerseInput): Promise<AnalyzeVerseOutput> {
        const { systemInstruction, userMessage } = buildAnalyzerPrompt(input);

        console.log('[GeminiCanonicalVerseAnalyzer] analyzing', {
            verse: `${input.verseRef.bookId} ${input.verseRef.chapterStart}:${input.verseRef.verseStart}-${input.verseRef.verseEnd ?? input.verseRef.verseStart}`,
            sourceCount: input.sources.length,
            priorAnalysisCount: input.priorAcceptedAnalyses.length,
            language: input.language,
            hasOriginalLanguageText: !!input.originalLanguageText,
        });

        const { text: rawJson, tokensUsed } = await withGeminiRetry(
            () => runLlmPromptWithUsage({
                feature: 'exegesis.analyzeVerse',
                model: this.modelName,
                system: systemInstruction,
                prompt: userMessage,
                responseMimeType: 'application/json',
                // El esquema lo sigue aplicando el servidor. El proxy lo pasa
                // tal cual a `generationConfig`; perderlo no daría error, daría
                // JSON peor formado.
                //
                // Se arma por verso porque sus descripciones nombran el idioma
                // y el aparato: el mismo esquema para Jonás y para Santiago le
                // pedía griego con NA28 a un análisis del texto masorético,
                // contradiciendo al prompt que ya decía lo correcto.
                responseSchema: canonicalVerseAnalysisSchema(voiceFor(input.verseRef.bookId)),
                temperature: 0.3,
                topP: 0.9,
                maxOutputTokens: 32768,
            }, { timeoutMs: LONG_GENERATION_TIMEOUT_MS }),
            { contextLabel: 'GeminiCanonicalVerseAnalyzer' },
        );

        const parsed = parseAnalyzerResponse(rawJson);
        const analysis = mapToCanonicalVerseAnalysis(parsed, input);

        return {
            analysis,
            modelId: this.modelName,
            tokensUsed,
        };
    }
}

/**
 * Parses the JSON returned by Gemini. With `responseSchema` enforced
 * server-side, Gemini guarantees well-formed JSON conforming to the
 * shape. We still defend against parse failures (rare but possible
 * during quota events or model anomalies) with a clear error.
 */
function parseAnalyzerResponse(rawJson: string): unknown {
    try {
        return JSON.parse(rawJson);
    } catch (err) {
        console.error('[GeminiCanonicalVerseAnalyzer] failed to parse Gemini response', {
            preview: rawJson.slice(0, 500),
            length: rawJson.length,
        });
        throw new Error(`Failed to parse analyzer response: ${(err as Error).message}`);
    }
}

/**
 * Maps the Gemini JSON payload to the domain `CanonicalVerseAnalysis`
 * type. Stamps `reference` from the input (the schema doesn't include
 * it because it's known by the caller) and `createdAt` / `updatedAt`
 * with the current time.
 *
 * Performs a shallow shape validation so any schema drift between the
 * domain entity and the response schema surfaces as a parse error
 * with a clear field reference.
 */
function mapToCanonicalVerseAnalysis(
    payload: unknown,
    input: AnalyzeVerseInput,
): CanonicalVerseAnalysis {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Analyzer response: payload is not an object');
    }
    const p = payload as Record<string, unknown>;

    const requireField = (name: string): unknown => {
        if (!(name in p)) {
            throw new Error(`Analyzer response: missing required field "${name}"`);
        }
        return p[name];
    };

    const now = new Date();

    return {
        reference: input.verseRef,
        originalText: String(requireField('originalText')),
        textualCriticism: requireField('textualCriticism') as CanonicalVerseAnalysis['textualCriticism'],
        syntacticAnalysis: requireField('syntacticAnalysis') as CanonicalVerseAnalysis['syntacticAnalysis'],
        lexicalAnalyses: requireField('lexicalAnalyses') as CanonicalVerseAnalysis['lexicalAnalyses'],
        argumentativeRole: String(requireField('argumentativeRole')),
        historicalContext: requireField('historicalContext') as CanonicalVerseAnalysis['historicalContext'],
        oldTestamentLinks: requireField('oldTestamentLinks') as CanonicalVerseAnalysis['oldTestamentLinks'],
        commentatorEngagement: requireField('commentatorEngagement') as CanonicalVerseAnalysis['commentatorEngagement'],
        translationCruxes: requireField('translationCruxes') as CanonicalVerseAnalysis['translationCruxes'],
        initialTranslation: String(requireField('initialTranslation')),
        finalTranslation: String(requireField('finalTranslation')),
        verseThesis: String(requireField('verseThesis')),
        theologicalHooks: requireField('theologicalHooks') as CanonicalVerseAnalysis['theologicalHooks'],
        confidenceFlags: requireField('confidenceFlags') as CanonicalVerseAnalysis['confidenceFlags'],
        footnoteExtensions: requireField('footnoteExtensions') as CanonicalVerseAnalysis['footnoteExtensions'],
        createdAt: now,
        updatedAt: now,
    };
}
