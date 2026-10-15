import { AnthropicLlmClient } from './AnthropicLlmClient';
import { GeminiLlmClient } from './GeminiLlmClient';
import type { ILlmClient, LlmGenerateOptions } from './LlmClient';
import type { LlmUsageContext } from './llmUsageRecorder';
import { MODEL_DEEP } from './modelCatalog';
import { OpenAiLlmClient } from './OpenAiLlmClient';
import { rutaPropiaPara, type RutaDeModelo } from './ruteoDeModelos';

/**
 * Las funciones del servidor que eligen su modelo por `config/llmRouting`.
 *
 * Llamaban a Claude Sonnet directo, fuera del ruteo: sin respaldo si fallaba,
 * y sin poder cambiar de modelo sin un deploy. En octubre de 2026 la cuenta de
 * Anthropic se quedó sin saldo y nada lo avisó (decisión del fundador,
 * 2026-10-15: pasarlas por el ruteo y medir antes de moverlas a OpenAI).
 */
export const FUNCIONES_DEL_SERVIDOR = [
    'adjudicateAnchorRefutes',
    'reviewVerifiedMisreading',
    'evaluateCoverageEngagement',
    'evaluateGenreEngagement',
    'evaluateClaimSourceFidelity.escalation',
    'sanitizeSermonCitations',
    'teachingSuite.generarPlan',
    'teachingSuite.proponerOutlineCurso',
    // Fase «biblioteca consultable» (2026-10-15): nacen en el ruteo, con Luna.
    'library.consult',
] as const;
export type FuncionDelServidor = typeof FUNCIONES_DEL_SERVIDOR[number];

/** Lo que usaban: sin entrada propia en el ruteo, nada cambia. */
export const RUTA_SONNET: RutaDeModelo = { provider: 'anthropic', model: 'claude-sonnet-4-6' };

export interface OpcionesDeCliente {
    usage: LlmUsageContext & { feature: FuncionDelServidor };
    /** El timeout de la función: el respaldo sólo entra si le queda tiempo. */
    timeoutSeconds: number;
    /** Tope de salida que usaba el adaptador de Anthropic (4096 por defecto). */
    maxOutputTokens?: number;
}

/** Lo que ve el usuario si no responde nadie: sin nombres de proveedor ni de modelo. */
export const MENSAJE_SIN_RESPUESTA = 'El asistente no respondió. Intenta de nuevo en unos minutos.';

/**
 * El cliente que la función usa: el de su ruta propia (o Sonnet), con Gemini
 * de respaldo si ése falla y queda tiempo.
 */
export async function clientePorRuta(opciones: OpcionesDeCliente): Promise<ILlmClient> {
    const ruta = (await rutaPropiaPara(opciones.usage.feature)) ?? RUTA_SONNET;
    const principal = construir(ruta, opciones);
    const gemini = process.env.GEMINI_API_KEY;
    const respaldo = ruta.provider !== 'gemini' && gemini
        ? new GeminiLlmClient(gemini, MODEL_DEEP, opciones.usage)
        : null;
    if (!principal && !respaldo) {
        console.error(`[clientePorRuta] ${opciones.usage.feature}: no hay clave para ${ruta.provider} ni para Gemini`);
        throw new Error(MENSAJE_SIN_RESPUESTA);
    }
    return new ClienteConRespaldo(
        principal,
        respaldo,
        `${opciones.usage.feature} (${ruta.provider}/${ruta.model})`,
        opciones.timeoutSeconds * 1000,
    );
}

function construir(ruta: RutaDeModelo, opciones: OpcionesDeCliente): ILlmClient | null {
    if (ruta.provider === 'openai') {
        const clave = process.env.OPENAI_API_KEY;
        return clave ? new OpenAiLlmClient(clave, ruta.model, opciones.usage, ruta.reasoning ?? 'none') : null;
    }
    if (ruta.provider === 'anthropic') {
        const clave = process.env.ANTHROPIC_API_KEY;
        return clave ? new AnthropicLlmClient(clave, ruta.model, opciones.maxOutputTokens, opciones.usage) : null;
    }
    const clave = process.env.GEMINI_API_KEY;
    return clave ? new GeminiLlmClient(clave, ruta.model, opciones.usage) : null;
}

/** La parte del límite que se guarda para que Gemini alcance a responder. */
export const RESERVA_PARA_RESPALDO = 0.4;
/** Con razonamiento, Gemini 2.5 cobra lo pensado del mismo tope de salida. */
const TOPE_MINIMO_DEL_RESPALDO = 8192;

/**
 * Prueba el principal; si falla y queda tiempo, Gemini. Exportada para las
 * pruebas.
 *
 * El plazo es el de la FUNCIÓN, no el de cada llamada: hay funciones que
 * hacen treinta seguidas con el mismo cliente. El pedido al principal se corta
 * antes de invadir la reserva del respaldo, y si el principal falla una vez,
 * el resto de la función va directo a Gemini (revisión adversarial de #769).
 */
export class ClienteConRespaldo implements ILlmClient {
    private readonly vence: number;
    private principalCaido = false;

    constructor(
        private readonly principal: ILlmClient | null,
        private readonly respaldo: ILlmClient | null,
        private readonly etiqueta: string,
        private readonly limiteMs: number,
        private readonly ahora: () => number = () => Date.now(),
    ) {
        this.vence = this.ahora() + limiteMs;
    }

    async generate(options: LlmGenerateOptions): Promise<string> {
        if (!this.principal || this.principalCaido) return this.porRespaldo(options, null);
        const reserva = this.respaldo ? this.limiteMs * RESERVA_PARA_RESPALDO : 0;
        const margen = this.vence - this.ahora() - reserva;
        try {
            return await this.principal.generate({ ...options, signal: AbortSignal.timeout(Math.max(1_000, margen)) });
        } catch (err) {
            this.principalCaido = true;
            return this.porRespaldo(options, err);
        }
    }

    private async porRespaldo(options: LlmGenerateOptions, causa: unknown): Promise<string> {
        const motivo = causa instanceof Error ? causa.message : causa;
        const queda = this.vence - this.ahora();
        if (!this.respaldo || queda < this.limiteMs * RESERVA_PARA_RESPALDO * 0.5) {
            console.error(`[clientePorRuta] ${this.etiqueta} sin respuesta (queda ${Math.round(queda / 1000)} s):`, motivo);
            throw new Error(MENSAJE_SIN_RESPUESTA);
        }
        if (causa) console.warn(`[clientePorRuta] ${this.etiqueta} cae a Gemini:`, motivo);
        try {
            return await this.respaldo.generate({
                ...options,
                signal: undefined,
                ...(options.maxOutputTokens ? { maxOutputTokens: Math.max(options.maxOutputTokens, TOPE_MINIMO_DEL_RESPALDO) } : {}),
            });
        } catch (err) {
            console.error(`[clientePorRuta] ${this.etiqueta}: también falló Gemini:`, err instanceof Error ? err.message : err);
            throw new Error(MENSAJE_SIN_RESPUESTA);
        }
    }
}
