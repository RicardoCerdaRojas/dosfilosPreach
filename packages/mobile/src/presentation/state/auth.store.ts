import { create } from 'zustand';
import { User } from '@/domain/entities/user';
import { AuthRepositoryImpl } from '@/data/repositories/auth.repository.impl';

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

export const useAuthStore = create<AuthState>((set) => ({
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
    signOut: async () => {
        await authRepository.signOut();
        set({ user: null });
    },
    resetPassword: async (email) => {
        await authRepository.sendPasswordResetEmail(email);
    },
    setUser: (user) => set({ user, isLoading: false }),
}));

// Initialize subscription
authRepository.onAuthStateChanged((user) => {
    useAuthStore.getState().setUser(user);
});
