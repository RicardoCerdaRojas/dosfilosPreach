import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rutaCalibracion } from '../rutaCalibracion';

/** La ruta de calibración es la que declara el router, bajo /dashboard. */
describe('rutaCalibracion', () => {
    it('apunta a la ruta que existe en App.tsx', () => {
        expect(rutaCalibracion('abc')).toBe('/dashboard/library/abc/numeracion');
        const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8');
        expect(app).toContain('path="library/:resourceId/numeracion"');
        expect(app).toMatch(/path="\/dashboard"/);
    });
});
