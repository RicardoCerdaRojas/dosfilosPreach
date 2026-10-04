import React, { useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useTranslation } from 'react-i18next';

import { useAppTheme } from '@/core/theme/appTheme';
import { useAuthStore } from '@/presentation/state/auth.store';
import { useUIStore } from '@/presentation/state/ui.store';
import { getGoogleIdToken } from '@/core/config/socialAuth';
import { LegalLinks } from '@/presentation/components/LegalLinks';

/**
 * El registro NO ocurre en la app: la política es payment-first en la web
 * (M-08). Ojo: Google y Apple NO son sólo login — con una cuenta nueva,
 * `signInWithCredential` la CREA. Por eso la app ofrece borrar la cuenta
 * (Perfil) y no enlaza al registro: esa página cobra, y las tiendas no
 * permiten llevar a pagar fuera de ellas (B1, decisión D3 del fundador).
 */

/**
 * La puerta de entrada.
 *
 * Era la única pantalla clavada en blanco: al abrir la app de noche, con el
 * dispositivo en oscuro, daba un fogonazo. Ahora respeta el tema como todo lo
 * demás. La marca sube a un rótulo tenue en versalita y el peso tipográfico se
 * lo lleva la acción — el pastor no viene a leer el nombre del producto, viene
 * a entrar.
 */
