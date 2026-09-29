import { useTranslation } from '@/i18n';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PreflightRow } from '@/lib/extractionRunsReport';

interface PreflightTableProps {
    rows: PreflightRow[];
}

const COLUMNAS = ['verdict', 'runs', 'ready', 'alerts'] as const;

/** Pregunta 4 de la ficha: ¿el veredicto al subir anticipó cómo terminó el libro? */
export function PreflightTable({ rows }: PreflightTableProps) {
    const { t } = useTranslation('admin');
    return (
        <Card className="p-5 space-y-3">
            <div>
                <h2 className="font-semibold">{t('extractionRuns.preflight.title')}</h2>
                <p className="text-xs text-muted-foreground">{t('extractionRuns.preflight.hint')}</p>
            </div>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {COLUMNAS.map((c) => (
                                <TableHead key={c} className={c === 'verdict' ? '' : 'text-right'}>
                                    {t(`extractionRuns.preflight.${c}`)}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((r) => (
                            <TableRow key={r.verdict}>
                                <TableCell className="font-medium">
                                    {t(`extractionRuns.preflight.verdicts.${r.verdict}`)}
                                </TableCell>
                                <TableCell className="text-right">{r.runs}</TableCell>
                                <TableCell className="text-right">{r.ready}</TableCell>
                                <TableCell className={`text-right ${r.withAlerts > 0 ? 'text-warning-subtle-foreground' : ''}`}>
                                    {r.withAlerts}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </Card>
    );
}
