import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from '@/components/theme-provider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Un despliegue renombra los trozos de código que se cargan bajo demanda. Una
// pestaña abierta desde antes pide nombres que ya no existen y recibe HTML
// donde espera JavaScript. Esto lo detecta y recarga, una vez.
import { recargarSiLaVersionCambio } from '@/lib/versionNueva'
recargarSiLaVersionCambio();

// Initialize i18n before rendering
import { initI18n } from '@/i18n'
initI18n();

// Initialize analytics — captures UTM params, then dynamically
// loads GA4 + Microsoft Clarity (+ Meta Pixel when the ID is
// filled in). Skipped in dev unless VITE_ANALYTICS_FORCE_ON=1.
import { initAnalytics } from '@/lib/analytics'
initAnalytics();

// Wire exégesis pricing telemetry into the existing trackUserActivity
// callable so the 6 events (reserve_attempted/_succeeded/exceeded/
// refunded/pack.purchased/upgrade.cta_clicked) reach `user_activities`.
import { setExegesisPricingTracker } from '@dosfilos/application'
import { getFunctions, httpsCallable } from 'firebase/functions'
setExegesisPricingTracker((event, metadata) => {
    try {
        const trackFn = httpsCallable(getFunctions(), 'trackUserActivity');
        void trackFn({
            eventType: 'feature_used',
            metadata: { feature: 'exegesis_pricing', event, ...metadata },
            sessionId: sessionStorage.getItem('sessionId') || undefined,
        }).catch((err) => console.debug('[exegesis-tracker]', err));
    } catch (err) {
        console.debug('[exegesis-tracker] init failed', err);
    }
});

// Create a client
const queryClient = new QueryClient();

// Suppress known Excalidraw warning about controlled/uncontrolled inputs
// This is a known issue in the Excalidraw library and doesn't affect functionality
const originalError = console.error;
console.error = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('A component is changing a controlled input to be uncontrolled')
  ) {
    return;
  }
  originalError.apply(console, args);
};


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="dosfilos-ui-theme">
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
