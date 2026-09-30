import type { ILlmClient, LlmGenerateOptions } from './LlmClient';
import { recordLlmUsage, type LlmUsageContext } from './llmUsageRecorder';

/**
 * Adaptador de OpenAI para el port `ILlmClient`.
 *
 * Existe para poder asignar modelos por función: el bakeoff de visión del
 * 2026-09-30 mostró que GPT-6 Luna cuesta entre cuatro y ocho veces menos que los
 * Gemini, y la pregunta abierta es en qué tareas de TEXTO rinde igual. Sin este
 * adaptador esa pregunta no se puede contestar con el código real.
 *
 * Habla con la Responses API por `fetch`, sin SDK: el port es texto→texto y un
 * pedido HTTP es todo lo que hace falta. Una dependencia más sería otra cosa que
 * mantener al día, que es justo lo que costó el SDK viejo de Gemini.
 *
 * Tres detalles que no se ven en la firma:
 *  - `reasoning.effort`: Luna acepta `none`; Sol no baja de `low`. Lo razonado se
 *    factura como salida Y cuenta contra `max_output_tokens`.
 *  - JSON: con `application/json` se pide `json_object`, que exige que la palabra
 *    «JSON» aparezca en la ENTRADA —en las instrucciones no alcanza; se probó—.
 *    Se agrega sola al final del pedido si falta.
 *  - `incomplete`: es el MAX_TOKENS de OpenAI. Se lanza con el motivo en vez de
 *    devolver media respuesta como si fuera buena.
 */

export type EsfuerzoDeRazonamiento = 'none' | 'minimal' | 'low' | 'medium' | 'high';

const URL_RESPONSES = 'https://api.openai.com/v1/responses';
const REINTENTOS = 3;

export class OpenAiLlmClient implements ILlmClient {
    /** Consumo total de la última llamada; mismo contrato que `GeminiLlmClient`. */
    lastTotalTokens: number | null = null;

    constructor(
        private readonly apiKey: string,
        private readonly modelName: string,
        private readonly usage?: LlmUsageContext,
        private readonly razonamiento: EsfuerzoDeRazonamiento = 'none',
        private readonly fetchImpl: typeof fetch = fetch,
    ) {}

    async generate(options: LlmGenerateOptions): Promise<string> {
        const quiereJson = options.responseMimeType === 'application/json';
        const cuerpo = {
            model: this.modelName,
            input: quiereJson ? conPalabraJson(options.prompt) : options.prompt,
            ...(options.system ? { instructions: options.system } : {}),
            reasoning: { effort: this.razonamiento },
            // OpenAI ignora `temperature` en los modelos que razonan; con
            // razonamiento apagado sí la respeta.
            ...(this.razonamiento === 'none' ? { temperature: options.temperature ?? 0.2 } : {}),
            ...(options.maxOutputTokens ? { max_output_tokens: options.maxOutputTokens } : {}),
            ...(quiereJson ? { text: { format: { type: 'json_object' } } } : {}),
        };

        const body = await this.pedir(cuerpo);
        const uso = body.usage ?? {};
        this.lastTotalTokens = typeof uso.total_tokens === 'number' ? uso.total_tokens : null;
        const razonados = uso.output_tokens_details?.reasoning_tokens ?? 0;
        void recordLlmUsage({
            model: this.modelName,
            feature: this.usage?.feature ?? 'unknown',
            userId: this.usage?.userId,
            inputTokens: uso.input_tokens ?? 0,
            // `output_tokens` YA incluye lo razonado: se separa para que el
            // medidor no lo cobre dos veces.
            outputTokens: Math.max(0, (uso.output_tokens ?? 0) - razonados),
            thinkingTokens: razonados,
        });

        if (body.status === 'incomplete') {
            throw new Error(`OpenAI devolvió una respuesta incompleta (${body.incomplete_details?.reason ?? 'sin motivo'})`);
        }
        return textoDe(body);
    }

    private async pedir(cuerpo: unknown): Promise<RespuestaOpenAi> {
        let ultimo: unknown;
        for (let intento = 1; intento <= REINTENTOS; intento++) {
            const res = await this.fetchImpl(URL_RESPONSES, {
                method: 'POST',
                headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(cuerpo),
            });
            if (res.ok) return (await res.json()) as RespuestaOpenAi;

            const detalle = await res.text();
            ultimo = new Error(`OpenAI HTTP ${res.status}: ${detalle.slice(0, 300)}`);
            // Un 429 puede ser límite de velocidad —se arregla esperando— o falta
            // de saldo —no se arregla nunca—. Lo separa el `code` del cuerpo.
            const sinSaldo = /billing_not_active|insufficient_quota/.test(detalle);
            const transitorio = !sinSaldo && (res.status === 429 || res.status >= 500);
            if (!transitorio || intento === REINTENTOS) break;
            await new Promise((r) => setTimeout(r, 1500 * intento));
        }
        throw ultimo;
    }
}

interface RespuestaOpenAi {
    status?: string;
    incomplete_details?: { reason?: string };
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
        total_tokens?: number;
        output_tokens_details?: { reasoning_tokens?: number };
    };
}

function conPalabraJson(prompt: string): string {
    return /json/i.test(prompt) ? prompt : `${prompt}\n\nResponde únicamente con JSON válido.`;
}

function textoDe(body: RespuestaOpenAi): string {
    if (typeof body.output_text === 'string') return body.output_text;
    return (body.output ?? [])
        .flatMap((o) => o.content ?? [])
        .filter((c) => c.type === 'output_text' && typeof c.text === 'string')
        .map((c) => c.text as string)
        .join('');
}
