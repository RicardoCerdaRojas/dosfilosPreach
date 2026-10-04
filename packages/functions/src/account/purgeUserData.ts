import * as admin from 'firebase-admin';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import {
    OWNED_BY_DOC_ID,
    OWNED_BY_EMAIL,
    OWNED_BY_FIELD,
    OWNED_IN_MAP,
    OWNED_VIA_PARENT,
    storagePrefix,
} from './ownedData';

/**
 * Borra todo lo de un usuario (B2). Idempotente: si se corta a mitad (el
 * tiempo de una función programada), la próxima corrida sigue donde quedó.
 *
 * Las dependencias se inyectan: la prueba verifica que se recorra TODA la
 * lista de `ownedData`, en el orden correcto, sin tocar Firebase.
 */
export interface PurgeDeps {
    /** Borra los documentos de `collection` con `field == value`, con sus subcolecciones. Devuelve cuántos. */
    deleteWhere(collection: string, field: string, value: string): Promise<number>;
    /** Igual, para varios valores (`in`). */
    deleteWhereIn(collection: string, field: string, values: readonly string[]): Promise<number>;
    /** Los ids de `collection` con `field == value`. */
    listIdsWhere(collection: string, field: string, value: string): Promise<string[]>;
    /** Los ids de `users/{uid}/{sub}`. */
    listUserSubcollectionIds(uid: string, sub: string): Promise<string[]>;
    /** Quita `{map}.{key}` de todos los documentos de `collection` que la tengan. */
    deleteMapEntry(collection: string, map: string, key: string): Promise<number>;
    /** Borra `collection/id` con sus subcolecciones. */
    deleteDoc(collection: string, id: string): Promise<void>;
    /** Borra los archivos de Storage bajo `prefix`. */
    deleteStoragePrefix(prefix: string): Promise<void>;
}

export interface PurgeReport {
    documents: Record<string, number>;
}

/**
 * Las formas en que el correo pudo quedar guardado: tal cual (formularios y
 * Stripe guardan lo que se escribió, con mayúsculas) y en minúsculas.
 */
export function emailVariants(email: string | null | undefined): string[] {
    const raw = email?.trim();
    if (!raw) return [];
    return [...new Set([raw, raw.toLowerCase()])];
}

export async function purgeUserData(uid: string, email: string | null, deps: PurgeDeps): Promise<PurgeReport> {
    // Un uid vacío consultaría `campo == ''` en TODAS las colecciones.
    if (!uid.trim()) throw new Error('purgeUserData: uid vacío');
    const documents: Record<string, number> = {};
    const add = (collection: string, n: number) => {
        documents[collection] = (documents[collection] ?? 0) + n;
    };

    // 1. Los ids de los padres, ANTES de borrarlos: hay cachés que sólo
    //    guardan el sermón, la semilla o la sesión de la que salieron.
    const parents = {
        sermons: await deps.listIdsWhere('sermons', 'userId', uid),
        pastoralSeeds: await deps.listIdsWhere('pastoralSeeds', 'userId', uid),
        ai_sessions: await deps.listUserSubcollectionIds(uid, 'ai_sessions'),
    };
    for (const { collection, field, parent } of OWNED_VIA_PARENT) {
        if (parents[parent].length) add(collection, await deps.deleteWhereIn(collection, field, parents[parent]));
    }

    // 2. Todo lo que nombra al dueño.
    for (const { collection, field } of OWNED_BY_FIELD) {
        add(collection, await deps.deleteWhere(collection, field, uid));
    }
    for (const value of emailVariants(email)) {
        for (const { collection, field } of OWNED_BY_EMAIL) {
            add(collection, await deps.deleteWhere(collection, field, value));
        }
    }
    for (const { collection, map } of OWNED_IN_MAP) {
        add(collection, await deps.deleteMapEntry(collection, map, uid));
    }

    await deps.deleteStoragePrefix(storagePrefix(uid));

    // 3. `users/{uid}` al final: si algo de arriba falla, la cuenta sigue
    //    identificable para reintentar.
    for (const collection of OWNED_BY_DOC_ID) {
        await deps.deleteDoc(collection, uid);
    }
    return { documents };
}

/** Las dependencias reales, con el SDK de administración. */
export function adminPurgeDeps(): PurgeDeps {
    const db = admin.firestore();
    // La página en paralelo: en serie, una biblioteca grande no entraba en el
    // tiempo de la función (revisión adversarial de B2).
    const deletePage = async (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => {
        await Promise.all(docs.map((d) => db.recursiveDelete(d.ref)));
    };
    return {
        async deleteWhere(collection, field, value) {
            let total = 0;
            // Por páginas: una biblioteca puede tener miles de fragmentos.
            for (;;) {
                const page = await db.collection(collection).where(field, '==', value).limit(300).get();
                if (page.empty) return total;
                await deletePage(page.docs);
                total += page.size;
            }
        },
        async deleteWhereIn(collection, field, values) {
            let total = 0;
            // `in` admite hasta 30 valores por consulta.
            for (let i = 0; i < values.length; i += 30) {
                const chunk = values.slice(i, i + 30);
                for (;;) {
                    const page = await db.collection(collection).where(field, 'in', chunk).limit(300).get();
                    if (page.empty) break;
                    await deletePage(page.docs);
                    total += page.size;
                }
            }
            return total;
        },
        async listIdsWhere(collection, field, value) {
            const snap = await db.collection(collection).where(field, '==', value).select().get();
            return snap.docs.map((d) => d.id);
        },
        async listUserSubcollectionIds(uid, sub) {
            const refs = await db.collection('users').doc(uid).collection(sub).listDocuments();
            return refs.map((r) => r.id);
        },
        async deleteMapEntry(collection, map, key) {
            const path = new FieldPath(map, key);
            const snap = await db.collection(collection).where(new FieldPath(map, key, 'calls'), '>', 0).get();
            await Promise.all(snap.docs.map((d) => d.ref.update(path, FieldValue.delete())));
            return snap.size;
        },
        async deleteDoc(collection, id) {
            await db.recursiveDelete(db.collection(collection).doc(id));
        },
        async deleteStoragePrefix(prefix) {
            await getStorage().bucket().deleteFiles({ prefix });
        },
    };
}
