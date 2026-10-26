import { useTranslation } from '@/i18n';

/**
 * Lo que se ve mientras llega la lista de proyectos en una carga en frío.
 * Antes el panel decía «Proyecto no encontrado» un instante, porque buscaba el
 * proyecto en una lista todavía vacía. Repite la forma del panel (cabecera,
 * recorrido, dos tarjetas) para que la página no salte al llegar los datos.
 */
export function ProjectDashboardSkeleton() {
    const { t } = useTranslation('projects');
    return (
        <div className="flex-1 overflow-y-auto bg-background">
            <div
                role="status"
                aria-label={t('loading.project')}
                data-testid="project-dashboard-loading"
                className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-5 lg:py-6 space-y-6"
            >
                <div className="space-y-2">
                    <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                    <div className="h-7 w-64 max-w-full rounded bg-muted animate-pulse" />
                </div>
                <div className="h-[132px] rounded-xl border border-border/60 bg-muted/40 animate-pulse" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="h-40 rounded-xl border border-border/60 bg-muted/40 animate-pulse" />
                    <div className="h-40 rounded-xl border border-border/60 bg-muted/40 animate-pulse" />
                </div>
                <span className="sr-only">{t('loading.project')}</span>
            </div>
        </div>
    );
}
