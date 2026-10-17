import { useState } from 'react';
import { Check, Copy, Loader2, Play } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { comandoDePreparar, estimar, nombreElegido, type Candidato } from '@/lib/loteReport';
import { cn } from '@/lib/utils';
import { formatUsd } from '../extraction-runs/format';

/**
 * Lo que costaría reprocesar lo elegido, en lote y —para comparar— en línea.
 * «Preparar lote» lo lanza desde el panel, después de confirmar el costo; el
 * comando de la terminal queda para los PDF que sólo ella puede abrir.
 */
export function EstimateBar({ elegidos, onLanzar, lanzando = false }: {
    elegidos: Candidato[];
    /** Lanza el lote con este nombre y su costo estimado. */
    onLanzar?: (nombre: string, estimadoUsd: number) => void;
    lanzando?: boolean;
}) {
    const { t } = useTranslation('admin');
    const [nombre, setNombre] = useState('');
    const [copiado, setCopiado] = useState(false);
    const [confirmar, setConfirmar] = useState(false);
    const e = estimar(elegidos);
    const comando = comandoDePreparar(nombre, elegidos.map(c => c.id));
    const grandes = elegidos.filter(c => c.motivos.includes('grande')).length;

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(comando);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1800);
        } catch { /* sin portapapeles: el comando queda a la vista */ }
    };

    return (
        // Fija abajo sólo con algo elegido: vacía, en el teléfono tapaba la tabla.
        <Card className={cn('space-y-3 p-5', e.libros > 0 && 'sticky bottom-4 shadow-lg')} aria-live="polite" data-testid="estimacion-del-lote">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                <p className="text-sm">
                    <span className="font-semibold">{t('batch.estimate.selection', { count: e.libros })}</span>
                    <span className="text-muted-foreground"> · {t('batch.estimate.pages', { count: e.paginas })}</span>
                </p>
                <p className="text-sm">
                    {t('batch.estimate.batch')} <span className="font-semibold tabular-nums">{formatUsd(e.loteUsd)}</span>
                    <span className="text-muted-foreground"> ({t('batch.estimate.withRetries', { usd: formatUsd(e.conReintentosUsd) })})</span>
                </p>
                <p className="text-sm text-muted-foreground">{t('batch.estimate.online', { usd: formatUsd(e.enLineaUsd) })}</p>
            </div>
            {(e.sinPaginas > 0 || e.paginasAproximadas > 0 || grandes > 0 || e.preciosDuplicados || e.cercaDeLaSuba) && (
                <ul className="m-0 list-disc space-y-1 pl-5 text-xs text-warning-subtle-foreground">
                    {e.sinPaginas > 0 && <li>{t('batch.estimate.noPages', { count: e.sinPaginas })}</li>}
                    {e.paginasAproximadas > 0 && <li>{t('batch.estimate.approxPages', { count: e.paginasAproximadas })}</li>}
                    {grandes > 0 && <li>{t('batch.estimate.large', { count: grandes })}</li>}
                    {e.preciosDuplicados && <li>{t('batch.estimate.doubled')}</li>}
                    {e.cercaDeLaSuba && <li>{t('batch.estimate.nearRise')}</li>}
                </ul>
            )}
            {e.libros > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="nombre-del-lote" className="text-sm text-muted-foreground">{t('batch.estimate.name')}</label>
                    <input
                        id="nombre-del-lote"
                        value={nombre}
                        onChange={ev => setNombre(ev.target.value)}
                        placeholder="biblioteca6"
                        className="h-9 w-40 rounded-md border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    {onLanzar && (
                        <Button size="sm" onClick={() => setConfirmar(true)} disabled={lanzando}>
                            {lanzando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                            <span className="ml-1.5">{t('batch.launch.button')}</span>
                        </Button>
                    )}
                </div>
            )}
            {e.libros > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t('batch.launch.orTerminal')}</span>
                    <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs" title={comando}>{comando}</code>
                    <button
                        type="button"
                        onClick={() => void copiar()}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copiado ? t('batch.estimate.copied') : t('batch.estimate.copy')}
                    </button>
                </div>
            )}
            {onLanzar && (
                <ConfirmDialog
                    open={confirmar}
                    onOpenChange={setConfirmar}
                    destructive={false}
                    title={t('batch.launch.confirmTitle', { nombre: nombreElegido(nombre) })}
                    body={t('batch.launch.confirmBody', { count: e.libros, paginas: e.paginas, usd: formatUsd(e.loteUsd), conReintentos: formatUsd(e.conReintentosUsd) })}
                    confirmLabel={t('batch.launch.confirm', { usd: formatUsd(e.conReintentosUsd) })}
                    cancelLabel={t('batch.launch.cancel')}
                    onConfirm={() => onLanzar(nombreElegido(nombre), e.conReintentosUsd)}
                />
            )}
        </Card>
    );
}
