import { describe, expect, it } from 'vitest';
import { cuotaDelPlan, esCuentaDeCortesia, marcadorDeCortesia, periodoDeRenovacion } from '../renovarCuotaDeCortesia';

describe('esCuentaDeCortesia', () => {
    it('caso real: Pro activo asignado desde el panel, sin suscripción en Stripe', () => {
        expect(esCuentaDeCortesia({ status: 'active', planId: 'pro' })).toBe(true);
    });

    it('una cuenta que paga no es de cortesía, venga el id por el registro o por el webhook', () => {
        // Registro con pago primero.
        expect(esCuentaDeCortesia({ status: 'active', planId: 'pro', stripeSubscriptionId: 'sub_123' })).toBe(false);
        // Usuario existente que se suscribe: el webhook escribe `subscription.id`.
        expect(esCuentaDeCortesia({ status: 'active', planId: 'pro', id: 'sub_456' })).toBe(false);
    });

    it('un id que no es de Stripe no cuenta como suscripción', () => {
        expect(esCuentaDeCortesia({ status: 'active', planId: 'pro', id: '' })).toBe(true);
    });

    it('el plan gratuito no se renueva', () => {
        expect(esCuentaDeCortesia({ status: 'active', planId: 'free' })).toBe(false);
    });

    it('cancelada, en prueba o con pago atrasado no se renueva aquí', () => {
        for (const status of ['cancelled', 'trialing', 'past_due']) {
            expect(esCuentaDeCortesia({ status, planId: 'pro' })).toBe(false);
        }
    });

    it('sin suscripción o sin plan no es de cortesía', () => {
        expect(esCuentaDeCortesia(undefined)).toBe(false);
        expect(esCuentaDeCortesia({ status: 'active' })).toBe(false);
    });
});

describe('periodoDeRenovacion', () => {
    it('usa el mes de Santiago, no el de UTC', () => {
        // 1 de diciembre 02:00 UTC = 30 de noviembre 23:00 en Santiago (UTC−3).
        expect(periodoDeRenovacion(new Date('2026-12-01T02:00:00Z'))).toBe('2026-11');
        // La corrida del día 1 a las 04:00 de Santiago ya es diciembre.
        expect(periodoDeRenovacion(new Date('2026-12-01T07:00:00Z'))).toBe('2026-12');
    });

    it('el marcador no choca con un id de factura de Stripe', () => {
        expect(marcadorDeCortesia('2026-12')).toBe('cortesia-2026-12');
        expect(marcadorDeCortesia('2026-12').startsWith('in_')).toBe(false);
    });
});

describe('cuotaDelPlan', () => {
    it('lee los límites del plan Pro', () => {
        expect(cuotaDelPlan({ standardPagesPerMonth: 2500, premiumPagesPerMonth: 150, exegesisUsdPerMonth: 10 }))
            .toEqual({ standardPages: 2500, premiumPages: 150, exegesisUsd: 10 });
    });

    it('sin límites o con basura da ceros, nunca negativos', () => {
        expect(cuotaDelPlan(undefined)).toEqual({ standardPages: 0, premiumPages: 0, exegesisUsd: 0 });
        expect(cuotaDelPlan({ standardPagesPerMonth: -5, premiumPagesPerMonth: 'x' })).toEqual({ standardPages: 0, premiumPages: 0, exegesisUsd: 0 });
    });
});
