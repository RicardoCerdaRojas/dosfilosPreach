import React from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useAppTheme } from '@/core/theme/appTheme';
import { STUDY_COLUMN, useLayout } from '@/core/theme/layout';
import { DELIVERY_SIZE } from '@/core/theme/typography';
import { READING_MODES, READING_MODE_LABEL_KEYS } from '@/core/theme/readingModes';
import type { ReadingMode } from '@/core/theme/readingModes';
import { PendingWritesError, useAuthStore } from '@/presentation/state/auth.store';
import { ACCOUNT_DELETION_GRACE_DAYS } from '@/core/config/features';
import { useThemeStore, ThemeMode } from '@/presentation/state/theme.store';
import { useLanguageStore, Language } from '@/presentation/state/language.store';
import { useReaderSettingsStore } from '@/presentation/state/readerSettings.store';
import { Card, SectionLabel } from '@/presentation/components/ui/kit';

/**
 * La cuenta y los ajustes.
 *
 * QUÉ SE FUE, Y POR QUÉ. Había una foto de archivo traída de internet —la
 * misma cara para todos—, un "Plan Teólogo" escrito a mano que no consultaba
 * nada, y dos filas ("editar perfil", "notificaciones") que no hacían nada al
 * tocarlas. Eran restos de la maqueta. Una pantalla que promete lo que no
 * cumple enseña a desconfiar del resto.
 *
 * QUÉ ENTRÓ: los ajustes de LECTURA. Modo de luz y cuerpo del texto vivían
 * sólo dentro del púlpito, donde se descubren tarde — parado, con gente
 * mirando. Acá se prueban sentado y quedan listos.
 */
