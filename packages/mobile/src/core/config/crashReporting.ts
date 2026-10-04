import {
    getCrashlytics,
    recordError,
    setAttributes,
    setCrashlyticsCollectionEnabled,
} from '@react-native-firebase/crashlytics';
import * as Updates from 'expo-updates';

import { onWriteFailure } from '@/core/errors/writeFailures';

/**
 * Reporte de fallos (B5, decisión D6: Crashlytics, ya estamos en Firebase).
 *
 * Antes no había ninguno: si la app se caía en el púlpito, nadie se enteraba.
 * - Sólo en builds publicados: en desarrollo la consola ya muestra el error.
 * - SIN datos personales: no se manda el uid ni el correo. Los atributos son
 *   del build (canal y actualización OTA), para saber qué versión falla.
 * - Las escrituras que el servidor rechazó también se reportan (sin su
 *   contenido): son la clase de fallo que el pastor ve como «se borró lo que
 *   marqué».
 */
export async function initCrashReporting(enabled: boolean = !__DEV__): Promise<void> {
    const crashlytics = getCrashlytics();
    await setCrashlyticsCollectionEnabled(crashlytics, enabled);
    if (!enabled) return;
    await setAttributes(crashlytics, {
        channel: Updates.channel ?? 'none',
        runtimeVersion: Updates.runtimeVersion ?? 'none',
        updateId: Updates.updateId ?? 'embedded',
    });
    onWriteFailure((kind, error) => {
        const message = error instanceof Error ? error.name : 'write-failure';
        recordError(crashlytics, new Error(`[write:${kind}] ${message}`), `write-${kind}`);
    });
}
