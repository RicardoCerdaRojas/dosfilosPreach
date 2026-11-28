import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { stripe } from '../config/stripe';
import { writeAuditLog } from './auditLog';
import {
    setPlanQuotaAdmin,
    setExegesisPlanQuotaAdmin,
} from '../library/processingBalance';
import { appCheckCallableOptions } from '../config/appCheckOptions';

type BillingCycle = 'monthly' | 'yearly';

interface ChangePlanForUserRequest {
    userId: string;
    newPlanId: string;
    billing?: BillingCycle;
}

/**
 * Cloud Function: Admin-driven plan change.
 *
 * Lets a super admin switch a user from one paid plan to another (or downgrade
 * to free). The flow:
 *
 *   1. Validate caller is super admin and target user exists.
 *   2. Look up the new plan's Stripe Price ID for the requested billing cycle
 *      (`stripePriceIds.{monthly,yearly}` shape; falls back to legacy
 *      `stripeProductIds[0]` for docs that haven't been migrated yet).
 *   3. If the user has an active Stripe subscription:
 *        - Update the subscription item to the new price (Stripe handles
 *          proration automatically with `proration_behavior: 'create_prorations'`).
 *        - Update Firestore `users/{uid}.subscription` to reflect the new plan.
 *      Otherwise (free user or no Stripe customer): just update Firestore.
 *   4. Write an audit-log entry.
 *
 * Note: the regular `changePlan` callable already exists for end-users. This
 * one is admin-only and accepts the target userId; it bypasses the
 * "self-service" path so admins can act on behalf of users (support cases,
 * comp accounts, error recovery).
 */
export const changePlanForUser = onCall<ChangePlanForUserRequest>(
    { ...appCheckCallableOptions(), secrets: ['STRIPE_SECRET_KEY'] },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const callerUid = request.auth.uid;
        const db = admin.firestore();

        const callerDoc = await db.collection('users').doc(callerUid).get();
        if (!callerDoc.exists || callerDoc.data()?.role !== 'super_admin') {
            throw new HttpsError('permission-denied', 'Only super admins can change plans');
        }

        const { userId, newPlanId, billing = 'monthly' } = request.data ?? ({} as ChangePlanForUserRequest);
        if (!userId || !newPlanId) {
            throw new HttpsError('invalid-argument', 'userId and newPlanId are required');
        }

        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            throw new HttpsError('not-found', `User ${userId} not found`);
        }
        const userData = userDoc.data()!;
        const previousPlanId = userData.subscription?.planId ?? 'free';

        if (newPlanId === previousPlanId) {
            throw new HttpsError('invalid-argument', 'New plan is the same as the current plan');
        }

        // Resolve target plan's Stripe Price ID. Free is a no-op on Stripe but
        // still updates Firestore; paid plans need a price id.
        const planDoc = await db.collection('plans').doc(newPlanId).get();
        if (!planDoc.exists) {
            throw new HttpsError('not-found', `Plan ${newPlanId} not found`);
        }
        const planData = planDoc.data()!;
        const newPriceId: string | undefined =
            planData.stripePriceIds?.[billing] ??
            planData.stripePriceIds?.monthly ??
            (Array.isArray(planData.stripeProductIds) ? planData.stripeProductIds[0] : undefined);

        const goingToFree = newPlanId === 'free';

        if (!goingToFree && !newPriceId) {
            throw new HttpsError(
                'failed-precondition',
                `Plan ${newPlanId} has no Stripe price configured for billing=${billing}`,
            );
        }

        try {
            // Update Stripe subscription if the user has one and is moving to a paid plan.
            // For downgrades to free, we cancel the subscription at period end so the
            // user keeps current-period access without further billing.
            const customerId: string | undefined = userData.stripeCustomerId;
            let haySuscripcionEnStripe = false;

            if (customerId) {
                const subscriptions = await stripe.subscriptions.list({
                    customer: customerId,
                    status: 'active',
                    limit: 1,
                });
                const subscription = subscriptions.data[0];
                haySuscripcionEnStripe = Boolean(subscription);

                if (subscription) {
                    if (goingToFree) {
                        await stripe.subscriptions.update(subscription.id, {
                            cancel_at_period_end: true,
                        });
                    } else {
                        await stripe.subscriptions.update(subscription.id, {
                            items: [
                                {
                                    id: subscription.items.data[0].id,
                                    price: newPriceId!,
                                },
                            ],
                            proration_behavior: 'create_prorations',
                        });
                    }
                }
            }

            // Update Firestore so the UI reflects the change immediately.
            // Stripe webhook will reconcile any drift on the next event.
            await userRef.update({
                'subscription.planId': newPlanId,
                ...(newPriceId && !goingToFree
                    ? { 'subscription.stripePriceId': newPriceId }
                    : {}),
                'subscription.status': goingToFree ? 'cancelled' : 'active',
                'subscription.cancelAtPeriodEnd': goingToFree,
                // Plan pagado sin suscripción activa en Stripe = cortesía. Se
                // borra el id de una suscripción ya muerta (un ex cliente):
                // con él la cuenta se leía como de pago y no se renovaba, y
                // «Cancelar» y el cambio de plan llamaban a Stripe sobre nada.
                ...(!goingToFree && !haySuscripcionEnStripe
                    ? { 'subscription.id': FieldValue.delete(), 'subscription.stripeSubscriptionId': FieldValue.delete() }
                    : {}),
                'subscription.updatedAt': FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            // Seed `processingBalance` plan buckets from the new plan's
            // monthly limits. Stripe webhook normally does this on
            // subscription.created/updated, but the admin path bypasses
            // Stripe (comp accounts, no Stripe customer, etc.), so without
            // this seeding the user has a Pro `planId` but zero exegesis
            // quota → modules gate as "upgrade required" even though the
            // plan badge says Pro. Same `setPlanQuotaAdmin` helpers used
            // by `resetUserPlanQuota` to keep the seeding semantics
            // consistent across admin paths.
            const newPlanLimits = (planData.limits ?? {}) as Record<string, number | undefined>;
            const standardPages = Math.max(0, newPlanLimits.standardPagesPerMonth ?? 0);
            const premiumPages = Math.max(0, newPlanLimits.premiumPagesPerMonth ?? 0);
            const exegesisUsd = Math.max(0, newPlanLimits.exegesisUsdPerMonth ?? 0);
            await setPlanQuotaAdmin(userId, 'standard', standardPages);
            await setPlanQuotaAdmin(userId, 'premium', premiumPages);
            await setExegesisPlanQuotaAdmin(userId, exegesisUsd);

            writeAuditLog({
                actorUid: callerUid,
                actorEmail: callerDoc.data()?.email,
                action: 'user.change_plan',
                targetUid: userId,
                targetEmail: userData.email,
                details: {
                    fromPlan: previousPlanId,
                    toPlan: newPlanId,
                    billing,
                    priceId: newPriceId ?? null,
                    cancelAtPeriodEnd: goingToFree,
                    seededQuotas: { standardPages, premiumPages, exegesisUsd },
                },
            });

            return {
                success: true,
                fromPlan: previousPlanId,
                toPlan: newPlanId,
                billing,
                cancelAtPeriodEnd: goingToFree,
            };
        } catch (error: any) {
            if (error instanceof HttpsError) throw error;
            console.error('[changePlanForUser] Failed:', error);
            throw new HttpsError('internal', error.message || 'Failed to change plan');
        }
    },
);
