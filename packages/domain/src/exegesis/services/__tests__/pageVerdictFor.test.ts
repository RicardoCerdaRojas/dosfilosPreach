import { describe, it, expect } from 'vitest';
import { pageVerdictFor } from '../evidenceForCitation';

/**
 * La regla vivía escrita dos veces, una en cada verificador, y las dos traían
 * el mismo defecto: el cotejo estaba condicionado a que el fragmento de apoyo
 * trajera número, así que la ausencia de número cancelaba la comprobación
 * entera y la cita conservaba el verde.
 */
describe('pageVerdictFor', () => {
    it('sin página citada no hay nada que reprochar', () => {
        expect(pageVerdictFor(null, 'p. 54')).toBe('ok');
        expect(pageVerdictFor(null, null)).toBe('ok');
        expect(pageVerdictFor('', '54')).toBe('ok');
    });

    it('páginas que se tocan: ok', () => {
        expect(pageVerdictFor('54', '54')).toBe('ok');
        expect(pageVerdictFor('48', '47-50')).toBe('ok');
    });

    it('páginas que no se tocan: discrepan', () => {
        expect(pageVerdictFor('87', '54')).toBe('mismatch');
    });

    it('cita con página y fragmento sin ancla: no se puede comprobar', () => {
        // Éste es el caso que salía `ok`. Es también el peor: un fragmento sin
        // ancla llega al modelo sin página, de modo que el número de la cita
        // no salió de ningún rótulo del sistema.
        expect(pageVerdictFor('87', null)).toBe('unverifiable');
        expect(pageVerdictFor('87', '')).toBe('unverifiable');
    });
});
