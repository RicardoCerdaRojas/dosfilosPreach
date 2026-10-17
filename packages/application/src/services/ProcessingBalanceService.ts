import {
    doc,
    getDoc,
    getFirestore,
    onSnapshot,
    serverTimestamp,
    setDoc,
    updateDoc,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { llamarConReintentoDeSesion } from '@dosfilos/infrastructure';
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
     * Reserva el costo de una operación de exégesis EN EL SERVIDOR
     * (`abrirReservaDeExegesis`, fase «el cobro de la exégesis pasa al
     * servidor», 2026-10-17). El servidor toma el costo de su catálogo, no de
     * acá: `costUsd` queda sólo para quien llama (telemetría).
     *
     * Lanza `InsufficientExegesisCreditsError` cuando el saldo no alcanza, como
     * antes, así el aviso de compra de `StepCard` sigue igual. `reservaId` hace
     * idempotente un reintento: no cobra dos veces.
     */
    async consumeExegesis(
        _userId: string,
        _costUsd: number,
        reserva: { operation: string; reservaId: string },
    ): Promise<void> {
        const abrir = httpsCallable<{ operacion: string; reservaId: string }, unknown>(getFunctions(), 'abrirReservaDeExegesis');
        try {
            // Idempotente por `reservaId`: reintentar tras renovar la sesión no cobra dos veces.
            await llamarConReintentoDeSesion(() => abrir({ operacion: reserva.operation, reservaId: reserva.reservaId }));
        } catch (err) {
            const e = err as { code?: string; details?: { reason?: string; neededUsd?: number; availableUsd?: number } };
            if (e.code === 'functions/resource-exhausted' && e.details?.reason === 'insufficient-exegesis-credits') {
                throw new InsufficientExegesisCreditsError(Number(e.details.neededUsd ?? 0), Number(e.details.availableUsd ?? 0));
            }
            // La web puede salir antes que las funciones en el deploy: mientras
            // el callable no exista, la operación sigue sin reserva (el
            // servidor está en sombra y sólo lo anota).
            if (e.code === 'functions/not-found') {
                console.warn('[ProcessingBalanceService] abrirReservaDeExegesis todavía no existe; sigue sin reserva');
                return;
            }
            throw err;
        }
    }

    /**
     * Devuelve una reserva cuyo modelo nunca se llamó
     * (`liberarReservaDeExegesis`). El servidor decide si corresponde: sabe si
     * el modelo se contactó, y lo de una reserva ya usada no vuelve.
     */
    async refundExegesis(_userId: string, _costUsd: number, reserva: { reservaId: string }): Promise<void> {
        const liberar = httpsCallable<{ reservaId: string }, unknown>(getFunctions(), 'liberarReservaDeExegesis');
        await llamarConReintentoDeSesion(() => liberar({ reservaId: reserva.reservaId }));
    }

    // `addExegesisPack` y `setExegesisPlanQuota` vivían acá y subían el saldo
    // desde el navegador. No los llamaba nadie (los abonos los hace el
    // servidor: webhook de Stripe, cuota mensual) y desde #785 las reglas los
    // rechazan. Se quitaron con el cobro en el servidor (2026-10-17).
}

export const processingBalanceService = new ProcessingBalanceService();
