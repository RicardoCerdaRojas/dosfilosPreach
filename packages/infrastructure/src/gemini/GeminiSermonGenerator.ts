import { runLlmPrompt } from '../llm/callableLlm';
import { streamChat } from '../llm/sseChat';
import {
    CitationManifest,
    ISermonGenerator,
    GenerationRules,
    ExegeticalStudy,
    HomileticalAnalysis,
    SermonContent,
    WorkflowPhase,
    DEFAULT_LANGUAGE,
} from '@dosfilos/domain';
import type { SupportedLanguage } from '@dosfilos/domain';
import { ChatMessage } from '@dosfilos/domain/src/entities/SermonWorkflow';
import {
    buildExegesisPrompt,
    buildSermonDraftPrompt,
    buildRegeneratePointPrompt,
    buildChatSystemPrompt
} from './prompts-generator';

import { GEMINI_CONFIG } from './config';
import { LONG_GENERATION_TIMEOUT_MS } from '../llm/llmTimeouts';

export class GeminiSermonGenerator implements ISermonGenerator {

    /**
     * Sin apiKey: todas las llamadas salen por el servidor — las de generación
     * por el proxy (`runLlmPrompt`) y las de chat por el endpoint SSE. La clave
     * ya no vive en el navegador.
     */
    constructor() {}



    async generateExegesis(passage: string, rules: GenerationRules, config?: any, language: SupportedLanguage = DEFAULT_LANGUAGE): Promise<ExegeticalStudy> {
        try {
            const prompt = buildExegesisPrompt(passage, rules, config, language);

            // 🧪 TESTING: Log prompt to verify hermeneutical method


            const text = await runLlmPrompt({
                feature: 'sermon.generateExegesis',
                prompt: prompt,
                safety: 'standard',
                ...(config?.aiModel ? { model: config.aiModel } : {}),
                temperature: config?.temperature ?? GEMINI_CONFIG.GENERATION_CONFIG.temperature,
                ...(config?.fileSearchStoreId
                    ? { fileSearchStoreId: config.fileSearchStoreId }
                    : { responseMimeType: 'application/json' as const }),
            });
            const parsed = JSON.parse(this.cleanJsonResponse(text));

            return {
                passage: parsed.passage || passage,
                context: {
                    historical: parsed.context?.historical || '',
                    literary: parsed.context?.literary || '',
                    audience: parsed.context?.audience || ''
                },
                keyWords: Array.isArray(parsed.keyWords) ? parsed.keyWords.map((kw: any) => ({
                    original: kw.original || '',
                    transliteration: kw.transliteration || '',
                    lemma: kw.lemma || '',
                    literalTranslation: kw.literalTranslation || '',
                    morphology: kw.morphology || '',
                    syntacticFunction: kw.syntacticFunction || '',
                    significance: kw.significance || ''
                })) : [],
                exegeticalProposition: parsed.exegeticalProposition || '',
                pastoralInsights: Array.isArray(parsed.pastoralInsights) ? parsed.pastoralInsights : [],
                ragSources: Array.isArray(parsed.ragSources) ? parsed.ragSources : undefined
            };
        } catch (error: any) {
            throw this.handleError(error);
        }
    }

