import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Brightness from 'expo-brightness';

/**
 * Brillo propio del atril (C7): el púlpito tiene su luz y el pastor la fija
 * una vez, en vez de tocar el del sistema cada domingo.
 *
 * - Android: es el brillo de la VENTANA; al salir se devuelve al del sistema.
 * - iOS: no hay brillo por app, sólo el de la pantalla. Se guarda el que había
 *   al entrar y se repone al salir del atril o al pasar la app a segundo
 *   plano — si no, el pastor encontraría la tablet con la luz
 *   del púlpito en la oficina.
 * - `null`: no se toca nada.
 *
 * Falla en silencio: sin brillo propio, el atril sigue sirviendo.
 */
export function usePreachBrightness(level: number | null) {
    useEffect(() => {
        if (level === null) return;
        let original: number | null = null;
        let active = true;

        const apply = () => Brightness.setBrightnessAsync(level).catch(() => undefined);
        const restore = async () => {
            try {
                if (Platform.OS === 'android') await Brightness.restoreSystemBrightnessAsync();
                else if (original !== null) await Brightness.setBrightnessAsync(original);
            } catch {
                // Sin brillo que reponer: nada que hacer.
            }
        };

        void (async () => {
            try {
                if (Platform.OS !== 'android') original = await Brightness.getBrightnessAsync();
            } catch {
                original = null;
            }
            if (active) await apply();
        })();

        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') void apply();
            else if (state === 'background') void restore();
        });

        return () => {
            active = false;
            sub.remove();
            void restore();
        };
    }, [level]);
}
