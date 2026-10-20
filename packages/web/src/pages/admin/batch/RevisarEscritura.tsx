import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, ScanSearch } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useBatchActions, type RevisionDeEscritura } from '@/hooks/admin/useBatchJobs';

/**
 * Para un libro ya aplicado: compara su texto con el respaldo de antes del
 * lote y repone las páginas que perdieron griego o hebreo. Los libros
 * aplicados antes de la protección por página (2026-10-19) pueden tenerlas.
 */
export function RevisarEscritura({ rid, lote, titulo }: { rid: string; lote: string; titulo: string }) {
    const { t } = useTranslation('admin');
    const { revisarEscritura } = useBatchActions();
    const [revision, setRevision] = useState<RevisionDeEscritura | null>(null);
    const [confirmar, setConfirmar] = useState(false);
    const ocupado = revisarEscritura.isPending && revisarEscritura.variables?.rid === rid;

    const correr = (escribir: boolean) => revisarEscritura.mutate({ rid, lote, escribir }, {
        onSuccess: r => {
            setRevision(r);
            if (escribir && r.repuestas.length > 0) toast.success(t('batch.restore.done', { titulo, count: r.repuestas.length }));
        },
        onError: err => toast.error(`${titulo}: ${err instanceof Error ? err.message : String(err)}`),
    });

    const paginas = revision?.paginas ?? [];
    const total = revision?.total ?? paginas.length;
    return (
        // `whitespace-normal`: la celda de la tabla es `nowrap` y el aviso la ensanchaba.
        <div className="flex max-w-[22rem] flex-col items-end gap-1 whitespace-normal text-right">
            {!revision || revision.repuestas.length > 0 ? (
                <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2 text-xs" onClick={() => correr(false)} disabled={ocupado}>
                    {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}
                    {t('batch.restore.check')}
                </Button>
            ) : null}
            {/* Siempre montado: un `role="status"` que aparece junto con su texto no siempre se anuncia. */}
            <div className="text-xs" role="status">
            {revision && (
                <div>
                    {revision.repuestas.length > 0 ? (
                        <span className="text-foreground">{t('batch.restore.restored', { count: revision.repuestas.length, paginas: revision.repuestas.join(', ') })}</span>
                    ) : revision.libroEntero ? (
                        <span className={revision.libroEntero.pierde ? 'text-foreground' : 'text-muted-foreground'}>
                            {revision.libroEntero.pierde
                                ? t('batch.restore.wholeBookLost', {
                                    griegoAntes: revision.libroEntero.griego.antes, griegoDespues: revision.libroEntero.griego.despues,
                                    hebreoAntes: revision.libroEntero.hebreo.antes, hebreoDespues: revision.libroEntero.hebreo.despues,
                                })
                                : t('batch.restore.wholeBookNone')}
                            {revision.libroEntero.recortado ? ` ${t('batch.restore.wholeBookTruncated')}` : null}
                        </span>
                    ) : revision.desalineado ? (
                        <span className="text-foreground">{t('batch.restore.misaligned')}</span>
                    ) : paginas.length === 0 ? (
                        <span className="text-muted-foreground">{t('batch.restore.none')}</span>
                    ) : (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <span className="text-foreground">
                                {t('batch.restore.found', { count: total, paginas: paginas.slice(0, 12).map(p => p.pagina).join(', ') + (total > 12 ? '…' : '') })}
                            </span>
                            <Button size="sm" className="h-8" onClick={() => setConfirmar(true)} disabled={ocupado}>
                                {t('batch.restore.restore', { count: total })}
                            </Button>
                        </div>
                    )}
                </div>
            )}
            </div>
            <ConfirmDialog
                open={confirmar}
                onOpenChange={setConfirmar}
                destructive={false}
                title={t('batch.restore.confirmTitle', { titulo })}
                body={t('batch.restore.confirmBody', { count: total, lote })}
                confirmLabel={t('batch.restore.restore', { count: total })}
                cancelLabel={t('batch.launch.cancel')}
                onConfirm={() => correr(true)}
            />
        </div>
    );
}
