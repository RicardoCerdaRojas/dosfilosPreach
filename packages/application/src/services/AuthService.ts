import { FirebaseAuthRepository, db } from '@dosfilos/infrastructure';
import { UserEntity, buildFreeUserProfile } from '@dosfilos/domain';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { signInWithCustomToken, getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface CompleteRegistrationResult {
    success: boolean;
    userId: string;
    customToken: string;
    message: string;
}

interface CompleteRegistrationInput {
    sessionId: string;
    locale: 'en' | 'es';
}

interface ImpersonateUserResult {
    customToken: string;
    targetUid: string;
    targetEmail: string | null;
    targetName: string | null;
}

interface StopImpersonatingResult {
    customToken: string;
    adminUid: string;
}

interface CreateCheckoutSessionInput {
    /** Subscription price (ignored when `packId` is set). */
    priceId?: string;
    /** Credit-pack id for one-time purchase (drives Stripe mode=payment). */
    packId?: string;
    isNewRegistration?: boolean;
    email?: string;
    displayName?: string;
    locale?: 'en' | 'es';
    successUrl?: string;
    cancelUrl?: string;
}

export class AuthService {
    private authRepository: FirebaseAuthRepository;

    constructor() {
        this.authRepository = new FirebaseAuthRepository();
    }

    async login(email: string, password: string): Promise<UserEntity> {
        try {
            return await this.authRepository.signIn(email, password);
        } catch (error: any) {
            throw this.translateError(error);
        }
    }

    async loginWithGoogle(): Promise<UserEntity> {
        try {
            return await this.authRepository.signInWithGoogle();
        } catch (error: any) {
            // "Not registered" is a signal for the UI to redirect to /pricing — pass
            // it through unchanged so the caller can discriminate by code.
            if (error?.code === 'auth/not-registered') throw error;
            throw this.translateError(error);
        }
    }

    async logout(): Promise<void> {
        try {
            await this.authRepository.signOut();
        } catch (error: any) {
            throw this.translateError(error);
        }
    }

    async resetPassword(email: string): Promise<void> {
        try {
            await this.authRepository.resetPassword(email);
        } catch (error: any) {
            throw this.translateError(error);
        }
    }

    /**
     * Completes a Stripe-driven registration: invokes the `completeRegistration`
     * Cloud Function with the checkout session id, then signs the user in with
     * the returned custom token. Encapsulates the Firebase callable + auth so
     * UI code doesn't import `firebase/functions` or `firebase/auth` directly.
     */
    /**
     * Invokes the `createCheckoutSession` Cloud Function and returns the Stripe
     * hosted-checkout URL. Used by the register page (new subscription) and the
     * subscription page (plan upgrade). Encapsulates `httpsCallable` so UI code
     * doesn't import `firebase/functions` directly.
     */
    async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<{ url: string }> {
        const functions = getFunctions();
        const callable = httpsCallable<CreateCheckoutSessionInput, { url: string }>(
            functions,
            'createCheckoutSession',
        );
        const result = await callable(input);
        return result.data;
    }

    async completeRegistration(input: CompleteRegistrationInput): Promise<{ userId: string; message: string }> {
        const functions = getFunctions();
        const callable = httpsCallable<CompleteRegistrationInput, CompleteRegistrationResult>(
            functions,
            'completeRegistration',
        );
        const result = await callable(input);
        const { customToken, userId, message } = result.data;
        await signInWithCustomToken(getAuth(), customToken);
        return { userId, message };
    }

    /**
     * Super-admin only: swap the current session for the target user's, so the
     * admin browses the app as that user. Returns the target's identity for the
     * "you are impersonating X" banner. The minted token carries the
     * `impersonatorUid` claim that powers `stopImpersonating`.
     */
    async impersonateUser(userId: string): Promise<ImpersonateUserResult> {
        const callable = httpsCallable<{ userId: string }, ImpersonateUserResult>(
            getFunctions(),
            'impersonateUser',
        );
        const { data } = await callable({ userId });
        await signInWithCustomToken(getAuth(), data.customToken);
        return data;
    }

    /**
     * Ends an impersonation session and signs back in as the original admin.
     * Only works from a session that carries the `impersonatorUid` claim.
     */
    async stopImpersonating(): Promise<StopImpersonatingResult> {
        const callable = httpsCallable<unknown, StopImpersonatingResult>(
            getFunctions(),
            'stopImpersonating',
        );
        const { data } = await callable({});
        await signInWithCustomToken(getAuth(), data.customToken);
        return data;
    }

    async getCurrentUser(): Promise<UserEntity | null> {
        try {
            return await this.authRepository.getCurrentUser();
        } catch (error: any) {
            throw this.translateError(error);
        }
    }

    /**
     * Resends the email-verification link to the currently signed-in user.
     * Used by /auth/verify-email when the original email was lost.
     */
    async resendVerificationEmail(): Promise<void> {
        try {
            await this.authRepository.resendVerificationEmail();
        } catch (error: any) {
            throw this.translateError(error);
        }
    }

    /**
     * Applies an emailVerification or recoverEmail action code. After this
     * resolves, the user's `emailVerified` flag is true server-side; we also
     * refresh the locally cached user so ProtectedRoute reflects it on the
     * next render.
     *
     * Errors from these methods preserve the original Firebase `code`
     * (`auth/expired-action-code`, etc.) so the UI can render a typed message
     * — translation happens in the page, not here.
     */
    async applyAuthActionCode(oobCode: string): Promise<void> {
        await this.authRepository.applyActionCode(oobCode);
        await this.authRepository.reloadCurrentUser().catch(() => {
            // Reload is best-effort — the action already succeeded server-side.
        });
    }

    /** Validates a reset code and returns the email it was issued for. */
    async verifyPasswordResetCode(oobCode: string): Promise<string> {
        return this.authRepository.verifyPasswordResetCode(oobCode);
    }

    /** Sets the new password for a previously-verified reset code. */
    async confirmPasswordReset(oobCode: string, newPassword: string): Promise<void> {
        await this.authRepository.confirmPasswordReset(oobCode, newPassword);
    }

    /**
     * Fallback validation for action modes we don't explicitly handle —
     * lets the UI render a clean error instead of a blank screen.
     */
    async checkAuthActionCode(oobCode: string): Promise<void> {
        await this.authRepository.checkActionCode(oobCode);
    }

    /**
     * Registers a Free-tier user without going through Stripe.
     *
     * Flow:
     *   1. Create Firebase Auth account (email + password + displayName)
     *   2. Write the Firestore `users/{uid}` profile with `subscription: { planId: 'free', ... }`
     *
     * Side-effects (handled by Cloud Function triggers, not here):
     *   - `sendWelcomeEmail` fires on Auth user creation
     *   - `onUserCreated` analytics trigger fires on Firestore user doc creation
     *
     * Paid signups must NOT use this — they go through Stripe Checkout +
     * webhook + completeRegistration so the subscription is provisioned
     * server-side with the right Stripe customer/subscription ids.
     */
    async registerFree(input: {
        email: string;
        password: string;
        displayName: string;
        locale: 'en' | 'es';
    }): Promise<UserEntity> {
        try {
            const user = await this.authRepository.signUpWithEmailPassword(
                input.email,
                input.password,
                input.displayName,
            );

            await setDoc(doc(db, 'users', user.id), {
                // El correo de Auth, no el tipeado: Auth lo guarda normalizado
                // y las reglas exigen que coincida con el de la sesión.
                ...buildFreeUserProfile({ email: user.email ?? input.email, displayName: input.displayName, locale: input.locale }),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            return user;
        } catch (error: any) {
            throw this.translateError(error);
        }
    }

    private translateError(error: any): Error {
        const errorCode = error.code || '';
        const errorMessages: Record<string, string> = {
            'auth/user-not-found': 'Usuario no encontrado',
            'auth/wrong-password': 'Contraseña incorrecta',
            'auth/email-already-in-use': 'El email ya está registrado',
            'auth/weak-password': 'La contraseña es muy débil (mínimo 6 caracteres)',
            'auth/invalid-email': 'Email inválido',
            'auth/user-disabled': 'Usuario deshabilitado',
            'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde',
            'auth/network-request-failed': 'Error de conexión. Verifica tu internet',
            'auth/invalid-credential': 'Credenciales inválidas',
            'auth/popup-closed-by-user': 'Inicio de sesión cancelado',
            'auth/cancelled-popup-request': 'Inicio de sesión cancelado',
            'auth/account-exists-with-different-credential': 'Ya existe una cuenta con este email usando otro método de inicio de sesión',
        };

        const message = errorMessages[errorCode] || error.message || 'Error desconocido';
        return new Error(message);
    }

    /**
     * Reads the user's role from `users/{uid}.role`. Used by the
     * admin route guard to gate `/dashboard/admin/**` behind a
     * `super_admin` check. Returns `null` for missing users or
     * read failures so the caller can fail closed (deny access).
     */
    async getUserRole(uid: string): Promise<string | null> {
        try {
            const snap = await getDoc(doc(db, 'users', uid));
            if (!snap.exists()) return null;
            const role = snap.data()?.role;
            return typeof role === 'string' ? role : null;
        } catch (err) {
            console.error('[AuthService] Failed to read user role:', err);
            return null;
        }
    }
}

// Singleton instance
export const authService = new AuthService();
