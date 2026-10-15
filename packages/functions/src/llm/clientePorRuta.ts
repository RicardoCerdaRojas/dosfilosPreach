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
        throw new Error(`${opciones.usage.feature}: no hay clave para ${ruta.provider} ni para Gemini`);
    }
    return new ClienteConRespaldo(
        principal,
        respaldo,
        `${opciones.usage.feature} (${ruta.provider}/${ruta.model})`,
        // La mitad del timeout: Gemini tiene que alcanzar a responder.
        opciones.timeoutSeconds * 1000 / 2,
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

/** Prueba el principal; si falla con tiempo de sobra, Gemini. Exportada para las pruebas. */
export class ClienteConRespaldo implements ILlmClient {
    constructor(
        private readonly principal: ILlmClient | null,
        private readonly respaldo: ILlmClient | null,
        private readonly etiqueta: string,
        private readonly sinRespaldoTrasMs: number,
        private readonly ahora: () => number = () => Date.now(),
    ) {}

    async generate(options: LlmGenerateOptions): Promise<string> {
        if (!this.principal) {
            console.warn(`[clientePorRuta] ${this.etiqueta}: sin clave; va por Gemini`);
            return this.respaldo!.generate(options);
        }
        const desde = this.ahora();
        try {
            return await this.principal.generate(options);
        } catch (err) {
            const motivo = err instanceof Error ? err.message : err;
            if (!this.respaldo || this.ahora() - desde > this.sinRespaldoTrasMs) {
                console.error(`[clientePorRuta] ${this.etiqueta} falló; sin respaldo:`, motivo);
                throw err;
            }
            console.warn(`[clientePorRuta] ${this.etiqueta} cae a Gemini:`, motivo);
            return this.respaldo.generate(options);
        }
    }
}