    async generateHomiletics(
        exegesis: ExegeticalStudy,
        rules: GenerationRules,
        _config?: any,
        _language: SupportedLanguage = DEFAULT_LANGUAGE,
    ): Promise<HomileticalAnalysis> {
        try {
            const { HomileticsPromptBuilder } = await import('./prompts/HomileticsPromptBuilder');
            const { ApproachFactory, normalizeHomileticalApproach } = await import('@dosfilos/domain');

            const prompt = new HomileticsPromptBuilder()
                .withExegesis(exegesis)
                .withRules(rules)
                .build();

            const text = await runLlmPrompt({
                feature: 'sermon.generateHomiletics',
                prompt: prompt,
                safety: 'standard',
                ...(_config?.aiModel ? { model: _config.aiModel } : {}),
                temperature: _config?.temperature ?? GEMINI_CONFIG.GENERATION_CONFIG.temperature,
                ...(_config?.fileSearchStoreId
                    ? { fileSearchStoreId: _config.fileSearchStoreId }
                    : { responseMimeType: 'application/json' as const }),
            });

            const parsed = JSON.parse(this.cleanJsonResponse(text));

            // Fail-closed on the write border: createFromAIResponse rejects a
            // non-member `type` (corrupt AI output). Skip a rejected preview per
            // item so one bad approach doesn't kill the whole batch.
            const homileticalApproaches = (Array.isArray(parsed.homileticalApproaches) ? parsed.homileticalApproaches : [])
                .map((approach: any, index: number) => {
                    try {
                        return ApproachFactory.createFromAIResponse(approach, index);
                    } catch (e: any) {
                        console.warn('[generateHomiletics] dropped invalid approach preview:', e?.message);
                        return null;
                    }
                })
                .filter((a: any): a is NonNullable<typeof a> => a !== null);

            const validApproaches = homileticalApproaches.filter((approach: any) =>
                ApproachFactory.validate(approach)
            );

            if (validApproaches.length === 0) {
                console.warn('⚠️ No valid approaches generated, falling back to legacy format');
                return {
                    homileticalApproaches: [],
                    selectedApproachId: undefined,
                    // Normalize any model-emitted value to a current form; unset
                    // rather than fabricate one when the model gave nothing valid.
                    homileticalApproach: normalizeHomileticalApproach(parsed.homileticalApproach).approach,
                    contemporaryApplication: Array.isArray(parsed.contemporaryApplication) ? parsed.contemporaryApplication : [],
                    homileticalProposition: parsed.homileticalProposition || '',
                    outline: parsed.outline || { mainPoints: [] },
                    exegeticalStudy: exegesis,
                };
            }

            const primaryApproach = validApproaches[0];

            return {
                homileticalApproaches: validApproaches,
                selectedApproachId: undefined,
                homileticalApproach: primaryApproach.type,
                contemporaryApplication: primaryApproach.contemporaryApplication || [],
                homileticalProposition: primaryApproach.homileticalProposition || '',
                outline: primaryApproach.outline || { mainPoints: [] },
                exegeticalStudy: exegesis,
            };
        } catch (error: any) {
            console.error('Error generating homiletics:', error);
            throw this.handleError(error);
        }
    }

