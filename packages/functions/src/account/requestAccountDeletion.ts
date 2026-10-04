import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { stripe } from '../config/stripe';
import { writeAuditLog } from '../admin/auditLog';
import { appCheckCallableOptions } from '../config/appCheckOptions';

/**
 * El usuario pide borrar su cuenta (B2 de la fase Púlpito premium).
 *
 * Apple 5.1.1(v) y la política de Play exigen que se pueda iniciar desde la
 * app. El borrado definitivo es irreversible, así que se hace en dos tiempos:
 *
 * 1. AHORA: la cuenta se desactiva (no se puede entrar), se cierran sus
 *    sesiones y se cancela el cobro — nada sigue facturándose.
 * 2. A LOS `ACCOUNT_DELETION_GRACE_DAYS` días: `processAccountDeletions`
 *    borra todo (`purgeUserData`) y la cuenta de Auth. La gracia permite
 *    deshacer un error escribiendo a soporte; pasado ese plazo no hay vuelta.
 */
export const ACCOUNT_DELETION_GRACE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Estados de una suscripción que siguen cobrando. */
const BILLING_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid']);

export const requestAccountDeletion = onCall(
    { ...appCheckCallableOptions(), secrets: ['STRIPE_SECRET_KEY'] },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Se requiere iniciar sesión.');
        const uid = request.auth.uid;
        const db = admin.firestore();

        const userSnap = await db.collection('users').doc(uid).get();
        const user = userSnap.data();
        // Una cuenta de administración no se borra sola: la quita otro admin.
        if (user?.role === 'super_admin') {
            throw new HttpsError('failed-precondition', 'Las cuentas de administración se eliminan desde el panel.');
        }

        const authUser = await admin.auth().getUser(uid);
        const email: string | null = authUser.email ?? user?.email ?? null;
        const purgeAfter = new Date(Date.now() + ACCOUNT_DELETION_GRACE_DAYS * DAY_MS);

        await db.collection('account_deletions').doc(uid).set(
            {
                uid,
                email,
                requestedAt: FieldValue.serverTimestamp(),
                purgeAfter: Timestamp.fromDate(purgeAfter),
                status: 'pending',
            },
            { merge: true },
        );

        // Cobro: se cancelan YA las suscripciones que facturan. El cliente de
        // Stripe se borra al final, con todo lo demás.
        let cancelled = 0;
        if (user?.stripeCustomerId) {
            try {
                const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: 'all', limit: 20 });
                for (const sub of subs.data) {
                    if (!BILLING_STATUSES.has(sub.status)) continue;
                    await stripe.subscriptions.cancel(sub.id);
                    cancelled++;
                }
            } catch (error) {
                // No bloquea el pedido: el borrado definitivo elimina el
                // cliente, y eso cancela lo que haya quedado.
                console.error(`[requestAccountDeletion] Stripe ${uid}:`, error);
            }
        }

        await admin.auth().updateUser(uid, { disabled: true });
        await admin.auth().revokeRefreshTokens(uid);

        writeAuditLog({
            actorUid: uid,
            actorEmail: email ?? undefined,
            action: 'user.self_delete_requested',
            targetUid: uid,
            targetEmail: email ?? undefined,
            details: { purgeAfter: purgeAfter.toISOString(), cancelledSubscriptions: cancelled },
        });

        return { purgeAfter: purgeAfter.toISOString(), graceDays: ACCOUNT_DELETION_GRACE_DAYS };
    },
);
