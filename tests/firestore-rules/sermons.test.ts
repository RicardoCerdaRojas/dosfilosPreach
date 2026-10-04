import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
    Timestamp,
    collection,
    doc,
    getDocs,
    limit as fsLimit,
    orderBy,
    query,
    setDoc,
    where,
} from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

/**
 * Reglas de `sermons` — listar (2026-10-04).
 *
 * POR QUÉ EXISTE ESTE ARCHIVO: `allow list` era `isAuthenticated()`, con un
 * comentario que decía que la consulta llevaba `userId`. La regla no lo
 * exigía: cualquier usuario con sesión podía pedir `collection('sermons')` sin
 * filtro y leer los sermones de todos. Se halló revisando la app mobile.
 *
 * Las consultas de abajo son réplicas de las que hace el cliente
 * (`FirebaseSermonRepository`, `UsageLimitsService`): si una deja de pasar, la
 * regla rompió una pantalla.
 */

const PROJECT_ID = 'demo-dosfilos-rules';
const PASTOR = 'pastor-uid';
const OTRO_PASTOR = 'otro-pastor-uid';
const SUPER_ADMIN = 'super-admin-uid';

let env: RulesTestEnvironment;

function sermonDe(userId: string, extra: Record<string, unknown> = {}) {
    return {
        userId,
        title: 'Compasión temporal',
        content: 'Texto del sermón.',
        status: 'published',
        isShared: false,
        createdAt: Timestamp.fromDate(new Date('2026-10-01')),
        ...extra,
    };
}

beforeAll(async () => {
    env = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
            host: '127.0.0.1',
            port: 8080,
            rules: readFileSync(fileURLToPath(new URL('../../firestore.rules', import.meta.url)), 'utf8'),
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
async function sembrar() {
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'users', SUPER_ADMIN), { role: 'super_admin' });
        await setDoc(doc(db, 'sermons', 'propio'), sermonDe(PASTOR, { sourceSermonId: 'borrador-1' }));
        await setDoc(doc(db, 'sermons', 'ajeno'), sermonDe(OTRO_PASTOR));
        await setDoc(doc(db, 'sermons', 'compartido'), sermonDe(OTRO_PASTOR, { isShared: true, shareToken: 'tok-123' }));
    });
}

describe('sermons — list', () => {
    it('REGRESIÓN: un usuario con sesión NO puede listar todos los sermones sin filtro', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertFails(getDocs(query(collection(db, 'sermons'), orderBy('createdAt', 'desc'))));
    });

    it('nadie lista los sermones de otro pastor filtrando por su userId', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertFails(getDocs(query(collection(db, 'sermons'), where('userId', '==', OTRO_PASTOR))));
    });

    it('el dueño lista los suyos (findByUserId con estado y orden)', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR).firestore();
        const snap = await assertSucceeds(getDocs(query(
            collection(db, 'sermons'),
            where('userId', '==', PASTOR),
            where('status', '==', 'published'),
            orderBy('createdAt', 'desc'),
        )));
        expect(snap.docs.map(d => d.id)).toEqual(['propio']);
    });

    it('el dueño busca la copia publicada de su borrador (findPublishedCopyOf)', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR).firestore();
        const snap = await assertSucceeds(getDocs(query(
            collection(db, 'sermons'),
            where('userId', '==', PASTOR),
            where('sourceSermonId', '==', 'borrador-1'),
            where('status', '==', 'published'),
        )));
        expect(snap.size).toBe(1);
    });

    it('el conteo mensual de límites de uso sigue pasando (UsageLimitsService)', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertSucceeds(getDocs(query(
            collection(db, 'sermons'),
            where('userId', '==', PASTOR),
            where('createdAt', '>=', Timestamp.fromDate(new Date('2026-10-01'))),
        )));
    });

    it('con sesión se abre un sermón compartido por su enlace (findByShareToken)', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR).firestore();
        const snap = await assertSucceeds(getDocs(query(
            collection(db, 'sermons'),
            where('shareToken', '==', 'tok-123'),
            where('isShared', '==', true),
            fsLimit(1),
        )));
        expect(snap.docs.map(d => d.id)).toEqual(['compartido']);
    });

    it('sin sesión la consulta por enlace sigue rechazada (comportamiento previo, sin ampliar)', async () => {
        await sembrar();
        const db = env.unauthenticatedContext().firestore();
        await assertFails(getDocs(query(
            collection(db, 'sermons'),
            where('shareToken', '==', 'tok-123'),
            where('isShared', '==', true),
            fsLimit(1),
        )));
    });

    it('el super_admin lista sin filtro', async () => {
        await sembrar();
        const db = env.authenticatedContext(SUPER_ADMIN).firestore();
        const snap = await assertSucceeds(getDocs(query(collection(db, 'sermons'))));
        expect(snap.size).toBe(3);
    });
});