    async generateSermonDraft(
        analysis: HomileticalAnalysis,
        rules: GenerationRules,
        _config?: any,
        language: SupportedLanguage = DEFAULT_LANGUAGE,
        manifest?: CitationManifest,
    ): Promise<SermonContent> {
        try {
            // A full sermon JSON (intro 200-400w + 3-5 body points 600-900w
            // each + conclusion + callToAction + ragSources) easily clears
            // 12-15k tokens; 24k headroom avoids mid-array truncation while
            // staying under Flash 2.5's 32k cap.
            const attempt = async (mf: CitationManifest | undefined, useFileSearch: boolean): Promise<string> => {
                const prompt = buildSermonDraftPrompt(analysis, rules, language, mf);
                const effectiveStore = useFileSearch ? _config?.fileSearchStoreId : undefined;
                return await runLlmPrompt({
                    feature: 'sermon.generateDraft',
                    prompt,
                    safety: 'standard',
                    maxOutputTokens: 24576,
                    ...(_config?.aiModel ? { model: _config.aiModel } : {}),
                    temperature: _config?.temperature ?? GEMINI_CONFIG.GENERATION_CONFIG.temperature,
                    ...(effectiveStore
                        ? { fileSearchStoreId: effectiveStore }
                        : { responseMimeType: 'application/json' as const }),
                }, { timeoutMs: LONG_GENERATION_TIMEOUT_MS });
            };

            let text: string;
            try {
                text = await attempt(manifest, true);
            } catch (err: any) {
                // RECITATION: Gemini blocked the candidate for reproducing
                // copyrighted source text. Retry once WITHOUT the citation
                // contract (no source list) and WITHOUT the File Search Store,
                // so no copyrighted prose is fed to the model. The post-gen
                // anchor injector (application layer) still adds the citations
                // from the manifest, so the sermon stays cited.
                if (this.isRecitationError(err)) {
                    console.warn('[generateSermonDraft] RECITATION block — retrying without citation contract + File Search');
                    text = await attempt(undefined, false);
                } else {
                    throw err;
                }
            }
            const parsed = JSON.parse(this.cleanJsonResponse(text));
            // Warn when the model returned a structurally-incomplete
            // sermon so we surface truncation / schema regressions in
            // logs instead of silently shipping empty bodies.
            if (!Array.isArray(parsed.body) || parsed.body.length === 0) {
                console.warn('[generateSermonDraft] empty body in response — likely truncation or schema mismatch', {
                    titleSet: !!parsed.title,
                    introSet: !!parsed.introduction,
                    conclusionSet: !!parsed.conclusion,
                    rawLength: text.length,
                });
            }
            // Normalize body: filter hallucinated authorityQuote when
            // null/undefined so the renderer skips the block cleanly.
            // PR #217: prompt now forbids fabricating quotes; the LLM
            // returns null when no verified source exists.
            const body = Array.isArray(parsed.body) ? parsed.body.map((b: any) => ({
                ...b,
                // Sólo strings con contenido: el esquema los pide así, pero un
                // modelo puede emitir objetos ({original, significance}) y el
                // renderizador hace `.trim()` sobre cada entrada — un objeto
                // acá revienta el lienzo entero, no una línea.
                keyWords: Array.isArray(b?.keyWords)
                    ? b.keyWords.filter((k: unknown): k is string => typeof k === 'string' && k.trim().length > 0)
                    : undefined,
                authorityQuote: b?.authorityQuote && typeof b.authorityQuote === 'string' && b.authorityQuote.trim().length > 0
                    ? b.authorityQuote
                    : null,
            })) : [];
            // callToAction is mandatory per PR #217 prompt rule. If the
            // LLM returned empty, surface a clear fallback the pastor
            // can replace — never ship an unconcluded sermon to the
            // pulpit.
            const callToAction = parsed.callToAction && typeof parsed.callToAction === 'string' && parsed.callToAction.trim().length > 0
                ? parsed.callToAction
                : 'Reflexiona esta semana cómo aplicar esta verdad a tu vida personal. Comparte el mensaje central con alguien que necesite escucharlo. Ora pidiendo que esta verdad arraigue en tu corazón.';
            return {
                title: parsed.title || 'Sin Título',
                introduction: parsed.introduction || '',
                body,
                conclusion: parsed.conclusion || '',
                callToAction,
                ragSources: Array.isArray(parsed.ragSources) ? parsed.ragSources : undefined,
                // Mirror the manifest onto the returned draft so the
                // application layer can hand it straight to
                // `validateCitations` without recomputing. The validator
                // will rebuild a survivor-only manifest from this one.
                citationManifest: manifest,
            };
        } catch (error: any) {
            throw this.handleError(error);
        }
    }

    async regenerateSermonPoint(
        point: any,
        rules: GenerationRules,
        context: any,
        language: SupportedLanguage = DEFAULT_LANGUAGE,
    ): Promise<any> {
        try {
            // El prompt vive en `prompts-generator` como el del borrador
            // completo. Tenerlo acá embebido fue lo que dejó que divergiera:
            // el punto regenerado salía sin la voz del predicador, sin nivel de
            // rigor, sin bosquejo y sin las directivas del pastor.
            const fullPrompt = buildRegeneratePointPrompt(point, rules, context, language);
            const text = await runLlmPrompt({
                feature: 'sermon.regeneratePoint',
                prompt: fullPrompt,
                safety: 'standard',
                ...(context?.aiModel ? { model: context.aiModel } : {}),
                temperature: context?.temperature ?? GEMINI_CONFIG.GENERATION_CONFIG.temperature,
                ...(context?.fileSearchStoreId
                    ? { fileSearchStoreId: context.fileSearchStoreId }
                    : { responseMimeType: 'application/json' as const }),
            });
            return JSON.parse(this.cleanJsonResponse(text));
        } catch (error: any) {
            throw this.handleError(error);
        }
    }

