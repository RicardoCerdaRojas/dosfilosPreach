import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDocs, limit, orderBy, query, setDoc, where } from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';

/**
 * Cinco colecciones se podían LISTAR desde cualquier sesión hasta el
 * 2026-10-16 (`allow list: if isAuthenticated()`): las series y las sesiones
 * de los tutores de griego y hebreo de todos los usuarios. Ahora, como
 * `sermons`, sólo lo propio o el super admin.
 *
 * Las consultas replican las del cliente (repositorios, UsageLimitsService,
 * Púlpito, el panel de actividad del super admin): si una deja de pasar, una
 * pantalla se rompe sin que nada más lo avise.
 */

const PROJECT_ID = 'demo-dosfilos-rules';
const PASTOR = 'pastor-uid';
const OTRO = 'otro-pastor-uid';
const ADMIN = 'super-admin-uid';
const DESDE = new Date('2026-10-01');

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

const COLECCIONES = ['series', 'sermon_series', 'greek_sessions', 'hebrewDetectiveSessions', 'hebrew_user_sessions'] as const;

async function sembrar() {
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'users', ADMIN), { role: 'super_admin' });
        for (const c of COLECCIONES) {
            for (const userId of [PASTOR, OTRO]) {
                await setDoc(doc(db, c, `${c}-${userId}`), { userId, createdAt: new Date('2026-10-10'), completedAt: new Date('2026-10-10') });
            }
        }
    });
}

describe('listas por dueño: lo propio pasa', () => {
    it('las consultas del cliente, con el userId de la sesión', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR).firestore();
        // FirebaseSeriesRepository.findByUserId / Púlpito useSeriesPlans
        await assertSucceeds(getDocs(query(collection(db, 'series'), where('userId', '==', PASTOR), orderBy('createdAt', 'desc'))));
        // UsageLimitsService (planes del mes, sesiones del mes)
        for (const c of ['series', 'greek_sessions', 'hebrew_user_sessions']) {
            await assertSucceeds(getDocs(query(collection(db, c), where('userId', '==', PASTOR), where('createdAt', '>=', DESDE))));
            await assertSucceeds(getDocs(query(collection(db, c), where('userId', '==', PASTOR))));
        }
        // FirestoreDetectiveSessionRepository.getSessionsByUser
        await assertSucceeds(getDocs(query(collection(db, 'hebrewDetectiveSessions'), where('userId', '==', PASTOR), orderBy('completedAt', 'desc'), limit(20))));
        await assertSucceeds(getDocs(query(collection(db, 'sermon_series'), where('userId', '==', PASTOR))));
    });
});

describe('listas por dueño: lo ajeno no', () => {
    for (const c of COLECCIONES) {
        it(`${c}: ni sin filtro ni con el userId de otro`, async () => {
            await sembrar();
            const db = env.authenticatedContext(PASTOR).firestore();
            await assertFails(getDocs(collection(db, c)));
            await assertFails(getDocs(query(collection(db, c), where('userId', '==', OTRO))));
        });
    }

    it('sin sesión, nada', async () => {
        await sembrar();
        const db = env.unauthenticatedContext().firestore();
        for (const c of COLECCIONES) await assertFails(getDocs(query(collection(db, c), where('userId', '==', PASTOR))));
    });
});

describe('listas por dueño: el super admin ve todo (panel de actividad)', () => {
    it('FirebaseUserActivityRepository con el uid de otro usuario', async () => {
        await sembrar();
        const db = env.authenticatedContext(ADMIN).firestore();
        for (const c of ['sermon_series', 'greek_sessions', 'hebrew_user_sessions']) {
            await assertSucceeds(getDocs(query(collection(db, c), where('userId', '==', OTRO), where('createdAt', '>=', DESDE), orderBy('createdAt', 'desc'))));
            await assertSucceeds(getDocs(query(collection(db, c), where('userId', '==', OTRO))));
        }
        await assertSucceeds(getDocs(collection(db, 'series')));
    });
});
