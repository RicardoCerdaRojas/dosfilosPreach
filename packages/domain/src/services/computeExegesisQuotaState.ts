import type { ProcessingBalance } from '../entities/User';
import { EXEGESIS_OPERATION_CATALOG, STUDY_UNIT_USD } from '../entities/ExegesisOperationCatalog';

/**
 * Pure helper that derives the UI-friendly state of a user's
 * exégesis quota from their `ProcessingBalance`. No side effects, no
 * async — safe to call inline in render paths.
 *
 * Use cases:
 *   - `UsageBanner` renders a progress bar + "5 / 8 estudios este
 *     mes" copy from this output.
 *   - The reserve use case (Fase 2) checks `capState !== 'hard-cap'`
 *     before charging.
 *   - The pre-confirm modal uses `remainingStudies` to render
 *     "después de esta operación quedarán N estudios".
 *
 * Soft-cap thresholds:
 *   - "soft-warn" at ≥80% of the combined plan + pack budget
 *   - "hard-cap" at 100% (no remaining USD)
 *   - "ok" otherwise
 *
 * "Studies" remaining is a display-only conversion — the canonical
 * unit is USD. Caller decides whether to show studies, USD, or both.
 */
export interface ExegesisQuotaState {
    /** Plan-included USD budget this month (resets via Stripe webhook). */
    planAllowanceUsd: number;
    /** Pack-purchased USD budget (persistent). */
    packBalanceUsd: number;
    /** plan + pack = total USD ceiling for this billing cycle. */
    totalBudgetUsd: number;
    /** Lifetime USD spent (for breakdown drawer / telemetry). */
    spentTotalUsd: number;
    /** USD remaining = available bucket. May be 0 even if plan allowance > 0 when fully consumed. */
    remainingUsd: number;
    /**
     * Display-only count of "estudios" remaining. Rounded to one
     * decimal so the UI can render "<0.1" when the remainder is too
     * small to fund a full operation.
     */
    remainingStudies: number;
    /** Cap state for banner color / gating decisions. */
    capState: 'ok' | 'soft-warn' | 'hard-cap';
    /**
     * True when the user's plan does not include any exégesis
     * allowance AND they have no pack credit. Distinct from `hard-cap`
     * (which means "you used everything") — `noAccess` means "your
     * plan doesn't include this feature". The UI surfaces an upgrade
     * card instead of a "buy more" CTA when this is true.
     */
    noAccess: boolean;
}

const SOFT_WARN_THRESHOLD = 0.8;

/**
 * La operación más barata del catálogo. Con menos saldo que esto no se puede
 * hacer ninguna, aunque el saldo no sea cero.
 */
export const MIN_EXEGESIS_OPERATION_USD = Math.min(
    ...Object.values(EXEGESIS_OPERATION_CATALOG)
        .map(op => op.estimatedCostUsd)
        .filter(costo => costo > 0),
);

/**
 * Por debajo de un estudio se avisa (caso real 2026-11-28: US$0,01 restantes
 * mostraban la tarjeta verde «Cuota disponible»). El cobro en el servidor descuenta del
 * balde del plan, así que plan + pack es lo que QUEDA, no lo que se asignó en
 * el mes: la fracción gastada casi siempre da 0 y no alcanza para avisar.
 */
const SOFT_WARN_USD = STUDY_UNIT_USD;

export function computeExegesisQuotaState(
    balance: ProcessingBalance | undefined | null,
): ExegesisQuotaState {
    const planAllowanceUsd = clampNonNegative(balance?.planExegesisUsd);
    const packBalanceUsd = clampNonNegative(balance?.packExegesisUsd);
    const remainingUsd = clampNonNegative(balance?.exegesisUsdAvailable);
    const spentTotalUsd = clampNonNegative(balance?.exegesisSpentTotalUsd);

    const totalBudgetUsd = planAllowanceUsd + packBalanceUsd;
    const remainingStudies = roundOneDecimal(remainingUsd / STUDY_UNIT_USD);

    // Order of checks matters: noAccess wins when plan + pack are
    // both empty, hard-cap when budget existed but is exhausted,
    // soft-warn near the line, ok otherwise.
    let capState: 'ok' | 'soft-warn' | 'hard-cap';
    let noAccess = false;
    if (totalBudgetUsd === 0 && spentTotalUsd === 0) {
        // Nunca tuvo saldo: su plan no incluye exégesis.
        capState = 'hard-cap';
        noAccess = true;
    } else if (remainingUsd < MIN_EXEGESIS_OPERATION_USD) {
        // Gastó todo, o lo que queda no paga ni la operación más barata.
        capState = 'hard-cap';
    } else if (remainingUsd < SOFT_WARN_USD) {
        capState = 'soft-warn';
    } else {
        // Spent-fraction comparison avoids floating-point traps that
        // sneak into "remaining / budget <= 1 - threshold" (e.g.
        // `1 - 0.8 === 0.19999999999999996` in JS, which would skip
        // soft-warn at exactly 80% spent).
        const spentFraction = (totalBudgetUsd - remainingUsd) / totalBudgetUsd;
        capState = spentFraction >= SOFT_WARN_THRESHOLD ? 'soft-warn' : 'ok';
    }

    return {
        planAllowanceUsd,
        packBalanceUsd,
        totalBudgetUsd,
        spentTotalUsd,
        remainingUsd,
        remainingStudies,
        capState,
        noAccess,
    };
}

/**
 * Helper: can the user afford `costUsd` for the next operation?
 * Returns the post-operation state without mutating anything — the
 * UI uses it to render "estudios después de esta operación: N" in
 * the pre-confirm modal.
 */
export function previewSpend(
    balance: ProcessingBalance | undefined | null,
    costUsd: number,
): {
    affordable: boolean;
    remainingAfterUsd: number;
    remainingAfterStudies: number;
} {
    const state = computeExegesisQuotaState(balance);
    const remainingAfterUsd = Math.max(0, state.remainingUsd - costUsd);
    const remainingAfterStudies = roundOneDecimal(remainingAfterUsd / STUDY_UNIT_USD);
    return {
        affordable: state.remainingUsd >= costUsd,
        remainingAfterUsd,
        remainingAfterStudies,
    };
}

function clampNonNegative(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
    return value;
}

function roundOneDecimal(value: number): number {
    return Math.round(value * 10) / 10;
}
