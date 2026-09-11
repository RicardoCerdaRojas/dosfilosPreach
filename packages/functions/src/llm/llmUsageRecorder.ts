import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { estimateUsd, hasKnownPricing } from './llmCost';

/**
 * Medidor de consumo LLM del servidor.
 *
 * Antes de esto el gasto era INVISIBLE: los SDK devuelven el consumo en cada
 * respuesta (`usageMetadata` en Gemini, `usage` en Anthropic) y los adapters lo
 * tiraban a la basura. No había forma de saber que el gasto subió hasta ver la
 * factura — y con el flag `passage_profile` encendido para toda la base, cada
 * estudio dispara llamadas que antes no ocurrían.
 *
 * FORMA DEL DATO: un documento por día (`llmUsageDaily/{YYYY-MM-DD}`) con
 * contadores atómicos. Un doc por llamada sería más fino y mucho más caro de
 * leer; los cortes que importan (por feature, por usuario, por modelo) caben
 * como mapas dentro del doc del día.
 *
 * FIRE-AND-FORGET: el medidor JAMÁS puede romper la llamada que mide. Un fallo
 * de escritura se registra y se traga. Perder una medición es aceptable;
 * romperle el estudio a un pastor por un contador, no.
 */

export interface LlmUsageContext {
    /** Qué feature gastó — el callable o el uso concreto. */
    feature: string;
    /** Quién gastó. Permite distinguir "creció el uso" de "alguien está abusando". */
    userId?: string;
}

export interface LlmUsageRecord extends LlmUsageContext {
    model: string;
    inputTokens: number;
    outputTokens: number;
    /**
     * Tokens de razonamiento (`thoughtsTokenCount` en Gemini 2.5+).
     *
     * Vienen APARTE de `candidatesTokenCount` y se facturan como salida, así
     * que hasta ahora el panel venía subcontando todo lo que los usara: en una
     * llamada de extracción medida fueron 32 584 tokens que ningún tablero vio.
     * Se suman al costo y además se guardan por separado, porque «cuánto de la
     * factura es razonamiento» es la pregunta que permite decidir si conviene
     * apagarlo en una feature concreta.
     */
    thinkingTokens?: number;
}

/** Clave del documento del día, en UTC (mismo huso que los jobs programados). */
export function usageDayKey(now: Date = new Date()): string {
    return now.toISOString().slice(0, 10);
}

/**
 * Clave del documento del mes. Existe para que el guardia de presupuesto y la
 * alerta lean UN documento en vez de sumar 31: se consultan en caliente (por
 * llamada / cada hora) y sumar el mes cada vez sería más caro que lo que miden.
 */
export function usageMonthKey(now: Date = new Date()): string {
    return now.toISOString().slice(0, 7);
}

/**
 * Las claves de un mapa de Firestore no pueden llevar `.` `/` `~` `*` `[` `]`.
 * Los ids de modelo y los uid son seguros, pero el nombre de feature lo escribe
 * quien llama: se sanea acá y no en cada caller.
 */
export function safeMapKey(raw: string): string {
    const cleaned = (raw ?? '').replace(/[.$/~*[\]#]/g, '_').trim();
    return cleaned.length > 0 ? cleaned.slice(0, 100) : 'unknown';
}

/**
 * Arma el patch del documento diario. PURO y exportado para poder probar su
 * FORMA: el bug que motivó esto no se veía en ningún test porque nadie miraba
 * la estructura del objeto que se escribe.
 *
 * CLAVE: los cortes van como mapas ANIDADOS, no como claves con puntos.
 * `set(..., { merge: true })` NO interpreta los puntos como rutas de campo (solo
 * `update()` lo hace), así que `{'byFeature.x.calls': 1}` crea un campo llamado
 * literalmente "byFeature.x.calls" y el lector nunca lo encuentra. Los
 * `increment` funcionan igual de bien anidados.
 */
/**
 * Tokens de salida que el proveedor cobra: el contenido MÁS el razonamiento.
 *
 * Una sola función para que el patch del día y el acumulado del mes no puedan
 * discrepar. Cuando el costo se calculaba en dos lugares con la misma fórmula
 * escrita dos veces, alcanzaba con corregir uno para que el panel dejara de
 * cuadrar consigo mismo.
 */
export function salidaFacturable(record: LlmUsageRecord): number {
    return (record.outputTokens || 0) + (record.thinkingTokens || 0);
}

export function buildUsagePatch(record: LlmUsageRecord, now: Date = new Date()): Record<string, unknown> {
    const { model, feature, userId, inputTokens } = record;
    const usd = estimateUsd(model, inputTokens, salidaFacturable(record));
    const inc = FieldValue.increment;
    const inTok = inputTokens || 0;
    const outTok = record.outputTokens || 0;
    const razTok = record.thinkingTokens || 0;

    return {
        day: usageDayKey(now),
        calls: inc(1),
        inputTokens: inc(inTok),
        outputTokens: inc(outTok),
        // Aparte del contenido a propósito: sumarlo a `outputTokens` haría
        // desaparecer justo el dato que sirve para decidir dónde apagarlo.
        thinkingTokens: inc(razTok),
        usd: inc(usd),
        byFeature: {
            [safeMapKey(feature)]: {
                calls: inc(1),
                usd: inc(usd),
                inputTokens: inc(inTok),
                outputTokens: inc(outTok),
                thinkingTokens: inc(razTok),
            },
        },
        byModel: {
            [safeMapKey(model)]: { calls: inc(1), usd: inc(usd) },
        },
        ...(userId ? { byUser: { [safeMapKey(userId)]: { calls: inc(1), usd: inc(usd) } } } : {}),
        // Un modelo sin precio propio se cuenta aparte: el total lleva una
        // estimación de respaldo y hay que saber cuánto del total es eso.
        ...(hasKnownPricing(model) ? {} : { usdFromFallbackPricing: inc(usd) }),
        updatedAt: FieldValue.serverTimestamp(),
    };
}

export async function recordLlmUsage(record: LlmUsageRecord, now: Date = new Date()): Promise<void> {
    try {
        const usd = estimateUsd(record.model, record.inputTokens, salidaFacturable(record));
        const db = admin.firestore();
        await Promise.all([
            db.collection('llmUsageDaily').doc(usageDayKey(now)).set(buildUsagePatch(record, now), { merge: true }),
            // El acumulado del mes: solo los totales, sin los cortes (esos se leen
            // del día). Es lo que consultan el guardia y la alerta.
            db.collection('llmUsageMonthly').doc(usageMonthKey(now)).set(
                {
                    month: usageMonthKey(now),
                    calls: FieldValue.increment(1),
                    usd: FieldValue.increment(usd),
                    updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            ),
        ]);
    } catch (err) {
        console.warn('[llmUsage] no se pudo registrar el consumo (no bloqueante)', err);
    }
}
