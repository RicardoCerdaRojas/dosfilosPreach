import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { stripe } from '../config/stripe';
import { writeAuditLog } from './auditLog';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import { stripeRefsOf } from '../account/deletionState';

/**
 * Cloud Function: Enable User
 *
 * Re-enables a previously disabled Firebase Auth account, removes the
 * disabled status from Firestore, and resumes the paused Stripe subscription
 * (if any).
 */
export const enableUser = onCall(
    { ...appCheckCallableOptions(), secrets: ['STRIPE_SECRET_KEY'] },
    async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const callerUid = request.auth.uid;
    const db = admin.firestore();

    // Verify Super Admin Role
    const callerDoc = await db.collection('users').doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== 'super_admin') {
        throw new HttpsError('permission-denied', 'Only super admins can enable users');
    }

    const { userId } = request.data;
    if (!userId) {
        throw new HttpsError('invalid-argument', 'Target userId is required');
    }

    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            throw new HttpsError('not-found', `User ${userId} not found`);
        }

        const userData = userDoc.data()!;
        // El cliente de Stripe del registro con pago primero vive en
        // `subscription.stripeCustomerId` (ver account/deletionState).
        const stripeCustomerId = stripeRefsOf(userData).customerId;

        // 1. Re-enable Firebase Auth account
        await admin.auth().updateUser(userId, { disabled: false });

        // Reactivar deshace un pedido de borrado pendiente (B2): sin esto, a
        // los 7 días se purgaba una cuenta que el pastor ya volvía a usar.
        const deletionRef = db.collection('account_deletions').doc(userId);
        const deletion = await deletionRef.get();
        if (deletion.exists && deletion.data()?.status === 'pending') {
            await deletionRef.set({ status: 'cancelled', cancelledAt: FieldValue.serverTimestamp(), cancelledBy: callerUid }, { merge: true });
        }
        console.log(`Re-enabled Firebase Auth account for ${userId}`);

        // 2. Resume paused Stripe subscription (if any)
        if (stripeCustomerId) {
            try {
                const subscriptions = await stripe.subscriptions.list({
                    customer: stripeCustomerId,
                    status: 'paused',
                    limit: 1,
                });

                if (subscriptions.data.length > 0) {
                    await stripe.subscriptions.update(subscriptions.data[0].id, {
                        pause_collection: '',
                    } as any);
                    console.log(`Resumed Stripe subscription for customer ${stripeCustomerId}`);
                }
            } catch (stripeError) {
                // Log but don't block — subscription resume is best-effort
                console.error('Error resuming Stripe subscription:', stripeError);
            }
        }

        // 3. Update Firestore user document — remove disabled status
        await userRef.update({
            status: 'active',
            disabledAt: FieldValue.delete(),
            disabledBy: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        console.log(`User ${userId} re-enabled by admin ${callerUid}`);
        writeAuditLog({
            actorUid: callerUid,
            actorEmail: callerDoc.data()?.email,
            action: 'user.enable',
            targetUid: userId,
            targetEmail: userData.email,
        });
        return { success: true, message: `User ${userId} has been re-enabled.` };

    } catch (error: any) {
        if (error instanceof HttpsError) throw error;
        console.error('Error enabling user:', error);
        throw new HttpsError('internal', error.message || 'Failed to enable user');
    }
});
