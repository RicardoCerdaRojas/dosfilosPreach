
import { IGreekTutorService, IWordCacheRepository, TrainingUnit, GreekForm, UserResponse, MorphologyBreakdown, BiblicalPassage, PassageWord, UnitPreview } from '@dosfilos/domain';
import { runLlmPrompt } from '../../llm/callableLlm';
import { FORM_SELECTION_SYSTEM_PROMPT, buildFormSelectionPrompt } from './prompts/FormSelectionPrompt';
import { TRAINING_UNIT_SYSTEM_PROMPT, buildTrainingUnitPrompt } from './prompts/TrainingUnitPrompt';
import { FEEDBACK_SYSTEM_PROMPT, buildFeedbackPrompt } from './prompts/FeedbackPrompt';
import { MORPHOLOGY_BREAKDOWN_SYSTEM_PROMPT, buildMorphologyBreakdownPrompt } from './prompts/MorphologyBreakdownPrompt';
import { PASSAGE_TEXT_SYSTEM_PROMPT, buildPassageTextPrompt } from './prompts/PassageTextPrompt';
import { WORD_IDENTIFICATION_SYSTEM_PROMPT, buildWordIdentificationPrompt } from './prompts/WordIdentificationPrompt';
import { getGeneralQuestionSystemInstruction, getContextualQuestionSystemInstruction, getContextualQuestionPrompt } from './prompt-helpers';

import { GEMINI_CONFIG } from '../../gemini/config';
import { LONG_GENERATION_TIMEOUT_MS } from '../../llm/llmTimeouts';

export class GeminiGreekTutorService implements IGreekTutorService {
    private wordCache?: IWordCacheRepository;

    /**
     * Sin apiKey: las llamadas al modelo salen por el proxy del servidor
     * (callable `runLlmPrompt`), que autentica, limita por usuario y mide el
     * gasto. El prompt se sigue armando acá.
     */
    constructor(wordCache?: IWordCacheRepository) {
        this.wordCache = wordCache;
    }


    async identifyForms(passage: string, fileSearchStoreId?: string, config?: { basePrompt?: string; userPrompts?: string[] }, language: string = 'Spanish'): Promise<string[]> {

        const genConfig: any = {};
        if (!fileSearchStoreId) {
            genConfig.responseMimeType = "application/json";
        }

        const rawResult = await runLlmPrompt({
            feature: 'greekTutor.identifyForms',
            prompt: buildFormSelectionPrompt(passage, language),
            system: FORM_SELECTION_SYSTEM_PROMPT,
            model: GEMINI_CONFIG.MODEL_NAME,
            ...(fileSearchStoreId ? { fileSearchStoreId } : {}),
        });

        const text = rawResult;
        const parsed = JSON.parse(this.cleanJsonResponse(text));

        if (Array.isArray(parsed)) {
            return parsed;
        }

        // Handle wrapped responses (e.g. { "forms": [...] })
        if (typeof parsed === 'object' && parsed !== null) {
            // Check for common keys
            if (Array.isArray(parsed.forms)) return parsed.forms;
            if (Array.isArray(parsed.greekForms)) return parsed.greekForms;
            if (Array.isArray(parsed.words)) return parsed.words;
            if (Array.isArray(parsed.items)) return parsed.items;

            // Fallback: look for ANY array value
            const values = Object.values(parsed);
            const arrayValue = values.find(val => Array.isArray(val));
            if (arrayValue) {
                return arrayValue as string[];
            }
        }

        console.warn("Gemini identifyForms returned unexpected format:", parsed);
        return [];
    }

    async createTrainingUnit(form: string, passage: string, fileSearchStoreId?: string, config?: { basePrompt?: string; userPrompts?: string[] }, language: string = 'Spanish'): Promise<TrainingUnit> {

        const genConfig: any = {};
        if (!fileSearchStoreId) {
            genConfig.responseMimeType = "application/json";
        }

        const rawResult = await runLlmPrompt({
            feature: 'greekTutor.createTrainingUnit',
            prompt: buildTrainingUnitPrompt(form, passage, language),
            system: TRAINING_UNIT_SYSTEM_PROMPT,
            model: GEMINI_CONFIG.MODEL_NAME,
            ...(fileSearchStoreId ? { fileSearchStoreId } : {}),
        });

        const data = JSON.parse(this.cleanJsonResponse(rawResult));

        return {
            id: crypto.randomUUID(),
            sessionId: '',
            greekForm: data.greekForm,
            identification: data.identification,
            recognitionGuidance: data.recognitionGuidance,
            functionInContext: data.functionInContext,
            significance: data.significance,
            reflectiveQuestion: data.reflectiveQuestion
        };
    }

