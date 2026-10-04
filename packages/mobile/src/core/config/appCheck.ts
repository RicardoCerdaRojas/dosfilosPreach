import { getApp } from '@react-native-firebase/app';
import {
    getToken,
    initializeAppCheck,
    ReactNativeFirebaseAppCheckProvider,
} from '@react-native-firebase/app-check';

/**
 * App Check desde el día 1 (M-04): la primera llamada real de la app
 * (getSermonsListSummary) lo exige.
 *
 * LA CARRERA CONTRA EL ARRANQUE NATIVO. Firebase inicializa App Check dentro
 * de `FirebaseApp.configure()`, en el lanzamiento, ANTES de que corra el
 * bundle de JS — y su proveedor por defecto en Apple es DeviceCheck. El
 * syslog del iPad lo mostró sin lugar a dudas: `devicecheckd` responde a las
 * .434 y el JS recién configura `appAttest` a las .905. El token que sale en
 * el medio va contra `exchangeDeviceCheckToken`, y como sólo registramos App
 * Attest en la consola, el servidor contesta 400 "App not registered".
 *
 * Por eso el primer `getToken` va con `forceRefresh: true`: descarta lo que
 * haya emitido el arranque nativo y vuelve a pedirlo con el proveedor que
 * efectivamente configuramos.
 *
 * ESCAPE PARA BUILDS INTERNOS. `EXPO_PUBLIC_APPCHECK_DEBUG=1` fuerza el
 * proveedor de debug en builds firmados, y `EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN`
 * fija el token —así no hay que leerlo del log nativo, que en release es
 * inaccesible—. El token se registra a mano en la consola. Viene APAGADO.
 * Debilita App Check en el build que lo lleve: es sólo para distribución
 * interna, nunca para producción. El token NO se commitea: entra por variable
 * de entorno de EAS, porque quien lo tenga pasa App Check.
 */
let ready: Promise<void> | null = null;

/**
 * Configura App Check UNA vez y devuelve la misma promesa a quien la pida.
 * La raíz lo lanza al arrancar sin esperar; las llamadas al servidor esperan
 * `appCheckReady()` antes de salir (B4): la primera llamada competía con la
 * configuración y podía salir con el token de relleno.
 */
export function initAppCheck(): Promise<void> {
    if (!ready) ready = configureAppCheck();
    return ready;
}

/** Espera la configuración (nunca falla: un fallo ya quedó en el log). */
export function appCheckReady(): Promise<void> {
    return (ready ?? initAppCheck()).catch(() => undefined);
}

async function configureAppCheck(): Promise<void> {
    const debugToken = process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN;
    const forceDebug = process.env.EXPO_PUBLIC_APPCHECK_DEBUG === '1';
    const useDebug = __DEV__ || forceDebug;

    const provider = new ReactNativeFirebaseAppCheckProvider();
    provider.configure({
        apple: useDebug
            ? { provider: 'debug', debugToken }
            : { provider: 'appAttest' },
        android: useDebug ? { provider: 'debug', debugToken } : { provider: 'playIntegrity' },
    });

    const appCheck = await initializeAppCheck(getApp(), {
        provider,
        isTokenAutoRefreshEnabled: true,
    });

    // Se pide el token al arrancar por dos razones: forzar el refresco que
    // descarta el del proveedor por defecto, y dejar el fallo en el log — sin
    // esto el motivo vive en el log nativo y desde el servidor sólo se ve
    // "el token no es un JWT". Nunca se registra el token en sí.
    const label = useDebug ? 'debug' : 'attest';
    try {
        const result = await getToken(appCheck, true);
        console.log(`[appCheck] proveedor=${label} token=${result?.token ? 'ok' : 'vacío'}`);
    } catch (error) {
        console.error(`[appCheck] no se pudo emitir el token (${label}):`, error);
    }
}
