/**
 * Tabla de precios y estimación de costo por llamada LLM.
 *
 * Es DATO EDITABLE, no lógica: cuando cambian los precios de lista se edita esta
 * tabla y nada más. Vive en `functions` porque es ahí donde corre el medidor
 * (`packages/functions` no puede importar `@dosfilos/domain` sin reventar el
 * build con ~180 TS6059).
 *
 * Precios en USD por 1M de tokens, según lista pública de cada proveedor. La
 * estimación es eso — una ESTIMACIÓN: no reemplaza la factura, sirve para ver
 * tendencias y para que una fuga se note el mismo día en vez de a fin de mes.
 */

export interface ModelPricing {
    /** USD por 1M tokens de entrada. */
    inputPer1M: number;
    /** USD por 1M tokens de salida. */
    outputPer1M: number;
    /**
     * Cambios de precio anunciados, con la fecha (UTC, `AAAA-MM-DD`) desde la
     * que rigen. Se aplica el último cuya fecha ya pasó. Existe porque Google
     * publicó que los 3.x duplican su precio el 1 de enero de 2027: sin esto el
     * panel seguiría estimando con el precio viejo sin que nadie lo notara.
     */
    cambios?: ReadonlyArray<{ desde: string; inputPer1M: number; outputPer1M: number }>;
}

export const LLM_PRICING: Record<string, ModelPricing> = {
    'gemini-2.5-flash': { inputPer1M: 0.3, outputPer1M: 2.5 },
    'gemini-2.5-pro': { inputPer1M: 1.25, outputPer1M: 10 },
    'gemini-2.0-flash': { inputPer1M: 0.1, outputPer1M: 0.4 },
    // Leído en ai.google.dev/gemini-api/docs/pricing por el fundador el
    // 2026-09-30 (Estándar, nivel de pago).
    'gemini-3.8-flash': {
        inputPer1M: 0.75,
        outputPer1M: 3.75,
        cambios: [{ desde: '2027-01-01', inputPer1M: 1.5, outputPer1M: 7.5 }],
    },
    // OpenAI, para el ruteo por función (2026-09-30). Leídos por investigación
    // automatizada en developers.openai.com/api/docs/pricing, sin confirmar a
    // mano: con ellos el bakeoff de visión costó ~$0,70, y el panel de uso de
    // OpenAI es donde se contrasta.
    'gpt-6-luna': { inputPer1M: 0.1, outputPer1M: 0.5 },
    'gpt-6.1-sol': { inputPer1M: 2, outputPer1M: 10 },
    'claude-sonnet-4-6': { inputPer1M: 3, outputPer1M: 15 },
    'claude-haiku-4-5': { inputPer1M: 1, outputPer1M: 5 },
    // Embeddings: solo cobran entrada. Sin precio propio caerían al respaldo
    // caro y el panel mostraría el indexado de una biblioteca como si costara
    // veinte veces lo que cuesta.
    'gemini-embedding-001': { inputPer1M: 0.15, outputPer1M: 0 },
};

/**
 * Precio de respaldo para un modelo que no está en la tabla. Se elige el de un
 * modelo CARO a propósito: si aparece un modelo nuevo sin precio, preferimos
 * sobreestimar y que alguien lo note, antes que subestimar en silencio.
 */
export const FALLBACK_PRICING: ModelPricing = { inputPer1M: 3, outputPer1M: 15 };

export function pricingFor(model: string, now: Date = new Date()): ModelPricing {
    const base = LLM_PRICING[model] ?? FALLBACK_PRICING;
    const hoy = now.toISOString().slice(0, 10);
    const vigente = [...(base.cambios ?? [])]
        .filter((c) => c.desde <= hoy)
        .sort((a, b) => a.desde.localeCompare(b.desde))
        .pop();
    return vigente ? { inputPer1M: vigente.inputPer1M, outputPer1M: vigente.outputPer1M } : base;
}

/** ¿El modelo tiene precio propio, o se está usando el respaldo? */
export function hasKnownPricing(model: string): boolean {
    return model in LLM_PRICING;
}

/** Costo estimado en USD de una llamada. Nunca negativo; tokens inválidos → 0. */
export function estimateUsd(model: string, inputTokens: number, outputTokens: number, now: Date = new Date()): number {
    const p = pricingFor(model, now);
    const inTok = Number.isFinite(inputTokens) && inputTokens > 0 ? inputTokens : 0;
    const outTok = Number.isFinite(outputTokens) && outputTokens > 0 ? outputTokens : 0;
    return (inTok / 1_000_000) * p.inputPer1M + (outTok / 1_000_000) * p.outputPer1M;
}
