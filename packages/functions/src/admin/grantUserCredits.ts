import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { writeAuditLog } from './auditLog';
import { addPackAdmin } from '../library/processingBalance';
import { appCheckCallableOptions } from '../config/appCheckOptions';

interface GrantUserCreditsRequest {
    userId: string;
    standardPages?: number;
    premiumPages?: number;
    reason: string;
}

/**
 * Cloud Function: Admin grants processing credits to a user.
 *
 * Two common use cases:
 *   1. Bug compensation — extraction failed mid-flight and consumed pages
 *      that the user shouldn't have lost.
 *   2. Sales / partnership — comp credits for a launch promotion or beta tester.
 *
 * El otorgamiento ACREDITA EL BUCKET `pack`, vía `addPackAdmin`, que es el
 * helper canónico. No se escribe el agregado a mano, por dos razones que ya
 * costaron caro:
 *
 *   1. `readBalance` RECALCULA `standardPagesAvailable` como plan + pack en
 *      cada lectura. Un otorgamiento que sólo incrementaba el agregado quedaba
 *      ignorado por la ruta de consumo: el número aparecía en el panel de admin
 *      y en ningún otro lado. El usuario veía saldo y no podía gastarlo.
 *
 *   2. Va a `pack` y no a `plan` porque el bucket del plan se RESETEA en cada
 *      factura de Stripe. Un crédito de compensación que desaparece al mes
 *      siguiente no compensa nada.
 *
 * `addPackAdmin` además siembra la estructura SÓLO si no existe. La versión
 * anterior la sembraba sin condición con `set(merge:true)`, lo que ponía en
 * cero el saldo disponible y los contadores históricos de gasto del usuario
 * antes de incrementar: otorgar 500 páginas a alguien que tenía 1.031 lo
 * dejaba con 500 y le borraba el historial.
 *
 * A `reason` is required and written to the audit log for compliance.
 *
 * Negative values (deductions) are NOT allowed via this function — that's
 * disable + manual cleanup territory.
 */
export const grantUserCredits = onCall<GrantUserCreditsRequest>(appCheckCallableOptions(), async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const callerUid = request.auth.uid;
    const db = admin.firestore();

    const callerDoc = await db.collection('users').doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== 'super_admin') {
        throw new HttpsError('permission-denied', 'Only super admins can grant credits');
    }

    const { userId, standardPages = 0, premiumPages = 0, reason } = request.data ?? ({} as GrantUserCreditsRequest);
    if (!userId || !reason?.trim()) {
        throw new HttpsError('invalid-argument', 'userId and reason are required');
    }
    if (standardPages < 0 || premiumPages < 0) {
        throw new HttpsError('invalid-argument', 'Negative grants are not allowed');
    }
    if (standardPages === 0 && premiumPages === 0) {
        throw new HttpsError('invalid-argument', 'At least one of standardPages or premiumPages must be > 0');
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        throw new HttpsError('not-found', `User ${userId} not found`);
    }
    const userData = userDoc.data()!;

    // `addPackAdmin` siembra la estructura si falta, acredita el bucket pack y
    // deja el agregado cuadrado como plan + pack. No hay nada que escribir acá.
    if (standardPages > 0) {
        await addPackAdmin(userId, 'standard', standardPages);
    }
    if (premiumPages > 0) {
        await addPackAdmin(userId, 'premium', premiumPages);
    }

    writeAuditLog({
        actorUid: callerUid,
        actorEmail: callerDoc.data()?.email,
        action: 'user.grant_credits',
        targetUid: userId,
        targetEmail: userData.email,
        details: {
            standardPages,
            premiumPages,
            reason,
        },
    });

    return { success: true, standardPages, premiumPages };
});