    async evaluateResponse(unit: TrainingUnit, userAnswer: string, fileSearchStoreId?: string, language: string = 'Spanish'): Promise<{ feedback: string; isCorrect: boolean; }> {

        const unitJson = JSON.stringify({
            identification: unit.identification,
            function: unit.functionInContext,
            question: unit.reflectiveQuestion
        });

        const genConfig: any = {};
        if (!fileSearchStoreId) {
            genConfig.responseMimeType = "application/json";
        }

        const rawResult = await runLlmPrompt({
            feature: 'greekTutor.evaluateResponse',
            prompt: buildFeedbackPrompt(unitJson, userAnswer, language),
            system: FEEDBACK_SYSTEM_PROMPT,
            model: GEMINI_CONFIG.MODEL_NAME,
            ...(fileSearchStoreId ? { fileSearchStoreId } : {}),
        });

        return JSON.parse(this.cleanJsonResponse(rawResult));
    }

    async explainMorphology(word: string, passage: string, fileSearchStoreId?: string, language: string = 'Spanish'): Promise<MorphologyBreakdown> {

        const genConfig: any = {};
        if (!fileSearchStoreId) {
            genConfig.responseMimeType = "application/json";
        }

        try {
            const rawResult = await runLlmPrompt({
                feature: 'greekTutor.explainMorphology',
                prompt: buildMorphologyBreakdownPrompt(word, passage, language),
                system: MORPHOLOGY_BREAKDOWN_SYSTEM_PROMPT,
                model: GEMINI_CONFIG.MODEL_NAME,
                ...(fileSearchStoreId ? { fileSearchStoreId } : {}),
            });

            const rawText = rawResult;
            const cleanedJson = this.cleanJsonResponse(rawText);
            let data: unknown;
            try {
                data = JSON.parse(cleanedJson);
            } catch (parseErr) {
                console.error('[GeminiGreekTutorService] explainMorphology: JSON.parse failed', {
                    word,
                    rawTextPreview: rawText.slice(0, 300),
                    cleanedPreview: cleanedJson.slice(0, 300),
                    parseErr,
                });
                throw new Error(
                    `Morphology breakdown for "${word}" returned malformed JSON from the model. Retry the request.`,
                );
            }

            // Defensive shape validation. Pre-existing code returned
            // `{ components: data.components || [] }` which silently
            // accepted any non-object payload (including the literal
            // `[]` fallback emitted by `cleanJsonResponse`) and shipped
            // an empty breakdown to the UI. Now we reject anything
            // that doesn't carry a non-empty `components` array so the
            // caller can surface a real error message instead of a
            // blank "Estructura / Componentes" panel.
            const isObject = data !== null && typeof data === 'object' && !Array.isArray(data);
            const components = isObject ? (data as any).components : undefined;
            if (!Array.isArray(components) || components.length === 0) {
                console.warn('[GeminiGreekTutorService] explainMorphology: model returned no components', {
                    word,
                    rawTextPreview: rawText.slice(0, 300),
                    parsedPreview: JSON.stringify(data).slice(0, 300),
                });
                throw new Error(
                    `El modelo no produjo descomposición morfológica para "${word}". Intenta nuevamente.`,
                );
            }

            return {
                word: (isObject && (data as any).word) || word,
                components,
                summary: (isObject && (data as any).summary) || '',
            };
        } catch (error) {
            console.error('[GeminiGreekTutorService] Error in explainMorphology:', error);
            throw error;
        }
    }

    async answerFreeQuestion(
        question: string,
        context: {
            greekWord: string;
            transliteration: string;
            gloss: string;
            identification: string;
            functionInContext: string;
            significance: string;
            passage: string;
        },
        fileSearchStoreId?: string,
        language: string = 'Spanish'
    ): Promise<string> {

        // Check if this is a general question (empty context)
        const isGeneralQuestion = !context.greekWord && !context.passage;

        if (isGeneralQuestion) {
            // General Greek question - no specific context
            const systemInstruction = getGeneralQuestionSystemInstruction(language);

            const rawResult = await runLlmPrompt({
                feature: 'greekTutor.answerFreeQuestion',
                prompt: question,
                system: systemInstruction,
                model: GEMINI_CONFIG.MODEL_NAME,
                temperature: 0.7,
                maxOutputTokens: 8192,
                ...(fileSearchStoreId ? { fileSearchStoreId } : {}),
            });

            return rawResult;
        }

        // Contextual question about specific word/passage
        // Build context-aware prompt
        const contextPrompt = getContextualQuestionPrompt(context, question, language);
        const systemInstruction = getContextualQuestionSystemInstruction(language);

        const rawResult = await runLlmPrompt({
            feature: 'greekTutor.answerFreeQuestion',
            prompt: contextPrompt,
            system: systemInstruction,
            model: GEMINI_CONFIG.MODEL_NAME,
            temperature: 0.7,
            maxOutputTokens: 8192,
            ...(fileSearchStoreId ? { fileSearchStoreId } : {}),
        });

        return rawResult;
    }

