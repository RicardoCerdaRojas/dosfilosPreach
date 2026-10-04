import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useAppTheme } from '@/core/theme/appTheme';
import { onWriteFailure } from '@/core/errors/writeFailures';
import { useUIStore, ToastType } from '@/presentation/state/ui.store';

const ICON: Record<ToastType, keyof typeof MaterialIcons.glyphMap> = {
    success: 'check-circle',
    error: 'error-outline',
    info: 'info-outline',
};

/**
 * El aviso de la app.
 *
 * Antes era verde/rojo/azul de Tailwind con títulos fijos en español
 * («Error», «Éxito»): no seguía el tema —en tinta electrónica era un bloque
 * de color— ni el idioma. Ahora es una tarjeta del tema con el color sólo en
 * el ícono, y el mensaje dice lo que pasó sin un título que lo repita.
 *
 * También escucha las escrituras que fallaron (A2): antes iban sólo a la
 * consola y el cambio desaparecía de la pantalla sin explicación.
 */
export const ToastNotification = () => {
    const { toast, hideToast, showToast } = useUIStore();
    const insets = useSafeAreaInsets();
    const theme = useAppTheme();
    const { t } = useTranslation();

    useEffect(
        () => onWriteFailure((kind) => showToast(t(`common:write_failed_${kind}`), 'error', 6000)),
        [showToast, t],
    );

    if (!toast || !toast.visible) return null;

    const tone = toast.type === 'error' ? theme.danger : toast.type === 'success' ? theme.positive : theme.accent;

    return (
        <Animated.View
            entering={FadeInUp}
            exiting={FadeOutUp}
            style={[styles.container, { top: insets.top + 12 }]}
            pointerEvents="box-none"
        >
            <View
                accessibilityRole="alert"
                className="flex-row items-center px-4 py-3 rounded-2xl"
                style={{
                    width: '92%',
                    maxWidth: 560,
                    backgroundColor: theme.surface,
                    borderWidth: 1,
                    borderColor: theme.borderStrong,
                    shadowColor: theme.shadow,
                    shadowOpacity: 0.18,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 6,
                }}
            >
                <MaterialIcons name={ICON[toast.type]} size={22} color={tone} />
                <Text
                    style={{ color: theme.textPrimary, fontSize: 15, lineHeight: 21 }}
                    className="font-lexend flex-1 ml-3"
                >
                    {toast.message}
                </Text>
                <TouchableOpacity
                    onPress={hideToast}
                    accessibilityRole="button"
                    accessibilityLabel={t('common:close')}
                    className="p-1 ml-2"
                >
                    <MaterialIcons name="close" size={18} color={theme.textMuted} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 9999,
        alignItems: 'center',
    },
});
