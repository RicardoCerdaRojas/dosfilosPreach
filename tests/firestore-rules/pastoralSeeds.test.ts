import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit as fsLimit,
    orderBy,
    query,
    runTransaction,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

/**
 * Reglas de `pastoralSeeds` — la unidad de estudio del pastor (ADR-015).
 *
 * POR QUÉ EXISTE ESTE ARCHIVO: el 2026-08-23 el PR #454 volvió idempotente la
 * creación del seed fijando el id del documento al `sermonId`, con una
 * transacción que PRIMERO LEE el documento antes de escribirlo. No tocó
 * `firestore.rules`, donde `allow get` desreferenciaba `resource.data.userId`
 * sin contemplar el documento ausente. Sobre un documento que no existe
 * `resource` es null, la expresión falla, y Firestore responde
 * permission-denied en vez de «no encontrado»: la regla prohibía leer lo que
 * todavía no existía, así que el seed NO SE PODÍA CREAR NUNCA.
 *
 * Estuvo roto tres semanas para todo sermón nuevo. Nadie lo vio porque no había
 * una sola prueba de reglas en el repo: un desajuste entre una lectura nueva del
 * cliente y las reglas era, literalmente, indetectable hasta que un pastor lo
 * reportaba.
 */

const PROJECT_ID = 'demo-dosfilos-rules';
const PASTOR = 'pastor-uid';
const OTRO_PASTOR = 'otro-pastor-uid';
const SUPER_ADMIN = 'super-admin-uid';

const SERMON_EXISTENTE = 'sermon-con-seed';
const SERMON_NUEVO = 'sermon-sin-seed-todavia';

let env: RulesTestEnvironment;

/** El seed tal como lo escribe `createEmptyPastoralSeed` + el repo. */
function seedDe(userId: string, sermonId: string) {
    return {
        userId,
        sermonId,
        passage: 'Santiago 1:19-27',
        origin: 'wizard',
        completed: false,
    };
}

beforeAll(async () => {
    env = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
            host: '127.0.0.1',
            port: 8080,
            rules: readFileSync(
                fileURLToPath(new URL('../../firestore.rules', import.meta.url)),
                'utf8',
            ),
        },
    });
});

afterAll(async () => {
    await env?.cleanup();
});

afterEach(async () => {
    await env.clearFirestore();
});

/** Siembra saltándose las reglas: el estado previo no es lo que se prueba. */
async function sembrar(fn: (db: any) => Promise<void>) {
    await env.withSecurityRulesDisabled(async (ctx) => {
        await fn(ctx.firestore());
    });
}

describe('pastoralSeeds — get', () => {
    it('REGRESIÓN #454: un sermón nuevo puede crear su seed (la transacción lee el documento ausente y luego escribe)', async () => {
        const db = env.authenticatedContext(PASTOR).firestore();
        const ref = doc(db, 'pastoralSeeds', SERMON_NUEVO);

        // Réplica exacta de FirestorePastoralSeedRepository.create(): el
        // `tx.get` sobre un documento inexistente es lo que rompía.
        await assertSucceeds(
            runTransaction(db, async (tx) => {
                const snap = await tx.get(ref);
                if (snap.exists()) return;
                tx.set(ref, seedDe(PASTOR, SERMON_NUEVO));
            }),
        );

        const escrito = await getDoc(doc(db, 'pastoralSeeds', SERMON_NUEVO));
        expect(escrito.exists()).toBe(true);
        expect(escrito.data()?.userId).toBe(PASTOR);
    });

    it('un usuario autenticado puede leer un documento que no existe (recibe vacío, no permission-denied)', async () => {
        const db = env.authenticatedContext(PASTOR).firestore();
        const snap = await assertSucceeds(getDoc(doc(db, 'pastoralSeeds', 'no-existe')));
        expect(snap.exists()).toBe(false);
    });

    it('un usuario sin sesión NO puede leer un documento inexistente', async () => {
        const db = env.unauthenticatedContext().firestore();
        await assertFails(getDoc(doc(db, 'pastoralSeeds', 'no-existe')));
    });

    it('el dueño lee su propio seed', async () => {
        await sembrar(async (db) => {
            await setDoc(
                doc(db, 'pastoralSeeds', SERMON_EXISTENTE),
                seedDe(PASTOR, SERMON_EXISTENTE),
            );
        });
        const db = env.authenticatedContext(PASTOR).firestore();
        const snap = await assertSucceeds(getDoc(doc(db, 'pastoralSeeds', SERMON_EXISTENTE)));
        expect(snap.data()?.passage).toBe('Santiago 1:19-27');
    });

    it('otro pastor NO lee el seed ajeno', async () => {
        await sembrar(async (db) => {
            await setDoc(
                doc(db, 'pastoralSeeds', SERMON_EXISTENTE),
                seedDe(PASTOR, SERMON_EXISTENTE),
            );
        });
        const db = env.authenticatedContext(OTRO_PASTOR).firestore();
        await assertFails(getDoc(doc(db, 'pastoralSeeds', SERMON_EXISTENTE)));
    });

    it('un super_admin lee el seed ajeno (inspector de auditoría)', async () => {
        await sembrar(async (db) => {
            await setDoc(doc(db, 'users', SUPER_ADMIN), { role: 'super_admin' });
            await setDoc(
                doc(db, 'pastoralSeeds', SERMON_EXISTENTE),
                seedDe(PASTOR, SERMON_EXISTENTE),
            );
        });
        const db = env.authenticatedContext(SUPER_ADMIN).firestore();
        await assertSucceeds(getDoc(doc(db, 'pastoralSeeds', SERMON_EXISTENTE)));
    });
});

