import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { stripe } from '../config/stripe';
import { getFirestore } from 'firebase-admin/firestore';
import { getPackById, resolveStripePriceId } from './creditPackCatalog';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import { esCuentaDeCortesia } from '../admin/renovarCuotaDeCortesia';

interface CheckoutSessionData {
    /** When `packId` is set, `priceId` is ignored — the catalog resolves the
     *  Stripe price from env vars. Otherwise this is the subscription price. */
    priceId?: string;
    /** When set, the checkout session is a one-time credit-pack purchase. */
    packId?: string;
    successUrl?: string;
    cancelUrl?: string;
    // New registration metadata (subscription only)
    isNewRegistration?: boolean;
    displayName?: string;
    email?: string;
    locale?: 'en' | 'es';
}

export const createCheckoutSession = onCall<CheckoutSessionData>(
    {
        ...appCheckCallableOptions(),
        secrets: [
            'STRIPE_SECRET_KEY',
            // Credit pack price IDs are read at request time; declaring them here
            // ensures Firebase injects them into the runtime env.
            'STRIPE_PRICE_PACK_STANDARD_S',
            'STRIPE_PRICE_PACK_STANDARD_M',
            'STRIPE_PRICE_PACK_STANDARD_L',
            'STRIPE_PRICE_PACK_PREMIUM_S',
            'STRIPE_PRICE_PACK_PREMIUM_M',
            'STRIPE_PRICE_PACK_PREMIUM_L',
            // Exégesis packs (Fase 3 of EXEGESIS_PRICING_INTEGRATION).
            'STRIPE_PRICE_PACK_EXEGESIS_S',
            'STRIPE_PRICE_PACK_EXEGESIS_M',
            'STRIPE_PRICE_PACK_EXEGESIS_L',
        ],
    },
    async (request) => {
    const {
        priceId,
        packId,
        successUrl,
        cancelUrl,
        isNewRegistration = false,
        displayName,
        email,
        locale = 'es'
    } = request.data;

    // Credit-pack purchases require an authenticated existing user.
    if (packId && !request.auth) {
        throw new HttpsError('unauthenticated', 'Credit-pack purchases require authentication');
    }

    // Auth verification: Only required for existing users
    if (!isNewRegistration && !request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // For new registrations, email is required
    if (isNewRegistration && !email) {
        throw new HttpsError('invalid-argument', 'Email is required for new registrations');
    }

    // Resolve the Stripe price for this checkout (subscription priceId or pack catalog).
    let resolvedPriceId: string | undefined = priceId;
    let pack: ReturnType<typeof getPackById>;
    if (packId) {
        pack = getPackById(packId);
        if (!pack) {
            throw new HttpsError('invalid-argument', `Unknown credit pack id: ${packId}`);
        }
        resolvedPriceId = resolveStripePriceId(pack);
        if (!resolvedPriceId) {
            throw new HttpsError(
                'failed-precondition',
                `Stripe price for pack ${packId} not configured (env var ${pack.stripePriceIdEnv} missing)`,
            );
        }
    }
    if (!resolvedPriceId) {
        throw new HttpsError('invalid-argument', 'priceId or packId is required');
    }

    try {
        const db = getFirestore();
        let customerId: string = '';
        let customerEmail: string;
        // Una cuenta de cortesía que pasa a pagar ya usó el plan gratis: paga
        // desde hoy, sin los 30 días de prueba (decisión del fundador, 2026-11-28).
        let sinPrueba = false;

        // NEW REGISTRATION: no Stripe customer is pre-created — Checkout will create
        // one from `customer_email` and attach it to the subscription, avoiding
        // orphan customers if the session is abandoned.
        if (isNewRegistration) {
            customerEmail = email!;
        } else {
            // EXISTING USER: Get from Firebase profile
            const userId = request.auth!.uid;
            const userRef = db.collection('users').doc(userId);
            const userDoc = await userRef.get();

            if (!userDoc.exists) {
                throw new HttpsError('not-found', 'User profile not found');
            }

            const userData = userDoc.data()!;
            customerEmail = userData.email;
            customerId = userData.stripeCustomerId;
            sinPrueba = esCuentaDeCortesia(userData.subscription);

            // Create Stripe customer if doesn't exist
            if (!customerId) {
                const customer = await stripe.customers.create({
                    email: userData.email,
                    metadata: {
                        firebaseUID: userId,
                    },
                });

                customerId = customer.id;

                // Save customer ID to Firestore
                await userRef.update({
                    stripeCustomerId: customerId,
                });
            }
        }

        // Determine success and cancel URLs
        const baseUrl = process.env.FRONTEND_URL;
        const finalSuccessUrl = packId
            ? successUrl || `${baseUrl}/dashboard/library?packPurchase=success`
            : isNewRegistration
                ? `${baseUrl}/auth/registration-success?session_id={CHECKOUT_SESSION_ID}`
                : successUrl || `${baseUrl}/dashboard/settings?success=true`;
        const finalCancelUrl = cancelUrl
            || (packId ? `${baseUrl}/dashboard/library?packPurchase=canceled` : `${baseUrl}/pricing?canceled=true`);

        // Prepare metadata
        const metadata: Record<string, string> = {};

        if (packId && pack) {
            metadata.firebaseUID = request.auth!.uid;
            metadata.packId = packId;
            metadata.packMode = pack.mode;
            metadata.packPages = String(pack.pages);
        } else if (isNewRegistration) {
            metadata.isNewRegistration = 'true';
            if (displayName) metadata.displayName = displayName;
            if (locale) metadata.locale = locale;
        } else {
            metadata.firebaseUID = request.auth!.uid;
        }

        // Build the Stripe Checkout Session. Three modes:
        //   - subscription / new registration: trial 30d, customer_email
        //   - subscription / existing user: customer-based
        //   - credit pack: one-time payment, customer-based, no trial / no subscription_data
        let session;

        if (packId) {
            // Credit-pack purchase (one-time payment).
            session = await stripe.checkout.sessions.create({
                customer: customerId,
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: resolvedPriceId,
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                success_url: finalSuccessUrl,
                cancel_url: finalCancelUrl,
                metadata,
                payment_intent_data: { metadata },
                allow_promotion_codes: true,
                billing_address_collection: 'required',
            });
        } else if (isNewRegistration) {
            // New registration: use customer_email
            session = await stripe.checkout.sessions.create({
                customer_email: customerEmail,
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: resolvedPriceId,
                        quantity: 1,
                    },
                ],
                mode: 'subscription',
                success_url: finalSuccessUrl,
                cancel_url: finalCancelUrl,
                metadata,
                allow_promotion_codes: true,
                billing_address_collection: 'required',
                subscription_data: {
                    trial_period_days: 30,
                    metadata,
                },
            });
        } else {
            // Existing user: use customer
            session = await stripe.checkout.sessions.create({
                customer: customerId,
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: resolvedPriceId,
                        quantity: 1,
                    },
                ],
                mode: 'subscription',
                success_url: finalSuccessUrl,
                cancel_url: finalCancelUrl,
                metadata,
                allow_promotion_codes: true,
                billing_address_collection: 'required',
                subscription_data: sinPrueba
                    ? { metadata }
                    : { trial_period_days: 30, metadata },
            });
        }

        return { sessionId: session.id, url: session.url };
    } catch (error: any) {
        console.error('Error creating checkout session:', error);
        throw new HttpsError('internal', error.message || 'Failed to create checkout session');
    }
});
