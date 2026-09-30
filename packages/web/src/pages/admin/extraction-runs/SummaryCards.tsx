import { useTranslation } from '@/i18n';
import { Card } from '@/components/ui/card';
import type { ExtractionRunsReport } from '@/lib/extractionRunsReport';
import { formatUsd } from './format';

interface SummaryCardsProps {
    report: ExtractionRunsReport;
}

export function SummaryCards({ report }: SummaryCardsProps) {
    const { t } = useTranslation('admin');
    const celdas: Array<{ key: string; value: string; tone?: string }> = [
        { key: 'runs', value: String(report.total) },
        { key: 'ready', value: String(report.ready), tone: 'text-success-subtle-foreground' },
        { key: 'failed', value: String(report.failed), tone: report.failed > 0 ? 'text-destructive' : undefined },
        { key: 'running', value: String(report.running) },
        { key: 'alerts', value: String(report.withAlerts), tone: report.withAlerts > 0 ? 'text-warning-subtle-foreground' : undefined },
        { key: 'usd', value: formatUsd(report.usd) },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {celdas.map(({ key, value, tone }) => (
                <Card key={key} className="p-4">
                    <p className="text-xs text-muted-foreground">{t(`extractionRuns.summary.${key}`)}</p>
                    <p className={`text-2xl font-semibold ${tone ?? ''}`}>{value}</p>
                </Card>
            ))}
        </div>
    );
}
