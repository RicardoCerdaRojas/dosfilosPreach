import { useMemo, useState } from 'react';
import { useTranslation } from '@/i18n';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fidelityAlerts, finalEngine, type ExtractionRun, type RunOutcome } from '@/lib/extractionRunsReport';
import { formatDuration, formatUsd } from './format';

interface RunsTableProps {
    runs: ExtractionRun[];
    titles: Record<string, string>;
}

type Filtro = 'all' | 'failed' | 'alerts';

const COLUMNAS = ['date', 'book', 'engine', 'outcome', 'pages', 'duration', 'cost', 'alerts'] as const;

const TONO: Record<RunOutcome, string> = {
    ready: 'bg-success-subtle text-success-subtle-foreground',
    failed: 'bg-destructive/10 text-destructive',
    stalled: 'bg-destructive/10 text-destructive',
    running: 'bg-info-subtle text-info-subtle-foreground',
    cancelled: 'bg-muted text-muted-foreground',
    superseded: 'bg-muted text-muted-foreground',
};

function pasaFiltro(run: ExtractionRun, filtro: Filtro): boolean {
    if (filtro === 'failed') return run.outcome === 'failed' || run.outcome === 'stalled';
    if (filtro === 'alerts') return fidelityAlerts(run).length > 0;
    return true;
}

export function RunsTable({ runs, titles }: RunsTableProps) {
    const { t, i18n } = useTranslation('admin');
    const [filtro, setFiltro] = useState<Filtro>('all');
    const visibles = useMemo(() => runs.filter((r) => pasaFiltro(r, filtro)), [runs, filtro]);
    const fecha = (iso: string | null) =>
        iso ? new Date(iso).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' }) : '—';

    return (
        <Card className="p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">{t('extractionRuns.runs.title')}</h2>
                <div className="flex items-center gap-2">
                    <Label htmlFor="extraction-runs-filter" className="text-sm text-muted-foreground">
                        {t('extractionRuns.runs.filterLabel')}
                    </Label>
                    <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
                        <SelectTrigger id="extraction-runs-filter" className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {(['all', 'failed', 'alerts'] as const).map((f) => (
                                <SelectItem key={f} value={f}>{t(`extractionRuns.runs.filter.${f}`)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            {visibles.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('extractionRuns.runs.none')}</p>
            ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {COLUMNAS.map((c) => <TableHead key={c}>{t(`extractionRuns.runs.${c}`)}</TableHead>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibles.map((run) => (
                                <RunRow key={run.runId} run={run} title={titles[run.resourceId]} fecha={fecha(run.startedAt)} />
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </Card>
    );
}

interface RunRowProps {
    run: ExtractionRun;
    title: string | undefined;
    fecha: string;
}

function RunRow({ run, title, fecha }: RunRowProps) {
    const { t } = useTranslation('admin');
    const alerts = fidelityAlerts(run);
    const paginas = run.pages?.emitted !== undefined
        ? `${run.pages.emitted}${run.pages.expected ? ` / ${run.pages.expected}` : ''}`
        : '—';
    return (
        <TableRow>
            <TableCell className="whitespace-nowrap text-xs">{fecha}</TableCell>
            <TableCell className="max-w-[16rem]">
                <p className="truncate" title={title}>{title || t('extractionRuns.runs.deletedResource')}</p>
                <p className="text-xs text-muted-foreground">{t(`extractionRuns.path.${run.path}`)}</p>
            </TableCell>
            <TableCell className="whitespace-nowrap">{t(`extractionRuns.engine.${finalEngine(run)}`)}</TableCell>
            <TableCell>
                <span className={`px-2 py-0.5 rounded-full text-xs ${TONO[run.outcome]}`} title={run.reason}>
                    {t(`extractionRuns.outcome.${run.outcome}`)}
                </span>
            </TableCell>
            <TableCell className="whitespace-nowrap">{paginas}</TableCell>
            <TableCell className="whitespace-nowrap">{formatDuration(run.durationMs)}</TableCell>
            <TableCell>{run.llm ? formatUsd(run.llm.usd) : '—'}</TableCell>
            <TableCell>
                <div className="flex flex-wrap gap-1">
                    {alerts.map((a) => (
                        <Badge key={a} variant="outline" className="border-warning/40 text-warning-subtle-foreground">
                            {t(`extractionRuns.alert.${a}`)}
                        </Badge>
                    ))}
                </div>
            </TableCell>
        </TableRow>
    );
}