    async chat(phase: WorkflowPhase, history: ChatMessage[], context: any, language: SupportedLanguage = DEFAULT_LANGUAGE): Promise<string> {
        try {
            const systemPrompt = buildChatSystemPrompt(phase, context, language);
            const geminiHistory = history.slice(0, -1).map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }));

            if (geminiHistory.length > 0) {
                const firstMsg = geminiHistory[0];
                if (firstMsg && firstMsg.role === 'user') {
                    const parts = firstMsg.parts;
                    if (parts && parts.length > 0 && parts[0]) {
                        const firstPart = parts[0];
                        if (firstPart && 'text' in firstPart) {
                            firstPart.text = `${systemPrompt}\n\n${firstPart.text}`;
                        }
                    }
                }
            }

            if (history.length === 0) throw new Error('History cannot be empty');
            const lastMessage = history[history.length - 1];
            if (!lastMessage || lastMessage.role !== 'user') throw new Error('Last message must be from user');

            let messageToSend = lastMessage.content;
            if (geminiHistory.length === 0) {
                messageToSend = `${systemPrompt}\n\n${messageToSend}`;
            }

            // Vía el servidor. Se conserva la peculiaridad del prompt original:
            // el system va INLINE (antepuesto al primer mensaje del historial, o
            // al mensaje si no hay historial), no como `systemInstruction`.
            // Cambiarlo alteraría lo que ve el modelo.
            const { text } = await streamChat({
                message: messageToSend,
                history: geminiHistory.map((h) => ({ role: h.role, text: h.parts[0]?.text ?? '' })),
                feature: 'sermonWizard.chat',
                generationConfig: {
                    maxOutputTokens: 8192,
                    temperature: context?.temperature || GEMINI_CONFIG.GENERATION_CONFIG.temperature,
                },
                ...(context?.aiModel ? { model: context.aiModel } : {}),
                ...(context?.fileSearchStoreId ? { corpusIds: [context.fileSearchStoreId] } : {}),
            });
            return sanitizeChatResponseText(text);
        } catch (error: any) {
            throw this.handleError(error);
        }
    }

    async chatStream(phase: WorkflowPhase, history: ChatMessage[], context: any, onChunk: (text: string) => void, language: SupportedLanguage = DEFAULT_LANGUAGE): Promise<string> {
        try {
            const systemPrompt = buildChatSystemPrompt(phase, context, language);
            const geminiHistory = history.slice(0, -1).map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }));

            if (geminiHistory.length > 0) {
                const firstMsg = geminiHistory[0];
                if (firstMsg && firstMsg.role === 'user') {
                    const parts = firstMsg.parts;
                    if (parts && parts.length > 0 && parts[0]) {
                        const firstPart = parts[0];
                        if (firstPart && 'text' in firstPart) {
                            firstPart.text = `${systemPrompt}\n\n${firstPart.text}`;
                        }
                    }
                }
            }

            if (history.length === 0) throw new Error('History cannot be empty');
            const lastMessage = history[history.length - 1];
            if (!lastMessage || lastMessage.role !== 'user') throw new Error('Last message must be from user');

            let messageToSend = lastMessage.content;
            if (geminiHistory.length === 0) {
                messageToSend = `${systemPrompt}\n\n${messageToSend}`;
            }

            let fullText = '';
            const { text } = await streamChat(
                {
                    message: messageToSend,
                    history: geminiHistory.map((h) => ({ role: h.role, text: h.parts[0]?.text ?? '' })),
                    feature: 'sermonWizard.chatStream',
                    generationConfig: {
                        maxOutputTokens: 8192,
                        temperature: context?.temperature || GEMINI_CONFIG.GENERATION_CONFIG.temperature,
                    },
                    ...(context?.aiModel ? { model: context.aiModel } : {}),
                    ...(context?.fileSearchStoreId ? { corpusIds: [context.fileSearchStoreId] } : {}),
                },
                (chunk) => {
                    fullText += chunk;
                    // Se sanea el ACUMULADO en cada render, igual que antes: así
                    // el pastor nunca ve sintaxis de tool-call filtrada a medio
                    // stream.
                    onChunk(sanitizeChatResponseText(fullText));
                },
            );
            return sanitizeChatResponseText(text || fullText);
        } catch (error: any) {
            throw this.handleError(error);
        }
    }

    async refineContent(content: string, instruction: string, context?: any, language: SupportedLanguage = DEFAULT_LANGUAGE): Promise<string> {
        try {
            let librarySection = '';
            if (context?.cachedResources && context.cachedResources.length > 0) {
                const resourcesList = context.cachedResources.map((r: any) => `- ${r.title} (${r.author})`).join('\n');
                librarySection = language === 'en'
                    ? `
## 📚 FULL ACCESS TO PASTOR'S LIBRARY:
You have access to the FULL CONTENT of these books in your context:
${resourcesList}
WHENEVER you use information from these books, CITE the source (Author, Title).
`
                    : `
## 📚 ACCESO COMPLETO A BIBLIOTECA DEL PASTOR:
Tienes acceso al CONTENIDO COMPLETO de estos libros en tu contexto:
${resourcesList}
SIEMPRE que uses información de estos libros, CITÁ la fuente (Autor, Título).
`;
            }

            const promptBody = language === 'en'
                ? `ACT AS AN EXPERT EDITOR AND THEOLOGIAN.
Your task is to refine the following content per the provided instructions.

ORIGINAL CONTENT:
${content}

REFINEMENT INSTRUCTIONS:
${instruction}
${librarySection}

RULES:
1. Preserve the JSON or Markdown format.
2. Be precise and theologically faithful.
3. Cite sources.
`
                : `ACTÚA COMO UN EDITOR Y TEÓLOGO EXPERTO.
Tu tarea es refinar el siguiente contenido según las instrucciones proporcionadas.

CONTENIDO ORIGINAL:
${content}

INSTRUCCIONES DE REFINAMIENTO:
${instruction}
${librarySection}

REGLAS:
1. Mantén el formato JSON o Markdown.
2. Sé preciso y teológicamente fiel.
3. Cita fuentes.
`;
            const directive = language === 'en'
                ? 'IMPORTANT: Respond entirely in English.'
                : 'IMPORTANTE: Responde completamente en español.';
            const prompt = `${directive}\n\n${promptBody}`;
            // Vía el proxy del servidor: la clave sale del navegador y el gasto
            // queda medido. Se conservan los mismos parámetros que traía la
            // llamada directa, incluidos los umbrales de seguridad explícitos.
            return await runLlmPrompt({
                feature: 'sermon.refineContent',
                prompt,
                safety: 'standard',
                ...(context?.aiModel ? { model: context.aiModel } : {}),
                temperature: context?.temperature ?? GEMINI_CONFIG.GENERATION_CONFIG.temperature,
                ...(context?.fileSearchStoreId ? { fileSearchStoreId: context.fileSearchStoreId } : {}),
            });
        } catch (error: any) {
            throw this.handleError(error);
        }
    }

    /**
     * Escapes unescaped control characters within JSON string values.
     * This handles cases where the AI generates literal newlines, tabs, etc. in JSON.
     */
    private escapeControlCharsInJson(jsonString: string): string {
        let result = '';
        let inString = false;
        let escapeNext = false;

        for (let i = 0; i < jsonString.length; i++) {
            const char = jsonString[i];
            const prev = i > 0 ? jsonString[i - 1] : '';

            if (escapeNext) {
                // Already escaped, keep as is
                result += char;
                escapeNext = false;
                continue;
            }

            if (char === '\\') {
                escapeNext = true;
                result += char;
                continue;
            }

            if (char === '"' && prev !== '\\') {
                inString = !inString;
                result += char;
                continue;
            }

            if (inString) {
                // Replace control characters with their escaped equivalents
                switch (char) {
                    case '\n':
                        result += '\\n';
                        break;
                    case '\r':
                        result += '\\r';
                        break;
                    case '\t':
                        result += '\\t';
                        break;
                    case '\b':
                        result += '\\b';
                        break;
                    case '\f':
                        result += '\\f';
                        break;
                    default:
                        result += char;
                }
            } else {
                result += char;
            }
        }

        return result;
    }

    private cleanJsonResponse(text: string): string {
        // Remove markdown code blocks
        let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

        // Find the first '{'
        const firstBrace = cleaned.indexOf('{');
        if (firstBrace === -1) return '{}'; // No JSON found

        cleaned = cleaned.substring(firstBrace);

        // CRITICAL FIX: Escape unescaped control characters within JSON strings
        // This fixes "Bad control character in string literal" errors
        cleaned = this.escapeControlCharsInJson(cleaned);

        // Try to parse as is
        try {
            JSON.parse(cleaned);
            return cleaned;
        } catch (e) {
            // If it fails, it might have trailing text after valid JSON
            // Use bracket balancing to find where the JSON actually ends

            let depth = 0;
            let inStr = false;
            let esc = false;
            let jsonEnd = -1;

            for (let i = 0; i < cleaned.length; i++) {
                const char = cleaned[i];

                if (esc) {
                    esc = false;
                    continue;
                }

                if (char === '\\' && inStr) {
                    esc = true;
                    continue;
                }

                if (char === '"') {
                    inStr = !inStr;
                    continue;
                }

                if (!inStr) {
                    if (char === '{') {
                        depth++;
                    } else if (char === '}') {
                        depth--;
                        if (depth === 0) {
                            jsonEnd = i;
                            break; // Found the end of the root object
                        }
                    }
                }
            }

            if (jsonEnd !== -1) {
                const candidate = cleaned.substring(0, jsonEnd + 1);
                try {
                    JSON.parse(candidate);
                    return candidate;
                } catch (e2) {
                    // Continue to fallback
                }
            }

            // Fallback: Try to find the last '}'

            // 2. Simple repair for truncated JSON (common in large generations)
            // This is a basic heuristic: try closing open braces/brackets
            // A proper parser would be better, but this catches common truncation cases
            const stack: string[] = [];
            let inString = false;
            let escape = false;

            for (const char of cleaned) {
                if (escape) {
                    escape = false;
                    continue;
                }
                if (char === '\\') {
                    escape = true;
                    continue;
                }
                if (char === '"') {
                    inString = !inString;
                    continue;
                }
                if (!inString) {
                    if (char === '{') stack.push('}');
                    else if (char === '[') stack.push(']');
                    else if (char === '}') {
                        if (stack.length > 0 && stack[stack.length - 1]! === '}') stack.pop();
                    }
                    else if (char === ']') {
                        if (stack.length > 0 && stack[stack.length - 1]! === ']') stack.pop();
                    }
                }
            }

            // Append missing closing characters
            let repaired = cleaned;
            // If we are inside a string, close it first
            if (inString) repaired += '"';

            // Close remaining structures in reverse order
            while (stack.length > 0) {
                repaired += stack.pop();
            }

            try {
                JSON.parse(repaired);
                return repaired;
            } catch (e) {
                console.error('Failed to repair JSON:', e);
                // Return original cleaned string to let the main parser throw the error
                // so we can see the original issue in logs
                return cleaned;
            }
        }
    }

    private handleError(error: any): Error {
        const errorMessage = error.message || error.toString();
        if (errorMessage.includes('API_KEY')) return new Error('API key de Gemini inválida');
        if (errorMessage.includes('quota')) return new Error('Límite de cuota excedido');
        return new Error(`Error en generación de sermón: ${errorMessage}`);
    }

    /** Gemini blocks the candidate (finishReason RECITATION) when the output
     *  reproduces copyrighted training/source text. Detect it so the caller can
     *  retry with a recitation-safe prompt. */
    private isRecitationError(error: any): boolean {
        const msg = (error?.message || error?.toString() || '') as string;
        return /RECITATION/i.test(msg);
    }

    async generateHomileticsPreview(
        exegesis: ExegeticalStudy,
        rules: GenerationRules,
        _config?: any,
        language: SupportedLanguage = DEFAULT_LANGUAGE,
    ): Promise<import('@dosfilos/domain').HomileticalApproachPreview[]> {
        try {
            const { HomileticsPreviewPromptBuilder } = await import('./prompts/HomileticsPreviewPromptBuilder');
            const directive = language === 'en'
                ? 'IMPORTANT: Respond entirely in English. Field values inside any JSON output must also be in English.\n\n'
                : '';
            const prompt = directive + new HomileticsPreviewPromptBuilder()
                .withExegesis(exegesis)
                .withRules(rules)
                .build();

            const text = await runLlmPrompt({
                feature: 'sermon.homileticsPreview',
                prompt: prompt,
                safety: 'standard',
                ...(_config?.aiModel ? { model: _config.aiModel } : {}),
                temperature: _config?.temperature ?? GEMINI_CONFIG.GENERATION_CONFIG.temperature,
                ...(_config?.fileSearchStoreId
                    ? { fileSearchStoreId: _config.fileSearchStoreId }
                    : { responseMimeType: 'application/json' as const }),
            });
            const parsed = JSON.parse(this.cleanJsonResponse(text));
            // ... (keep parsing logic) ...
            const previews: import('@dosfilos/domain').HomileticalApproachPreview[] = Array.isArray(parsed.homileticalApproaches)
                ? parsed.homileticalApproaches.map((approach: any) => ({
                    id: approach.id || `${approach.type}-${Math.random().toString(36).substring(7)}`,
                    type: approach.type,
                    direction: approach.direction || '',
                    tone: approach.tone || 'conversacional',
                    purpose: approach.purpose || '',
                    suggestedStructure: approach.suggestedStructure || '',
                    targetAudience: approach.targetAudience || 'Congregación general',
                    rationale: approach.rationale || ''
                }))
                : [];

            if (previews.length === 0) throw new Error('No se generaron vistas previas de enfoques válidos');
            return previews;
        } catch (error: any) {
            console.error('❌ [Phase 1] Error generating approach previews:', error);
            throw this.handleError(error);
        }
    }

    async developSelectedApproach(
        exegesis: ExegeticalStudy,
        selectedPreview: import('@dosfilos/domain').HomileticalApproachPreview,
        rules: GenerationRules,
        _config?: any,
        language: SupportedLanguage = DEFAULT_LANGUAGE,
    ): Promise<import('@dosfilos/domain').HomileticalApproach> {
        try {
            const { ApproachDevelopmentPromptBuilder } = await import('./prompts/ApproachDevelopmentPromptBuilder');
            const directive = language === 'en'
                ? 'IMPORTANT: Respond entirely in English. Field values inside any JSON output must also be in English.\n\n'
                : '';
            const prompt = directive + new ApproachDevelopmentPromptBuilder()
                .withExegesis(exegesis)
                .withSelectedPreview(selectedPreview)
                .withRules(rules)
                .build();

            const text = await runLlmPrompt({
                feature: 'sermon.developApproach',
                prompt: prompt,
                safety: 'standard',
                ...(_config?.aiModel ? { model: _config.aiModel } : {}),
                temperature: _config?.temperature ?? GEMINI_CONFIG.GENERATION_CONFIG.temperature,
                ...(_config?.fileSearchStoreId
                    ? { fileSearchStoreId: _config.fileSearchStoreId }
                    : { responseMimeType: 'application/json' as const }),
            });
            const parsed = JSON.parse(this.cleanJsonResponse(text));

            // ... (keep parsing logic) ...
            const fullApproach: import('@dosfilos/domain').HomileticalApproach = {
                id: selectedPreview.id,
                type: selectedPreview.type,
                direction: selectedPreview.direction,
                tone: selectedPreview.tone,
                purpose: selectedPreview.purpose,
                suggestedStructure: selectedPreview.suggestedStructure,
                targetAudience: selectedPreview.targetAudience,
                rationale: selectedPreview.rationale,
                homileticalProposition: parsed.homileticalProposition || '',
                outlinePreview: Array.isArray(parsed.outlinePreview) ? parsed.outlinePreview : undefined,
                contemporaryApplication: Array.isArray(parsed.contemporaryApplication) ? parsed.contemporaryApplication : [],
                outline: parsed.outline || { mainPoints: [] }
            };

            if (!fullApproach.homileticalProposition || !fullApproach.outline.mainPoints || fullApproach.outline.mainPoints.length === 0) {
                throw new Error('El enfoque desarrollado está incompleto');
            }
            return fullApproach;
        } catch (error: any) {
            console.error(`❌ [Phase 2] Error developing approach ${selectedPreview.id}:`, error);
            throw this.handleError(error);
        }
    }
}

