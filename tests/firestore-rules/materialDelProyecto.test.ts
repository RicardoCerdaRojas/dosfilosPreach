import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';

/**
 * El material del proyecto (`users/{uid}/projects/{id}/outputs`) no tenía
 * regla: toda lectura y escritura se negaba (2026-10-29). Es del pastor
 * dueño, y de nadie más.
 */

const PROJECT_ID = 'demo-dosfilos-rules';
const PASTOR = 'pastor-uid';
const OTRO = 'otro-pastor-uid';

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

const ruta = (uid: string) => ['users', uid, 'projects', 'p1', 'outputs'] as const;

describe('el material del proyecto', () => {
    it('REGRESIÓN: el dueño lista, crea, edita y borra su material', async () => {
        const db = env.authenticatedContext(PASTOR).firestore();
        await assertSucceeds(getDocs(collection(db, ...ruta(PASTOR))));
        await assertSucceeds(setDoc(doc(db, ...ruta(PASTOR), 'n1'), { kind: 'note', title: 'Nota', content: 'x' }));
        await assertSucceeds(setDoc(doc(db, ...ruta(PASTOR), 'n1'), { kind: 'note', title: 'Nota 2', content: 'y' }));
        await assertSucceeds(deleteDoc(doc(db, ...ruta(PASTOR), 'n1')));
    });

    it('otro pastor no lo lee ni lo escribe', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), ...ruta(PASTOR), 'n1'), { kind: 'note', title: 'Nota', content: 'x' });
        });
        const db = env.authenticatedContext(OTRO).firestore();
        await assertFails(getDocs(collection(db, ...ruta(PASTOR))));
        await assertFails(setDoc(doc(db, ...ruta(PASTOR), 'n2'), { kind: 'note', title: 'Ajena', content: 'x' }));
    });

    it('sin sesión, nada', async () => {
        const db = env.unauthenticatedContext().firestore();
        await assertFails(getDocs(collection(db, ...ruta(PASTOR))));
    });
});
