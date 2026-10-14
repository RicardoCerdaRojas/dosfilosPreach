import { describe, it, expect } from 'vitest';
import { versionUnderReview } from '../ExegeticalStep';

/**
 * TP #7 (#29): un paso regenerado después de aceptarse. Aceptar acepta
 * `current`; la revisión miraba `accepted` y la nueva quedaba bloqueada.
 */
describe('versionUnderReview — qué versión se revisa', () => {
    const vieja = { id: 'v1' } as never;
    const nueva = { id: 'v2' } as never;

    it('regenerado tras aceptar: la nueva, que es la que se va a aceptar', () => {
        expect(versionUnderReview({ state: 'awaiting-review', current: nueva, accepted: vieja })).toBe(nueva);
    });
    it('aceptado: la aceptada', () => {
        expect(versionUnderReview({ state: 'accepted', current: nueva, accepted: vieja })).toBe(vieja);
    });
    it('regenerado otra vez y falló: la actual, que es la que aceptar tomaría', () => {
        expect(versionUnderReview({ state: 'failed', current: nueva, accepted: vieja })).toBe(nueva);
    });
    it('primera revisión, sin aceptada: la actual', () => {
        expect(versionUnderReview({ state: 'awaiting-review', current: nueva, accepted: null })).toBe(nueva);
        expect(versionUnderReview({ state: 'pending', current: null, accepted: null })).toBeNull();
    });
});
