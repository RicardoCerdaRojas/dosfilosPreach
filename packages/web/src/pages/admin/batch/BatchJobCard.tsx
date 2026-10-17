import { useState } from 'react';
import { ChevronDown, Loader2, RotateCcw, XCircle } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { estimar } from '@/lib/loteReport';
import type { EstadoDelLote, ResumenDeLote } from '@/hooks/admin/useBatchJobs';
import { formatUsd } from '../extraction-runs/format';
import { BatchBooksTable } from './BatchBooksTable';

// Texto en `foreground` o en su par `*-subtle-foreground`: AA sobre el fondo suave.
const TONO: Record<EstadoDelLote, string> = {
    preparando: 'bg-info-subtle text-info-subtle-foreground',
    'en-curso': 'bg-info-subtle text-info-subtle-foreground',
    listo: 'bg-success-subtle text-success-subtle-foreground',
    cancelado: 'bg-muted text-foreground',
    fallido: 'border border-destructive/50 bg-destructive/10 text-foreground',
};

/**
 * Un lote: estado, avance de los tramos, rondas, costo real contra el
 * estimado y los libros. «Reintentar» abre una ronda con lo que falló;
 * «Cancelar» corta lo que esté en curso (lo ya leído se conserva).
 */
export function BatchJobCard({ lote, onReintentar, onCancelar, ocupado }: {
    lote: ResumenDeLote;
    onReintentar: () => void;
    onCancelar: () => void;
    ocupado: boolean;
}) {
    const { t, i18n } = useTranslation('admin');
    const [cancelar, setCancelar] = useState(false);
    const [reintentar, setReintentar] = useState(false);
    // Lo que costaría como mucho: el plan del servidor puede abandonar páginas en blanco y pedir menos.
    const costoDelReintento = estimar([{ paginas: lote.paginasConFallas, pdfPageCount: lote.paginasConFallas }]).loteUsd;
    const vivos = lote.tramos.ok + lote.tramos.pendiente + lote.tramos.fallo + lote.tramos.incompleto;
    const avance = vivos === 0 ? 0 : Math.round((100 * lote.tramos.ok) / vivos);
    const fecha = new Date(lote.creado).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
    const conFallas = lote.tramos.fallo + lote.tramos.incompleto;

    return (
        <Card className="space-y-4 p-5" data-testid={`lote-${lote.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{lote.id}</h3>
                        <Badge variant="secondary" className={cn('font-normal', TONO[lote.estado])}>{t(`batch.jobs.state.${lote.estado}`)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {t('batch.jobs.meta', { fecha, count: lote.libros.length, paginas: lote.paginas, por: lote.creadoPorEmail ?? '—' })}
                    </p>
                    {lote.motivo && <p className="text-sm text-foreground">{lote.motivo}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                    {lote.puedeReintentar && (
                        <Button size="sm" variant="outline" onClick={() => setReintentar(true)} disabled={ocupado}>
                            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                            <span className="ml-1.5">{t('batch.jobs.retry', { count: conFallas })}</span>
                        </Button>
                    )}
                    {lote.puedeCancelar && (
                        <Button size="sm" variant="outline" onClick={() => setCancelar(true)} disabled={ocupado}>
                            <XCircle className="h-4 w-4" />
                            <span className="ml-1.5">{t('batch.jobs.cancel')}</span>
                        </Button>
                    )}
                </div>
            </div>

            <div className="space-y-1.5">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span>{t('batch.jobs.progress', { ok: lote.tramos.ok, total: vivos })}</span>
                    <span className="tabular-nums">
                        {t('batch.jobs.cost', { usd: formatUsd(lote.usd), estimado: formatUsd(lote.estimadoUsd) })}
                    </span>
                </div>
                <Progress value={avance} className="h-2" aria-label={t('batch.jobs.progressLabel', { pct: avance })} />
                <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-muted-foreground">
                    {lote.tramos.pendiente > 0 && <li>{t('batch.jobs.counts.pendiente', { count: lote.tramos.pendiente })}</li>}
                    {lote.tramos.incompleto > 0 && <li>{t('batch.jobs.counts.incompleto', { count: lote.tramos.incompleto })}</li>}
                    {lote.tramos.fallo > 0 && <li>{t('batch.jobs.counts.fallo', { count: lote.tramos.fallo })}</li>}
                    {lote.tramos.abandonado > 0 && <li>{t('batch.jobs.counts.abandonado', { count: lote.tramos.abandonado })}</li>}
                    {lote.rondas.map(r => (
                        <li key={r.numero}>{t('batch.jobs.round', { numero: r.numero, count: r.tramos, estado: r.leida ? t('batch.jobs.roundRead') : t('batch.jobs.roundRunning') })}</li>
                    ))}
                </ul>
            </div>

            <Collapsible defaultOpen={lote.libros.some(b => b.listo && !b.aplicado)}>
                <CollapsibleTrigger className="group inline-flex min-h-9 items-center gap-1 rounded-md text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                    {t('batch.jobs.books', { count: lote.libros.length })}
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                    <BatchBooksTable lote={lote} />
                </CollapsibleContent>
            </Collapsible>

            <ConfirmDialog
                open={reintentar}
                onOpenChange={setReintentar}
                destructive={false}
                title={t('batch.jobs.retryTitle', { nombre: lote.id })}
                body={t('batch.jobs.retryBody', { count: lote.paginasConFallas, usd: formatUsd(costoDelReintento) })}
                confirmLabel={t('batch.jobs.retryConfirm', { usd: formatUsd(costoDelReintento) })}
                cancelLabel={t('batch.launch.cancel')}
                onConfirm={onReintentar}
            />
            <ConfirmDialog
                open={cancelar}
                onOpenChange={setCancelar}
                title={t('batch.jobs.cancelTitle', { nombre: lote.id })}
                body={t('batch.jobs.cancelBody')}
                confirmLabel={t('batch.jobs.cancelConfirm')}
                cancelLabel={t('batch.launch.cancel')}
                onConfirm={onCancelar}
            />
        </Card>
    );
}
