import { User } from '@/domain/entities/user';
import { AuthRepository } from '@/domain/repositories/auth.repository';
import { getFirebaseAuth } from '@/data/sources/firebase.source';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser, sendPasswordResetEmail, createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, AppleAuthProvider, signInWithCredential, revokeToken } from '@react-native-firebase/auth';
import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { signOutGoogle } from '@/core/config/socialAuth';
import { appCheckReady } from '@/core/config/appCheck';

export class AuthRepositoryImpl implements AuthRepository {
    async signIn(email: string, password: string): Promise<User> {
        try {
            const auth = getFirebaseAuth();
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            // Map Firebase user to Domain User
            const fbUser = userCredential.user;
            return {
                id: fbUser.uid,
                email: fbUser.email || '',
                firstName: fbUser.displayName?.split(' ')[0] || '',
                lastName: fbUser.displayName?.split(' ').slice(1).join(' ') || '',
                photoUrl: fbUser.photoURL || undefined,
                role: 'viewer', // Default role, should fetch from Firestore claims or DB
            };
        } catch (error) {
            console.error('Error signing in:', error);
            throw error;
        }
    }

    async signUp(email: string, password: string, firstName: string, lastName: string): Promise<User> {
        try {
            const auth = getFirebaseAuth();
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const fbUser = userCredential.user;

            await updateProfile(fbUser, {
                displayName: `${firstName} ${lastName}`.trim()
            });

            return {
                id: fbUser.uid,
                email: fbUser.email || '',
                firstName: firstName,
                lastName: lastName,
                photoUrl: fbUser.photoURL || undefined,
                role: 'viewer',
            };
        } catch (error) {
            console.error('Error signing up:', error);
            throw error;
        }
    }

    async signInWithGoogle(idToken: string): Promise<User> {
        try {
            const auth = getFirebaseAuth();
            const credential = GoogleAuthProvider.credential(idToken);
            const userCredential = await signInWithCredential(auth, credential);
            const fbUser = userCredential.user;

            return {
                id: fbUser.uid,
                email: fbUser.email || '',
                firstName: fbUser.displayName?.split(' ')[0] || '',
                lastName: fbUser.displayName?.split(' ').slice(1).join(' ') || '',
                photoUrl: fbUser.photoURL || undefined,
                role: 'viewer',
            };
        } catch (error) {
            console.error('Error signing in with Google:', error);
            throw error;
        }
    }

    async signInWithApple(identityToken: string, rawNonce: string): Promise<User> {
        try {
            const auth = getFirebaseAuth();
            // El nonce va en CLARO al proveedor: Firebase compara su hash con
            // el que Apple firmó dentro del identityToken.
            const credential = AppleAuthProvider.credential(identityToken, rawNonce);
            const userCredential = await signInWithCredential(auth, credential);
            const fbUser = userCredential.user;

            return {
                id: fbUser.uid,
                email: fbUser.email || '',
                firstName: fbUser.displayName?.split(' ')[0] || '',
                lastName: fbUser.displayName?.split(' ').slice(1).join(' ') || '',
                photoUrl: fbUser.photoURL || undefined,
                role: 'viewer',
            };
        } catch (error) {
            console.error('Error signing in with Apple:', error);
            throw error;
        }
    }

    async signOut(): Promise<void> {
        const auth = getFirebaseAuth();
        await signOut(auth);
        await signOutGoogle();
    }

    /**
     * Borrar la cuenta (B2).
     *
     * Apple exige revocar el token de «Iniciar sesión con Apple» al borrar la
     * cuenta. La revocación necesita un código de autorización fresco, así que
     * a quien entró con Apple se le vuelve a pedir la autorización (en iOS,
     * que es donde la librería la implementa). Si la revocación falla —p. ej.
     * el proveedor de Apple sin configurar en Firebase—, el borrado sigue: lo
     * que la persona pidió es que se borre su cuenta.
     */
    async deleteAccount(): Promise<{ purgeAfter: string; graceDays: number }> {
        const auth = getFirebaseAuth();
        const fbUser = auth.currentUser;
        if (!fbUser) throw new Error('not-signed-in');
        const usesApple = fbUser.providerData.some((p) => p.providerId === 'apple.com');
        if (usesApple && Platform.OS === 'ios') {
            // Si la persona cancela este diálogo, el borrado se cancela.
            const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
            if (credential.authorizationCode) {
                await revokeToken(auth, credential.authorizationCode).catch((error) =>
                    console.warn('[deleteAccount] Apple revoke failed:', error),
                );
            }
        }
        await appCheckReady();
        const callable = httpsCallable<void, { purgeAfter: string; graceDays: number }>(
            getFunctions(getApp()),
            'requestAccountDeletion',
        );
        const result = await callable();
        return result.data;
    }

    async getCurrentUser(): Promise<User | null> {
        const auth = getFirebaseAuth();
        const fbUser = auth.currentUser;
        if (!fbUser) return null;
        return {
            id: fbUser.uid,
            email: fbUser.email || '',
            firstName: fbUser.displayName?.split(' ')[0] || '',
            lastName: fbUser.displayName?.split(' ').slice(1).join(' ') || '',
            photoUrl: fbUser.photoURL || undefined,
            role: 'viewer', // Default role, should fetch from Firestore claims or DB
        };
    }
    async sendPasswordResetEmail(email: string): Promise<void> {
        const auth = getFirebaseAuth();
        await sendPasswordResetEmail(auth, email);
    }

    onAuthStateChanged(callback: (user: User | null) => void): () => void {
        const auth = getFirebaseAuth();
        return onAuthStateChanged(auth, (fbUser) => {
            if (fbUser) {
                callback({
                    id: fbUser.uid,
                    email: fbUser.email || '',
                    firstName: fbUser.displayName?.split(' ')[0] || '',
                    lastName: fbUser.displayName?.split(' ').slice(1).join(' ') || '',
                    photoUrl: fbUser.photoURL || undefined,
                    role: 'viewer', // Default role
                });
            } else {
                callback(null);
            }
        });
    }
}
