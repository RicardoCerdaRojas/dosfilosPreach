import { describe, expect, it } from 'vitest';
import { decideDeletion, stripeRefsOf } from '../deletionState';

describe('borrado de cuenta — Stripe y reactivación (revisión adversarial de B2)', () => {
    it('REGRESIÓN: el cliente del registro con pago primero vive en subscription.stripeCustomerId', () => {
        expect(stripeRefsOf({ subscription: { stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' } })).toEqual({
            customerId: 'cus_1',
            subscriptionId: 'sub_1',
        });
    });

    it('el del checkout desde la app, en la raíz; sin Stripe, nada', () => {
        expect(stripeRefsOf({ stripeCustomerId: 'cus_2' }).customerId).toBe('cus_2');
        expect(stripeRefsOf({})).toEqual({ customerId: null, subscriptionId: null });
        expect(stripeRefsOf(undefined)).toEqual({ customerId: null, subscriptionId: null });
    });

    it('REGRESIÓN: una cuenta reactivada (soporte deshizo el pedido) NO se purga', () => {
        expect(decideDeletion({ disabled: false })).toBe('cancel');
        expect(decideDeletion({ disabled: true })).toBe('purge');
        expect(decideDeletion(null)).toBe('purge');
    });
});
