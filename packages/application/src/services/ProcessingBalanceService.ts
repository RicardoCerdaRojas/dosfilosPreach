import {
    doc,
    getDoc,
    getFirestore,
    onSnapshot,
    serverTimestamp,
    setDoc,
    updateDoc,
} from 'firebase/firestore';
import type { ProcessingBalance, ProcessingMode } from '@dosfilos/domain';

export type { ProcessingMode } from '@dosfilos/domain';

interface InsufficientBalanceErrorData {
    needed: number;
    available: number;
    mode: ProcessingMode;
}

/**
 * Thrown by `consume()` when the user doesn't have enough pages of the
 * requested mode. UI catches it and prompts to buy a pack.
 */
export class InsufficientBalanceError extends Error {
    readonly code = 'insufficient-balance' as const;
    readonly data: InsufficientBalanceErrorData;
    constructor(data: InsufficientBalanceErrorData) {
        super(
            `Not enough ${data.mode} pages: needed ${data.needed}, available ${data.available}`,
        );
        this.data = data;
    }
}

/**
 * Thrown by `consumeExegesis()` when the user's exégesis bucket is
 * insufficient. The UI surfaces an upgrade / pack-purchase modal.
 */
export class InsufficientExegesisCreditsError extends Error {
    readonly code = 'insufficient-exegesis-credits' as const;
    readonly neededUsd: number;
    readonly availableUsd: number;
    constructor(neededUsd: number, availableUsd: number) {
        super(
            `Not enough exegesis credits: needed $${neededUsd.toFixed(4)}, available $${availableUsd.toFixed(4)}`,
        );
        this.neededUsd = neededUsd;
        this.availableUsd = availableUsd;
    }
}

const ZERO_BALANCE: ProcessingBalance = {
    planStandardPages: 0,
    planPremiumPages: 0,
    packStandardPages: 0,
    packPremiumPages: 0,
    standardPagesAvailable: 0,
    premiumPagesAvailable: 0,
    standardSpentTotal: 0,
    premiumSpentTotal: 0,
};

/**
 * Service that manages the per-user `processingBalance` document field.
 *
 * Storage: flat user doc with nested object at `users/{uid}.processingBalance`.
 *
 * Consumption order is **plan first, pack second** — the plan bucket resets
 * monthly via the Stripe invoice webhook, so letting it expire wastes value;
 * the pack bucket persists for 12 months. Writes recompute the legacy
 * `*PagesAvailable` aggregates to keep existing consumers (admin UI, Library
 * banner, upload gate) working without forcing them to know about the new
 * buckets.
 */
export class ProcessingBalanceService {
    private readonly USERS = 'users';

    async getBalance(userId: string): Promise<ProcessingBalance> {
        const db = getFirestore();
        const snap = await getDoc(doc(db, this.USERS, userId));
        if (!snap.exists()) return { ...ZERO_BALANCE };
        return this.normalizeBalance(snap.data()?.processingBalance);
    }

    /**
     * Live subscription to the user's balance. Fires immediately with
     * the current state and again every time `users/{uid}.processingBalance`
     * changes — used by the BalanceBanner so the page count debits as
     * soon as the cloud function writes them, no manual refresh needed.
     *
     * Returns the unsubscribe function — caller should call it on
     * unmount to avoid leaking listeners.
     */
    subscribeToBalance(
        userId: string,
        callback: (balance: ProcessingBalance) => void,
        onError?: (err: Error) => void,
    ): () => void {
        const db = getFirestore();
        return onSnapshot(
            doc(db, this.USERS, userId),
            (snap) => {
                if (!snap.exists()) {
                    callback({ ...ZERO_BALANCE });
                    return;
                }
                callback(this.normalizeBalance(snap.data()?.processingBalance));
            },
            (err) => {
                console.error('[ProcessingBalanceService] subscribe error:', err);
                onError?.(err);
            },
        );
    }

