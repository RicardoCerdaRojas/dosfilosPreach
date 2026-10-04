import React from 'react';
import { Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';

import { useAppTheme } from '@/core/theme/appTheme';
import { LEGAL_URLS } from '@/core/config/features';

/**
 * Privacidad y términos (B3). Apple 5.1.1(i) pide la política de privacidad
 * accesible DENTRO de la app. Se abren en el navegador de la app: el pastor no
 * sale de ella.
 */
export function LegalLinks({ prefix }: { prefix?: string }) {
    const theme = useAppTheme();
    const { t } = useTranslation();
    const link = (label: string, url: string) => (
        <Text
            accessibilityRole="link"
            onPress={() => void WebBrowser.openBrowserAsync(url)}
            style={{ color: theme.accent }}
            className="font-lexend"
        >
            {label}
        </Text>
    );
    return (
        <View className="items-center px-6">
            <Text style={{ color: theme.textMuted, fontSize: 12, lineHeight: 18 }} className="font-lexend text-center">
                {prefix ? `${prefix} ` : ''}
                {link(t('common:terms'), LEGAL_URLS.terms)}
                {` ${t('common:and')} `}
                {link(t('common:privacy'), LEGAL_URLS.privacy)}
            </Text>
        </View>
    );
}
