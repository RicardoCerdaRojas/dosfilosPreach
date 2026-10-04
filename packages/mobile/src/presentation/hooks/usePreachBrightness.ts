import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Brightness from 'expo-brightness';

/**
 * Brillo propio del atril (C7): el púlpito tiene su luz y el pastor la fija
 * una vez, en vez de tocar el del sistema cada domingo.
 *
 * - Android: es el brillo de la VENTANA; al salir se devuelve al del sistema.
 * - iOS: no hay brillo por app, sólo el de la pantalla. Se guarda el que había
 *   al entrar y se repone al salir del atril o al pasar la app a segundo
 *   plano — si no, el pastor encontraría la tablet con la luz del púlpito en
 *   la oficina.
 * - `null`: no se toca nada (y si se estaba tocando, se repone).
 *
 * Revisión adversarial de C7:
 * - El original se lee UNA vez por visita. Cambiar el nivel desde los
 *   ajustes sólo pone el nuevo: releerlo guardaba la luz del atril como
 *   «original».
 * - Todo va en serie: en iOS `set` corre en la cola principal y `get` en la
 *   del módulo, y en paralelo un `get` podía leer el brillo a medio reponer.
 * - Se vuelve a aplicar sólo al volver de SEGUNDO PLANO. Bajar el Centro de
 *   Control pasa por `inactive` y no por `background`: el brillo que el
 *   pastor subió a mano ahí no se pisa.
 *
 * Falla en silencio: sin brillo propio, el atril sigue sirviendo.
 */
export function usePreachBrightness(level: number | null) {
    const levelRef = useRef(level);
    const control = useRef<{ apply: () => void } | null>(null);

    useEffect(() => {
        let original: number | null = null;
        let applied = false;
        let chain: Promise<unknown> = Promise.resolve();
        const run = (op: () => Promise<unknown>) => {
            chain = chain.then(op).catch(() => undefined);
        };

        const restore = async () => {
            if (!applied) return;
            applied = false;
            if (Platform.OS === 'android') await Brightness.restoreSystemBrightnessAsync();
            else if (original !== null) await Brightness.setBrightnessAsync(original);
        };
        const apply = async () => {
            const target = levelRef.current;
            if (target === null) return restore();
            if (!applied) {
                original = Platform.OS === 'android' ? null : await Brightness.getBrightnessAsync();
                applied = true;
            }
            await Brightness.setBrightnessAsync(target);
        };

        control.current = { apply: () => run(apply) };
        run(apply);

        let previous = AppState.currentState;
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'background') run(restore);
            else if (state === 'active' && previous === 'background') run(apply);
            previous = state;
        });

        return () => {
            control.current = null;
            sub.remove();
            run(restore);
        };
    }, []);

    // Cambiar el nivel no relee el original: sólo pone el nuevo.
    const firstLevel = useRef(true);
    useEffect(() => {
        levelRef.current = level;
        if (firstLevel.current) {
            firstLevel.current = false;
            return;
        }
        control.current?.apply();
    }, [level]);
}
