import * as admin from 'firebase-admin';
import { usageDayKey, usageMonthKey } from './llmUsageRecorder';

/**
 * Presupuesto y guardia de gasto LLM.
 *
 * El presupuesto vive en `config/llmBudget` como DATO EDITABLE: cambiarlo no
 * requiere deploy. Los defaults de acá solo aplican si el documento no existe.
 */

export interface LlmBudgetConfig {
    /** Presupuesto mensual en USD. */
    monthlyUsd: number;
    /**
     * Tope DIARIO de gasto total sobre el cual la sombra deja de llamar al LLM.
     * La sombra es prescindible por definición: perder una medición no le hace
     * daño a nadie, una factura inesperada sí. Fail-open para el pastor,
     * fail-closed para el gasto.
     */
    shadowDailyUsdCap: number;
    /** Umbrales de aviso, en % del presupuesto mensual. */
    alertPcts: number[];
    /** Tope de llamadas al proxy por usuario y por hora. */
    proxyMaxCallsPerHourPerUser: number;
    /**
     * El cobro de exégesis en el servidor (2026-10-17). En `sombra`,
     * `runLlmPrompt` registra las llamadas que cobran sin reserva válida pero
     * no las rechaza; en `obligatorio`, las rechaza. Se pasa a obligatorio con
     * el OK del fundador, después de unos días en sombra.
     */
    cobroExegesis: 'sombra' | 'obligatorio';
}

export const DEFAULT_BUDGET: LlmBudgetConfig = {
    monthlyUsd: 25,
    shadowDailyUsdCap: 1.5,
    // Se avisa a la MITAD y no al 90%: con un presupuesto chico, para cuando
    // llegas al 90% ya no queda margen de reacción.
    alertPcts: [50, 80, 100],
    // Con 13 usuarios esto es holgado; existe para que un cliente manipulado (o
    // un bucle accidental en la UI) no vacíe el presupuesto en una tarde.
    proxyMaxCallsPerHourPerUser: 120,
    cobroExegesis: 'sombra',
};

export async function readBudgetConfig(): Promise<LlmBudgetConfig> {
    try {
        const doc = await admin.firestore().collection('config').doc('llmBudget').get();
        const d = doc.data() ?? {};
        return {
            monthlyUsd: numberOr(d.monthlyUsd, DEFAULT_BUDGET.monthlyUsd),
            shadowDailyUsdCap: numberOr(d.shadowDailyUsdCap, DEFAULT_BUDGET.shadowDailyUsdCap),
            alertPcts: Array.isArray(d.alertPcts) && d.alertPcts.length > 0 ? d.alertPcts : DEFAULT_BUDGET.alertPcts,
            proxyMaxCallsPerHourPerUser: numberOr(
                d.proxyMaxCallsPerHourPerUser,
                DEFAULT_BUDGET.proxyMaxCallsPerHourPerUser,
            ),
            cobroExegesis: d.cobroExegesis === 'obligatorio' ? 'obligatorio' : 'sombra',
        };
    } catch (err) {
        console.warn('[llmBudget] no se pudo leer la config; se usan los defaults', err);
        return DEFAULT_BUDGET;
    }
}

/** Gasto del mes en curso (un solo documento). */
export async function readMonthUsd(now: Date = new Date()): Promise<number> {
    const doc = await admin.firestore().collection('llmUsageMonthly').doc(usageMonthKey(now)).get();
    return numberOr(doc.data()?.usd, 0);
}

/** Gasto del día (un solo documento). */
export async function readDayUsd(now: Date = new Date()): Promise<number> {
    const doc = await admin.firestore().collection('llmUsageDaily').doc(usageDayKey(now)).get();
    return numberOr(doc.data()?.usd, 0);
}

/**
 * La decisión pura: ¿el día ya alcanzó el tope? Separada de la lectura para que
 * la POLÍTICA se pueda probar sin Firestore. Un tope de 0 o negativo desactiva
 * el cortacircuito (nunca corta) en vez de cortar siempre — apagar la medición
 * por una config vacía sería el peor default posible.
 */
export function shadowExhausted(dayUsd: number, cap: number): boolean {
    if (!Number.isFinite(cap) || cap <= 0) return false;
    if (!Number.isFinite(dayUsd)) return false;
    return dayUsd >= cap;
}

/**
 * Caché por instancia. El guardia se consulta ANTES de cada llamada de sombra;
 * sin caché, medir el gasto costaría una lectura por llamada — el remedio sería
 * parte de la enfermedad. 60s de desfase es aceptable para un tope diario.
 */
let cache: { atMs: number; exhausted: boolean } | null = null;
const CACHE_TTL_MS = 60_000;

/** Para tests: limpia el estado entre casos. */
export function __resetShadowGuardCache(): void {
    cache = null;
}

/**
 * ¿Puede la sombra gastar en LLM ahora mismo?
 *
 * FAIL-OPEN ante un error de lectura: si no podemos saber cuánto se gastó, NO
 * apagamos la medición — un fallo de Firestore no puede dejarnos ciegos encima
 * de ciego. El techo duro es el presupuesto de la nube, no este guardia.
 */
export async function shadowLlmAllowed(nowMs: number = Date.now()): Promise<boolean> {
    if (cache && nowMs - cache.atMs < CACHE_TTL_MS) return !cache.exhausted;
    try {
        const [cfg, dayUsd] = await Promise.all([readBudgetConfig(), readDayUsd(new Date(nowMs))]);
        const exhausted = shadowExhausted(dayUsd, cfg.shadowDailyUsdCap);
        cache = { atMs: nowMs, exhausted };
        if (exhausted) {
            console.warn(
                `[llmBudget] sombra en pausa: el gasto del día (${dayUsd.toFixed(2)} USD) alcanzó el tope ${cfg.shadowDailyUsdCap} USD`,
            );
        }
        return !exhausted;
    } catch (err) {
        console.warn('[llmBudget] no se pudo evaluar el tope de sombra; se permite (fail-open)', err);
        return true;
    }
}

function numberOr(value: unknown, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}
