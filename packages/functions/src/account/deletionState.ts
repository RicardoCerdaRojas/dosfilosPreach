import * as admin from 'firebase-admin';

/**
 * Lo que el borrado de cuenta necesita decidir (B2), puro donde se puede.
 *
 * Nació de la revisión adversarial de B2, que encontró dos defectos ALTOS:
 * - El cliente de Stripe del registro con pago primero vive en
 *   `users.subscription.stripeCustomerId`, NO en `users.stripeCustomerId`
 *   (ése sólo lo escribe el checkout desde la app). El borrado leía sólo el de
 *   la raíz: a quien se registró pagando primero —el camino normal— se le
 *   seguía cobrando después de borrar la cuenta.
 * - La purga no miraba si la cuenta seguía desactivada: si soporte la
 *   reactivaba para deshacer el pedido, a los 7 días se borraba igual.
 */
export interface StripeRefs {
    customerId: string | null;
    subscriptionId: string | null;
}

export function stripeRefsOf(user: Record<string, any> | undefined): StripeRefs {
    const sub = user?.subscription ?? {};
    return {
        customerId: user?.stripeCustomerId ?? sub.stripeCustomerId ?? null,
        subscriptionId: sub.stripeSubscriptionId ?? user?.stripeSubscriptionId ?? null,
    };
}

/** Estados de una suscripción que cobran o van a cobrar (incomplete pasa a active tras 3DS). */
export const BILLING_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete']);

export type DeletionDecision = 'purge' | 'cancel';

/**
 * ¿Se purga o se cancela? Sólo se purga una cuenta que SIGUE desactivada (o
 * que ya no existe en Auth). Si alguien la reactivó, el pedido se cancela.
 */
export function decideDeletion(authUser: { disabled: boolean } | null): DeletionDecision {
    if (authUser && !authUser.disabled) return 'cancel';
    return 'purge';
}

/** Estados en los que los disparadores no deben recrear datos del usuario. */
const PURGING_STATES = new Set(['purging', 'done']);

/**
 * Para los disparadores que escriben agregados del usuario al borrarse un
 * documento (`user_analytics`): durante la purga no deben recrearlos.
 */
export async function isAccountBeingPurged(uid: string | undefined | null): Promise<boolean> {
    if (!uid) return false;
    const snap = await admin.firestore().collection('account_deletions').doc(uid).get();
    return snap.exists && PURGING_STATES.has(String(snap.data()?.status));
}
