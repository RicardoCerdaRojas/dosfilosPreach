import { useEffect, useRef, useState } from 'react';
import { SourceViewerProvider, SourceViewerSlot } from '@/components/exegesis/citation/SourceViewerProvider';
import { Outlet, useLocation } from 'react-router-dom';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { BarraDePaginaContexto } from './barra-de-pagina-contexto';
import { PreferenciasDeVista } from './preferencias-de-vista';
import { useSmartTriggers } from '@/hooks/useSmartTriggers';
import { useLibrarySync } from '@/hooks/library';
import { FloatingHelpButton } from '@/components/onboarding';
import { DashboardTour, useDashboardTourTrigger } from '@/components/onboarding/DashboardTour';
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner';

export function DashboardLayout() {
  const location = useLocation();
  const isPlanner = location.pathname.includes('/planner');
  const isGenerator = location.pathname.includes('/sermons/generate');

  // Initialize Smart Triggers
  useSmartTriggers();

  // Single Firestore listener for the user's library — every consumer reads from the cache this hook keeps fresh.
  useLibrarySync();

  // Spotlight tour fires once after the onboarding wizard completes — runs
  // here at the layout level (not the dashboard page) so the sidebar is
  // always mounted as the Joyride target.
  const tour = useDashboardTourTrigger();

  // Track dashboard visits for "Stuck User" trigger
  useEffect(() => {
    if (location.pathname === '/dashboard') {
        const visits = parseInt(localStorage.getItem('dashboard_visits') || '0');
        localStorage.setItem('dashboard_visits', (visits + 1).toString());
    }
  }, [location.pathname]);

  const isBible = location.pathname.includes('/bible');
  const isSermonDetail = location.pathname.startsWith('/dashboard/sermons/') && location.pathname !== '/dashboard/sermons';
  // El selector de hojas maneja su propio alto: tres paneles que scrollean por
  // separado. Sin esto, el shell agrega su scroll y su padding, y la página
  // queda más alta que el viewport.
  const isSourcePages = /\/dashboard\/exegesis\/[^/]+\/fuentes\/[^/]+\/paginas$/.test(location.pathname);
  const [espacioDeLaBarra, setEspacioDeLaBarra] = useState<HTMLDivElement | null>(null);
  const isFullScreen = isPlanner || isGenerator || isSermonDetail || isBible || isSourcePages;

  return (
    <SourceViewerProvider>
    <BarraDePaginaContexto.Provider value={espacioDeLaBarra}>
    <SidebarProvider>
      <AutoCollapseOnFaculty />
      <AppSidebar />
      <SidebarInset className={cn(
        isFullScreen ? "h-svh overflow-hidden print:h-auto print:overflow-visible" : "min-h-svh print:h-auto", 
        isFullScreen && "md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:rounded-none"
      )}>
        {/* Impersonation banner — only renders while a super admin views as another user */}
        <ImpersonationBanner />

        {/* La barra única de la app (fase «barra única», 2026-10-17): el menú,
            el espacio donde cada página pone su título, pestañas y botones
            (`<BarraDePagina>`), e idioma y tema en un solo botón. */}
        {/* En el teléfono la barra puede tener dos filas: los controles de la
            página bajan a la segunda (ver `BarraDePagina`). */}
        <header className="flex min-h-[var(--alto-barra)] shrink-0 items-center gap-3 border-b bg-background px-3 py-1.5 sm:h-[var(--alto-barra)] sm:px-4 sm:py-0">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <div ref={setEspacioDeLaBarra} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 sm:flex-nowrap sm:gap-4" />
          <Separator orientation="vertical" className="h-4" />
          <PreferenciasDeVista />
        </header>
        
        {/* Main content + el visor de fuente en su propia columna: abierto en
            panel, el contenido se angosta en vez de quedar tapado. */}
        <div className={cn("flex flex-1 min-h-0", isFullScreen && "overflow-hidden")}>
          <main className={cn(
            "flex-1 min-w-0 flex flex-col print:block print:overflow-visible print:h-auto",
            // Apps that need full height control (no parent scroll, no parent padding)
            isFullScreen ? "overflow-hidden h-full" : "overflow-y-auto bg-muted/40 p-4 md:p-2"
          )}>
            <Outlet />
          </main>
          <SourceViewerSlot />
        </div>
      </SidebarInset>
      <FloatingHelpButton />
      <DashboardTour run={tour.run} onComplete={tour.markComplete} />
    </SidebarProvider>
    </BarraDePaginaContexto.Provider>
    </SourceViewerProvider>
  );
}

/**
 * Collapses the global app sidebar when the user enters /dashboard/faculty/*.
 * The Faculty module owns its own session list + extraction panel, so the
 * outer rail competes for horizontal space. We collapse on entry only —
 * once inside, manual expand is respected until the user leaves and re-enters.
 */
function AutoCollapseOnFaculty() {
  const { setOpen, isMobile } = useSidebar();
  const location = useLocation();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevPathRef.current;
    const curr = location.pathname;
    const wasFaculty = prev !== null && prev.includes('/dashboard/faculty');
    const isFaculty = curr.includes('/dashboard/faculty');
    if (!wasFaculty && isFaculty && !isMobile) {
      setOpen(false);
    }
    prevPathRef.current = curr;
  }, [location.pathname, isMobile, setOpen]);

  return null;
}
