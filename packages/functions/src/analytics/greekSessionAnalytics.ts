// firebase-functions v6+ cambió el entrypoint por defecto de v1 a v2. Estas
// funciones siguen en v1 (runWith / firestore.document / https.onCall v1), así
// que el import apunta explícitamente a /v1 para conservar el MISMO
// comportamiento. Migrarlas a v2 es trabajo aparte, no de este upgrade.
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { isAccountBeingPurged } from '../account/deletionState';

const db = admin.firestore();

/**
 * Helper to get today's date string in YYYY-MM-DD format
 */
function getTodayString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Track when a new Greek tutor session is created
 */
export const onGreekSessionCreated = functions.firestore
    .document('greek_sessions/{sessionId}')
    .onCreate(async (snap, context) => {
        const session = snap.data();
        const batch = db.batch();
        const userId = session.userId;
        const today = getTodayString();

        console.log(`Tracking Greek session creation: ${context.params.sessionId} for user ${userId}`);

        // Update user analytics
        const userAnalyticsRef = db.doc(`user_analytics/${userId}`);
        batch.set(userAnalyticsRef, {
            userId,
            greekSessions: {
                total: FieldValue.increment(1),
                lastSession: FieldValue.serverTimestamp(),
            },
            updatedAt: FieldValue.serverTimestamp(),
            version: 1,
        }, { merge: true });

        // Update daily global metrics
        const dailyRef = db.doc(`global_metrics_daily/${today}`);
        batch.set(dailyRef, {
            date: today,
            greekSessions: {
                created: FieldValue.increment(1),
            },
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        // Update aggregate
        const aggregateRef = db.doc('global_metrics/aggregate');
        batch.set(aggregateRef, {
            allTime: {
                greekSessions: FieldValue.increment(1),
            },
            lastUpdated: FieldValue.serverTimestamp(),
        }, { merge: true });

        await batch.commit();
        console.log(`✓ Greek session analytics updated for ${userId}`);
    });

/**
 * Track when a Greek session is completed (status becomes ACTIVE)
 */
export const onGreekSessionCompleted = functions.firestore
    .document('greek_sessions/{sessionId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();

        // Check if session was just completed
        const wasCompleted = before.status !== 'ACTIVE' && after.status === 'ACTIVE';

        if (!wasCompleted) {
            return;
        }

        const batch = db.batch();
        const userId = after.userId;
        const today = getTodayString();

        console.log(`Tracking Greek session completion: ${context.params.sessionId}`);

        // Update user analytics
        const userAnalyticsRef = db.doc(`user_analytics/${userId}`);
        batch.set(userAnalyticsRef, {
            greekSessions: {
                completed: FieldValue.increment(1),
            },
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        // Update daily global metrics
        const dailyRef = db.doc(`global_metrics_daily/${today}`);
        batch.set(dailyRef, {
            greekSessions: {
                completed: FieldValue.increment(1),
            },
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        await batch.commit();
        console.log(`✓ Greek session completion tracked for ${userId}`);
    });

/**
 * Track when a Greek session is deleted
 */
export const onGreekSessionDeleted = functions.firestore
    .document('greek_sessions/{sessionId}')
    .onDelete(async (snap, context) => {
        const session = snap.data();
        // Borrar la cuenta borra sus sesiones: no se recrea su analítica (B2).
        if (await isAccountBeingPurged(session?.userId)) return;
        const batch = db.batch();
        const userId = session.userId;
        const today = getTodayString();
        const wasCompleted = session.status === 'ACTIVE';

        console.log(`Tracking Greek session deletion: ${context.params.sessionId}`);

        // Update user analytics
        const userAnalyticsRef = db.doc(`user_analytics/${userId}`);
        const decrements: any = {
            greekSessions: {
                total: FieldValue.increment(-1),
            },
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (wasCompleted) {
            decrements.greekSessions.completed = FieldValue.increment(-1);
        }

        batch.set(userAnalyticsRef, decrements, { merge: true });

        // Update daily global metrics
        const dailyRef = db.doc(`global_metrics_daily/${today}`);
        const dailyDecrements: any = {
            greekSessions: {
                created: FieldValue.increment(-1),
            },
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (wasCompleted) {
            dailyDecrements.greekSessions.completed = FieldValue.increment(-1);
        }

        batch.set(dailyRef, dailyDecrements, { merge: true });

        // Update aggregate
        const aggregateRef = db.doc('global_metrics/aggregate');
        batch.set(aggregateRef, {
            allTime: {
                greekSessions: FieldValue.increment(-1),
            },
            lastUpdated: FieldValue.serverTimestamp(),
        }, { merge: true });

        await batch.commit();
        console.log(`✓ Greek session deletion tracked for ${userId}`);
    });
