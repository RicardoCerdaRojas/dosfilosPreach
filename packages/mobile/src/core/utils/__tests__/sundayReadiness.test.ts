import { describe, expect, it } from '@jest/globals';

import { isReady, sundayReadiness } from '../sundayReadiness';

const base = { offline: true, readingWanted: true, readingFound: true };

describe('listo para el domingo', () => {
    it('con todo resuelto, está listo', () => {
        const items = sundayReadiness(base);
        expect(items.map((i) => i.key)).toEqual(['offline', 'reading']);
        expect(isReady(items)).toBe(true);
    });

    it('cada pendiente se dice por separado', () => {
        expect(sundayReadiness({ ...base, offline: false }).find((i) => i.key === 'offline')?.done).toBe(false);
        expect(isReady(sundayReadiness({ ...base, readingFound: false }))).toBe(false);
    });

    it('sin página de Lectura o sin pasaje, la lectura no es un pendiente', () => {
        const items = sundayReadiness({ ...base, readingWanted: false, readingFound: false });
        expect(items.map((i) => i.key)).toEqual(['offline']);
        expect(isReady(items)).toBe(true);
    });

    it('mientras se busca el pasaje no se afirma nada sobre la lectura', () => {
        expect(sundayReadiness({ ...base, readingFound: null }).map((i) => i.key)).toEqual(['offline']);
    });
});
