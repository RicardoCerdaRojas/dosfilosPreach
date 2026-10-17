import { Loader2, MessageSquareText, PanelLeftClose, PanelLeftOpen, Plus, Search, Trash2 } from 'lucide-react';
import type { AlcanceDeConsulta, ConsultaGuardada } from '@dosfilos/infrastructure';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { grupoDeFecha, type GrupoDeFecha } from './presentacion';

const ORDEN: GrupoDeFecha[] = ['hoy', 'ayer', 'semana', 'antes'];

/**
 * El riel de consultas anteriores (rediseño, 2026-10-17): agrupadas por fecha,
 * con un ícono por tipo (búsqueda de temas o pregunta) y un resumen debajo,
 * para que dos entradas con el mismo título se distingan.
 */
export function HistorialDeConsultas({ consultas, cargando, error, actualId, rotuloDeAlcance, onAbrir, onNueva, onBorrar, plegado = false, onPlegar }: {
    consultas: ReadonlyArray<ConsultaGuardada>;
    cargando: boolean;
    error: boolean;
    actualId: string | null;
    rotuloDeAlcance: (a: AlcanceDeConsulta) => string;
    onAbrir: (id: string) => void;
    onNueva: () => void;
    onBorrar: (id: string) => void;
    /** Plegado (sólo en pantallas anchas): un riel con «abrir» y «nueva», y la consulta usa el ancho. */
    plegado?: boolean;
    onPlegar?: (plegado: boolean) => void;
}) {
    const { t } = useTranslation('library');
    const grupos = ORDEN
        .map(g => ({ grupo: g, items: consultas.filter(c => grupoDeFecha(c.actualizada) === g) }))
        .filter(g => g.items.length > 0);
    const resumen = (c: ConsultaGuardada) => c.tipo === 'temas'
        ? t('consult.historyTopicMeta', { count: c.temas?.libros.reduce((n, l) => n + l.hojas.length, 0) ?? 0 })
        : t('consult.historyAskMeta', { count: c.turnos.length });

    const icono = 'inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

    // Plegado vale sólo en pantallas anchas: en una angosta (un iPad que gira,
    // una ventana que se achica) el historial se ve completo, o no quedaría
    // ni la lista ni «Nueva».
    if (plegado) {
        return (<>
            <nav className="hidden flex-col items-center gap-1 lg:flex" aria-label={t('consult.history')}>
                <button type="button" onClick={() => onPlegar?.(false)} aria-label={t('consult.historyOpen')} title={t('consult.historyOpen')} className={icono}>
                    <PanelLeftOpen className="h-4 w-4" />
                </button>
                <button type="button" onClick={onNueva} aria-label={t('consult.new')} title={t('consult.new')} className={icono}>
                    <Plus className="h-4 w-4" />
                </button>
            </nav>
            <div className="lg:hidden">
                <HistorialDeConsultas {...{ consultas, cargando, error, actualId, rotuloDeAlcance, onAbrir, onNueva, onBorrar }} />
            </div>
        </>);
    }

    return (
        <nav className="flex flex-col gap-4" aria-label={t('consult.history')}>
            {/* «Nueva» chico en el encabezado: el botón negro de ancho completo
                era lo más oscuro de la pantalla y competía con el botón principal. */}
            <div className="flex items-center gap-1 pl-2.5">
                <h2 className="m-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t('consult.history')}</h2>
                <button
                    type="button"
                    onClick={onNueva}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <Plus className="h-3.5 w-3.5" />
                    {t('consult.newShort')}
                </button>
                {onPlegar && (
                    <button type="button" onClick={() => onPlegar(true)} aria-label={t('consult.historyClose')} title={t('consult.historyClose')} className={cn(icono, 'hidden lg:inline-flex')}>
                        <PanelLeftClose className="h-4 w-4" />
                    </button>
                )}
            </div>

            {cargando ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
            ) : error ? (
                <p className="text-sm text-muted-foreground">{t('consult.historyError')}</p>
            ) : consultas.length === 0 ? (
                <p className="px-2 text-sm text-muted-foreground">{t('consult.historyEmpty')}</p>
            ) : (
                <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto pr-1">
                    {grupos.map(({ grupo, items }) => (
                        <section key={grupo} className="flex flex-col gap-1">
                            <h2 className="px-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t(`consult.group_${grupo}`)}</h2>
                            <ul className="flex flex-col gap-1">
                                {items.map(c => {
                                    const actual = c.id === actualId;
                                    return (
                                        <li key={c.id} className="group relative">
                                            <button
                                                type="button"
                                                onClick={() => onAbrir(c.id)}
                                                aria-current={actual ? 'true' : undefined}
                                                className={cn(
                                                    'flex w-full gap-2.5 rounded-xl border p-2.5 pr-9 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                    actual ? 'border-border bg-card shadow-sm' : 'border-transparent hover:bg-muted',
                                                )}
                                            >
                                                <span
                                                    role="img"
                                                    aria-label={c.tipo === 'temas' ? t('consult.savedTopic') : t('consult.savedQuestion')}
                                                    className={cn('flex h-7 w-7 flex-none items-center justify-center rounded-lg', actual ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}
                                                >
                                                    {c.tipo === 'temas' ? <Search className="h-3.5 w-3.5" /> : <MessageSquareText className="h-3.5 w-3.5" />}
                                                </span>
                                                <span className="flex min-w-0 flex-col gap-0.5">
                                                    <span className={cn('line-clamp-2 text-sm leading-snug', actual ? 'font-semibold text-foreground' : 'text-foreground/85')}>{c.titulo}</span>
                                                    <span className="truncate text-xs text-muted-foreground">{resumen(c)} · {rotuloDeAlcance(c.alcance)}</span>
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onBorrar(c.id)}
                                                aria-label={t('consult.delete')}
                                                className="absolute right-1.5 top-2 rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:opacity-0 md:group-hover:opacity-100"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </div>
            )}
        </nav>
    );
}