describe('pastoralSeeds — create', () => {
    it('el pastor crea su propio seed', async () => {
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertSucceeds(
            setDoc(doc(db, 'pastoralSeeds', SERMON_NUEVO), seedDe(PASTOR, SERMON_NUEVO)),
        );
    });

    it('NO puede crear un seed a nombre de otro pastor', async () => {
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertFails(
            setDoc(doc(db, 'pastoralSeeds', SERMON_NUEVO), seedDe(OTRO_PASTOR, SERMON_NUEVO)),
        );
    });

    it('NO puede crear un seed sin sermonId', async () => {
        const db = env.authenticatedContext(PASTOR).firestore();
        const { sermonId: _omitido, ...sinSermon } = seedDe(PASTOR, SERMON_NUEVO);
        await assertFails(setDoc(doc(db, 'pastoralSeeds', SERMON_NUEVO), sinSermon));
    });

    it('NO puede crear un seed sin passage', async () => {
        const db = env.authenticatedContext(PASTOR).firestore();
        const { passage: _omitido, ...sinPassage } = seedDe(PASTOR, SERMON_NUEVO);
        await assertFails(setDoc(doc(db, 'pastoralSeeds', SERMON_NUEVO), sinPassage));
    });
});

describe('pastoralSeeds — update / delete', () => {
    async function sembrarSeedDelPastor() {
        await sembrar(async (db) => {
            await setDoc(
                doc(db, 'pastoralSeeds', SERMON_EXISTENTE),
                seedDe(PASTOR, SERMON_EXISTENTE),
            );
        });
    }

    it('el dueño guarda su avance', async () => {
        await sembrarSeedDelPastor();
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertSucceeds(
            updateDoc(doc(db, 'pastoralSeeds', SERMON_EXISTENTE), { completed: true }),
        );
    });

    it('otro pastor NO guarda sobre el seed ajeno', async () => {
        await sembrarSeedDelPastor();
        const db = env.authenticatedContext(OTRO_PASTOR).firestore();
        await assertFails(
            updateDoc(doc(db, 'pastoralSeeds', SERMON_EXISTENTE), { completed: true }),
        );
    });

    it('el dueño NO puede reasignar el seed a otro usuario', async () => {
        await sembrarSeedDelPastor();
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertFails(
            updateDoc(doc(db, 'pastoralSeeds', SERMON_EXISTENTE), { userId: OTRO_PASTOR }),
        );
    });

    it('el dueño NO puede mover el seed a otro sermón', async () => {
        await sembrarSeedDelPastor();
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertFails(
            updateDoc(doc(db, 'pastoralSeeds', SERMON_EXISTENTE), { sermonId: 'otro-sermon' }),
        );
    });

    it('un super_admin NO escribe sobre el seed del pastor (el estudio es su voz)', async () => {
        await sembrar(async (db) => {
            await setDoc(doc(db, 'users', SUPER_ADMIN), { role: 'super_admin' });
            await setDoc(
                doc(db, 'pastoralSeeds', SERMON_EXISTENTE),
                seedDe(PASTOR, SERMON_EXISTENTE),
            );
        });
        const db = env.authenticatedContext(SUPER_ADMIN).firestore();
        await assertFails(
            updateDoc(doc(db, 'pastoralSeeds', SERMON_EXISTENTE), { completed: true }),
        );
    });

    it('otro pastor NO borra el seed ajeno', async () => {
        await sembrarSeedDelPastor();
        const db = env.authenticatedContext(OTRO_PASTOR).firestore();
        await assertFails(deleteDoc(doc(db, 'pastoralSeeds', SERMON_EXISTENTE)));
    });
});

describe('pastoralSeeds — list', () => {
    it('el dueño encuentra su seed por sermonId (consulta de findBySermonId)', async () => {
        await sembrar(async (db) => {
            await setDoc(
                doc(db, 'pastoralSeeds', SERMON_EXISTENTE),
                { ...seedDe(PASTOR, SERMON_EXISTENTE), updatedAt: new Date() },
            );
        });
        const db = env.authenticatedContext(PASTOR).firestore();
        const q = query(
            collection(db, 'pastoralSeeds'),
            where('sermonId', '==', SERMON_EXISTENTE),
            orderBy('updatedAt', 'desc'),
            fsLimit(1),
        );
        const snap = await assertSucceeds(getDocs(q));
        expect(snap.size).toBe(1);
    });

    /**
     * FUGA CONOCIDA — se cierra en el PR que sigue a este.
     *
     * `allow list: if isAuthenticated()` deja que CUALQUIER usuario con sesión
     * consulte la colección y lea el seed de otro pastor: el estudio entero,
     * incluido lo que escribió a mano. La prueba afirma la conducta ACTUAL a
     * propósito, para que el PR que la cierre muestre el cambio de seguridad en
     * su diff en vez de esconderlo.
     */
    it('HOY un pastor ajeno puede leer el seed de otro por consulta (pendiente de cerrar)', async () => {
        await sembrar(async (db) => {
            await setDoc(
                doc(db, 'pastoralSeeds', SERMON_EXISTENTE),
                { ...seedDe(PASTOR, SERMON_EXISTENTE), updatedAt: new Date() },
            );
        });
        const db = env.authenticatedContext(OTRO_PASTOR).firestore();
        const q = query(
            collection(db, 'pastoralSeeds'),
            where('sermonId', '==', SERMON_EXISTENTE),
            fsLimit(1),
        );
        const snap = await assertSucceeds(getDocs(q));
        expect(snap.size).toBe(1);
        expect(snap.docs[0].data().userId).toBe(PASTOR);
    });
});
