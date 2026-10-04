import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { ReactNode, useEffect } from 'react';
import { AppState, Platform } from 'react-native';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 2,
            staleTime: 1000 * 60 * 5, // 5 minutes
        },
    },
});

interface Props {
    children: ReactNode;
}

export const AppQueryClientProvider = ({ children }: Props) => {
    // Volver a la app es «volver a mirar»: en React Native react-query no lo
    // sabe solo. Sin esto, la tablet que quedó sin conexión el sábado seguía
    // mostrando lo guardado el domingo aunque ya hubiera WiFi (A1).
    useEffect(() => {
        if (Platform.OS === 'web') return;
        const sub = AppState.addEventListener('change', (status) => {
            focusManager.setFocused(status === 'active');
        });
        return () => sub.remove();
    }, []);

    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
