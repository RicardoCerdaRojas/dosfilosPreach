import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import { COLECCION_DE_FICHAS } from './fichaDeCorrida';

/**
 * Lectura super_admin de las fichas de extracción, para el panel.
 *
 * Callable FINO, mismo patrón que `getLlmUsageSummary`: devuelve las fichas
 * crudas y la agregación —por motor, tasa de fallo, alertas de fidelidad— corre
 * en el cliente, en funciones puras con pruebas.
 *
 * Agrega el título del libro y el correo del dueño porque el panel habla de
 * libros y personas, no de identificadores. El título es metadato del recurso;
 * de su contenido la ficha no guarda nada.
 */

const POR_DEFECTO = 200;
const MAXIMO = 500;

export const getExtractionRuns = onCall({ ...appCheckCallableOptions() }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
    }
    const db = admin.firestore();
    const caller = await db.collection('users').doc(request.auth.uid).get();
    if (!caller.exists || caller.data()?.role !== 'super_admin') {
        throw new HttpsError('permission-denied', 'Super admin only');
    }

    const pedido = Number((request.data as { limit?: number } | undefined)?.limit ?? POR_DEFECTO);
    const limite = Math.min(Math.max(1, Number.isFinite(pedido) ? pedido : POR_DEFECTO), MAXIMO);

    const snap = await db
        .collection(COLECCION_DE_FICHAS)
        .orderBy('startedAt', 'desc')
        .limit(limite)
        .get();

    const resourceIds = [...new Set(snap.docs.map((d) => d.data().resourceId as string).filter(Boolean))];
    const userIds = [...new Set(snap.docs.map((d) => d.data().userId as string).filter(Boolean))];

    const titles: Record<string, string> = {};
    if (resourceIds.length > 0) {
        const recursos = await db.getAll(...resourceIds.map((id) => db.collection('library_resources').doc(id)));
        for (const r of recursos) {
            if (r.exists) titles[r.id] = (r.data()?.title as string) ?? '';
        }
    }
    const emails: Record<string, string> = {};
    if (userIds.length > 0) {
        const usuarios = await db.getAll(...userIds.map((id) => db.collection('users').doc(id)));
        for (const u of usuarios) {
            if (u.exists) emails[u.id] = (u.data()?.email as string) ?? u.id;
        }
    }

    return {
        titles,
        emails,
        runs: snap.docs.map((d) => {
            const x = d.data();
            return {
                ...x,
                runId: d.id,
                startedAt: aIso(x.startedAt),
                finishedAt: aIso(x.finishedAt),
            };
        }),
    };
});

function aIso(v: unknown): string | null {
    if (!v) return null;
    const conToDate = v as { toDate?: () => Date };
    if (typeof conToDate.toDate === 'function') return conToDate.toDate().toISOString();
    return v instanceof Date ? v.toISOString() : null;
}
