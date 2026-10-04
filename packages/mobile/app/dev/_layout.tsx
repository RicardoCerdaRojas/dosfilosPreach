import { Redirect, Stack } from 'expo-router';

import { DEV_ROUTES } from '@/core/config/features';

/**
 * Grupo SOLO DE DESARROLLO. Vive fuera del gate de autenticación
 * (`app/_layout.tsx`) porque su razón de ser es mirar pantallas cuando el
 * login no está disponible. En release REDIRIGE: antes la ruta existía y se
 * llegaba por enlace (`dosfilospreach://dev/preach`), y quedaba en un spinner.
 */
export default function DevLayout() {
    if (!DEV_ROUTES) return <Redirect href="/(tabs)" />;
    return (
        <Stack>
            <Stack.Screen name="preach" options={{ headerShown: false }} />
        </Stack>
    );
}
