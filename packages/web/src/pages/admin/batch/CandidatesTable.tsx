import { useTranslation } from '@/i18n';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { esRecomendado, type Candidato, type Motivo } from '@/lib/loteReport';

// El texto siempre en `foreground` o en el par `*-subtle-foreground` (AA sobre
// su fondo): `text-destructive` sobre su 10 % no llega a 4,5:1.
const GRAVE = 'border border-destructive/50 bg-destructive/10 text-foreground';
const NEUTRO = 'bg-muted text-foreground';
const TONO: Record<Motivo, string> = {
    faltan: GRAVE,
    vacio: GRAVE,
    fallido: GRAVE,
    sinExtraer: 'bg-warning-subtle text-warning-subtle-foreground',
    sinVision: 'bg-warning-subtle text-warning-subtle-foreground',
    modeloViejo: 'bg-info-subtle text-info-subtle-foreground',
    sinMedir: NEUTRO,
    yaReprocesado: NEUTRO,
    grande: 'bg-warning-subtle text-warning-subtle-foreground',
    enProceso: NEUTRO,
    sinPdf: NEUTRO,
};

const mb = (bytes: number | null) => (bytes === null ? '—' : `${(bytes / 1024 / 1024).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`);

/** Los libros, los más convenientes de reprocesar primero, con su diagnóstico y para elegir. */
export function CandidatesTable({ candidatos, elegidos, onAlternar, onElegirRecomendados }: {
    candidatos: Candidato[];
    elegidos: ReadonlySet<string>;
    onAlternar: (id: string) => void;
    onElegirRecomendados: () => void;
}) {
    const { t } = useTranslation('admin');
    const recomendados = candidatos.filter(esRecomendado).length;
    return (
        <Card className="p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="font-semibold">{t('batch.candidates.title')}</h2>
                    <p className="text-sm text-muted-foreground">{t('batch.candidates.subtitle', { count: recomendados })}</p>
                </div>
                <button
                    type="button"
                    onClick={onElegirRecomendados}
                    disabled={recomendados === 0}
                    className="inline-flex min-h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {t('batch.candidates.pickRecommended')}
                </button>
            </div>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10"><span className="sr-only">{t('batch.candidates.select')}</span></TableHead>
                            <TableHead>{t('batch.candidates.book')}</TableHead>
                            <TableHead>{t('batch.candidates.reasons')}</TableHead>
                            <TableHead className="text-right">{t('batch.candidates.pages')}</TableHead>
                            <TableHead className="text-right">{t('batch.candidates.size')}</TableHead>
                            <TableHead>{t('batch.candidates.reader')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {candidatos.map(c => (
                            <TableRow key={c.id} className={cn(c.excluido && 'bg-muted/40')} data-testid={`candidato-${c.id}`}>
                                <TableCell>
                                    <Checkbox
                                        checked={elegidos.has(c.id)}
                                        disabled={c.excluido}
                                        onCheckedChange={() => onAlternar(c.id)}
                                        aria-label={t('batch.candidates.selectBook', { titulo: c.titulo })}
                                    />
                                </TableCell>
                                <TableCell className="max-w-[22rem]">
                                    <div className="truncate font-medium">{c.titulo || c.id}</div>
                                    {c.excluido && <div className="text-xs text-muted-foreground">{t('batch.candidates.excluded')}</div>}
                                    {c.autor && <div className="truncate text-xs text-muted-foreground">{c.autor}</div>}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {c.motivos.length === 0 && <span className="text-xs text-muted-foreground">{t('batch.reason.none')}</span>}
                                        {c.motivos.map(m => (
                                            <Badge key={m} variant="secondary" className={cn('font-normal', TONO[m])}>
                                                {m === 'faltan'
                                                    ? t('batch.reason.faltan', { faltan: c.paginasFaltantes?.total ?? 0, de: c.paginas ?? '?' })
                                                    : m === 'yaReprocesado'
                                                        ? t('batch.reason.yaReprocesado', { lote: c.reprocesadoEnLote?.lote ?? '' })
                                                        : t(`batch.reason.${m}`)}
                                            </Badge>
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{c.paginas ?? '—'}</TableCell>
                                <TableCell className="text-right tabular-nums">{mb(c.sizeBytes)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    {[c.extractionVersion, c.extractionModel].filter(Boolean).join(' · ') || '—'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </Card>
    );
}