/**
 * Strips Gemini tool-call syntax that occasionally leaks into the
 * response text. When the model is given the `fileSearch` tool, it can
 * emit a Python-style invocation (`print(file_search.query("…"))` or
 * raw `file_search.query(...)` lines) as plain text instead of as a
 * function-call part. The SDK then concatenates that into `.text()`
 * and the user sees the leaked code at the top of the assistant
 * reply.
 *
 * Surfaced 2026-05-21 in prod: user asked "que relación tiene Juan
 * 1:1 con Génesis 1:1?" in the exegesis chat and the response opened
 * with `print(file_search.query("relaci...` before the actual pastoral
 * reply. Until the root cause (SDK / tool-registration mismatch) is
 * fixed, this defensive scrub keeps the user surface clean.
 *
 * Patterns matched (only at the START of the response — trailing
 * mentions inside legitimate prose are left alone):
 *   - `print(file_search.query(…))` with or without surrounding code
 *     fences and trailing newlines.
 *   - Bare `file_search.query(…)` / `default_api.file_search.query(…)`
 *     lines.
 *   - Markdown code fences wrapping either of the above.
 */
export function sanitizeChatResponseText(text: string): string {
    if (!text) return text;
    let result = text;
    // Strip a leading fenced code block when its body is just a
    // tool-call invocation. Up to ~3 leading blocks are peeled in
    // case the model wraps + repeats.
    for (let i = 0; i < 3; i++) {
        const codeFenceMatch = result.match(/^\s*```[\w-]*\s*\n([\s\S]*?)```\s*\n*/);
        if (codeFenceMatch && /(?:default_api\.)?(?:print\s*\(\s*)?(?:default_api\.)?file_search\.(?:query|search)/i.test(codeFenceMatch[1] ?? '')) {
            result = result.slice(codeFenceMatch[0].length);
            continue;
        }
        // Bare leading `print(file_search…)` / `file_search.query(…)`
        // line(s) — peel as long as the next line still matches.
        const bareMatch = result.match(/^\s*(?:print\s*\(\s*)?(?:default_api\.)?file_search\.(?:query|search)\s*\([\s\S]*?\)\s*\)?\s*\n*/i);
        if (bareMatch) {
            result = result.slice(bareMatch[0].length);
            continue;
        }
        break;
    }
    return result.trimStart();
}
