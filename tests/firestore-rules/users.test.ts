import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildFreeUserProfile } from '../../packages/domain/src/entities/User';

/**
 * Reglas de `users/{uid}`.
 *
 * Hasta el 2026-10-16:
 *   - cualquier sesión leía y listaba todos los usuarios (correos, planes);
 *   - cada usuario podía escribirse `role: 'super_admin'`, el plan, el saldo
 *     de exégesis o los flags;
 *   - `isFunction()` dejaba a cualquier sesión con token personalizado
 *     (impersonación, recién registrados) escribir el rol de CUALQUIERA.
 *
 * Las escrituras de abajo replican las del cliente: registro Free
 * (AuthService.registerFree), login con Google y perfil
 * (FirebaseAuthRepository), confesión, testigos e idioma
 * (FirebaseUserProfileRepository) y el descuento de exégesis
 * (ProcessingBalanceService.consumeExegesis).
 */

const PROJECT_ID = 'demo-dosfilos-rules';
const PASTOR = 'pastor-uid';
const OTRO = 'otro-pastor-uid';
const ADMIN = 'super-admin-uid';
const CORREO = 'pastor@iglesia.org';
const RULES = fileURLToPath(new URL('../../firestore.rules', import.meta.url));
const DOMAIN_USER_TS = fileURLToPath(new URL('../../packages/domain/src/entities/User.ts', import.meta.url));

let env: RulesTestEnvironment;

beforeAll(async () => {
    env = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync(RULES, 'utf8') },
    });
});
afterAll(async () => { await env?.cleanup(); });
afterEach(async () => { await env.clearFirestore(); });

function flagsPorDefecto(): Record<string, true> {
    const bloque = /export const DEFAULT_FEATURE_FLAGS[^=]*=\s*\[([\s\S]*?)\];/.exec(readFileSync(DOMAIN_USER_TS, 'utf8'));
    if (!bloque) throw new Error('No se pudo leer DEFAULT_FEATURE_FLAGS del dominio');
    return Object.fromEntries([...bloque[1]!.matchAll(/'([a-z_]+)'/g)].map(m => [m[1]!, true]));
}

/** Lo que escribe `AuthService.registerFree`: la MISMA función del dominio. */
function altaFree() {
    return {
        ...buildFreeUserProfile({ email: CORREO, displayName: 'Pastor', locale: 'es' }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };
}

const sesion = (uid: string, extra: Record<string, unknown> = {}) => env.authenticatedContext(uid, { email: CORREO, ...extra }).firestore();

async function sembrar() {
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'users', ADMIN), { role: 'super_admin', email: 'admin@x.org' });
        await setDoc(doc(db, 'users', PASTOR), {
            email: CORREO, displayName: 'Pastor', status: 'active',
            subscription: { planId: 'pro', status: 'active' },
            processingBalance: { planExegesisUsd: 5, packExegesisUsd: 2, exegesisUsdAvailable: 7, exegesisSpentTotalUsd: 1 },
        });
        await setDoc(doc(db, 'users', OTRO), { email: 'otro@x.org', subscription: { planId: 'free', status: 'active' } });
    });
}

describe('users — paridad', () => {
    it('los flags por defecto de la regla son los del dominio', () => {
        const regla = /function soloFlagsPorDefecto[\s\S]*?let porDefecto = \[([\s\S]*?)\];/.exec(readFileSync(RULES, 'utf8'));
        expect(regla).not.toBeNull();
        const enRegla = [...regla![1]!.matchAll(/'([a-z_]+)'/g)].map(m => m[1]).sort();
        expect(enRegla).toEqual(Object.keys(flagsPorDefecto()).sort());
    });
});

describe('users — leer', () => {
    it('el propio sí; otro no; listar no', async () => {
        await sembrar();
        const db = sesion(PASTOR);
        await assertSucceeds(getDoc(doc(db, 'users', PASTOR)));
        await assertFails(getDoc(doc(db, 'users', OTRO)));
        await assertFails(getDocs(collection(db, 'users')));
        await assertFails(getDocs(query(collection(db, 'users'), where('email', '==', 'otro@x.org'))));
    });

    it('el super admin lee y lista (panel de usuarios)', async () => {
        await sembrar();
        const db = env.authenticatedContext(ADMIN).firestore();
        await assertSucceeds(getDoc(doc(db, 'users', OTRO)));
        await assertSucceeds(getDocs(collection(db, 'users')));
        await assertSucceeds(getDoc(doc(db, 'users', OTRO, 'usage_counters', '2026-10')));
    });
});

describe('users — crear', () => {
    it('la cuenta Free del registro pasa', async () => {
        await assertSucceeds(setDoc(doc(sesion(PASTOR), 'users', PASTOR), altaFree()));
    });

    it('nadie se crea con rol, saldo, otro plan, flags extra u otro correo', async () => {
        const db = sesion(PASTOR);
        const ref = doc(db, 'users', PASTOR);
        await assertFails(setDoc(ref, { ...altaFree(), role: 'super_admin' }));
        await assertFails(setDoc(ref, { ...altaFree(), processingBalance: { planExegesisUsd: 999 } }));
        await assertFails(setDoc(ref, { ...altaFree(), subscription: { planId: 'pro', status: 'active', stripePriceId: null, cancelAtPeriodEnd: false } }));
        await assertFails(setDoc(ref, { ...altaFree(), featureFlags: { ...flagsPorDefecto(), modo_experto: true } }));
        await assertFails(setDoc(ref, { ...altaFree(), featureFlags: { ...flagsPorDefecto(), study_depth: false } }));
        await assertFails(setDoc(ref, { ...altaFree(), featureFlags: {} }));
        await assertFails(setDoc(ref, { ...altaFree(), createdAt: 'nunca' }));
        await assertFails(setDoc(ref, { ...altaFree(), displayName: { a: 1 } }));
        await assertFails(setDoc(ref, { ...altaFree(), email: 'otro@x.org' }));
        await assertFails(setDoc(doc(db, 'users', OTRO), altaFree()));
    });
});