export default function ProfileScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useAppTheme();
    const { gutter } = useLayout();
    const { t, i18n } = useTranslation();

    const { user, signOut, deleteAccount } = useAuthStore();
    const [deleting, setDeleting] = React.useState(false);

    /**
     * Borrar la cuenta (B2). Dos pasos a propósito: es irreversible pasado el
     * plazo, y un toque no puede bastar. El texto dice qué pasa ahora, qué
     * pasa después y cómo arrepentirse.
     */
    const confirmDelete = () =>
        Alert.alert(t('common:delete_account_title'), t('common:delete_account_body', { days: ACCOUNT_DELETION_GRACE_DAYS }), [
            { text: t('common:cancel'), style: 'cancel' },
            {
                text: t('common:delete_account_confirm'),
                style: 'destructive',
                onPress: async () => {
                    setDeleting(true);
                    try {
                        const { purgeAfter } = await deleteAccount();
                        const date = new Date(purgeAfter).toLocaleDateString(i18n.language, {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                        });
                        Alert.alert(t('common:delete_account_done_title'), t('common:delete_account_done_body', { date }));
                    } catch (error) {
                        // Cancelar el diálogo de Apple también llega acá: no es un error.
                        if ((error as { code?: string })?.code !== 'ERR_REQUEST_CANCELED') {
                            Alert.alert(t('common:delete_account_title'), t('common:delete_account_failed'));
                        }
                    } finally {
                        setDeleting(false);
                    }
                },
            },
        ]);
    const { themeMode, setThemeMode } = useThemeStore();
    const { language, setLanguage } = useLanguageStore();
    const readingMode = useReaderSettingsStore((s) => s.readingMode);
    const setReadingMode = useReaderSettingsStore((s) => s.setReadingMode);
    const fontSize = useReaderSettingsStore((s) => s.deliveryFontSize);
    const setFontSize = useReaderSettingsStore((s) => s.setDeliveryFontSize);

    const themeOptions: {
        label: string;
        value: ThemeMode;
        icon: keyof typeof MaterialIcons.glyphMap;
    }[] = [
        { label: t('common:light'), value: 'light', icon: 'light-mode' },
        { label: t('common:dark'), value: 'dark', icon: 'dark-mode' },
        { label: t('common:system'), value: 'system', icon: 'settings-brightness' },
        // Tinta electrónica: la app entera pasa a negro sobre blanco y los
        // rellenos se vuelven bordes. En un Boox es la diferencia entre
        // usable e ilegible.
        { label: t('common:eink'), value: 'eink', icon: 'chrome-reader-mode' },
    ];

    const languageOptions: { label: string; value: Language }[] = [
        { label: t('common:spanish'), value: 'es' },
        { label: t('common:english'), value: 'en' },
    ];

    const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() ||
        (user?.email?.[0] ?? '·').toUpperCase();

    /** Celda de opción: misma forma para tema, idioma y modo de luz. */
    const option = (key: string, label: string, chosen: boolean, onPress: () => void, icon?: React.ReactNode) => (
        <TouchableOpacity
            key={key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: chosen }}
            className="flex-1 items-center py-3.5 mx-1 rounded-xl"
            style={{
                backgroundColor: chosen ? theme.accentSoft : theme.surfaceSunken,
                borderWidth: 1,
                borderColor: chosen ? theme.accent : 'transparent',
            }}
        >
            {icon}
            <Text
                style={{ color: chosen ? theme.accent : theme.textSecondary, fontSize: 12 }}
                className="font-lexend-semibold mt-1.5"
            >
                {label}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background, paddingTop: insets.top }}>
            <ScrollView
                contentContainerStyle={{
                    paddingHorizontal: gutter,
                    paddingBottom: insets.bottom + 40,
                }}
                showsVerticalScrollIndicator={false}
            >
                <View style={{ width: '100%', maxWidth: STUDY_COLUMN, alignSelf: 'center' }}>
                    <View className="flex-row items-center py-4">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            accessibilityRole="button"
                            className="p-2 -ml-2 active:opacity-60"
                        >
                            <MaterialIcons name="arrow-back" size={23} color={theme.textSecondary} />
                        </TouchableOpacity>
                        <Text
                            style={{ color: theme.textPrimary, fontSize: 22 }}
                            className="font-lexend-bold ml-2"
                        >
                            {t('common:profile')}
                        </Text>
                    </View>

                    <View className="flex-row items-center mb-8 mt-2">
                        <View
                            className="items-center justify-center"
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: 32,
                                backgroundColor: theme.accentSoft,
                                borderWidth: 1,
                                borderColor: theme.border,
                            }}
                        >
                            <Text
                                style={{ color: theme.accent, fontSize: 22 }}
                                className="font-lexend-semibold"
                            >
                                {initials}
                            </Text>
                        </View>
                        <View className="flex-1 ml-4">
                            <Text
                                style={{ color: theme.textPrimary, fontSize: 19 }}
                                className="font-lexend-semibold"
                                numberOfLines={1}
                            >
                                {user?.firstName} {user?.lastName}
                            </Text>
                            <Text
                                style={{ color: theme.textSecondary, fontSize: 14 }}
                                className="font-lexend mt-0.5"
                                numberOfLines={1}
                            >
                                {user?.email}
                            </Text>
                        </View>
                    </View>

                    {/* Lectura primero: es lo que el pastor cambia de verdad. */}
                    <Card theme={theme} className="p-5 mb-4">
                        <SectionLabel theme={theme}>{t('preach:reading_mode')}</SectionLabel>
                        <View className="flex-row mt-4 -mx-1">
                            {(Object.keys(READING_MODE_LABEL_KEYS) as ReadingMode[]).map((mode) =>
                                option(
                                    mode,
                                    t(READING_MODE_LABEL_KEYS[mode]),
                                    readingMode === mode,
                                    () => setReadingMode(mode),
                                    <View
                                        style={{
                                            width: 22,
                                            height: 22,
                                            borderRadius: 11,
                                            backgroundColor: READING_MODES[mode].background,
                                            borderWidth: 1,
                                            borderColor: theme.borderStrong,
                                        }}
                                    />,
                                ),
                            )}
                        </View>

                        <SectionLabel theme={theme} style={{ marginTop: 24 }}>
                            {t('preach:font_size')}
                        </SectionLabel>
                        <View className="flex-row items-center mt-3">
                            <TouchableOpacity
                                onPress={() => setFontSize(Math.max(DELIVERY_SIZE.min, fontSize - 2))}
                                accessibilityRole="button"
                                accessibilityLabel={t('preach:font_smaller')}
                                className="items-center justify-center rounded-full"
                                style={{
                                    width: 40,
                                    height: 40,
                                    backgroundColor: theme.surfaceSunken,
                                }}
                            >
                                <MaterialIcons name="remove" size={20} color={theme.textPrimary} />
                            </TouchableOpacity>
                            <Text
                                style={{ color: theme.textPrimary, fontSize: 15, width: 64 }}
                                className="font-lexend-semibold text-center"
                            >
                                {fontSize}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setFontSize(Math.min(DELIVERY_SIZE.max, fontSize + 2))}
                                accessibilityRole="button"
                                accessibilityLabel={t('preach:font_bigger')}
                                className="items-center justify-center rounded-full"
                                style={{
                                    width: 40,
                                    height: 40,
                                    backgroundColor: theme.surfaceSunken,
                                }}
                            >
                                <MaterialIcons name="add" size={20} color={theme.textPrimary} />
                            </TouchableOpacity>
                        </View>
                    </Card>

                    <Card theme={theme} className="p-5 mb-4">
                        <SectionLabel theme={theme}>{t('common:appearance')}</SectionLabel>
                        <View className="flex-row mt-4 -mx-1">
                            {themeOptions.map((o) =>
                                option(
                                    o.value,
                                    o.label,
                                    themeMode === o.value,
                                    () => setThemeMode(o.value),
                                    <MaterialIcons
                                        name={o.icon}
                                        size={22}
                                        color={themeMode === o.value ? theme.accent : theme.textSecondary}
                                    />,
                                ),
                            )}
                        </View>

                        <SectionLabel theme={theme} style={{ marginTop: 24 }}>
                            {t('common:language')}
                        </SectionLabel>
                        <View className="flex-row mt-4 -mx-1">
                            {languageOptions.map((o) =>
                                option(o.value, o.label, language === o.value, () =>
                                    setLanguage(o.value),
                                ),
                            )}
                        </View>
                    </Card>

                    <TouchableOpacity
                        onPress={() =>
                            signOut().catch((error) => {
                                // Cambios sin subir: el pastor decide. Antes
                                // se perdían en silencio (revisión de A8).
                                if (error instanceof PendingWritesError) {
                                    Alert.alert(t('common:pending_sync_title'), t('common:pending_sync_body'), [
                                        { text: t('common:cancel'), style: 'cancel' },
                                        {
                                            text: t('common:logout_anyway'),
                                            style: 'destructive',
                                            onPress: () => void signOut({ force: true }),
                                        },
                                    ]);
                                }
                            })
                        }
                        accessibilityRole="button"
                        className="flex-row items-center justify-center py-4 rounded-2xl active:opacity-80"
                        style={{ borderWidth: 1, borderColor: theme.border }}
                    >
                        <MaterialIcons name="logout" size={18} color={theme.danger} />
                        <Text
                            style={{ color: theme.danger, fontSize: 15 }}
                            className="font-lexend-semibold ml-2"
                        >
                            {t('common:logout')}
                        </Text>
                    </TouchableOpacity>

                    {/* Borrar la cuenta (Apple 5.1.1(v), política de Play). Discreto,
                        no escondido: se encuentra donde se busca. */}
                    <TouchableOpacity
                        onPress={confirmDelete}
                        disabled={deleting}
                        accessibilityRole="button"
                        className="self-center mt-5 px-4 py-2"
                    >
                        <Text style={{ color: theme.textMuted, fontSize: 14 }} className="font-lexend underline">
                            {deleting ? t('common:delete_account_working') : t('common:delete_account')}
                        </Text>
                    </TouchableOpacity>

                    <View className="items-center mt-10">
                        <SectionLabel theme={theme}>Dos Filos Preach</SectionLabel>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
