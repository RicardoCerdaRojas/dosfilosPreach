import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { stripe } from '../config/stripe';
import { writeAuditLog } from '../admin/auditLog';
import { adminPurgeDeps, purgeUserData } from './purgeUserData';

/**
 * Borrado definitivo de las cuentas cuyo plazo de gracia venció (B2).
 *
 * Una vez por día. Cada cuenta se procesa entera o se reintenta al día
 * siguiente: la purga es idempotente. Queda en `account_deletions/{uid}` sólo
 * el uid y las fechas (el email se borra al terminar).
 */
export const processAccountDeletions = onSchedule(
    { schedule: 'every 24 hours', timeoutSeconds: 540, secrets: ['STRIPE_SECRET_KEY'] },
    async () => {
        const db = admin.firestore();
        const due = await db
            .collection('account_deletions')
            .where('status', '==', 'pending')
            .where('purgeAfter', '<=', Timestamp.now())
            .limit(20)
            .get();

        for (const doc of due.docs) {
            const { uid, email } = doc.data() as { uid: string; email: string | null };
            try {
                const userSnap = await db.collection('users').doc(uid).get();
                const customerId: string | undefined = userSnap.data()?.stripeCustomerId;

                const report = await purgeUserData(uid, email, adminPurgeDeps());

                if (customerId) {
                    await stripe.customers.del(customerId).catch((error) => {
                        console.error(`[processAccountDeletions] Stripe ${uid}:`, error);
                    });
                }
                await admin
                    .auth()
                    .deleteUser(uid)
                    .catch((error) => {
                        // Ya borrada: no es un fallo.
                        if (error?.code !== 'auth/user-not-found') throw error;
                    });

                await doc.ref.set(
                    { status: 'done', completedAt: FieldValue.serverTimestamp(), email: FieldValue.delete() },
                    { merge: true },
                );
                writeAuditLog({
                    actorUid: uid,
                    action: 'user.self_delete_completed',
                    targetUid: uid,
                    details: { documents: report.documents, hadStripeCustomer: !!customerId },
                });
            } catch (error) {
                // Se reintenta en la próxima corrida.
                console.error(`[processAccountDeletions] ${uid}:`, error);
            }
        }
    },
);
