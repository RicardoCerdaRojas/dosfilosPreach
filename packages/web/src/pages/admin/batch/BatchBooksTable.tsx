import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Loader2, Scale, Upload } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBatchActions, type ResumenDeLote } from '@/hooks/admin/useBatchJobs';
import { aplicablesSinPreguntar } from '@/lib/loteReport';

type Libro = ResumenDeLote['libros'][number];
const mensaje = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Los libros de un lote con lo que se puede hacer con cada uno (PR 3):
 * «Comparar» mide el texto nuevo contra el actual sin tocar el libro;
 * «Aplicar» lo reemplaza si mejora sin perder nada (con respaldo). Con tramos
 * que fallaron, aplicar pide confirmación: lo que falte queda como estaba.
 */
export function BatchBooksTable({ lote, autores }: { lote: ResumenDeLote; autores?: ReadonlyMap<string, string> }) {
    const { t } = useTranslation('admin');
    const { comparar, aplicar } = useBatchActions();
    const [ocupados, setOcupados] = useState<ReadonlySet<string>>(new Set());
    const [aceptar, setAceptar] = useState<Libro | null>(null);
    const [todos, setTodos] = useState(false);

    const conOcupado = async (rid: string, trabajo: () => Promise<void>) => {
        setOcupados(prev => new Set(prev).add(rid));
        try { await trabajo(); } finally {
            setOcupados(prev => { const sig = new Set(prev); sig.delete(rid); return sig; });
        }
    };
    const compararUno = (b: Libro) => conOcupado(b.rid, async () => {
        try { await comparar.mutateAsync({ loteId: lote.id, rid: b.rid }); } catch (err) { toast.error(`${b.titulo}: ${mensaje(err)}`); }
    });
    const aplicarUno = (b: Libro, aceptarIncompletos: boolean) => conOcupado(b.rid, async () => {
        try {
            const r = await aplicar.mutateAsync({ loteId: lote.id, rid: b.rid, aceptarIncompletos });
            toast.success(r.reemplazado ? t('batch.apply.done', { titulo: b.titulo }) : t('batch.apply.kept', { titulo: b.titulo, motivo: r.motivo }));
        } catch (err) { toast.error(`${b.titulo}: ${mensaje(err)}`); }
    });
    // De a uno: cada aplicación baja y escribe un libro entero.
    const compararTodos = async () => { for (const b of lote.libros.filter(x => x.listo)) await compararUno(b); };
    const aplicarTodos = async () => { for (const b of aplicablesSinPreguntar(lote.libros)) await aplicarUno(b, false); };
    const listos = lote.libros.filter(b => b.listo);
    const mejoran = aplicablesSinPreguntar(lote.libros);
    const trabajando = ocupados.size > 0;

    return (
        <div className="space-y-3">
            {listos.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => void compararTodos()} disabled={trabajando}>
                        <Scale className="h-4 w-4" /><span className="ml-1.5">{t('batch.apply.compareAll', { count: listos.length })}</span>
                    </Button>
                    <Button size="sm" onClick={() => setTodos(true)} disabled={trabajando || mejoran.length === 0}>
                        <Upload className="h-4 w-4" /><span className="ml-1.5">{t('batch.apply.applyAll', { count: mejoran.length })}</span>
                    </Button>
                    <span className="text-xs text-muted-foreground">{t('batch.apply.hint')}</span>
                </div>
            )}
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('batch.candidates.book')}</TableHead>
                            <TableHead className="text-right">{t('batch.candidates.pages')}</TableHead>
                            <TableHead>{t('batch.jobs.sections')}</TableHead>
                            <TableHead>{t('batch.apply.comparison')}</TableHead>
                            <TableHead><span className="sr-only">{t('batch.apply.actions')}</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {lote.libros.map(b => {
                            const c = b.comparacion;
                            const ocupado = ocupados.has(b.rid);
                            return (
                                <TableRow key={b.rid} data-testid={`libro-${b.rid}`}>
                                    <TableCell className="max-w-[18rem]">
                                        <div className="truncate font-medium">{b.titulo}</div>
                                        {(b.autor || autores?.get(b.rid)) && (
                                            <div className="truncate text-xs text-muted-foreground">{b.autor || autores?.get(b.rid)}</div>
                                        )}
                                        {b.estado !== 'preparado' && (
                                            <div className="text-xs text-muted-foreground">{t(`batch.jobs.book.${b.estado}`)}{b.motivo ? `: ${b.motivo}` : ''}</div>
                                        )}
                                        {/* Tres y un resumen: la lista entera estiraba la fila (16 tramos en un libro). */}
                                        {b.fallas.slice(0, 3).map(f => <div key={f} className="truncate text-xs text-muted-foreground" title={f}>{f}</div>)}
                                        {b.tramos.fallo + b.tramos.incompleto > 3 && (
                                            <div className="text-xs text-muted-foreground">{t('batch.apply.moreSections', { count: b.tramos.fallo + b.tramos.incompleto - 3 })}</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">{b.paginas ?? '—'}</TableCell>
                                    <TableCell className="text-xs">
                                        {t('batch.jobs.bookSections', { ok: b.tramos.ok, pendiente: b.tramos.pendiente, fallas: b.tramos.fallo + b.tramos.incompleto })}
                                    </TableCell>
                                    <TableCell className="max-w-[20rem] text-xs">
                                        {c ? (
                                            <div className="space-y-0.5">
                                                <div className="font-medium text-foreground">{c.reemplazar ? t('batch.apply.improves') : t('batch.apply.keeps')}</div>
                                                <div className="text-muted-foreground">
                                                    {t('batch.apply.numbers', {
                                                        faltan: `${c.actual.faltantes} → ${c.nueva.faltantes}`,
                                                        hebreo: `${c.actual.hebreo} → ${c.nueva.hebreo}`,
                                                        griego: `${c.actual.griego} → ${c.nueva.griego}`,
                                                    })}
                                                </div>
                                                <div className="text-muted-foreground">{c.motivo}</div>
                                                {c.rellenadas > 0 && <div className="text-muted-foreground">{t('batch.apply.filled', { count: c.rellenadas })}</div>}
                                                {(c.conservadas?.length ?? 0) > 0 && (
                                                    <div className="text-foreground">
                                                        {t('batch.apply.keptPages', {
                                                            count: c.conservadasTotal ?? c.conservadas!.length,
                                                            paginas: c.conservadas!.slice(0, 8).map(p => p.pagina).join(', ') + ((c.conservadasTotal ?? c.conservadas!.length) > 8 ? '…' : ''),
                                                        })}
                                                    </div>
                                                )}
                                                {b.comparacionVieja && <div className="text-foreground">{t('batch.apply.stale')}</div>}
                                            </div>
                                        ) : <span className="text-muted-foreground">—</span>}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-right">
                                        {b.aplicado?.reemplazado ? (
                                            <Badge variant="secondary" className="bg-success-subtle font-normal text-success-subtle-foreground">
                                                <Check className="mr-1 h-3 w-3" />{t('batch.apply.applied')}
                                            </Badge>
                                        ) : b.aplicado && !b.listo ? (
                                            // Se comparó al aplicar y no mejoraba: neutro, no un «hecho» verde.
                                            <Badge variant="secondary" className="bg-muted font-normal text-foreground">{t('batch.apply.unchanged')}</Badge>
                                        ) : b.listo ? (
                                            <div className="inline-flex gap-1.5">
                                                <Button size="sm" variant="outline" onClick={() => void compararUno(b)} disabled={ocupado}>
                                                    {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : t('batch.apply.compare')}
                                                </Button>
                                                <Button size="sm" onClick={() => (b.incompletos > 0 ? setAceptar(b) : void aplicarUno(b, false))} disabled={ocupado}>
                                                    {t('batch.apply.apply')}
                                                </Button>
                                            </div>
                                        ) : null}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
            <ConfirmDialog
                open={aceptar !== null}
                onOpenChange={o => { if (!o) setAceptar(null); }}
                destructive={false}
                title={t('batch.apply.incompleteTitle', { titulo: aceptar?.titulo ?? '' })}
                body={t('batch.apply.incompleteBody', { count: aceptar?.incompletos ?? 0 })}
                confirmLabel={t('batch.apply.incompleteConfirm')}
                cancelLabel={t('batch.launch.cancel')}
                onConfirm={() => { if (aceptar) void aplicarUno(aceptar, true); setAceptar(null); }}
            />
            <ConfirmDialog
                open={todos}
                onOpenChange={setTodos}
                destructive={false}
                title={t('batch.apply.applyAllTitle', { count: mejoran.length })}
                body={t('batch.apply.applyAllBody')}
                confirmLabel={t('batch.apply.applyAll', { count: mejoran.length })}
                cancelLabel={t('batch.launch.cancel')}
                onConfirm={() => void aplicarTodos()}
            />
        </div>
    );
}
