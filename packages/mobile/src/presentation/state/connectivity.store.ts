import { create } from 'zustand';

/**
 * ¿Lo que se ve viene de la red o de lo guardado en la tablet?
 *
 * No hay NetInfo en la app (sumarlo es un módulo nativo): el estado se deduce
 * de cómo terminó la última lectura. Si la red no contestó y se usó el
 * maletín o la última lista, se está sin conexión; la próxima lectura que
 * llegue de la red lo apaga. Es lo que le importa al pastor: no si hay WiFi,
 * sino si lo que tiene delante es lo último.
 */
interface ConnectivityState {
    offline: boolean;
    setOffline: (offline: boolean) => void;
}

export const useConnectivityStore = create<ConnectivityState>((set) => ({
    offline: false,
    setOffline: (offline) => set((s) => (s.offline === offline ? s : { offline })),
}));