    /**
     * Builds the canonical balance shape from the raw Firestore field,
     * back-filling missing buckets from the legacy
     * `{standardPagesAvailable, premiumPagesAvailable}` representation.
     * Pre-refactor docs only had those — we treat them as pack pages
     * (the conservative choice, since packs persist across plan
     * renewals).
     */
    private normalizeBalance(raw: unknown): ProcessingBalance {
        const balance = (raw ?? undefined) as Partial<ProcessingBalance> | undefined;
        if (!balance) return { ...ZERO_BALANCE };
        const planStandard = balance.planStandardPages ?? 0;
        const planPremium = balance.planPremiumPages ?? 0;
        const packStandard = balance.packStandardPages
            ?? balance.standardPagesAvailable
            ?? 0;
        const packPremium = balance.packPremiumPages
            ?? balance.premiumPagesAvailable
            ?? 0;
        // Exegesis bucket — defaults to 0 / undefined for legacy users
        // who haven't been migrated yet. The reserve UC treats 0 as
        // "no access" + throws InsufficientExegesisCreditsError.
        const planExegesis = balance.planExegesisUsd ?? 0;
        const packExegesis = balance.packExegesisUsd ?? 0;
        const exegesisAvailable = balance.exegesisUsdAvailable
            ?? (planExegesis + packExegesis);
        return {
            planStandardPages: planStandard,
            planPremiumPages: planPremium,
            packStandardPages: packStandard,
            packPremiumPages: packPremium,
            standardPagesAvailable: planStandard + packStandard,
            premiumPagesAvailable: planPremium + packPremium,
            standardSpentTotal: balance.standardSpentTotal ?? 0,
            premiumSpentTotal: balance.premiumSpentTotal ?? 0,
            planExegesisUsd: planExegesis,
            packExegesisUsd: packExegesis,
            exegesisUsdAvailable: exegesisAvailable,
            exegesisSpentTotalUsd: balance.exegesisSpentTotalUsd ?? 0,
            updatedAt: balance.updatedAt,
        };
    }

    /**
     * Returns true when the user can afford the given page count in the given
     * mode (plan + pack combined) without dipping below zero.
     */
    async hasCapacity(userId: string, mode: ProcessingMode, pages: number): Promise<boolean> {
        const balance = await this.getBalance(userId);
        const available = mode === 'standard'
            ? balance.standardPagesAvailable
            : balance.premiumPagesAvailable;
        return available >= pages;
    }

    /**
     * Atomically debits `pages` from the user's balance for the given mode and
     * increments the `*SpentTotal` counter. Plan bucket drains first (it
     * resets monthly so wasting it makes no sense), then the pack bucket.
     * Throws `InsufficientBalanceError` if the combined buckets can't cover
     * the request.
     */
    async consume(userId: string, mode: ProcessingMode, pages: number): Promise<void> {
        if (pages <= 0) return;
        const balance = await this.getBalance(userId);
        const planAvailable = mode === 'standard' ? balance.planStandardPages : balance.planPremiumPages;
        const packAvailable = mode === 'standard' ? balance.packStandardPages : balance.packPremiumPages;
        const total = planAvailable + packAvailable;
        if (total < pages) {
            throw new InsufficientBalanceError({ needed: pages, available: total, mode });
        }

        const fromPlan = Math.min(planAvailable, pages);
        const fromPack = pages - fromPlan;

        const newPlan = planAvailable - fromPlan;
        const newPack = packAvailable - fromPack;

        const db = getFirestore();
        const ref = doc(db, this.USERS, userId);
        const planField = mode === 'standard'
            ? 'processingBalance.planStandardPages'
            : 'processingBalance.planPremiumPages';
        const packField = mode === 'standard'
            ? 'processingBalance.packStandardPages'
            : 'processingBalance.packPremiumPages';
        const availableField = mode === 'standard'
            ? 'processingBalance.standardPagesAvailable'
            : 'processingBalance.premiumPagesAvailable';
        const spentField = mode === 'standard'
            ? 'processingBalance.standardSpentTotal'
            : 'processingBalance.premiumSpentTotal';

        // Use SET semantics (not increment) for the bucket fields because
        // we computed exact new values above based on the consumption split
        // — concurrent decrements would corrupt that split. The
        // `*SpentTotal` counter still uses increment because it's
        // monotonic and order-independent.
        await updateDoc(ref, {
            [planField]: newPlan,
            [packField]: newPack,
            [availableField]: newPlan + newPack,
            [spentField]: (mode === 'standard'
                ? balance.standardSpentTotal
                : balance.premiumSpentTotal) + pages,
            'processingBalance.updatedAt': serverTimestamp(),
        });
    }

