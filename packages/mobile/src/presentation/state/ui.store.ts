import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

/** Una acción en el aviso: «Deshacer» es la que importa (A5). */
export interface ToastAction {
    label: string;
    onPress: () => void;
}

interface ToastState {
    message: string;
    type: ToastType;
    visible: boolean;
    action?: ToastAction;
}

interface UIState {
    toast: ToastState | null;
    showToast: (message: string, type: ToastType, duration?: number, action?: ToastAction) => void;
    hideToast: () => void;
}

let timeoutId: ReturnType<typeof setTimeout> | undefined;

export const useUIStore = create<UIState>((set) => ({
    toast: null,
    showToast: (message, type, duration = 4000, action) => {
        if (timeoutId) clearTimeout(timeoutId);

        set({ toast: { message, type, visible: true, ...(action ? { action } : {}) } });

        timeoutId = setTimeout(() => {
            set((state) => ({
                toast: state.toast ? { ...state.toast, visible: false } : null,
            }));
        }, duration);
    },
    hideToast: () => {
        if (timeoutId) clearTimeout(timeoutId);
        set((state) => ({
            toast: state.toast ? { ...state.toast, visible: false } : null,
        }));
    },
}));
