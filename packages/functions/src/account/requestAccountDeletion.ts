import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { stripe } from '../config/stripe';
import { writeAuditLog } from '../admin/auditLog';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import { BILLING_STATUSES, stripeRefsOf } from './deletionState';

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
 *    deshacer un error escribiendo a soporte (reactivar la cuenta cancela el
 *    pedido); pasado ese plazo no hay vuelta.
 *
 * EL ORDEN IMPORTA (revisión adversarial de B2): primero se desactiva, al
 * final se anota el pedido. Al revés, si desactivar fallaba quedaba un pedido
 * «pendiente» sobre una cuenta ACTIVA, y a los 7 días se purgaba igual.
 */
export const ACCOUNT_DELETION_GRACE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

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
        const stripeRefs = stripeRefsOf(user);

        // 1. Nadie entra más.
        await admin.auth().updateUser(uid, { disabled: true });
        await admin.auth().revokeRefreshTokens(uid);

        // 2. Nada se cobra más: la suscripción conocida y cualquier otra del
        //    cliente que siga facturando. El cliente se borra con la purga.
        let cancelled = 0;
        try {
            const ids = new Set<string>();
            if (stripeRefs.subscriptionId) ids.add(stripeRefs.subscriptionId);
            if (stripeRefs.customerId) {
                const subs = await stripe.subscriptions.list({ customer: stripeRefs.customerId, status: 'all', limit: 20 });
                for (const sub of subs.data) if (BILLING_STATUSES.has(sub.status)) ids.add(sub.id);
            }
            for (const id of ids) {
                try {
                    await stripe.subscriptions.cancel(id);
                    cancelled++;
                } catch (error: any) {
                    // Ya cancelada o inexistente: no es un fallo.
                    if (error?.code !== 'resource_missing' && error?.raw?.code !== 'resource_missing') throw error;
                }
            }
        } catch (error) {
            // No bloquea el pedido: la purga reintenta borrar el cliente de
            // Stripe, y eso cancela lo que haya quedado.
            console.error(`[requestAccountDeletion] Stripe ${uid}:`, error);
        }

        // 3. Recién ahora el pedido: la purga lo necesita para encontrar el
        //    cliente de Stripe aunque `users/{uid}` ya se haya borrado.
        await db.collection('account_deletions').doc(uid).set(
            {
                uid,
                email,
                stripeCustomerId: stripeRefs.customerId,
                requestedAt: FieldValue.serverTimestamp(),
                purgeAfter: Timestamp.fromDate(purgeAfter),
                status: 'pending',
            },
            { merge: true },
        );

        // Sin correo: el registro de auditoría se conserva y no debe guardar
        // los datos de quien pidió borrarlos.
        writeAuditLog({
            actorUid: uid,
            action: 'user.self_delete_requested',
            targetUid: uid,
            details: { purgeAfter: purgeAfter.toISOString(), cancelledSubscriptions: cancelled },
        });

        return { purgeAfter: purgeAfter.toISOString(), graceDays: ACCOUNT_DELETION_GRACE_DAYS };
    },
);
