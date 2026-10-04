import { create } from 'zustand';
import { User } from '@/domain/entities/user';
import { AuthRepositoryImpl } from '@/data/repositories/auth.repository.impl';
import { clearOfflineData } from '@/data/offline/offlineSermons';
import { queryClient } from '@/core/providers/query-client.provider';

// Instantiate repository - in a reel app, this might be injected
const authRepository = new AuthRepositoryImpl();

interface AuthState {
    user: User | null;
    isLoading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
    signInWithGoogle: (idToken: string) => Promise<void>;
    signInWithApple: (identityToken: string, rawNonce: string) => Promise<void>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    // SÓLO el arranque: true hasta saber si hay sesión. Ingresar NO lo toca
    // (A2): la raíz devuelve `null` mientras vale true, y un ingreso que lo
    // encendía desmontaba la pantalla de login — si la contraseña era
    // incorrecta, el pastor volvía a una pantalla en blanco y sin el email que
    // había escrito. El login tiene su propio indicador.
    isLoading: true,
    signIn: async (email, password) => {
        const user = await authRepository.signIn(email, password);
        set({ user });
    },
    signUp: async (email, password, firstName, lastName) => {
        const user = await authRepository.signUp(email, password, firstName, lastName);
        set({ user });
    },
    signInWithGoogle: async (idToken) => {
        const user = await authRepository.signInWithGoogle(idToken);
        set({ user });
    },
    signInWithApple: async (identityToken, rawNonce) => {
        const user = await authRepository.signInWithApple(identityToken, rawNonce);
        set({ user });
    },
    /**
     * Cerrar sesión no dejaba nada limpio (A8): en una tablet compartida, el
     * siguiente usuario veía la caché de sermones, las marcas de la Biblia y
     * el maletín del anterior. Ahora se vacía la caché y se borra todo lo
     * guardado para usar sin conexión.
     */
    signOut: async () => {
        await authRepository.signOut();
        queryClient.clear();
        await clearOfflineData();
        set({ user: null });
    },
    resetPassword: async (email) => {
        await authRepository.sendPasswordResetEmail(email);
    },
    // Si cambia QUIÉN está adentro, la caché de la sesión anterior no sirve:
    // varias consultas no llevan el uid en la clave y no caducan nunca. Lo
    // guardado sin conexión se conserva (filtra por usuario) — borrarlo acá
    // haría perder el maletín a quien vuelve a entrar con su misma cuenta.
    setUser: (user) => {
        const previous = get().user;
        if (previous && previous.id !== user?.id) queryClient.clear();
        set({ user, isLoading: false });
    },
}));

// Initialize subscription
authRepository.onAuthStateChanged((user) => {
    useAuthStore.getState().setUser(user);
});
