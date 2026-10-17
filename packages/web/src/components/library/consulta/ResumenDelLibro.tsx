import { useEffect, useRef, useState } from 'react';
import { BookMarked, X } from 'lucide-react';
import { resumirEnBiblioteca, type PedidoDeResumen, type ResumenDeLibro } from '@dosfilos/infrastructure';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { TextoConEscrituras } from './TextoConEscrituras';

/**
 * Un resumen breve de la biblioteca (fase «biblioteca consultable», U7): el
 * mapa del libro o el capítulo donde se está leyendo. Se pide al montarse; el
 * servidor lo guarda, así que verlo otra vez no cuesta ni cuenta. Cada tema o
 * idea lleva sus páginas, que abren el libro ahí.
 */
export function ResumenDelLibro({ id, pedido, paginaDeHoja, onIrAHoja, onCerrar, compacta = false }: {
    /** Para el `aria-controls` del botón que lo abre. */
    id?: string;
    pedido: PedidoDeResumen;
    /** La página impresa de una hoja («p. 188»), con la numeración calibrada del libro. */
    paginaDeHoja: (hoja: number) => string;
    onIrAHoja: (hoja: number) => void;
    onCerrar?: () => void;
    compacta?: boolean;
}) {
    const { t } = useTranslation('library');
    const [resumen, setResumen] = useState<ResumenDeLibro | null>(null);
    const [error, setError] = useState<string | null>(null);
    const clave = JSON.stringify(pedido);
    // El pedido se repite sólo si cambia el pedido, no si cambia `t`.
    const tRef = useRef(t);
    tRef.current = t;

    useEffect(() => {
        let vigente = true;
        setResumen(null);
        setError(null);
        resumirEnBiblioteca(JSON.parse(clave) as PedidoDeResumen)
            .then(r => { if (vigente) setResumen(r); })
            .catch(err => {
                if (!vigente) return;
                const mensaje = err instanceof Error ? err.message : String(err);
                // Los del servidor vienen en español; los de transporte («internal»), no.
                setError(/\s/.test(mensaje) ? mensaje : tRef.current('consult.errorGeneric'));
            });
        return () => { vigente = false; };
    }, [clave]);

    const titulo = pedido.tipo === 'mapa'
        ? t('consult.summary.mapTitle')
        : resumen?.titulo
            ? t('consult.summary.sectionTitle', { titulo: resumen.titulo })
            : resumen?.desde != null && resumen.hasta != null
                ? t('consult.summary.rangeTitle', { desde: paginaDeHoja(resumen.desde), hasta: paginaDeHoja(resumen.hasta) })
                : t('consult.summary.sectionTitleLoading');

    return (
        <section
            id={id}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
            aria-label={titulo}
            data-testid="resumen-del-libro"
        >
            <header className="mb-3 flex items-start gap-2">
                <BookMarked className="mt-0.5 h-4 w-4 shrink-0 text-warning-subtle-foreground" aria-hidden="true" />
                <h3 className="flex-1 font-serif text-[15px] font-bold leading-snug text-foreground">{titulo}</h3>
                {onCerrar && (
                    <button
                        type="button"
                        onClick={onCerrar}
                        aria-label={t('consult.summary.close')}
                        className="-m-1 inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8 sm:w-8"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </header>

            {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}

            {!resumen && !error && (
                <div className="space-y-2" role="status" aria-label={pedido.tipo === 'mapa' ? t('consult.summary.loadingMap') : t('consult.summary.loadingSection')}>
                    <p className="text-sm text-muted-foreground">{pedido.tipo === 'mapa' ? t('consult.summary.loadingMap') : t('consult.summary.loadingSection')}</p>
                    <div className="h-3 animate-pulse rounded bg-muted" />
                    <div className="h-3 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                </div>
            )}

            {resumen && (
                <div className="space-y-4">
                    <p className={cn('font-serif leading-[1.8] text-foreground/90', compacta ? 'text-sm' : 'text-[15px]')}>
                        <TextoConEscrituras texto={resumen.resumen} />
                    </p>
                    {resumen.puntos.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                {pedido.tipo === 'mapa' ? t('consult.summary.themes') : t('consult.summary.ideas')}
                            </h4>
                            <ul className="m-0 list-none space-y-2 p-0">
                                {resumen.puntos.map((p, i) => (
                                    <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-foreground/90">
                                        <span className="font-serif"><TextoConEscrituras texto={p.texto} /></span>
                                        {p.hojas.map(h => (
                                            <button
                                                key={h}
                                                type="button"
                                                onClick={() => onIrAHoja(h)}
                                                className="inline-flex min-h-11 items-center rounded bg-secondary/25 px-2 font-bible text-[14px] font-semibold text-foreground hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0 sm:px-1.5"
                                            >
                                                {paginaDeHoja(h)}
                                            </button>
                                        ))}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                        {resumen.guardado ? t('consult.summary.saved') : resumen.sinGuardar ? t('consult.summary.countedUnsaved') : t('consult.summary.counted')}
                    </p>
                </div>
            )}
        </section>
    );
}