    private cleanJsonResponse(text: string): string {
        // Strip markdown fences. Some prompts make Gemini wrap JSON
        // in ```json ... ``` even when responseMimeType is JSON.
        let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

        // Locate the first JSON-shaped character. Falls back to '[]'
        // when nothing is found so other tutor methods (training units,
        // free questions, etc.) keep degrading silently instead of
        // crashing the standalone tutor render — full hardening lives
        // in the Pastoral Word Study refactor (Fase 1.5, ADR-016).
        // The morphology-specific shape validator in `explainMorphology`
        // converts that silent fallback into a proper user-facing
        // error toast on the pastoral path.
        const firstPunctuation = cleaned.search(/[{\[]/);
        if (firstPunctuation === -1) {
            console.warn('[GeminiGreekTutorService] No JSON start character found in response.', {
                preview: cleaned.slice(0, 300),
            });
            return '[]';
        }

        const lastBrace = cleaned.lastIndexOf('}');
        const lastBracket = cleaned.lastIndexOf(']');
        const lastPunctuation = Math.max(lastBrace, lastBracket);

        if (lastPunctuation === -1 || lastPunctuation < firstPunctuation) {
            console.warn('[GeminiGreekTutorService] No JSON end character found in response.', {
                preview: cleaned.slice(0, 300),
            });
            return '[]';
        }

        cleaned = cleaned.substring(firstPunctuation, lastPunctuation + 1);
        return cleaned.trim();
    }

    // ========================================================================
    // Phase 3B: Passage Reader Methods
    // ========================================================================

    /**
     * Retrieves biblical passage in multiple versions with word alignment
     */
    async getPassageText(
        reference: string,
        fileSearchStoreId?: string,
        language: string = 'Spanish',
        bibleText?: string
    ): Promise<BiblicalPassage> {
        console.log('[GeminiGreekTutorService] Fetching passage text for:', reference);


        const genConfig: any = {};
        if (!fileSearchStoreId) {
            genConfig.responseMimeType = "application/json";
        }

        try {
            const rawResult = await runLlmPrompt({
                feature: 'greekTutor.answerFreeQuestion',
                prompt: buildPassageTextPrompt(reference, language, bibleText),
                system: PASSAGE_TEXT_SYSTEM_PROMPT,
                model: GEMINI_CONFIG.MODEL_NAME,
                ...(fileSearchStoreId ? { fileSearchStoreId } : {}),
            });

            const data = JSON.parse(this.cleanJsonResponse(rawResult));

            // Validate and structure the response
            const passage: BiblicalPassage = {
                // FORCE use of requested reference (e.g. "Romans 12:1-2") instead of AI's potentially localized version
                // This ensures cache keys ("romans_12_1_2") match the request keys reliably
                reference: reference,
                // Use provided local bible text if available (e.g. ASV for English), otherwise fallback to AI generated text
                // Note: The field name 'rv60Text' is legacy; it now holds the primary translation text (Spanish or English)
                rv60Text: bibleText || data.rv60Text || '',
                greekText: data.greekText || '',
                transliteration: data.transliteration || '',
                words: (data.words || []).map((w: any, index: number) => ({
                    id: w.id || `w${index}`,
                    greek: w.greek || '',
                    transliteration: w.transliteration || '',
                    spanish: w.spanish || '',
                    position: w.position !== undefined ? w.position : index,
                    lemma: w.lemma,
                    isInUnits: false // Will be set by use case layer
                }))
            };

            console.log('[GeminiGreekTutorService] Successfully retrieved passage with', passage.words.length, 'words');
            return passage;
        } catch (error) {
            console.error('[GeminiGreekTutorService] Error fetching passage text:', error);
            throw new Error(`Failed to retrieve passage ${reference}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Identifies a word from the passage and generates unit preview
     */
    async identifyWordForUnit(
        word: PassageWord,
        context: string,
        fileSearchStoreId?: string,
        language: string = 'Spanish'
    ): Promise<UnitPreview> {
        console.log('[GeminiGreekTutorService] Identifying word for unit:', word.greek);

        // Check cache first (if lemma available and cache enabled)
        if (word.lemma && this.wordCache) {
            try {
                const cached = await this.wordCache.get(word.lemma, language);
                if (cached) {
                    console.log('[GeminiGreekTutorService] Cache HIT:', word.lemma);
                    return {
                        greekForm: {
                            text: word.greek,
                            transliteration: word.transliteration,
                            lemma: word.lemma,
                            morphology: cached.morphology,
                            gloss: cached.gloss,
                            grammaticalCategory: cached.grammaticalCategory
                        },
                        identification: cached.identification,
                        recognitionGuidance: cached.recognitionGuidance
                    };
                }
            } catch (cacheError) {
                console.warn('[GeminiGreekTutorService] Cache error:', cacheError);
            }
        }

        // Cache miss - call Gemini API
        console.log('[GeminiGreekTutorService] Cache MISS, calling API:', word.greek);


        const genConfig: any = {};
        if (!fileSearchStoreId) {
            genConfig.responseMimeType = "application/json";
        }

        try {
            const rawResult = await runLlmPrompt({
                feature: 'greekTutor.answerFreeQuestion',
                prompt: buildWordIdentificationPrompt(word.greek, context, language),
                system: WORD_IDENTIFICATION_SYSTEM_PROMPT,
                model: GEMINI_CONFIG.MODEL_NAME,
                ...(fileSearchStoreId ? { fileSearchStoreId } : {}),
            });

            const data = JSON.parse(this.cleanJsonResponse(rawResult));

            const preview: UnitPreview = {
                greekForm: {
                    text: data.greekForm.text || word.greek,
                    transliteration: data.greekForm.transliteration || word.transliteration,
                    lemma: data.greekForm.lemma || '',
                    morphology: data.greekForm.morphology || '',
                    gloss: data.greekForm.gloss || '',
                    grammaticalCategory: data.greekForm.grammaticalCategory || ''
                },
                identification: data.identification || '',
                recognitionGuidance: data.recognitionGuidance
            };

            console.log('[GeminiGreekTutorService] Successfully identified word:', preview.greekForm.lemma);

            // Save to cache if lemma available
            if (preview.greekForm.lemma && this.wordCache) {
                try {
                    await this.wordCache.set({
                        lemma: preview.greekForm.lemma,
                        language,
                        gloss: preview.greekForm.gloss,
                        grammaticalCategory: preview.greekForm.grammaticalCategory,
                        morphology: preview.greekForm.morphology,
                        identification: preview.identification,
                        recognitionGuidance: preview.recognitionGuidance,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                    console.log('[GeminiGreekTutorService] Cached word:', preview.greekForm.lemma);
                } catch (cacheError) {
                    console.warn('[GeminiGreekTutorService] Cache save failed:', cacheError);
                }
            }

            return preview;
        } catch (error) {
            console.error('[GeminiGreekTutorService] Error identifying word:', error);
            throw new Error(`Failed to identify word ${word.greek}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Analyzes the syntactic structure of a Greek passage
     * 
     * This method is intentionally simple - it just calls Gemini with the prompt.
     * The complexity of prompt building and response parsing is handled in the
     * use case layer (Application Layer), following Clean Architecture.
     * 
     * @param prompt - The complete analysis prompt (built by use case)
     * @returns Raw JSON string response from Gemini
     */
    async analyzeSyntax(prompt: string): Promise<string> {
        try {
            console.log('[GeminiGreekTutorService] Analyzing syntax...');

            // Use the model without tools for JSON response
            // (Tools conflict with JSON mode in Gemini)
            // NOTA: responseMimeType JSON no garantiza JSON válido en la
            // práctica, así que el use case sigue parseando a mano.
            const text = await runLlmPrompt({
                feature: 'greekTutor.analyzeSyntax',
                prompt,
                model: GEMINI_CONFIG.MODEL_NAME,
                temperature: 0.3, // Bajo: el análisis sintáctico debe ser determinista.
                maxOutputTokens: 16384, // Pasajes de 10+ versos necesitan espacio.
            }, { timeoutMs: LONG_GENERATION_TIMEOUT_MS });

            console.log('[GeminiGreekTutorService] Syntax analysis complete. Response length:', text.length);

            return text;
        } catch (error) {
            console.error('[GeminiGreekTutorService] Error analyzing syntax:', error);
            throw new Error(`Failed to analyze syntax: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
