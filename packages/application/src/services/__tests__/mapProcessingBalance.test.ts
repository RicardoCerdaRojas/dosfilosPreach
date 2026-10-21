import { describe, expect, it } from 'vitest';
import { mapProcessingBalance } from '../AdminUserQueryService';

/**
 * TP #8 (2026-10-21, #41), revisión adversarial: el panel recibía el saldo sin
 * los baldes de exégesis y el diálogo de otorgar mostraba «US$ 0,00» con US$
 * 0,04 guardados.
 */
describe('mapProcessingBalance', () => {
    it('conserva los baldes de exégesis', () => {
        expect(mapProcessingBalance({ planExegesisUsd: 0.04, packExegesisUsd: 0, exegesisUsdAvailable: 0.04, exegesisSpentTotalUsd: 29.96 }))
            .toMatchObject({ planExegesisUsd: 0.04, packExegesisUsd: 0, exegesisUsdAvailable: 0.04, exegesisSpentTotalUsd: 29.96 });
    });

    it('un usuario sin saldo sigue sin saldo', () => {
        expect(mapProcessingBalance(undefined)).toBeUndefined();
    });
});
