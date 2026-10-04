import * as admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { OWNED_BY_DOC_ID, OWNED_BY_EMAIL, OWNED_BY_FIELD, storagePrefix } from './ownedData';

/**
 * Borra todo lo de un usuario (B2). Idempotente: si se corta a mitad (el
 * tiempo de una función programada), la próxima corrida sigue donde quedó.
 *
 * Las dependencias se inyectan: la prueba verifica que se recorra TODA la
 * lista de `ownedData` sin tocar Firebase.
 */
export interface PurgeDeps {
    /** Borra los documentos de `collection` con `field == value`, con sus subcolecciones. Devuelve cuántos. */
    deleteWhere(collection: string, field: string, value: string): Promise<number>;
    /** Borra `collection/id` con sus subcolecciones. */
    deleteDoc(collection: string, id: string): Promise<void>;
    /** Borra los archivos de Storage bajo `prefix`. */
    deleteStoragePrefix(prefix: string): Promise<void>;
}

export interface PurgeReport {
    documents: Record<string, number>;
}

export async function purgeUserData(uid: string, email: string | null, deps: PurgeDeps): Promise<PurgeReport> {
    const documents: Record<string, number> = {};
    for (const { collection, field } of OWNED_BY_FIELD) {
        documents[collection] = await deps.deleteWhere(collection, field, uid);
    }
    const normalized = email?.trim().toLowerCase();
    if (normalized) {
        for (const { collection, field } of OWNED_BY_EMAIL) {
            documents[collection] = await deps.deleteWhere(collection, field, normalized);
        }
    }
    await deps.deleteStoragePrefix(storagePrefix(uid));
    // `users/{uid}` al final: si algo de arriba falla, la cuenta sigue
    // identificable para reintentar.
    for (const collection of OWNED_BY_DOC_ID) {
        await deps.deleteDoc(collection, uid);
    }
    return { documents };
}

/** Las dependencias reales, con el SDK de administración. */
export function adminPurgeDeps(): PurgeDeps {
    const db = admin.firestore();
    return {
        async deleteWhere(collection, field, value) {
            let total = 0;
            // Por páginas: una biblioteca puede tener miles de fragmentos.
            for (;;) {
                const page = await db.collection(collection).where(field, '==', value).limit(300).get();
                if (page.empty) return total;
                for (const doc of page.docs) await db.recursiveDelete(doc.ref);
                total += page.size;
            }
        },
        async deleteDoc(collection, id) {
            await db.recursiveDelete(db.collection(collection).doc(id));
        },
        async deleteStoragePrefix(prefix) {
            await getStorage().bucket().deleteFiles({ prefix });
        },
    };
}