describe('users — actualizar', () => {
    it('perfil, idioma, confesión y login con Google pasan', async () => {
        await sembrar();
        const ref = doc(sesion(PASTOR), 'users', PASTOR);
        await assertSucceeds(setDoc(ref, { displayName: 'Nuevo', photoURL: null, updatedAt: serverTimestamp() }, { merge: true }));
        await assertSucceeds(setDoc(ref, { preferredLanguage: 'en', updatedAt: serverTimestamp() }, { merge: true }));
        await assertSucceeds(setDoc(ref, { declaredConfession: 'westminster', confessionVisibility: 'public', confessionAffirmedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }));
        await assertSucceeds(setDoc(ref, { useConfessionalWitnesses: true, updatedAt: serverTimestamp() }, { merge: true }));
        await assertSucceeds(setDoc(ref, { email: CORREO, displayName: 'Pastor', photoURL: 'https://x', updatedAt: serverTimestamp() }, { merge: true }));
    });

    it('el descuento de exégesis pasa; subirse el saldo no', async () => {
        await sembrar();
        const ref = doc(sesion(PASTOR), 'users', PASTOR);
        await assertSucceeds(updateDoc(ref, {
            'processingBalance.planExegesisUsd': 4.5, 'processingBalance.packExegesisUsd': 2,
            'processingBalance.exegesisUsdAvailable': 6.5, 'processingBalance.exegesisSpentTotalUsd': 1.5,
            'processingBalance.updatedAt': serverTimestamp(),
        }));
        await assertFails(updateDoc(ref, { 'processingBalance.planExegesisUsd': 999, 'processingBalance.exegesisUsdAvailable': 1001 }));
        await assertFails(updateDoc(ref, { 'processingBalance.packExegesisUsd': 50 }));
        await assertFails(updateDoc(ref, { 'processingBalance.exegesisSpentTotalUsd': 0 }));
        await assertFails(updateDoc(ref, { 'processingBalance.planPagesAvailable': 5000 }));
    });

    it('el primer consumo de un perfil sin el agregado `exegesisUsdAvailable` pasa; subir sólo el agregado no', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'users', PASTOR), { email: CORREO, processingBalance: { planExegesisUsd: 5, packExegesisUsd: 0 } });
        });
        const ref = doc(sesion(PASTOR), 'users', PASTOR);
        await assertSucceeds(updateDoc(ref, {
            'processingBalance.planExegesisUsd': 4.9, 'processingBalance.packExegesisUsd': 0,
            'processingBalance.exegesisUsdAvailable': 4.9, 'processingBalance.exegesisSpentTotalUsd': 0.1,
            'processingBalance.updatedAt': serverTimestamp(),
        }));
        await assertFails(updateDoc(ref, { 'processingBalance.exegesisUsdAvailable': 900 }));
    });

    it('fechas y nombre con su tipo', async () => {
        await sembrar();
        const ref = doc(sesion(PASTOR), 'users', PASTOR);
        await assertFails(updateDoc(ref, { updatedAt: { falso: true } }));
        await assertFails(updateDoc(ref, { displayName: 'x'.repeat(201) }));
    });

    it('nadie se da rol, plan, Stripe, flags, estado ni analítica', async () => {
        await sembrar();
        const ref = doc(sesion(PASTOR), 'users', PASTOR);
        for (const cambio of [
            { role: 'super_admin' },
            { subscription: { planId: 'team', status: 'active' } },
            { 'subscription.planId': 'team' },
            { stripeCustomerId: 'cus_x' },
            { featureFlags: { modo_experto: true } },
            { status: 'suspended' },
            { analytics: { loginCount: 1 } },
            { email: 'otro@x.org' },
        ]) {
            await assertFails(updateDoc(ref, cambio));
        }
    });

    it('REGRESIÓN isFunction(): una sesión con token personalizado no escribe el rol de otro', async () => {
        await sembrar();
        const db = env.authenticatedContext(PASTOR, { email: CORREO, firebase: { sign_in_provider: 'custom' } }).firestore();
        await assertFails(updateDoc(doc(db, 'users', OTRO), { role: 'super_admin' }));
        await assertFails(updateDoc(doc(db, 'users', PASTOR), { role: 'super_admin', updatedAt: serverTimestamp() }));
        await assertFails(setDoc(doc(db, 'users', OTRO, 'usage_counters', '2026-10'), { pages: 0 }));
    });

    it('no se toca a otro usuario ni se borra la cuenta desde el cliente', async () => {
        await sembrar();
        const db = sesion(PASTOR);
        await assertFails(updateDoc(doc(db, 'users', OTRO), { displayName: 'pisado' }));
        await assertFails(deleteDoc(doc(db, 'users', PASTOR)));
    });
});
