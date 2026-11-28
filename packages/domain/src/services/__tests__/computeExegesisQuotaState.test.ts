import { describe, it, expect } from 'vitest';
import type { ProcessingBalance } from '../../entities/User';
import {
    computeExegesisQuotaState,
    MIN_EXEGESIS_OPERATION_USD,
    previewSpend,
} from '../computeExegesisQuotaState';

const baseBalance = (overrides: Partial<ProcessingBalance> = {}): ProcessingBalance => ({
    planStandardPages: 0,
    planPremiumPages: 0,
    packStandardPages: 0,
    packPremiumPages: 0,
    standardPagesAvailable: 0,
    premiumPagesAvailable: 0,
    standardSpentTotal: 0,
    premiumSpentTotal: 0,
    ...overrides,
});

describe('computeExegesisQuotaState', () => {
    // Caso real 2026-11-28: el cobro en el servidor descuenta del plan, así
    // que plan + pack es lo que queda. Con US$0,01 la tarjeta salía verde.
    it('US$0,01 restantes avisan (ámbar), no «Cuota disponible» (verde)', () => {
        const state = computeExegesisQuotaState(baseBalance({
            planExegesisUsd: 0.01,
            packExegesisUsd: 0,
            exegesisUsdAvailable: 0.01,
            exegesisSpentTotalUsd: 9.99,
        }));
        expect(state.capState).toBe('soft-warn');
        expect(state.noAccess).toBe(false);
    });

    it('hard-cap cuando lo que queda no paga la operación más barata', () => {
        const resto = MIN_EXEGESIS_OPERATION_USD / 2;
        const state = computeExegesisQuotaState(baseBalance({
            planExegesisUsd: resto,
            exegesisUsdAvailable: resto,
            exegesisSpentTotalUsd: 9.99,
        }));
        expect(state.capState).toBe('hard-cap');
        expect(state.noAccess).toBe(false);
    });

    it('la operación más barata del catálogo cuesta más que cero', () => {
        expect(MIN_EXEGESIS_OPERATION_USD).toBeGreaterThan(0);
        expect(Number.isFinite(MIN_EXEGESIS_OPERATION_USD)).toBe(true);
    });

    it('justo con la operación más barata todavía puede operar (avisa, no bloquea)', () => {
        const state = computeExegesisQuotaState(baseBalance({
            planExegesisUsd: MIN_EXEGESIS_OPERATION_USD,
            exegesisUsdAvailable: MIN_EXEGESIS_OPERATION_USD,
            exegesisSpentTotalUsd: 5,
        }));
        expect(state.capState).toBe('soft-warn');
    });

    it('soft-warn con menos de un estudio aunque la fracción gastada dé 0', () => {
        const state = computeExegesisQuotaState(baseBalance({
            planExegesisUsd: 1.5,
            exegesisUsdAvailable: 1.5,
            exegesisSpentTotalUsd: 8.5,
        }));
        expect(state.capState).toBe('soft-warn');
    });

    it('gastó todo: hard-cap, no «sin acceso»', () => {
        const state = computeExegesisQuotaState(baseBalance({
            planExegesisUsd: 0,
            packExegesisUsd: 0,
            exegesisUsdAvailable: 0,
            exegesisSpentTotalUsd: 10,
        }));
        expect(state.capState).toBe('hard-cap');
        expect(state.noAccess).toBe(false);
    });

    it('returns noAccess + hard-cap when plan + pack are both 0', () => {
        const state = computeExegesisQuotaState(baseBalance());
        expect(state.noAccess).toBe(true);
        expect(state.capState).toBe('hard-cap');
        expect(state.totalBudgetUsd).toBe(0);
        expect(state.remainingStudies).toBe(0);
    });

    it('returns "ok" when the user has plenty of budget remaining', () => {
        const state = computeExegesisQuotaState(baseBalance({
            planExegesisUsd: 10,
            packExegesisUsd: 0,
            exegesisUsdAvailable: 10,
            exegesisSpentTotalUsd: 0,
        }));
        expect(state.capState).toBe('ok');
        expect(state.noAccess).toBe(false);
        expect(state.remainingUsd).toBe(10);
        expect(state.remainingStudies).toBe(5); // 10 / $2 per estudio
    });

    it('returns "soft-warn" at 80% spent', () => {
        // Budget $10, remaining $2 → 80% spent → soft-warn.
        const state = computeExegesisQuotaState(baseBalance({
            planExegesisUsd: 10,
            packExegesisUsd: 0,
            exegesisUsdAvailable: 2,
        }));
        expect(state.capState).toBe('soft-warn');
    });

    it('returns "hard-cap" when remaining hits 0 (but plan was non-zero)', () => {
        const state = computeExegesisQuotaState(baseBalance({
            planExegesisUsd: 10,
            packExegesisUsd: 0,
            exegesisUsdAvailable: 0,
        }));
        expect(state.capState).toBe('hard-cap');
        expect(state.noAccess).toBe(false); // user has access, just used everything
    });

    it('combines plan + pack into total budget', () => {
        const state = computeExegesisQuotaState(baseBalance({
            planExegesisUsd: 10,
            packExegesisUsd: 18,
            exegesisUsdAvailable: 28,
        }));
        expect(state.totalBudgetUsd).toBe(28);
        expect(state.capState).toBe('ok');
    });

    it('handles undefined fields gracefully', () => {
        const state = computeExegesisQuotaState(baseBalance({
            // exegesis fields all undefined → treated as zeros
        }));
        expect(state.noAccess).toBe(true);
        expect(state.totalBudgetUsd).toBe(0);
    });

    it('clamps negative values to zero (defensive)', () => {
        const state = computeExegesisQuotaState(baseBalance({
            planExegesisUsd: -5 as any,
            exegesisUsdAvailable: -1 as any,
        }));
        expect(state.planAllowanceUsd).toBe(0);
        expect(state.remainingUsd).toBe(0);
    });

    it('handles undefined/null balance', () => {
        expect(computeExegesisQuotaState(undefined).noAccess).toBe(true);
        expect(computeExegesisQuotaState(null).noAccess).toBe(true);
    });
});

describe('previewSpend', () => {
    const balance = baseBalance({
        planExegesisUsd: 10,
        packExegesisUsd: 0,
        exegesisUsdAvailable: 10,
    });

    it('reports affordable + remaining when budget covers the cost', () => {
        const preview = previewSpend(balance, 0.10);
        expect(preview.affordable).toBe(true);
        expect(preview.remainingAfterUsd).toBeCloseTo(9.9, 5);
        // remainingAfterStudies is rounded to one decimal (display
        // precision) — `roundOneDecimal(4.95)` lands at 5.0 because
        // JS `Math.round(49.5) === 50` (banker's rounding miss). The
        // UI never shows "4.95 estudios" anyway; one-decimal is the
        // contract the banner relies on.
        expect(preview.remainingAfterStudies).toBe(5);
    });

    it('reports unaffordable when cost exceeds remaining', () => {
        const preview = previewSpend(balance, 11);
        expect(preview.affordable).toBe(false);
        expect(preview.remainingAfterUsd).toBe(0); // clamped to zero
    });

    it('handles zero-cost (catalog gap) without breaking math', () => {
        const preview = previewSpend(balance, 0);
        expect(preview.affordable).toBe(true);
        expect(preview.remainingAfterUsd).toBe(10);
    });
});