    /**
     * Credits `pages` to the user's PACK bucket. Used by the Stripe webhook
     * when a credit pack is purchased. Idempotent given a stable caller (the
     * webhook deduplicates per Stripe session id before invoking).
     */
    async addPack(userId: string, mode: ProcessingMode, pages: number): Promise<void> {
        if (pages <= 0) return;
        const balance = await this.getBalance(userId);
        const newPack = (mode === 'standard' ? balance.packStandardPages : balance.packPremiumPages) + pages;
        const newPlan = mode === 'standard' ? balance.planStandardPages : balance.planPremiumPages;

        const db = getFirestore();
        const ref = doc(db, this.USERS, userId);

        // Only seed the zero-bucket structure when the balance doesn't
        // exist yet. Unconditional `set merge: true` overwrites leaf
        // values back to 0 between successive calls — successive
        // addPack/setPlanQuota invocations on the same user would
        // wipe what each other just wrote.
        const snap = await getDoc(ref);
        if (!snap.exists() || !snap.data()?.processingBalance) {
            await setDoc(
                ref,
                { processingBalance: { ...ZERO_BALANCE } },
                { merge: true },
            );
        }

        const packField = mode === 'standard'
            ? 'processingBalance.packStandardPages'
            : 'processingBalance.packPremiumPages';
        const availableField = mode === 'standard'
            ? 'processingBalance.standardPagesAvailable'
            : 'processingBalance.premiumPagesAvailable';

        await updateDoc(ref, {
            [packField]: newPack,
            [availableField]: newPlan + newPack,
            'processingBalance.updatedAt': serverTimestamp(),
        });
    }

    /**
     * SETs the user's PLAN bucket to the given page count for the given
     * mode. Used by the monthly billing-cycle webhook to reset the plan
     * quota at the start of each billing period (no rollover). Pack pages
     * are untouched. Called by both `setPlanQuota` (server, admin SDK) and
     * the bonus-inicial flow during subscription activation.
     */
    async setPlanQuota(userId: string, mode: ProcessingMode, pages: number): Promise<void> {
        const balance = await this.getBalance(userId);
        const newPlan = Math.max(0, pages);
        const packAvailable = mode === 'standard' ? balance.packStandardPages : balance.packPremiumPages;

        const db = getFirestore();
        const ref = doc(db, this.USERS, userId);

        // Same conditional pre-ensure as `addPack` — see the comment
        // there. Crucially: `set merge: true` with leaf objects
        // OVERWRITES leaf values, so two consecutive setPlanQuota calls
        // (one per mode) would erase each other's writes.
        const snap = await getDoc(ref);
        if (!snap.exists() || !snap.data()?.processingBalance) {
            await setDoc(
                ref,
                { processingBalance: { ...ZERO_BALANCE } },
                { merge: true },
            );
        }

        const planField = mode === 'standard'
            ? 'processingBalance.planStandardPages'
            : 'processingBalance.planPremiumPages';
        const availableField = mode === 'standard'
            ? 'processingBalance.standardPagesAvailable'
            : 'processingBalance.premiumPagesAvailable';

        await updateDoc(ref, {
            [planField]: newPlan,
            [availableField]: newPlan + packAvailable,
            'processingBalance.updatedAt': serverTimestamp(),
        });
    }

    // ── Exégesis bucket (USD-based, separate from page buckets) ──
    //
    // Same plan-first / pack-second consumption order as pages. Same
    // dual-write pattern (plan + pack + aggregate available + lifetime
    // total). Storage = nested USD scalars on `processingBalance` per
    // the schema added in PR #112 (Fase 1 of the EXEGESIS_PRICING
    // roadmap).

    /**
     * Returns true when the user has at least `costUsd` available
     * across plan + pack exégesis budgets.
     */
    async hasExegesisCapacity(userId: string, costUsd: number): Promise<boolean> {
        const balance = await this.getBalance(userId);
        const available = (balance.exegesisUsdAvailable ?? 0);
        return available >= costUsd;
    }

    /**
     * Atomically debits `costUsd` from the user's exégesis budget.
     * Plan bucket drains first (it resets monthly so wasting it is
     * silly), then the pack bucket. Throws
     * `InsufficientExegesisCreditsError` when the combined buckets
     * can't cover the request.
     *
     * Caller is responsible for invoking `refundExegesis` if the
     * downstream operation fails BEFORE the LLM was contacted —
     * see use-case wrappers for the policy. Failures AFTER the LLM
     * was hit are not refundable (tokens were paid).
     */
    async consumeExegesis(userId: string, costUsd: number): Promise<void> {
        if (costUsd <= 0) return;
        const balance = await this.getBalance(userId);
        const planAvailable = balance.planExegesisUsd ?? 0;
        const packAvailable = balance.packExegesisUsd ?? 0;
        const total = planAvailable + packAvailable;
        if (total < costUsd) {
            throw new InsufficientExegesisCreditsError(costUsd, total);
        }

        const fromPlan = Math.min(planAvailable, costUsd);
        const fromPack = costUsd - fromPlan;

        const newPlan = planAvailable - fromPlan;
        const newPack = packAvailable - fromPack;

        const db = getFirestore();
        const ref = doc(db, this.USERS, userId);

        await updateDoc(ref, {
            'processingBalance.planExegesisUsd': newPlan,
            'processingBalance.packExegesisUsd': newPack,
            'processingBalance.exegesisUsdAvailable': newPlan + newPack,
            'processingBalance.exegesisSpentTotalUsd':
                (balance.exegesisSpentTotalUsd ?? 0) + costUsd,
            'processingBalance.updatedAt': serverTimestamp(),
        });
    }

