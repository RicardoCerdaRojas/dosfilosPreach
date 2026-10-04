import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { ACCOUNT_DELETION_GRACE_DAYS, LEGAL_URLS, TABLET_EDITING } from '../features';

/**
 * Reglas de las tiendas que el código tiene que cumplir solo (B1).
 *
 * Apple 3.1.1 / 3.1.3(f) y la política de pagos de Play: una app que no vende
 * dentro de ella no puede llevar a pagar afuera. El registro de Preach cobra
 * antes de crear la cuenta, y para una cuenta sin plan el planificador web
 * puede terminar en una página de pago: la app no enlaza a la web de Preach.
 */
const ROOT = join(__dirname, '../../../..');
const archivos = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        if (name === 'node_modules' || name === '__tests__') return [];
        if (statSync(p).isDirectory()) return archivos(p);
        return /\.(ts|tsx)$/.test(name) ? [p] : [];
    });

describe('cumplimiento de tiendas', () => {
    it('la app sólo enlaza a las páginas legales de la web, nunca a registro, planes o precios', () => {
        const fuentes = [...archivos(join(ROOT, 'app')), ...archivos(join(ROOT, 'src'))];
        expect(fuentes.length).toBeGreaterThan(30);
        const enlaces = fuentes.flatMap((f) =>
            [...readFileSync(f, 'utf8').matchAll(/https?:\/\/[a-z.]*dosfilos\.[a-z]+(\/[a-z-]*)?/g)].map((m) => `${m[0]} (${f.split('/src/').pop()})`),
        );
        const permitidos = new Set<string>(Object.values(LEGAL_URLS));
        const prohibidos = enlaces.filter((e) => !permitidos.has(e.split(' ')[0]!));
        expect(prohibidos).toEqual([]);
    });

    it('las páginas legales existen en la web', () => {
        const app = readFileSync(join(ROOT, '../web/src/App.tsx'), 'utf8');
        for (const url of Object.values(LEGAL_URLS)) {
            expect(app).toContain(`path="${new URL(url).pathname}"`);
        }
    });

    it('editar en la tablet está apagado en la v1 (D5)', () => {
        expect(TABLET_EDITING).toBe(false);
    });
});

describe('borrado de cuenta — paridad con el servidor', () => {
    it('la gracia que se le promete al pastor es la que aplica el servidor', () => {
        const fuente = readFileSync(join(ROOT, '../functions/src/account/requestAccountDeletion.ts'), 'utf8');
        const m = /export const ACCOUNT_DELETION_GRACE_DAYS = (\d+);/.exec(fuente);
        expect(m).not.toBeNull();
        expect(Number(m![1])).toBe(ACCOUNT_DELETION_GRACE_DAYS);
    });

    // Los textos legales viven en i18n (`legal.json`), en los dos idiomas.
    const legal = (lang: 'es' | 'en') =>
        JSON.parse(readFileSync(join(ROOT, `../web/src/i18n/locales/${lang}/legal.json`), 'utf8')) as {
            deleteAccount: unknown;
            privacy: unknown;
        };
    const plazosEn = (texto: unknown) =>
        [...JSON.stringify(texto).matchAll(/(\d+) (días|days)/g)].map((m) => Number(m[1]));

    it('la página web del borrado (la que pide Google Play) dice el mismo plazo, en los dos idiomas', () => {
        expect(JSON.stringify(legal('es').deleteAccount)).toContain(`A los ${ACCOUNT_DELETION_GRACE_DAYS} días`);
        expect(JSON.stringify(legal('en').deleteAccount)).toContain(`After ${ACCOUNT_DELETION_GRACE_DAYS} days`);
        // Y ningún OTRO plazo en la página (antes pasaba aunque dijera otro).
        for (const lang of ['es', 'en'] as const) {
            expect(plazosEn(legal(lang).deleteAccount).every((d) => d === ACCOUNT_DELETION_GRACE_DAYS)).toBe(true);
        }
    });

    it('la política de privacidad dice el mismo plazo, y ningún otro', () => {
        for (const lang of ['es', 'en'] as const) {
            const plazos = plazosEn(legal(lang).privacy);
            expect(plazos.length).toBeGreaterThan(0);
            expect(plazos.every((d) => d === ACCOUNT_DELETION_GRACE_DAYS)).toBe(true);
        }
    });
});
