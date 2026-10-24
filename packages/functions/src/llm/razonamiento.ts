import { ThinkingLevel, type GenerateContentConfig } from '@google/genai';

/**
 * El nivel de razonamiento que el llamador puede pedir (allowlist). Sirve
 * para las tareas de COPIAR datos, donde razonar es gasto: medido en el
 * lector de bibliografía (gemini-3.8-flash, 2026-10-23), ~6 000 tokens de
 * razonamiento por lectura, que además se descuentan del tope de salida.
 */
const NIVELES: Record<string, ThinkingLevel> = {
    minimal: ThinkingLevel.MINIMAL,
    low: ThinkingLevel.LOW,
    medium: ThinkingLevel.MEDIUM,
    high: ThinkingLevel.HIGH,
};

/** Solo los modelos gemini-3 aceptan `thinkingLevel`; a los demás no se les manda nada. */
export function configDeRazonamiento(thinking: unknown, model: string): Pick<GenerateContentConfig, 'thinkingConfig'> {
    const nivel = typeof thinking === 'string' ? NIVELES[thinking] : undefined;
    if (!nivel || !model.startsWith('gemini-3')) return {};
    return { thinkingConfig: { thinkingLevel: nivel } };
}

/**
 * Si el modelo rechaza el nivel pedido (no está confirmado qué niveles admite
 * cada modelo), la llamada se repite SIN él: mejor gastar el razonamiento que
 * perder la lectura. Queda en el log para ajustarlo.
 */
export async function conRespaldoSinRazonamiento<T>(
    config: GenerateContentConfig,
    llamar: (config: GenerateContentConfig) => Promise<T>,
    etiqueta: string,
): Promise<T> {
    try {
        return await llamar(config);
    } catch (err) {
        const mensaje = err instanceof Error ? err.message : String(err);
        if (!config.thinkingConfig || !/think/i.test(mensaje)) throw err;
        console.warn(`[runLlmPrompt] ${etiqueta}: el modelo rechazó thinkingConfig (${mensaje.slice(0, 200)}); se repite sin él`);
        const { thinkingConfig: _fuera, ...sin } = config;
        return llamar(sin);
    }
}
