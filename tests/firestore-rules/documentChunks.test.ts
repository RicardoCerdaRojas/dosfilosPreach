import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

/**
 * Reglas de `document_chunks` — el texto de los libros de cada usuario.
 *
 * Hasta el 2026-10-16 cualquier sesión podía LEER y BORRAR los fragmentos de
 * otros usuarios (`allow read, delete: if isAuthenticated()`). Ahora sólo el
 * dueño. Las consultas de abajo replican las que hace el cliente
 * (FirestoreVectorRepository y FirebaseChunkRepository): si una deja de pasar,
 * una pantalla se rompe sin que nada más lo avise.
 */

const PROJECT_ID = 'demo-dosfilos-rules';
const PASTOR = 'pastor-uid';
const OTRO = 'otro-pastor-uid';
const LIBRO = 'libro-del-pastor';
const LIBRO_AJENO = 'libro-del-otro';
const SISTEMA = '__system__';
const LIBRO_COMUN = 'libro-de-la-biblioteca-comun';
const LEGIBLES = [PASTOR, SISTEMA];

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

function fragmento(userId: string, resourceId: string, chunkIndex: number) {
    return { userId, resourceId, chunkIndex, text: `texto ${chunkIndex}`, resourceTitle: 'Libro', resourceAuthor: 'Autor', metadata: {} };
}

async function sembrar() {
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        for (let i = 0; i < 3; i++) {
            await setDoc(doc(db, 'document_chunks', `${LIBRO}_chunk_${i}`), fragmento(PASTOR, LIBRO, i));
            await setDoc(doc(db, 'document_chunks', `${LIBRO_AJENO}_chunk_${i}`), fragmento(OTRO, LIBRO_AJENO, i));
            await setDoc(doc(db, 'document_chunks', `${LIBRO_COMUN}_chunk_${i}`), fragmento(SISTEMA, LIBRO_COMUN, i));
        }
    });
}

const fragmentos = (db: any) => collection(db, 'document_chunks');

describe('document_chunks — lo propio', () => {
    it('las consultas de lectura del cliente (lo propio y la biblioteca común) pasan', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR).firestore();
        // hasIndex / hasIndexBatch
        await assertSucceeds(getDocs(query(fragmentos(db), where('userId', 'in', LEGIBLES), where('resourceId', '==', LIBRO), limit(1))));
        // findByResourceIds (planificador): propios y comunes juntos
        const r = await assertSucceeds(getDocs(query(fragmentos(db), where('userId', 'in', LEGIBLES), where('resourceId', 'in', [LIBRO, LIBRO_COMUN]))));
        expect(new Set(r.docs.map((d: any) => d.data().resourceId))).toEqual(new Set([LIBRO, LIBRO_COMUN]));
        // firstChunksText (leer bibliografía de la portada)
        await assertSucceeds(getDocs(query(fragmentos(db), where('userId', 'in', LEGIBLES), where('resourceId', '==', LIBRO), where('chunkIndex', 'in', [0, 1, 2]))));
        // search / findByUserId
        await assertSucceeds(getDocs(query(fragmentos(db), where('userId', '==', PASTOR))));
        await assertSucceeds(getDoc(doc(db, 'document_chunks', `${LIBRO}_chunk_0`)));
        await assertSucceeds(getDoc(doc(db, 'document_chunks', `${LIBRO_COMUN}_chunk_0`)));
    });

    it('CONTRATO DEL PLANIFICADOR: pedir libros ajenos con el filtro de dueño no falla, devuelve vacío', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR).firestore();
        const r = await assertSucceeds(getDocs(query(fragmentos(db), where('userId', 'in', LEGIBLES), where('resourceId', 'in', [LIBRO_AJENO, 'inexistente']))));
        expect(r.docs).toHaveLength(0);
    });

    it('borrar los fragmentos de un libro propio (deleteByResourceId) pasa', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR).firestore();
        const snap = await getDocs(query(fragmentos(db), where('userId', '==', PASTOR), where('resourceId', '==', LIBRO)));
        const lote = writeBatch(db);
        snap.docs.forEach(d => lote.delete(d.ref));
        await assertSucceeds(lote.commit());
    });

    it('crear con su userId pasa; actualizar sin cambiar el dueño pasa', async () => {
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertSucceeds(setDoc(doc(db, 'document_chunks', 'nuevo'), fragmento(PASTOR, LIBRO, 9)));
        await assertSucceeds(updateDoc(doc(db, 'document_chunks', 'nuevo'), { text: 'otro texto' }));
    });
});

describe('document_chunks — lo ajeno', () => {
    it('no se lee un fragmento de otro, ni por id ni por consulta', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertFails(getDoc(doc(db, 'document_chunks', `${LIBRO_AJENO}_chunk_0`)));
        await assertFails(getDocs(query(fragmentos(db), where('userId', '==', OTRO))));
        // La consulta de antes, sin userId, ya no pasa: Firestore no puede garantizar la regla.
        await assertFails(getDocs(query(fragmentos(db), where('resourceId', '==', LIBRO_AJENO))));
        await assertFails(getDocs(query(fragmentos(db), where('resourceId', '==', LIBRO))));
    });

    it('no se borra un fragmento de otro ni de la biblioteca común', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertFails(deleteDoc(doc(db, 'document_chunks', `${LIBRO_AJENO}_chunk_0`)));
        await assertFails(deleteDoc(doc(db, 'document_chunks', `${LIBRO_COMUN}_chunk_0`)));
        await assertFails(getDocs(query(fragmentos(db), where('userId', '==', SISTEMA), where('resourceId', '==', LIBRO_COMUN))).then(async snap => {
            const lote = writeBatch(db); snap.docs.forEach((d: any) => lote.delete(d.ref)); await lote.commit();
        }));
    });

    it('no se crea a nombre de otro ni se le pasa un fragmento propio a otro', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertFails(setDoc(doc(db, 'document_chunks', 'falso'), fragmento(OTRO, LIBRO_AJENO, 9)));
        await assertFails(updateDoc(doc(db, 'document_chunks', `${LIBRO}_chunk_0`), { userId: OTRO }));
        await assertFails(updateDoc(doc(db, 'document_chunks', `${LIBRO_AJENO}_chunk_0`), { text: 'pisado' }));
        // Pisar con setDoc un id que ya es de otro: es un update, y no es suyo.
        await assertFails(setDoc(doc(db, 'document_chunks', `${LIBRO_AJENO}_chunk_0`), fragmento(PASTOR, LIBRO, 0)));
        await assertFails(setDoc(doc(db, 'document_chunks', `${LIBRO_COMUN}_chunk_0`), fragmento(PASTOR, LIBRO, 0)));
    });

    it('sin sesión, nada', async () => {
        await sembrar();
        const db = env.unauthenticatedContext().firestore();
        await assertFails(getDoc(doc(db, 'document_chunks', `${LIBRO}_chunk_0`)));
        await assertFails(getDocs(query(fragmentos(db), where('userId', '==', PASTOR))));
    });
});
