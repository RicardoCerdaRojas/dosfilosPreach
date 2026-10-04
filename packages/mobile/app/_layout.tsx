import { DarkTheme as navigationDarkTheme, DefaultTheme as navigationDefaultTheme, ThemeProvider } from 'expo-router';
import { View, useColorScheme as useDeviceColorScheme } from 'react-native';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Lexend_400Regular,
  Lexend_500Medium,
  Lexend_600SemiBold,
  Lexend_700Bold,
} from '@expo-google-fonts/lexend';
// Tres familias de LECTURA, elegibles desde el púlpito. No son estilos: cada
// una resuelve un problema distinto del ojo que vuelve del público. Ver
// DELIVERY_FACES en core/theme/typography.
import { Literata_400Regular, Literata_600SemiBold } from '@expo-google-fonts/literata';
import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
} from '@expo-google-fonts/atkinson-hyperlegible';
import { useEffect, useMemo } from 'react';
import { useColorScheme } from 'nativewind';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';


import { useTranslation } from 'react-i18next';

import { AppQueryClientProvider } from '@/core/providers/query-client.provider';
import { useThemeStore } from '@/presentation/state/theme.store';
import { useAuthStore } from '@/presentation/state/auth.store';
import { useReaderSettingsStore } from '@/presentation/state/readerSettings.store';
import { useLanguageStore } from '@/presentation/state/language.store';
import { ToastNotification } from '@/presentation/components/ui/ToastNotification';
import { APP_DARK, APP_LIGHT } from '@/core/theme/appTheme';
import { initAppCheck } from '@/core/config/appCheck';
import { initCrashReporting } from '@/core/config/crashReporting';
import { configureGoogleSignIn } from '@/core/config/socialAuth';
import '@/core/i18n';
import '../global.css';

// Arranque, en este orden y antes de montar nada:
// - App Check antes de cualquier llamada al backend (M-04).
// - Reporte de fallos (B5): sólo en builds publicados, sin datos personales.
// - Google Sign-In nativo (M-08): configurado antes de que se monte el login.
initAppCheck().catch((err) => console.error('[appCheck] init failed:', err));
initCrashReporting().catch((err) => console.error('[crashlytics] init failed:', err));
configureGoogleSignIn();

export const unstable_settings = {
  initialRouteName: '(tabs)',
  bible: {
    initialRouteName: 'index',
  },
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// El tema de navegación sale del MISMO catálogo que las pantallas. Tenía su
// propia copia de los colores, con un fondo azulado que ya no coincidía con
// nada: al empujar una pantalla se veía el gris viejo un instante.
const CustomDarkTheme = {
  ...navigationDarkTheme,
  colors: {
    ...navigationDarkTheme.colors,
    primary: APP_DARK.accent,
    background: APP_DARK.background,
    card: APP_DARK.surface,
    text: APP_DARK.textPrimary,
    border: APP_DARK.border,
  },
};

const CustomDefaultTheme = {
  ...navigationDefaultTheme,
  colors: {
    ...navigationDefaultTheme.colors,
    primary: APP_LIGHT.accent,
    background: APP_LIGHT.background,
    card: APP_LIGHT.surface,
    text: APP_LIGHT.textPrimary,
    border: APP_LIGHT.border,
  },
};

function RootLayoutNav() {
  const einkPulpit = useReaderSettingsStore((state) => state.readingMode === 'eink');
  const deviceColorScheme = useDeviceColorScheme();
  const { setColorScheme } = useColorScheme();
  const themeMode = useThemeStore((state) => state.themeMode);
  const { language } = useLanguageStore();
  const { i18n } = useTranslation();
  const { user, isLoading } = useAuthStore();
  const [fontsLoaded, fontsError] = useFonts({
    Lexend: Lexend_400Regular,
    'Lexend-Medium': Lexend_500Medium,
    'Lexend-SemiBold': Lexend_600SemiBold,
    'Lexend-Bold': Lexend_700Bold,
    Literata: Literata_400Regular,
    'Literata-SemiBold': Literata_600SemiBold,
    Atkinson: AtkinsonHyperlegible_400Regular,
    'Atkinson-Bold': AtkinsonHyperlegible_700Bold,
  });
  const segments = useSegments();
  const router = useRouter();

  // Sync translation language
  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  const isDark = useMemo(() => {
    if (themeMode === 'system') return deviceColorScheme === 'dark';
    return themeMode === 'dark';
  }, [themeMode, deviceColorScheme]);

  // Sync our theme store with NativeWind
  useEffect(() => {
    setColorScheme(isDark ? 'dark' : 'light');
  }, [isDark, setColorScheme]);

  useEffect(() => {
    // Si las fuentes fallan (p.ej. asset no resoluble en dev) NO se bloquea el
    // arranque: se entra con la fuente del sistema.
    if (!isLoading && (fontsLoaded || fontsError)) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, fontsLoaded, fontsError]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    // Vista previa de desarrollo: pasa sin sesión a propósito — existe justo
    // para mirar pantallas cuando el login no está disponible.
    const inDevPreview = __DEV__ && String(segments[0]) === 'dev';
    if (inDevPreview) return;
    
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, isLoading, segments, router]);

  if (isLoading) {
    return null; // or a dedicated loading component
  }

  return (
    <ThemeProvider value={isDark ? CustomDarkTheme : CustomDefaultTheme}>
      {/* hideAsync desde un effect temprano tiene carrera con el registro del
          overlay nativo (pantalla blanca intermitente en cold start); el
          onLayout del root es el punto que Expo documenta como seguro. */}
      <View
        style={{ flex: 1 }}
        onLayout={() => {
          SplashScreen.hideAsync();
        }}
      >
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="sermon/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="sermon/edit/[id]" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="sermon/paste" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen
            name="preach/[id]"
            // En tinta electrónica, sin fundido (C3): cada cuadro de la
            // animación es un refresco de pantalla con su parpadeo.
            options={{ headerShown: false, animation: einkPulpit ? 'none' : 'fade', gestureEnabled: false }}
          />
          {/* Grupo solo de desarrollo: sin header, como el púlpito real. */}
          {/* El perfil dibuja su propia cabecera. Sin esto encima quedaba la
              del sistema, con el título en minúscula y sin traducir
              ("profile") y un "atrás" que decía "(tabs)". */}
          <Stack.Screen name="profile" options={{ headerShown: false }} />
          {/* Grupo solo de desarrollo: sin header, como el púlpito real. */}
          <Stack.Screen name="dev" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" options={{ headerShown: false }} />
        </Stack>
        <ToastNotification />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // Raíz de react-native-gesture-handler: la tinta distingue el Apple Pencil
  // del dedo con sus gestos (T-9 de la fase «Atril: tinta y lectura»).
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppQueryClientProvider>
        <RootLayoutNav />
      </AppQueryClientProvider>
    </GestureHandlerRootView>
  );
}
