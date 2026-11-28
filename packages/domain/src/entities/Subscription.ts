export enum SubscriptionStatus {
    ACTIVE = 'active',
    PAST_DUE = 'past_due',
    CANCELLED = 'cancelled',
    INCOMPLETE = 'incomplete',
    TRIALING = 'trialing',
}

export interface Subscription {
    // Core fields
    id: string; // Stripe subscription ID
    planId: string; // Internal plan ID ("basic", "pro", "team")
    status: SubscriptionStatus;
    stripePriceId: string; // Stripe Price ID

    // Billing cycle
    startDate: Date; // Subscription start
    currentPeriodStart: Date; // Current billing cycle start
    currentPeriodEnd: Date; // Current billing cycle end (next billing date)

    // Cancellation
    cancelledAt?: Date; // When user requested cancellation
    cancelAtPeriodEnd: boolean; // If scheduled to cancel at period end

    // Failed payments
    failedPaymentAttempts?: number; // Counter 0-3 before auto-cancel
    lastPaymentError?: {
        message: string;
        attemptedAt: Date;
    };

    // Trial features
    trialEnd?: Date; // Trial period end (if applicable)
    trialStartedAt?: Date; // When trial countdown actually started (null = not started yet)

    // Grace period (after trial expiration)
    gracePeriodEnd?: Date; // End of 7-day grace period after trial expires

    // Metadata
    updatedAt: Date;
}

/**
 * Un plan pagado, activo y SIN suscripción en Stripe: lo asignó el super admin
 * desde el panel (`changePlanForUser`). No tiene factura, así que su cuota la
 * renueva `renovarCuotaDeCortesia` y no se puede cancelar ni cambiar por Stripe;
 * para pagarlo, el usuario pasa por el checkout.
 *
 * `id` es el id de Stripe (`sub_…`). Copia en functions:
 * `esCuentaDeCortesia` (functions no importa domain, ADR-025).
 */
export function esSuscripcionDeCortesia(
    sub: Pick<Subscription, 'status' | 'planId' | 'id'> | null | undefined,
): boolean {
    if (!sub || sub.status !== SubscriptionStatus.ACTIVE) return false;
    if (!sub.planId || sub.planId === 'free') return false;
    return !(typeof sub.id === 'string' && sub.id.startsWith('sub_'));
}
