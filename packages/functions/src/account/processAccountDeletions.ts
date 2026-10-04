import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { stripe } from '../config/stripe';
import { writeAuditLog } from '../admin/auditLog';
import { adminPurgeDeps, purgeUserData } from './purgeUserData';
import { decideDeletion } from './deletionState';

/** Tiempo de la corrida que se deja para empezar cuentas nuevas (el tope es 540 s). */
const START_BUDGET_MS = 420 * 1000;

/**
 * Borrado definitivo de las cuentas cuyo plazo de gracia venció (B2).
 *
 * Una vez por día. Cada cuenta se purga entera o vuelve a `pending` para el
 * día siguiente: la purga es idempotente. Queda en `account_deletions/{uid}`
 * sólo el uid y las fechas.
 *
 * Revisión adversarial de B2:
 * - Se purga sólo si la cuenta SIGUE desactivada (o ya no existe en Auth): si
 *   soporte la reactivó para deshacer el pedido, se cancela.
 * - El uid sale del ID del documento y tiene que coincidir con el campo: un
 *   documento armado a mano con `uid: ""` consultaría `campo == ''` en todas
 *   las colecciones.
 * - Un fallo de Stripe o de Auth NO marca `done`: vuelve a `pending` y se
 *   reintenta, con el cliente de Stripe guardado en el pedido.
 * - No se empiezan cuentas nuevas después de START_BUDGET_MS: una biblioteca
 *   grande no deja a las demás sin turno.
 */
export const processAccountDeletions = onSchedule(
    { schedule: 'every 24 hours', timeoutSeconds: 540, secrets: ['STRIPE_SECRET_KEY'] },
    async () => {
        const startedAt = Date.now();
        const db = admin.firestore();
        let docs: FirebaseFirestore.QueryDocumentSnapshot[];
        try {
            const [due, stalled] = await Promise.all([
                db
                    .collection('account_deletions')
                    .where('status', '==', 'pending')
                    .where('purgeAfter', '<=', Timestamp.now())
                    .limit(20)
                    .get(),
                // Una corrida cortada por tiempo a mitad de purga deja el
                // pedido en `purging` sin pasar por el catch: también vuelve.
                db.collection('account_deletions').where('status', '==', 'purging').limit(20).get(),
            ]);
            docs = [...stalled.docs, ...due.docs];
        } catch (error) {
            // P. ej. el índice compuesto todavía construyéndose tras el deploy.
            console.error('[processAccountDeletions] consulta:', error);
            return;
        }

        for (const doc of docs) {
            if (Date.now() - startedAt > START_BUDGET_MS) break;
            const data = doc.data() as { uid?: string; email?: string | null; stripeCustomerId?: string | null };
            const uid = doc.id;
            if (!uid.trim() || data.uid !== uid) {
                await doc.ref.set({ status: 'invalid' }, { merge: true });
                continue;
            }
            try {
                const authUser = await admin
                    .auth()
                    .getUser(uid)
                    .catch((error) => {
                        if (error?.code === 'auth/user-not-found') return null;
                        throw error;
                    });
                if (decideDeletion(authUser) === 'cancel') {
                    await doc.ref.set({ status: 'cancelled', cancelledAt: FieldValue.serverTimestamp() }, { merge: true });
                    continue;
                }

                // Los disparadores de analítica no recrean datos durante la purga.
                await doc.ref.set({ status: 'purging' }, { merge: true });
                const report = await purgeUserData(uid, data.email ?? null, adminPurgeDeps());

                if (data.stripeCustomerId) {
                    await stripe.customers.del(data.stripeCustomerId).catch((error: any) => {
                        if (error?.code !== 'resource_missing' && error?.raw?.code !== 'resource_missing') throw error;
                    });
                }
                if (authUser) await admin.auth().deleteUser(uid);

                await doc.ref.set(
                    {
                        status: 'done',
                        completedAt: FieldValue.serverTimestamp(),
                        email: FieldValue.delete(),
                        stripeCustomerId: FieldValue.delete(),
                    },
                    { merge: true },
                );
                writeAuditLog({
                    actorUid: uid,
                    action: 'user.self_delete_completed',
                    targetUid: uid,
                    details: { documents: report.documents, hadStripeCustomer: !!data.stripeCustomerId },
                });
            } catch (error) {
                // Vuelve a la cola: se reintenta en la próxima corrida.
                console.error(`[processAccountDeletions] ${uid}:`, error);
                await doc.ref
                    .set({ status: 'pending', lastError: String((error as Error)?.message ?? error) }, { merge: true })
                    .catch(() => undefined);
            }
        }
    },
);