export const LoginScreen = () => {
    const theme = useAppTheme();
    const [resetMode, setResetMode] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [localLoading, setLocalLoading] = useState(false);
    const [appleAvailable, setAppleAvailable] = useState(false);

    const { t } = useTranslation();
    const { showToast } = useUIStore();
    const { signIn, signInWithGoogle, signInWithApple, resetPassword } = useAuthStore();

    React.useEffect(() => {
        if (Platform.OS !== 'ios') return;
        AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }, []);

    const describeAuthError = (error: any): string => {
        const code = error?.code || error?.message;
        if (
            code === 'auth/invalid-credential' ||
            code === 'auth/user-not-found' ||
            code === 'auth/wrong-password'
        ) {
            return t('auth:error_invalid_credentials');
        }
        if (code === 'auth/invalid-email') return t('auth:error_invalid_email');
        if (code === 'auth/too-many-requests') return t('auth:error_too_many_requests');
        return t('auth:error_generic');
    };

    const handleLogin = async () => {
        if (!email || !password) {
            showToast(t('auth:enter_email_password'), 'info');
            return;
        }
        try {
            setLocalLoading(true);
            await signIn(email, password);
        } catch (error: any) {
            showToast(describeAuthError(error), 'error');
        } finally {
            setLocalLoading(false);
        }
    };

    const handleGoogle = async () => {
        try {
            setLocalLoading(true);
            const idToken = await getGoogleIdToken();
            if (!idToken) return; // cancelado por el usuario
            await signInWithGoogle(idToken);
        } catch (error: any) {
            showToast(describeAuthError(error), 'error');
        } finally {
            setLocalLoading(false);
        }
    };

    const handleApple = async () => {
        try {
            setLocalLoading(true);
            // Apple firma el HASH del nonce; Firebase recibe el nonce en claro
            // y compara. Sin esto el token es rechazado por replay.
            const rawNonce = Crypto.randomUUID();
            const hashedNonce = await Crypto.digestStringAsync(
                Crypto.CryptoDigestAlgorithm.SHA256,
                rawNonce,
            );
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
                nonce: hashedNonce,
            });
            if (!credential.identityToken) {
                showToast(t('auth:error_generic'), 'error');
                return;
            }
            await signInWithApple(credential.identityToken, rawNonce);
        } catch (error: any) {
            if (error?.code === 'ERR_REQUEST_CANCELED') return;
            showToast(describeAuthError(error), 'error');
        } finally {
            setLocalLoading(false);
        }
    };

    const handlePasswordReset = async () => {
        if (!email) {
            showToast(t('auth:enter_email'), 'info');
            return;
        }
        try {
            setLocalLoading(true);
            await resetPassword(email);
            showToast(t('auth:reset_sent'), 'success');
            setResetMode(false);
        } catch {
            showToast(t('auth:reset_failed'), 'error');
        } finally {
            setLocalLoading(false);
        }
    };

    return (
        <View
            className="flex-1 justify-center items-center p-6"
            style={{ backgroundColor: theme.background }}
        >
            <View className="w-full" style={{ maxWidth: 400 }}>
                <Text
                    style={{ color: theme.textMuted, fontSize: 11, letterSpacing: 1.6 }}
                    className="font-lexend-semibold text-center uppercase"
                >
                    Dos Filos Preach
                </Text>
                <Text
                    style={{ color: theme.textPrimary, fontSize: 27, marginTop: 10 }}
                    className="font-lexend-bold text-center"
                >
                    {resetMode ? t('auth:reset_title') : t('auth:sign_in')}
                </Text>

                <TextInput
                    className="w-full rounded-xl p-4 mt-8 font-lexend"
                    style={{
                        backgroundColor: theme.surfaceSunken,
                        borderWidth: 1,
                        borderColor: theme.border,
                        color: theme.textPrimary,
                        fontSize: 16,
                    }}
                    placeholder={t('auth:email')}
                    placeholderTextColor={theme.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    editable={!localLoading}
                />

                {!resetMode && (
                    <TextInput
                        className="w-full rounded-xl p-4 mt-3 font-lexend"
                        style={{
                            backgroundColor: theme.surfaceSunken,
                            borderWidth: 1,
                            borderColor: theme.border,
                            color: theme.textPrimary,
                            fontSize: 16,
                        }}
                        placeholder={t('auth:password')}
                        placeholderTextColor={theme.textMuted}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoComplete="current-password"
                        editable={!localLoading}
                    />
                )}

                <TouchableOpacity
                    className="w-full rounded-xl p-4 flex-row justify-center items-center mt-6 active:opacity-85"
                    style={{ backgroundColor: theme.accent, opacity: localLoading ? 0.7 : 1 }}
                    onPress={resetMode ? handlePasswordReset : handleLogin}
                    disabled={localLoading}
                    accessibilityRole="button"
                >
                    {localLoading ? (
                        <ActivityIndicator color={theme.onAccent} />
                    ) : (
                        <Text
                            style={{ color: theme.onAccent, fontSize: 16 }}
                            className="font-lexend-semibold"
                        >
                            {resetMode ? t('auth:send_reset') : t('auth:sign_in')}
                        </Text>
                    )}
                </TouchableOpacity>

                {!resetMode && (
                    <>
                        <View className="flex-row items-center my-6">
                            <View className="flex-1" style={{ height: 1, backgroundColor: theme.border }} />
                            <Text
                                style={{ color: theme.textMuted, fontSize: 12 }}
                                className="font-lexend mx-3"
                            >
                                {t('auth:or')}
                            </Text>
                            <View className="flex-1" style={{ height: 1, backgroundColor: theme.border }} />
                        </View>

                        <TouchableOpacity
                            onPress={handleGoogle}
                            disabled={localLoading}
                            accessibilityRole="button"
                            className="w-full rounded-xl p-4 flex-row justify-center items-center mb-3 active:opacity-80"
                            style={{
                                backgroundColor: theme.surface,
                                borderWidth: 1,
                                borderColor: theme.borderStrong,
                            }}
                        >
                            <Text
                                style={{ color: theme.textPrimary, fontSize: 15 }}
                                className="font-lexend-semibold"
                            >
                                {t('auth:continue_google')}
                            </Text>
                        </TouchableOpacity>

                        {appleAvailable && (
                            <AppleAuthentication.AppleAuthenticationButton
                                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                                buttonStyle={
                                    theme.isDark
                                        ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                                        : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                                }
                                cornerRadius={12}
                                style={{ width: '100%', height: 54, marginBottom: 12 }}
                                onPress={handleApple}
                            />
                        )}
                    </>
                )}

                <TouchableOpacity
                    onPress={() => setResetMode(!resetMode)}
                    className="self-center mt-4"
                    disabled={localLoading}
                    accessibilityRole="button"
                >
                    <Text style={{ color: theme.accent, fontSize: 14 }} className="font-lexend">
                        {resetMode ? t('auth:back_to_sign_in') : t('auth:forgot_password')}
                    </Text>
                </TouchableOpacity>

                <View className="mt-10">
                    <LegalLinks prefix={t('auth:legal_prefix')} />
                </View>

            </View>
        </View>
    );
};
