import { GoogleGenAI } from '@google/genai';
import { textoDeGemini } from './textoDeGemini';
import type { ILlmClient, LlmGenerateOptions } from './LlmClient';
import { recordLlmUsage, type LlmUsageContext } from './llmUsageRecorder';
import { MODEL_FAST } from './modelCatalog';

/**
 * Gemini adapter for the thin `ILlmClient` port (Phase 2.5, Q7 / ADR-025).
 *
 * New Pastoral Fidelity callables depend on `ILlmClient`, not on this class
 * directly — swapping the provider (e.g. MiniMax) means writing a sibling
 * adapter and changing the one construction line in the callable. The broad
 * refactor of the legacy direct-SDK callers is a separate tech-debt sprint
 * (memory `tech_debt_llm_provider_abstraction`).
 */
export class GeminiLlmClient implements ILlmClient {
    /**
     * `usage` identifica QUIÉN gasta (feature + usuario) para el medidor. Es
     * opcional para no romper callers viejos, pero sin él el gasto aparece bajo
     * `unknown` — que es exactamente el agujero que el medidor viene a tapar.
     */
    constructor(
        private readonly apiKey: string,
        private readonly modelName: string = MODEL_FAST,
        private readonly usage?: LlmUsageContext,
    ) {}

    /**
     * Consumo total de la ÚLTIMA llamada, o `null` si el modelo no lo informó.
     *
     * El port es texto→texto a propósito, así que el dato no cabe en `generate`.
     * Vive acá porque `runLlmPrompt` tiene que devolvérselo al navegador: varios
     * adapters de exégesis leían `usageMetadata.totalTokenCount` y lo muestran
     * en el diálogo de composición ("12.345 tokens · modelo X"). Sin esto, esa
     * línea desaparecería de la UI sin ningún error de por medio.
     */
    lastTotalTokens: number | null = null;

    async generate(options: LlmGenerateOptions): Promise<string> {
        const ai = new GoogleGenAI({ apiKey: this.apiKey });
        const result = await ai.models.generateContent({
            model: this.modelName,
            contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
            config: {
                responseMimeType: options.responseMimeType ?? 'text/plain',
                temperature: options.temperature ?? 0.2,
                ...(options.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
                ...(options.system ? { systemInstruction: options.system } : {}),
            },
        });
        // El consumo viene en la respuesta y hasta ahora se descartaba.
        // Fire-and-forget: medir nunca puede romper la llamada medida.
        const meta = result.usageMetadata;
        this.lastTotalTokens = typeof meta?.totalTokenCount === 'number'
            ? meta.totalTokenCount
            : (((meta?.promptTokenCount ?? 0) + (meta?.candidatesTokenCount ?? 0)) || null);
        void recordLlmUsage({
            model: this.modelName,
            feature: this.usage?.feature ?? 'unknown',
            userId: this.usage?.userId,
            inputTokens: meta?.promptTokenCount ?? 0,
            outputTokens: meta?.candidatesTokenCount ?? 0,
            // El razonamiento se factura como salida; el SDK viejo no lo
            // informaba y este adaptador lo dejaba fuera del panel.
            thinkingTokens: meta?.thoughtsTokenCount ?? 0,
        });
        return textoDeGemini(result);
    }
}
