import { describe, expect, it, jest } from '@jest/globals';

import { useAuthStore } from '../auth.store';

// jest sube este mock por encima de los imports: el store ya lo recibe.

jest.mock('@/data/repositories/auth.repository.impl', () => {
    const signIn = jest.fn();
    return {
        __signIn: signIn,
        AuthRepositoryImpl: jest.fn().mockImplementation(() => ({
            signIn,
            onAuthStateChanged: () => () => undefined,
        })),
    };
});


const signIn = (jest.requireMock('@/data/repositories/auth.repository.impl') as { __signIn: jest.Mock<any> })
    .__signIn;

describe('ingresar', () => {
    it('una contraseña incorrecta no apaga la pantalla de login (el arranque no se toca)', async () => {
        useAuthStore.setState({ isLoading: false, user: null });
        signIn.mockRejectedValueOnce(new Error('auth/wrong-password'));
        const estados: boolean[] = [];
        const off = useAuthStore.subscribe((s) => estados.push(s.isLoading));
        await expect(useAuthStore.getState().signIn('pastor@iglesia.org', 'mala')).rejects.toThrow(
            'auth/wrong-password',
        );
        off();
        expect(estados.every((v) => v === false)).toBe(true);
        expect(useAuthStore.getState().user).toBeNull();
    });

    it('un ingreso correcto deja al usuario', async () => {
        useAuthStore.setState({ isLoading: false, user: null });
        signIn.mockResolvedValueOnce({ id: 'pastor' });
        await useAuthStore.getState().signIn('pastor@iglesia.org', 'buena');
        expect(useAuthStore.getState().user).toEqual({ id: 'pastor' });
    });
});
