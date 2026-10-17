import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

/**
 * Reglas de `library_resources` — los libros de cada usuario, con su texto
 * extraído completo (`textContent`).
 *
 * Hasta el 2026-10-16 cualquier sesión los leía todos, y un usuario podía
 * publicar un recurso propio en la biblioteca común cambiándole el dueño a
 * `__system__`. Las consultas de abajo replican las del cliente
 * (FirebaseLibraryRepository, UsageLimitsService, el panel de super admin):
 * si una deja de pasar, una pantalla se rompe sin que nada más lo avise.
 */

const PROJECT_ID = 'demo-dosfilos-rules';
const PASTOR = 'pastor-uid';
const OTRO = 'otro-pastor-uid';
const ADMIN = 'super-admin-uid';
const SISTEMA = '__system__';

let env: RulesTestEnvironment;

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
afterAll(async () => { await env?.cleanup(); });
afterEach(async () => { await env.clearFirestore(); });

function recurso(userId: string, extra: Record<string, unknown> = {}) {
    return { userId, title: `Libro de ${userId}`, textContent: 'texto completo del libro', createdAt: new Date(), ...extra };
}

async function sembrar() {
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'users', ADMIN), { role: 'super_admin' });
        await setDoc(doc(db, 'users', PASTOR), { role: 'user' });
        await setDoc(doc(db, 'library_resources', 'mio'), recurso(PASTOR));
        await setDoc(doc(db, 'library_resources', 'ajeno'), recurso(OTRO));
        await setDoc(doc(db, 'library_resources', 'comun'), recurso(SISTEMA, { isSystemSource: true }));
    });
}

const recursos = (db: any) => collection(db, 'library_resources');

describe('library_resources — leer', () => {
    it('lo propio y la biblioteca común, por id y con las consultas del cliente', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertSucceeds(getDoc(doc(db, 'library_resources', 'mio')));
        await assertSucceeds(getDoc(doc(db, 'library_resources', 'comun')));
        // findByUserId / subscribeToUserResources / UsageLimitsService
        await assertSucceeds(getDocs(query(recursos(db), where('userId', '==', PASTOR), orderBy('createdAt', 'desc'))));
        // findByUserIdAndTitle
        await assertSucceeds(getDocs(query(recursos(db), where('userId', '==', PASTOR), where('title', '==', 'x'))));
        // findSystemResources
        await assertSucceeds(getDocs(query(recursos(db), where('userId', '==', SISTEMA), orderBy('createdAt', 'desc'))));
    });

    it('un recurso borrado dice «no existe», no «permiso denegado»', async () => {
        const db = env.authenticatedContext(PASTOR).firestore();
        const snap = await assertSucceeds(getDoc(doc(db, 'library_resources', 'ya-no-existe')));
        expect(snap.exists()).toBe(false);
    });

    it('lo de otro usuario no: ni por id, ni por consulta, ni una consulta sin dueño', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertFails(getDoc(doc(db, 'library_resources', 'ajeno')));
        await assertFails(getDocs(query(recursos(db), where('userId', '==', OTRO))));
        await assertFails(getDocs(recursos(db)));
        // La consulta de `findCoreResources`, sin dueño, ya no pasa (por eso devuelve vacío).
        await assertFails(getDocs(query(recursos(db), where('coreStores', 'array-contains', 'global'))));
    });

    it('sin sesión, ni siquiera la biblioteca común', async () => {
        await sembrar();
        const db = env.unauthenticatedContext().firestore();
        await assertFails(getDoc(doc(db, 'library_resources', 'comun')));
        await assertFails(getDocs(query(recursos(db), where('userId', '==', SISTEMA))));
    });

    it('el super admin lee lo de otros (panel de usuarios, semilla CORE)', async () => {
        await sembrar();
        const db = env.authenticatedContext(ADMIN).firestore();
        await assertSucceeds(getDoc(doc(db, 'library_resources', 'ajeno')));
        await assertSucceeds(getDocs(query(recursos(db), where('userId', '==', OTRO))));
        await assertSucceeds(getDocs(query(recursos(db), where('isSystemSource', '==', true))));
    });
});

