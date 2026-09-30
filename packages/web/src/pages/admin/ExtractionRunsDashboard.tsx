import { Link } from 'react-router-dom';
import { ArrowLeft, FileScan, Loader2, RefreshCw } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useExtractionRuns } from '@/hooks/admin/useExtractionRuns';
import { SummaryCards } from './extraction-runs/SummaryCards';
import { EngineTable } from './extraction-runs/EngineTable';
import { PreflightTable } from './extraction-runs/PreflightTable';
import { RunsTable } from './extraction-runs/RunsTable';

/**
 * Panel de extracción: una fila por corrida, con motor, costo, duración y
 * fidelidad de escritura. Lee las fichas de `extraction_runs`
 * (docs/FASE_CIERRE_DE_BRECHAS_2026-09.md, ítem 7). Sólo administración.
 */
export function ExtractionRunsDashboard() {
    const { t } = useTranslation('admin');
    const { data, isLoading, isFetching, error, refetch } = useExtractionRuns();

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-6xl">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Link
                        to="/dashboard/admin"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={t('common.back')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-semibold flex items-center gap-2">
                            <FileScan className="h-5 w-5" /> {t('extractionRuns.title')}
                        </h1>
                        <p className="text-sm text-muted-foreground">{t('extractionRuns.subtitle')}</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
                    {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <span className="ml-2">{t('common.refresh')}</span>
                </Button>
            </div>

            {isLoading && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}

            {error && (
                <Card className="p-4 border-destructive text-sm text-destructive">{t('extractionRuns.loadError')}</Card>
            )}

            {data && data.runs.length === 0 && (
                <Card className="p-6 text-sm text-muted-foreground">{t('extractionRuns.empty')}</Card>
            )}

            {data && data.runs.length > 0 && (
                <>
                    <SummaryCards report={data.report} />
                    <EngineTable rows={data.report.engines} />
                    <PreflightTable rows={data.report.preflight} />
                    <RunsTable runs={data.runs} titles={data.titles} />
                </>
            )}
        </div>
    );
}
