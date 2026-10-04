import React from 'react';
import { Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useAppTheme } from '@/core/theme/appTheme';
import { useConnectivityStore } from '@/presentation/state/connectivity.store';

/**
 * Aviso de «lo que ves es lo guardado en esta tablet».
 *
 * Sin él, una lista sin conexión se lee igual que una al día y el pastor no
 * sabe si el sermón que corrigió anoche en la web está o no. No alarma: es
 * un renglón, en el tono de aviso, que se va solo cuando vuelve la red.
 */
export function OfflineNotice() {
    const offline = useConnectivityStore((s) => s.offline);
    const theme = useAppTheme();
    const { t } = useTranslation();
    if (!offline) return null;
    return (
        <View
            accessibilityRole="text"
            className="flex-row items-center rounded-xl px-4 py-2.5 mb-3"
            style={{ backgroundColor: theme.surfaceSunken, borderWidth: 1, borderColor: theme.border }}
        >
            <MaterialIcons name="cloud-off" size={16} color={theme.warning} />
            <Text style={{ color: theme.textSecondary, fontSize: 13 }} className="font-lexend ml-2 flex-1">
                {t('sermons:offline_notice')}
            </Text>
        </View>
    );
}