describe('library_resources — escribir', () => {
    it('crear, actualizar y borrar lo propio', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertSucceeds(setDoc(doc(db, 'library_resources', 'nuevo'), recurso(PASTOR)));
        await assertSucceeds(updateDoc(doc(db, 'library_resources', 'nuevo'), { title: 'Otro título', coreStores: [] }));
        await assertSucceeds(deleteDoc(doc(db, 'library_resources', 'nuevo')));
    });

    it('nadie se publica en la biblioteca común: ni cambiando el dueño ni marcándose fuente del sistema', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertFails(updateDoc(doc(db, 'library_resources', 'mio'), { userId: SISTEMA }));
        await assertFails(updateDoc(doc(db, 'library_resources', 'mio'), { isSystemSource: true }));
        await assertFails(setDoc(doc(db, 'library_resources', 'falso'), recurso(PASTOR, { isSystemSource: true })));
        await assertFails(setDoc(doc(db, 'library_resources', 'falso2'), recurso(SISTEMA)));
    });

    it('nadie se mete solo en un store CORE (las citas de los sermones de todos)', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertFails(updateDoc(doc(db, 'library_resources', 'mio'), { coreStores: ['homiletics'] }));
        await assertFails(setDoc(doc(db, 'library_resources', 'falso3'), recurso(PASTOR, { coreStores: ['exegesis'] })));
        // Lo que escribe el cliente al crear: `coreStores: []`.
        await assertSucceeds(setDoc(doc(db, 'library_resources', 'nuevo2'), recurso(PASTOR, { coreStores: [] })));
    });

    it('un recurso que ya está en un store: el dueño lo puede editar sin tocarlo, o sacarlo, pero no cambiarlo', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'library_resources', 'en-store'), recurso(PASTOR, { coreStores: ['exegesis'] }));
        });
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertSucceeds(updateDoc(doc(db, 'library_resources', 'en-store'), { title: 'Nuevo título' }));
        await assertFails(updateDoc(doc(db, 'library_resources', 'en-store'), { coreStores: ['exegesis', 'homiletics'] }));
        await assertSucceeds(updateDoc(doc(db, 'library_resources', 'en-store'), { coreStores: [] }));
    });

    it('el super admin arma los stores con sus libros', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await setDoc(doc(db, 'users', ADMIN), { role: 'super_admin' });
            await setDoc(doc(db, 'library_resources', 'del-admin'), recurso(ADMIN));
        });
        const db = env.authenticatedContext(ADMIN).firestore();
        await assertSucceeds(updateDoc(doc(db, 'library_resources', 'del-admin'), { coreStores: ['exegesis'] }));
    });

    it('no se toca lo ajeno ni lo común', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertFails(updateDoc(doc(db, 'library_resources', 'ajeno'), { title: 'pisado' }));
        await assertFails(deleteDoc(doc(db, 'library_resources', 'ajeno')));
        await assertFails(deleteDoc(doc(db, 'library_resources', 'comun')));
    });

    it('el super admin sí puede marcar una fuente del sistema propia', async () => {
        await sembrar();
        const db = env.authenticatedContext(ADMIN).firestore();
        await assertSucceeds(setDoc(doc(db, 'library_resources', 'semilla'), recurso(ADMIN, { isSystemSource: true })));
    });
});

describe('library_summaries (U7)', () => {
    it('el cliente no lee ni escribe los resúmenes (los sirve el servidor tras verificar al dueño)', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertFails(getDoc(doc(db, 'library_summaries', 'mio_mapa')));
        await assertFails(setDoc(doc(db, 'library_summaries', 'mio_mapa'), { userId: PASTOR, resultado: {} }));
    });
});
