import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { Card } from '@/components/ui/card';
import { useBatchActions, type ResumenDeLote } from '@/hooks/admin/useBatchJobs';
import { BatchJobCard } from './BatchJobCard';

const mensaje = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Los lotes lanzados desde el panel, el más nuevo primero, con sus botones. */
export function BatchJobs({ lotes, cargando, error }: { lotes: ResumenDeLote[] | undefined; cargando: boolean; error: unknown }) {
    const { t } = useTranslation('admin');
    const { reintentar, cancelar } = useBatchActions();
    const ocupado = (id: string) => (reintentar.isPending && reintentar.variables?.loteId === id) || (cancelar.isPending && cancelar.variables?.loteId === id);

    if (cargando) return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />;
    if (error) return <Card className="border-destructive p-4 text-sm text-foreground">{t('batch.jobs.loadError')}</Card>;
    if (!lotes || lotes.length === 0) return <Card className="p-6 text-sm text-muted-foreground">{t('batch.jobs.empty')}</Card>;

    return (
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('batch.jobs.hint')}</p>
            {lotes.map(l => (
                <BatchJobCard
                    key={l.id}
                    lote={l}
                    ocupado={ocupado(l.id)}
                    onReintentar={() => reintentar.mutate({ loteId: l.id }, {
                        onSuccess: r => toast.success(r.ronda === null
                            ? t('batch.jobs.retryNothing', { count: r.abandonadas })
                            : t('batch.jobs.retryDone', { ronda: r.ronda, count: r.libros })),
                        onError: err => toast.error(mensaje(err)),
                    })}
                    onCancelar={() => cancelar.mutate({ loteId: l.id }, {
                        onSuccess: () => toast.success(t('batch.jobs.cancelDone')),
                        onError: err => toast.error(mensaje(err)),
                    })}
                />
            ))}
        </div>
    );
}
