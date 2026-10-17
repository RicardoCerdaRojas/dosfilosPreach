import {
    type ExegesisOperationKey,
    getExegesisOperationCostUsd,
} from '@dosfilos/domain';
import { processingBalanceService, InsufficientExegesisCreditsError } from './ProcessingBalanceService';
import { fireExegesisPricingEvent } from './exegesisPricingTracker';

/**
 * Thin reservation handle that consolidates the reserve / refund
 * pattern every exégesis-LLM use case follows. Lifecycle:
 *
 *   1. `open(userId, operationKey)` reserves the operation's catalog
 *      cost from the user's `processingBalance.exegesis*` bucket.
 *      Throws `InsufficientExegesisCreditsError` (from
 *      ProcessingBalanceService) when the bucket can't cover it —
 *      callers let this bubble so the UI surfaces the upgrade modal.
 *   2. The caller does its pre-LLM work (validation, repo loads).
 *      Failures here will trigger refund via step 4.
 *   3. The caller invokes `markLlmContacted()` IMMEDIATELY before the
 *      `await modelClient.generateContent(...)` line. After this, any
 *      throw is treated as post-LLM (tokens were paid for real, no
 *      refund).
 *   4. On error, the caller invokes `refundIfPreLlm()` which checks
 *      the marker and refunds when appropriate.
 *
 * Desde el 2026-10-17 la reserva vive en el SERVIDOR
 * (`abrirReservaDeExegesis`): el servidor cobra del catálogo, `runLlmPrompt`
 * marca cuándo se contactó el modelo y el reembolso sólo procede si no se
 * contactó. Una clave de costo cero (fuera del catálogo) no reserva.
 */
export class ExegesisCreditReservation {
    readonly costUsd: number;
    /** El id de la reserva en el servidor (lo genera el navegador: reintentar no cobra dos veces). */
    readonly reservaId: string;
    private llmContacted = false;
    private refunded = false;

    private constructor(
        readonly userId: string,
        readonly operation: ExegesisOperationKey,
    ) {
        this.costUsd = getExegesisOperationCostUsd(operation);
        this.reservaId = nuevoReservaId();
    }

    static async open(
        userId: string,
        operation: ExegesisOperationKey,
    ): Promise<ExegesisCreditReservation> {
        const reservation = new ExegesisCreditReservation(userId, operation);
        // Costo cero = clave fuera del catálogo: no hay nada que reservar (y el
        // servidor rechazaría una operación que no conoce).
        if (reservation.costUsd <= 0) {
            return reservation;
        }
        fireExegesisPricingEvent('exegesis.quota.reserve_attempted', {
            ownerId: userId,
            operation,
            costUsd: reservation.costUsd,
        });
        try {
            await processingBalanceService.consumeExegesis(userId, reservation.costUsd, {
                operation,
                reservaId: reservation.reservaId,
            });
        } catch (err) {
            if (err instanceof InsufficientExegesisCreditsError) {
                fireExegesisPricingEvent('exegesis.quota.exceeded', {
                    ownerId: userId,
                    operation,
                    requiredUsd: err.neededUsd,
                    availableUsd: err.availableUsd,
                });
            }
            throw err;
        }
        fireExegesisPricingEvent('exegesis.quota.reserve_succeeded', {
            ownerId: userId,
            operation,
            costUsd: reservation.costUsd,
        });
        return reservation;
    }

    markLlmContacted(): void {
        this.llmContacted = true;
    }

    /**
     * Refunds the reservation when the operation failed BEFORE the LLM
     * was contacted. Idempotent — safe to call from a `catch` block
     * regardless of whether the LLM actually ran. Swallows refund
     * errors and logs them; the original error in the caller's catch
     * remains the propagated one.
     */
    async refundIfPreLlm(): Promise<void> {
        if (this.refunded) return;
        this.refunded = true;
        if (this.llmContacted || this.costUsd <= 0) return;
        try {
            // El servidor decide si corresponde: sabe si el modelo se contactó.
            await processingBalanceService.refundExegesis(this.userId, this.costUsd, { reservaId: this.reservaId });
            fireExegesisPricingEvent('exegesis.quota.refunded', {
                ownerId: this.userId,
                operation: this.operation,
                costUsd: this.costUsd,
                reason: 'pre-llm-failure',
            });
        } catch (err) {
            console.error('[ExegesisCreditReservation] refund failed:', err);
        }
    }
}

/** Un id de reserva: UUID si el navegador lo tiene, si no algo equivalente. */
function nuevoReservaId(): string {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
