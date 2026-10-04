import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAppTheme } from '@/core/theme/appTheme';
import { EmptyState } from '@/presentation/components/ui/kit';

/** Ruta que no existe. Del andamio de Expo quedaba el "Oops!" en inglés (C5: ahora por i18n). */
export default function NotFoundScreen() {
    const theme = useAppTheme();
    const router = useRouter();
    const { t } = useTranslation();

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <View
                className="flex-1 justify-center"
                style={{ backgroundColor: theme.background }}
            >
                <EmptyState
                    theme={theme}
                    title={t('common:not_found')}
                    action={
                        <TouchableOpacity
                            onPress={() => router.replace('/')}
                            accessibilityRole="button"
                            className="px-6 py-3 rounded-full active:opacity-85"
                            style={{ backgroundColor: theme.accent }}
                        >
                            <Text
                                style={{ color: theme.onAccent }}
                                className="font-lexend-semibold"
                            >
                                {t('common:go_home')}
                            </Text>
                        </TouchableOpacity>
                    }
                />
            </View>
        </>
    );
}
