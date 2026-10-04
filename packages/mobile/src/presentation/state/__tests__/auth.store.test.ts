import { describe, expect, it, jest } from '@jest/globals';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { queryClient } from '@/core/providers/query-client.provider';
import { PendingWritesError, useAuthStore } from '../auth.store';
import { useReaderSettingsStore } from '../readerSettings.store';

// jest sube este mock por encima de los imports: el store ya lo recibe.

jest.mock('@/data/sources/firebase.source', () => {
    const synced = jest.fn(async () => true);
    return { __synced: synced, pendingWritesSynced: synced };
});

jest.mock('@/data/repositories/auth.repository.impl', () => {
    const signIn = jest.fn();
    return {
        __signIn: signIn,
        AuthRepositoryImpl: jest.fn().mockImplementation(() => ({
            signIn,
            signOut: async () => undefined,
            deleteAccount: async () => ({ purgeAfter: '2026-10-11T00:00:00.000Z', graceDays: 7 }),
            onAuthStateChanged: () => () => undefined,
        })),
    };
});


const synced = (jest.requireMock('@/data/sources/firebase.source') as { __synced: jest.Mock<any> }).__synced;
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

describe('cerrar sesión', () => {
    it('vacía la caché y lo guardado sin conexión: la tablet queda limpia para el siguiente', async () => {
        queryClient.setQueryData(['bibleMarks'], ['marca del pastor anterior']);
        await AsyncStorage.setItem('briefcase:s1', '{}');
        useAuthStore.setState({ user: { id: 'pastor' } as never, isLoading: false });
        await useAuthStore.getState().signOut();
        expect(queryClient.getQueryData(['bibleMarks'])).toBeUndefined();
        expect(await AsyncStorage.getItem('briefcase:s1')).toBeNull();
    });

    it('entrar con otra cuenta vacía la caché de la anterior', () => {
        useAuthStore.setState({ user: { id: 'pastor-a' } as never });
        queryClient.setQueryData(['bibleInk'], ['tinta de A']);
        useAuthStore.getState().setUser({ id: 'pastor-b' } as never);
        expect(queryClient.getQueryData(['bibleInk'])).toBeUndefined();
    });
});

describe('cerrar sesión — revisión adversarial de A8', () => {
    it('con cambios sin subir no sale: avisa (se perderían); forzado, sale igual', async () => {
        useAuthStore.setState({ user: { id: 'pastor' } as never, isLoading: false });
        synced.mockResolvedValueOnce(false);
        await expect(useAuthStore.getState().signOut()).rejects.toBeInstanceOf(PendingWritesError);
        expect(useAuthStore.getState().user).toEqual({ id: 'pastor' });
        await useAuthStore.getState().signOut({ force: true });
        expect(useAuthStore.getState().user).toBeNull();
    });

    it('borra lo personal de los ajustes (el lugar de predicación del anterior) y conserva los del aparato', async () => {
        useReaderSettingsStore.setState({ lastPreachingPlace: 'Iglesia del anterior', deliveryFontSize: 32 });
        useAuthStore.setState({ user: { id: 'pastor' } as never, isLoading: false });
        await useAuthStore.getState().signOut();
        expect(useReaderSettingsStore.getState().lastPreachingPlace).toBe('');
        expect(useReaderSettingsStore.getState().deliveryFontSize).toBe(32);
    });
});

describe('borrar la cuenta (B2)', () => {
    it('pide el borrado y deja la tablet limpia aunque haya cambios sin subir (ya no van a subir)', async () => {
        useAuthStore.setState({ user: { id: 'pastor' } as never, isLoading: false });
        queryClient.setQueryData(['bibleMarks'], ['marca']);
        synced.mockResolvedValueOnce(false);
        const r = await useAuthStore.getState().deleteAccount();
        expect(r.purgeAfter).toBe('2026-10-11T00:00:00.000Z');
        expect(useAuthStore.getState().user).toBeNull();
        expect(queryClient.getQueryData(['bibleMarks'])).toBeUndefined();
    });
});
