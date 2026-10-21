import { describe, expect, it } from 'vitest';
import { GrantInputError, MAX_EXEGESIS_USD_POR_OTORGAMIENTO, parseGrantUserCreditsInput } from '../grantUserCreditsInput';

/** TP #8 (2026-10-21, #41): el panel no sabía dar US$ de exégesis. */
describe('parseGrantUserCreditsInput', () => {
    const base = { userId: 'u1', reason: 'cuota agotada en el TP #8' };

    it('acepta sólo US$ de exégesis, redondeados a centavos', () => {
        expect(parseGrantUserCreditsInput({ ...base, exegesisUsd: 20.004 }))
            .toEqual({ ...base, standardPages: 0, premiumPages: 0, exegesisUsd: 20 });
    });

    it('sigue aceptando sólo páginas, como antes', () => {
        expect(parseGrantUserCreditsInput({ ...base, standardPages: 500 }))
            .toMatchObject({ standardPages: 500, premiumPages: 0, exegesisUsd: 0 });
    });

    it('rechaza un otorgamiento vacío', () => {
        expect(() => parseGrantUserCreditsInput(base)).toThrow(GrantInputError);
    });

    it('rechaza negativos, también en exégesis', () => {
        expect(() => parseGrantUserCreditsInput({ ...base, exegesisUsd: -5 })).toThrow(/Negative/);
    });

    it('rechaza un monto de exégesis por encima del tope (error de tipeo)', () => {
        expect(() => parseGrantUserCreditsInput({ ...base, exegesisUsd: MAX_EXEGESIS_USD_POR_OTORGAMIENTO + 1 })).toThrow(/above/);
        expect(parseGrantUserCreditsInput({ ...base, exegesisUsd: MAX_EXEGESIS_USD_POR_OTORGAMIENTO }).exegesisUsd)
            .toBe(MAX_EXEGESIS_USD_POR_OTORGAMIENTO);
    });

    it('exige el motivo, que va al registro de auditoría', () => {
        expect(() => parseGrantUserCreditsInput({ userId: 'u1', reason: '  ', exegesisUsd: 5 })).toThrow(/reason/);
    });

    it('un campo presente que no es número es un error, no un cero callado', () => {
        expect(() => parseGrantUserCreditsInput({ ...base, exegesisUsd: '20' })).toThrow(GrantInputError);
        // El caso que la versión anterior dejaba pasar: páginas en texto junto a US$ válidos.
        expect(() => parseGrantUserCreditsInput({ ...base, standardPages: '500', exegesisUsd: 5 })).toThrow(/standardPages/);
    });

    it('un campo ausente o nulo vale cero', () => {
        expect(parseGrantUserCreditsInput({ ...base, standardPages: null, exegesisUsd: 5 }).standardPages).toBe(0);
    });
});