    /**
     * Refunds `costUsd` to the user's exégesis budget. Used by the
     * use-case error path when an operation fails BEFORE the Gemini
     * call (validation error, missing entity, quota exceeded
     * downstream). The split favors the bucket that was last drained:
     * we top up the plan bucket first to avoid pretending the user has
     * more pack credits than they bought.
     *
     * DESDE EL 2026-10-16 LAS REGLAS LO RECHAZAN: el cliente sólo puede bajar
     * su saldo de exégesis (antes podía ponerse el que quisiera). El que lo
     * llama (`ExegesisCreditReservation.refundIfPreLlm`) traga el error, así
     * que una falla previa al modelo cuesta la reserva. El arreglo es llevar
     * el cobro de exégesis al servidor (fase pendiente).
     */
    async refundExegesis(userId: string, costUsd: number): Promise<void> {
        if (costUsd <= 0) return;
        const balance = await this.getBalance(userId);
        const planAvailable = balance.planExegesisUsd ?? 0;
        const packAvailable = balance.packExegesisUsd ?? 0;

        const newPlan = planAvailable + costUsd;
        const newPack = packAvailable;

        const db = getFirestore();
        const ref = doc(db, this.USERS, userId);

        await updateDoc(ref, {
            'processingBalance.planExegesisUsd': newPlan,
            'processingBalance.packExegesisUsd': newPack,
            'processingBalance.exegesisUsdAvailable': newPlan + newPack,
            'processingBalance.exegesisSpentTotalUsd': Math.max(
                0,
                (balance.exegesisSpentTotalUsd ?? 0) - costUsd,
            ),
            'processingBalance.updatedAt': serverTimestamp(),
        });
    }

    /**
     * Credits `usdAmount` to the user's exégesis PACK bucket. Used by
     * the Stripe webhook when an `exegesis-*` pack is purchased.
     * Idempotent given a stable caller (the webhook deduplicates per
     * Stripe session id).
     */
    async addExegesisPack(userId: string, usdAmount: number): Promise<void> {
        if (usdAmount <= 0) return;
        const balance = await this.getBalance(userId);
        const planExisting = balance.planExegesisUsd ?? 0;
        const newPack = (balance.packExegesisUsd ?? 0) + usdAmount;

        const db = getFirestore();
        const ref = doc(db, this.USERS, userId);

        const snap = await getDoc(ref);
        if (!snap.exists() || !snap.data()?.processingBalance) {
            await setDoc(
                ref,
                { processingBalance: { ...ZERO_BALANCE } },
                { merge: true },
            );
        }

        await updateDoc(ref, {
            'processingBalance.packExegesisUsd': newPack,
            'processingBalance.exegesisUsdAvailable': planExisting + newPack,
            'processingBalance.updatedAt': serverTimestamp(),
        });
    }

    /**
     * SETs the user's exégesis PLAN bucket to `usdAmount`. Used by the
     * monthly billing-cycle webhook to reset the plan allowance at
     * the start of each billing period. Pack bucket is untouched.
     */
    async setExegesisPlanQuota(userId: string, usdAmount: number): Promise<void> {
        const balance = await this.getBalance(userId);
        const newPlan = Math.max(0, usdAmount);
        const packExisting = balance.packExegesisUsd ?? 0;

        const db = getFirestore();
        const ref = doc(db, this.USERS, userId);

        const snap = await getDoc(ref);
        if (!snap.exists() || !snap.data()?.processingBalance) {
            await setDoc(
                ref,
                { processingBalance: { ...ZERO_BALANCE } },
                { merge: true },
            );
        }

        await updateDoc(ref, {
            'processingBalance.planExegesisUsd': newPlan,
            'processingBalance.exegesisUsdAvailable': newPlan + packExisting,
            'processingBalance.updatedAt': serverTimestamp(),
        });
    }
}

export const processingBalanceService = new ProcessingBalanceService();
