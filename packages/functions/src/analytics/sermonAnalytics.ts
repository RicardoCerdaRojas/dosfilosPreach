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
 * Track when a new sermon is created with wizardProgress
 * Increments draft count in both user_analytics and global_metrics
 */
export const onSermonCreated = functions.firestore
    .document('sermons/{sermonId}')
    .onCreate(async (snap, context) => {
        const sermon = snap.data();

        // Only count sermons with wizardProgress (created via generator)
        if (!sermon.wizardProgress) {
            console.log(`Sermon ${context.params.sermonId} has no wizardProgress, skipping`);
            return;
        }

        const batch = db.batch();
        const userId = sermon.userId;
        const today = getTodayString();

        console.log(`Tracking sermon creation: ${context.params.sermonId} for user ${userId}`);

        // Update user analytics
        const userAnalyticsRef = db.doc(`user_analytics/${userId}`);
        batch.set(userAnalyticsRef, {
            userId,
            sermons: {
                total: FieldValue.increment(1),
                drafts: FieldValue.increment(1),
                lastCreated: FieldValue.serverTimestamp(),
            },
            updatedAt: FieldValue.serverTimestamp(),
            version: 1,
        }, { merge: true });

        // Update daily global metrics
        const dailyRef = db.doc(`global_metrics_daily/${today}`);
        batch.set(dailyRef, {
            date: today,
            sermons: {
                created: FieldValue.increment(1),
                drafts: FieldValue.increment(1),
            },
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        // Update aggregate
        const aggregateRef = db.doc('global_metrics/aggregate');
        batch.set(aggregateRef, {
            allTime: {
                sermons: FieldValue.increment(1),
            },
            lastUpdated: FieldValue.serverTimestamp(),
        }, { merge: true });

        await batch.commit();
        console.log(`✓ Sermon analytics updated for ${userId}`);
    });

/**
 * Track when a sermon is published
 * Moves count from drafts to published
 */
export const onSermonPublished = functions.firestore
    .document('sermons/{sermonId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();

        // Only track if wizardProgress exists
        if (!after.wizardProgress || !before.wizardProgress) {
            return;
        }

        // Check if sermon was just published
        const wasPublished = !before.wizardProgress.publishedCopyId && after.wizardProgress.publishedCopyId;

        if (!wasPublished) {
            return;
        }

        const batch = db.batch();
        const userId = after.userId;
        const today = getTodayString();

        console.log(`Tracking sermon publication: ${context.params.sermonId} for user ${userId}`);

        // Update user analytics (move from draft to published)
        const userAnalyticsRef = db.doc(`user_analytics/${userId}`);
        batch.set(userAnalyticsRef, {
            sermons: {
                published: FieldValue.increment(1),
                drafts: FieldValue.increment(-1),
            },
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        // Update daily global metrics
        const dailyRef = db.doc(`global_metrics_daily/${today}`);
        batch.set(dailyRef, {
            sermons: {
                published: FieldValue.increment(1),
                drafts: FieldValue.increment(-1),
            },
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        await batch.commit();
        console.log(`✓ Sermon publication tracked for ${userId}`);
    });

/**
 * Track when a sermon is deleted
 * Decrements appropriate counters
 */
export const onSermonDeleted = functions.firestore
    .document('sermons/{sermonId}')
    .onDelete(async (snap, context) => {
        const sermon = snap.data();
        // Borrar la cuenta borra sus sermones: no se recrea su analítica (B2).
        if (await isAccountBeingPurged(sermon?.userId)) return;

        // Only count sermons with wizardProgress
        if (!sermon.wizardProgress) {
            return;
        }

        const batch = db.batch();
        const userId = sermon.userId;
        const today = getTodayString();
        const isPublished = !!sermon.wizardProgress.publishedCopyId;

        console.log(`Tracking sermon deletion: ${context.params.sermonId} (published: ${isPublished})`);

        // Update user analytics
        const userAnalyticsRef = db.doc(`user_analytics/${userId}`);
        batch.set(userAnalyticsRef, {
            sermons: {
                total: FieldValue.increment(-1),
                [isPublished ? 'published' : 'drafts']: FieldValue.increment(-1),
            },
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        // Update daily global metrics
        const dailyRef = db.doc(`global_metrics_daily/${today}`);
        batch.set(dailyRef, {
            sermons: {
                created: FieldValue.increment(-1),
                [isPublished ? 'published' : 'drafts']: FieldValue.increment(-1),
            },
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        // Update aggregate
        const aggregateRef = db.doc('global_metrics/aggregate');
        batch.set(aggregateRef, {
            allTime: {
                sermons: FieldValue.increment(-1),
            },
            lastUpdated: FieldValue.serverTimestamp(),
        }, { merge: true });

        await batch.commit();
        console.log(`✓ Sermon deletion tracked for ${userId}`);
    });
