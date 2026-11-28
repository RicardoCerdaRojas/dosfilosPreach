import { describe, expect, it } from 'vitest';
import { esSuscripcionDeCortesia, SubscriptionStatus } from '../Subscription';

const activa = SubscriptionStatus.ACTIVE;

describe('esSuscripcionDeCortesia', () => {
    it('caso real: Pro activo asignado desde el panel, sin id de Stripe', () => {
        expect(esSuscripcionDeCortesia({ status: activa, planId: 'pro', id: undefined as unknown as string })).toBe(true);
    });

    it('con id de Stripe paga y no es de cortesía', () => {
        expect(esSuscripcionDeCortesia({ status: activa, planId: 'pro', id: 'sub_1Snh5U' })).toBe(false);
    });

    it('gratis, en prueba o cancelada no es de cortesía', () => {
        expect(esSuscripcionDeCortesia({ status: activa, planId: 'free', id: '' })).toBe(false);
        expect(esSuscripcionDeCortesia({ status: SubscriptionStatus.TRIALING, planId: 'pro', id: '' })).toBe(false);
        expect(esSuscripcionDeCortesia({ status: SubscriptionStatus.CANCELLED, planId: 'pro', id: '' })).toBe(false);
        expect(esSuscripcionDeCortesia(undefined)).toBe(false);
    });
});
