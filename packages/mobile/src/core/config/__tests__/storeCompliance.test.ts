import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { ACCOUNT_DELETION_GRACE_DAYS, TABLET_EDITING } from '../features';

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
    it('ningún archivo de la app enlaza a la web de Preach', () => {
        const fuentes = [...archivos(join(ROOT, 'app')), ...archivos(join(ROOT, 'src'))];
        expect(fuentes.length).toBeGreaterThan(30);
        const conEnlace = fuentes.filter((f) => /app\.preach\.dosfilos\.com|preach\.dosfilos\.com\/(register|dashboard|pricing)/.test(readFileSync(f, 'utf8')));
        expect(conEnlace).toEqual([]);
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

    it('la página web del borrado (la que pide Google Play) dice el mismo plazo', () => {
        const pagina = readFileSync(join(ROOT, '../web/src/pages/legal/DeleteAccount.tsx'), 'utf8');
        expect(pagina).toContain(`A los ${ACCOUNT_DELETION_GRACE_DAYS} días`);
    });
});
