import { describe, expect, it } from 'vitest';
import { emailVariants, purgeUserData, type PurgeDeps } from '../purgeUserData';
import { OWNED_BY_DOC_ID, OWNED_BY_EMAIL, OWNED_BY_FIELD, OWNED_IN_MAP, OWNED_VIA_PARENT } from '../ownedData';

function registrar(parents: { sermons?: string[]; seeds?: string[]; sessions?: string[] } = {}) {
    const calls: string[] = [];
    const deps: PurgeDeps = {
        deleteWhere: async (c, f, v) => {
            calls.push(`where ${c}.${f}=${v}`);
            return 1;
        },
        deleteWhereIn: async (c, f, vs) => {
            calls.push(`in ${c}.${f}=${vs.join(',')}`);
            return vs.length;
        },
        listIdsWhere: async (c) => {
            calls.push(`list ${c}`);
            return c === 'sermons' ? (parents.sermons ?? []) : (parents.seeds ?? []);
        },
        listUserSubcollectionIds: async (_uid, sub) => {
            calls.push(`sub ${sub}`);
            return parents.sessions ?? [];
        },
        deleteMapEntry: async (c, m, k) => {
            calls.push(`map ${c}.${m}.${k}`);
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
    it('recorre TODA la lista: por campo, por padre, por correo, en mapas, por id y Storage', async () => {
        const { calls, deps } = registrar({ sermons: ['s1'], seeds: ['p1'], sessions: ['a1'] });
        await purgeUserData('u1', 'Pastor@Iglesia.org', deps);
        for (const { collection, field } of OWNED_BY_FIELD) expect(calls).toContain(`where ${collection}.${field}=u1`);
        for (const { collection, field } of OWNED_BY_EMAIL) {
            expect(calls).toContain(`where ${collection}.${field}=Pastor@Iglesia.org`);
            expect(calls).toContain(`where ${collection}.${field}=pastor@iglesia.org`);
        }
        for (const { collection, map } of OWNED_IN_MAP) expect(calls).toContain(`map ${collection}.${map}.u1`);
        expect(OWNED_VIA_PARENT.length).toBeGreaterThan(0);
        expect(calls).toContain('in witnessResults.sermonId=s1');
        expect(calls).toContain('in witnessResults.seedId=p1');
        expect(calls).toContain('in heartExamResults.estudioId=a1');
        for (const c of OWNED_BY_DOC_ID) expect(calls).toContain(`doc ${c}/u1`);
        expect(calls).toContain('storage users/u1/');
    });

    it('los ids de los padres se leen ANTES de borrar sermones, semillas y al usuario', async () => {
        const { calls, deps } = registrar({ sermons: ['s1'] });
        await purgeUserData('u1', null, deps);
        expect(calls.indexOf('list sermons')).toBeLessThan(calls.indexOf('where sermons.userId=u1'));
        expect(calls.indexOf('in witnessResults.sermonId=s1')).toBeLessThan(calls.indexOf('where sermons.userId=u1'));
        expect(calls.indexOf('sub ai_sessions')).toBeLessThan(calls.indexOf('doc users/u1'));
    });

    it('users/{uid} va al final: si algo falla antes, la cuenta sigue identificable', async () => {
        const { calls, deps } = registrar();
        await purgeUserData('u1', null, deps);
        expect(calls.at(-OWNED_BY_DOC_ID.length)).toBe('doc users/u1');
    });

    it('sin correo no toca las colecciones por correo; un uid vacío no purga nada', async () => {
        const { calls, deps } = registrar();
        await purgeUserData('u1', null, deps);
        expect(calls.some((c) => c.includes('contact_leads'))).toBe(false);
        await expect(purgeUserData('  ', null, registrar().deps)).rejects.toThrow('uid vacío');
    });

    it('el correo se busca tal como se escribió y en minúsculas', () => {
        expect(emailVariants(' Pastor@Iglesia.org ')).toEqual(['Pastor@Iglesia.org', 'pastor@iglesia.org']);
        expect(emailVariants('ya@minusculas.org')).toEqual(['ya@minusculas.org']);
        expect(emailVariants(null)).toEqual([]);
    });
});
