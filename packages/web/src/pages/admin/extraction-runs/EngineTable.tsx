import { useTranslation } from '@/i18n';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { EngineRow } from '@/lib/extractionRunsReport';
import { formatDuration, formatPct, formatUsd } from './format';

interface EngineTableProps {
    rows: EngineRow[];
}

const COLUMNAS = ['engine', 'runs', 'ready', 'failRate', 'degraded', 'alerts', 'usdPerPage', 'credits', 'median'] as const;

/** Pregunta 1 y 3 de la ficha: qué motor resuelve los libros, a qué costo, y dónde se cae. */
export function EngineTable({ rows }: EngineTableProps) {
    const { t } = useTranslation('admin');
    return (
        <Card className="p-5 space-y-3">
            <div>
                <h2 className="font-semibold">{t('extractionRuns.engines.title')}</h2>
                <p className="text-xs text-muted-foreground">{t('extractionRuns.engines.hint')}</p>
            </div>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {COLUMNAS.map((c) => (
                                <TableHead key={c} className={c === 'engine' ? '' : 'text-right'}>
                                    {t(`extractionRuns.engines.${c}`)}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((r) => (
                            <TableRow key={r.engine}>
                                <TableCell className="font-medium">{t(`extractionRuns.engine.${r.engine}`)}</TableCell>
                                <TableCell className="text-right">{r.runs}</TableCell>
                                <TableCell className="text-right">{r.ready}</TableCell>
                                <TableCell className={`text-right ${r.failRate > 0.2 ? 'text-destructive' : ''}`}>
                                    {formatPct(r.failRate)}
                                </TableCell>
                                <TableCell className="text-right">{r.degraded}</TableCell>
                                <TableCell className={`text-right ${r.withAlerts > 0 ? 'text-warning-subtle-foreground' : ''}`}>
                                    {r.withAlerts}
                                </TableCell>
                                <TableCell className="text-right">{r.usdPerPage === null ? '—' : formatUsd(r.usdPerPage)}</TableCell>
                                <TableCell className="text-right">{r.llamaParseCredits || '—'}</TableCell>
                                <TableCell className="text-right">{formatDuration(r.medianDurationMs)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </Card>
    );
}
