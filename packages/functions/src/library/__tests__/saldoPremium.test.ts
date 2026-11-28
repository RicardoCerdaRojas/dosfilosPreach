import { describe, expect, it } from 'vitest';
import { avisoSinSaldoPremium, premiumAlcanza } from '../saldoPremium';

describe('premiumAlcanza', () => {
    it('caso real: 150 de saldo no alcanzan para 1.368 páginas', () => {
        expect(premiumAlcanza({ saldo: 150, paginas: 1368, esAdmin: false })).toBe(false);
    });

    it('alcanza justo con el saldo igual a las páginas', () => {
        expect(premiumAlcanza({ saldo: 964, paginas: 964, esAdmin: false })).toBe(true);
    });

    it('una página de más ya no alcanza', () => {
        expect(premiumAlcanza({ saldo: 963, paginas: 964, esAdmin: false })).toBe(false);
    });

    it('saldo negativo o cero nunca alcanza, ni sin número de páginas', () => {
        expect(premiumAlcanza({ saldo: -2270, paginas: 10, esAdmin: false })).toBe(false);
        expect(premiumAlcanza({ saldo: 0, paginas: undefined, esAdmin: false })).toBe(false);
    });

    it('sin número de páginas alcanza con saldo positivo', () => {
        expect(premiumAlcanza({ saldo: 1, paginas: undefined, esAdmin: false })).toBe(true);
    });

    it('el super admin no se revisa', () => {
        expect(premiumAlcanza({ saldo: -5, paginas: 2000, esAdmin: true })).toBe(true);
    });
});

describe('avisoSinSaldoPremium', () => {
    it('dice el saldo, las páginas y el motor usado', () => {
        expect(avisoSinSaldoPremium(150, 1368, false)).toBe(
            'Saldo premium insuficiente (150 de 1368 páginas); usamos Estándar. Compra un pack premium si quieres reprocesarlo.',
        );
    });

    it('nombra la caída a Básico sin afirmar que Estándar corrió', () => {
        expect(avisoSinSaldoPremium(0, undefined, true)).toContain('Básico (pdf-parse) sin cobro');
        expect(avisoSinSaldoPremium(0, undefined, true)).not.toContain('Estándar');
        expect(avisoSinSaldoPremium(0, undefined, true)).toContain('(0 de ? páginas)');
    });
});
