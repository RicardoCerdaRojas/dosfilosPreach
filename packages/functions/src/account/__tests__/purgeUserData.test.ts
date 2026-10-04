import { describe, expect, it } from 'vitest';
import { purgeUserData, type PurgeDeps } from '../purgeUserData';
import { OWNED_BY_DOC_ID, OWNED_BY_EMAIL, OWNED_BY_FIELD } from '../ownedData';

function registrar() {
    const calls: string[] = [];
    const deps: PurgeDeps = {
        deleteWhere: async (c, f, v) => {
            calls.push(`where ${c}.${f}=${v}`);
            return 1;
        },
        deleteDoc: async (c, id) => {
            calls.push(`doc ${c}/${id}`);
        },
        deleteStoragePrefix: async (p) => {
            calls.push(`storage ${p}`);
        },
    };
    return { calls, deps };
}

describe('purga de los datos de un usuario', () => {
    it('recorre TODA la lista: cada colección por su campo, cada documento por uid, Storage', async () => {
        const { calls, deps } = registrar();
        await purgeUserData('u1', 'Pastor@Iglesia.org', deps);
        for (const { collection, field } of OWNED_BY_FIELD) expect(calls).toContain(`where ${collection}.${field}=u1`);
        for (const { collection, field } of OWNED_BY_EMAIL) expect(calls).toContain(`where ${collection}.${field}=pastor@iglesia.org`);
        for (const c of OWNED_BY_DOC_ID) expect(calls).toContain(`doc ${c}/u1`);
        expect(calls).toContain('storage users/u1/');
    });

    it('users/{uid} va al final: si algo falla antes, la cuenta sigue identificable', async () => {
        const { calls, deps } = registrar();
        await purgeUserData('u1', null, deps);
        expect(calls.at(-OWNED_BY_DOC_ID.length)).toBe('doc users/u1');
        expect(calls.indexOf('doc users/u1')).toBeGreaterThan(calls.indexOf('where sermons.userId=u1'));
    });

    it('sin email no toca las colecciones por email', async () => {
        const { calls, deps } = registrar();
        await purgeUserData('u1', null, deps);
        expect(calls.some((c) => c.includes('contact_leads'))).toBe(false);
    });
});
