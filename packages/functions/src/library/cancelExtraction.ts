import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import { cerrarFichasAbiertas } from './fichaDeCorrida';

interface CancelRequest {
    resourceId: string;
}

const ADMIN_EMAIL = 'rdocerda@gmail.com';

/**
 * Callable Cloud Function: cancels an in-progress extraction by
 * deleting the resource doc + its chunks + its storage objects.
 *
 * Authorized callers:
 *   - Resource owner (`auth.uid === resource.userId`)
 *   - Admin (`ADMIN_EMAIL`) — for cleanup of zombie resources
 *
 * The storage trigger that's actually doing the extraction may
 * still be running when this fires; that's fine. Its final
 * `resourceRef.update(...)` will be a no-op (Firestore allows
 * updates on deleted docs but they don't bring the doc back), and
 * the auto-indexer trigger never fires for a doc that was deleted
 * before it transitioned to 'ready'. Worst case the cloud function
 * burns a few extra LlamaParse credits before noticing — acceptable
 * trade-off vs maintaining a cancellation token across services.
 *
 * No refund is performed: the debit only happens at the END of
 * extraction (after the cascade succeeds), so cancelling mid-run
 * means nothing was debited yet.
 *
 * Idempotent: if the resource is already gone, returns success.
 */
export const cancelExtraction = onCall<CancelRequest>(
    {
        ...appCheckCallableOptions(),
        region: 'us-central1',
        memory: '512MiB',
        timeoutSeconds: 60,
    },
    async (request) => {
        const callerEmail = request.auth?.token?.email ?? 'unauthenticated';
        const callerUid = request.auth?.uid;
        if (!request.auth || !callerUid) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }

        const { resourceId } = request.data;
        if (!resourceId) {
            throw new HttpsError('invalid-argument', 'resourceId is required');
        }

        console.log(`[CancelExtraction] Called by ${callerEmail} for resource ${resourceId}`);

        const db = getFirestore();
        const resourceRef = db.collection('library_resources').doc(resourceId);
        const snap = await resourceRef.get();

        // Idempotent: already gone is success.
        if (!snap.exists) {
            console.log(`[CancelExtraction] ${resourceId} already deleted; nothing to do`);
            return { success: true, alreadyGone: true };
        }

        const data = snap.data()!;

        // Authorization: owner or admin.
        const isAdmin = callerEmail === ADMIN_EMAIL;
        const isOwner = data.userId === callerUid;
        if (!isAdmin && !isOwner) {
            throw new HttpsError('permission-denied', 'You can only cancel your own resources');
        }

        // Refuse to "cancel" a resource that's already finished —
        // those need the regular Delete action which has its own
        // confirm dialog and respects user intent more clearly.
        if (data.textExtractionStatus === 'ready') {
            throw new HttpsError(
                'failed-precondition',
                'Resource has already finished extracting; use Delete instead of Cancel.',
            );
        }

        // 1. Delete chunks (if any made it through partial indexing).
        try {
            const chunksSnap = await db
                .collection('document_chunks')
                .where('resourceId', '==', resourceId)
                .get();
            if (!chunksSnap.empty) {
                const batch = db.batch();
                chunksSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                console.log(`[CancelExtraction] Deleted ${chunksSnap.size} chunks`);
            }
        } catch (err: any) {
            console.warn(`[CancelExtraction] Chunk cleanup failed: ${err.message ?? err}`);
            // Non-fatal: continue with doc + storage deletion.
        }

        // 2. Delete storage objects (PDF + structured.md if it exists).
        const storage = getStorage();
        const userId: string = data.userId;
        const bucket = storage.bucket('dosfilosapp.firebasestorage.app');
        const prefix = `users/${userId}/library/${resourceId}/`;
        try {
            const [files] = await bucket.getFiles({ prefix });
            await Promise.all(files.map(f => f.delete().catch(() => {/* ignore individual */ })));
            console.log(`[CancelExtraction] Deleted ${files.length} storage object(s) under ${prefix}`);
        } catch (err: any) {
            console.warn(`[CancelExtraction] Storage cleanup failed: ${err.message ?? err}`);
            // Non-fatal: continue with doc deletion.
        }

        // 3. Delete the Firestore doc. This is the user-visible
        //    "the card disappeared" signal and is the source of truth
        //    for "this resource is gone".
        await resourceRef.delete();
        console.log(`[CancelExtraction] ✅ Deleted resource doc ${resourceId}`);

        // La ficha sobrevive al recurso a propósito: un libro que alguien
        // cancela a los diez minutos es justamente un dato que interesa.
        await cerrarFichasAbiertas(db, resourceId, 'cancelled');

        return { success: true };
    },
);
