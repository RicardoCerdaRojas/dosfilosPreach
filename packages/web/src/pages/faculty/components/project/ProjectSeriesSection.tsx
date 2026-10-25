import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Mic2, Plus } from 'lucide-react';
import {
    formatPassageReference,
    nextScheduledDate,
    seriesPericopeRows,
    seriesProgress,
    type AIProject,
    type BibleBookId,
    type ExegesisPaperSummary,
    type PericopeSermonState,
    type SerieLike,
    type SupportedLanguage,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

type SermonLike = { id: string; status?: string; sourceSermonId?: string | null; updatedAt: Date | string };

/**
 * El planificador abierto desde el proyecto. El libro va solo si el
 * proyecto tiene exactamente uno; si no, el planificador obliga a elegirlo.
 */
export function planSeriesUrl(projectId: string, book: BibleBookId | null): string {
    const base = `/dashboard/plans/pericope?projectId=${encodeURIComponent(projectId)}`;
    return book ? `${base}&book=${encodeURIComponent(book)}` : base;
}

interface ProjectSeriesSectionProps {
    project: Pick<AIProject, 'id'>;
    /** Las series del proyecto (`projectSeriesOf`), la más nueva primero. */
    series: ReadonlyArray<SerieLike>;
    /** Todos los estudios del usuario: una perícopa puede apuntar a uno archivado o de otro origen. */
    papers: ReadonlyArray<ExegesisPaperSummary>;
    /** Todos los sermones del usuario, para saber si el borrador ya se publicó (o su copia). */
    sermons: ReadonlyArray<SermonLike>;
    onPlanSeries: () => void;
}

const CHIP: Record<PericopeSermonState, { key: string; className: string }> = {
    none: { key: 'seriesSection.row.noSermon', className: 'border-border text-muted-foreground' },
    draft: { key: 'seriesSection.row.sermonDraft', className: 'border-warning/30 bg-warning-subtle text-warning-subtle-foreground' },
    published: { key: 'seriesSection.row.sermonPublished', className: 'border-success/30 bg-success-subtle text-success-subtle-foreground' },
};

/**
 * «Series de predicación» (etapa 3 de ADR-046): una tarjeta por serie del
 * proyecto con su avance y una fila por perícopa, con su estudio y el
 * estado de su sermón. La vista exacta del plan sigue siendo SeriesDetail.
 */
export function ProjectSeriesSection({ project, series, papers, sermons, onPlanSeries }: ProjectSeriesSectionProps) {
    const { t, i18n } = useTranslation('projects');
    const lang: SupportedLanguage = i18n.language?.startsWith('en') ? 'en' : 'es';
    const tituloId = `project-series-title-${project.id}`;

    // El resumen trae el título opcional; la fila necesita uno.
    const paperDe = useMemo(() => {
        const porId = new Map(papers.map(p => [p.id, p]));
        return (id: string) => {
            const p = porId.get(id);
            return p ? { ...p, title: p.title?.trim() || formatPassageReference(p.passage, lang) } : undefined;
        };
    }, [papers, lang]);

    // Un sermón publicado abre la copia publicada, si la hay; si no, el propio borrador.
    const publicadoDe = (draftId: string) =>
        sermons.find(s => s.status === 'published' && s.sourceSermonId === draftId)?.id ?? draftId;

    const fecha = (d: Date) => d.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3" aria-labelledby={tituloId}>
            <header className="flex items-center gap-2">
                <Mic2 className="h-4 w-4 text-muted-foreground" />
                <h2 id={tituloId} className="text-sm font-semibold text-foreground">
                    {t('seriesSection.title')}
                    {series.length > 0 && <span className="text-muted-foreground font-normal"> · {series.length}</span>}
                </h2>
                <Button size="sm" variant="outline" className="ml-auto" onClick={onPlanSeries}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    {t(series.length ? 'seriesSection.planAnother' : 'seriesSection.plan')}
                </Button>
            </header>

            {series.length === 0 ? (
                <p className="text-xs leading-relaxed text-muted-foreground">{t('seriesSection.empty')}</p>
            ) : (
                <ul className="space-y-3">
                    {series.map(s => {
                        const rows = seriesPericopeRows(s, paperDe, sermons);
                        const avance = seriesProgress(rows);
                        const proxima = nextScheduledDate(rows, new Date());
                        return (
                            <li key={s.id} className="rounded-lg border border-border/60 p-3 space-y-2" data-testid="project-series-card">
                                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                                    <Link
                                        to={`/dashboard/plans/${s.id}`}
                                        title={t('seriesSection.open')}
                                        className="text-sm font-medium text-foreground hover:text-primary hover:underline underline-offset-2"
                                    >
                                        {s.title?.trim() || t('seriesSection.title')}
                                    </Link>
                                    <span className="text-[11px] text-muted-foreground">
                                        {t('seriesSection.progress', { studies: avance.withStudy, total: avance.total, sermons: avance.withSermon })}
                                    </span>
                                    {proxima && (
                                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                            <CalendarDays className="h-3 w-3" />
                                            {t('seriesSection.nextDate', { date: fecha(proxima) })}
                                        </span>
                                    )}
                                </div>

                                {rows.length > 0 && (
                                    <ol className="divide-y divide-border/50">
                                        {rows.map((r, i) => {
                                            const chip = CHIP[r.sermonState];
                                            const destino = r.sermonId
                                                ? r.sermonState === 'published'
                                                    ? `/dashboard/sermons/${publicadoDe(r.sermonId)}`
                                                    : `/dashboard/sermons/generate?id=${encodeURIComponent(r.sermonId)}`
                                                : null;
                                            const claseChip = cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px]', chip.className);
                                            return (
                                                <li key={r.pericopeId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 sm:flex-nowrap" data-testid="project-series-row">
                                                    <span className="w-5 shrink-0 text-right font-mono text-[11px] text-muted-foreground">{r.week ?? i + 1}</span>
                                                    <span className="w-32 shrink-0 truncate text-[12.5px] text-foreground" title={r.title || undefined}>
                                                        {r.passage || r.title}
                                                    </span>
                                                    <span className="min-w-[8rem] flex-1 truncate text-[12px]">
                                                        {r.paper ? (
                                                            <Link
                                                                to={`/dashboard/exegesis/${r.paper.id}`}
                                                                title={t('seriesSection.row.openStudy')}
                                                                className="text-foreground hover:text-primary hover:underline underline-offset-2"
                                                            >
                                                                {r.paper.title}
                                                            </Link>
                                                        ) : (
                                                            <span className="text-muted-foreground">{t('seriesSection.row.noStudy')}</span>
                                                        )}
                                                    </span>
                                                    {destino ? (
                                                        <Link to={destino} className={cn(claseChip, 'hover:border-primary/40')}>{t(chip.key)}</Link>
                                                    ) : (
                                                        <span className={claseChip}>{t(chip.key)}</span>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ol>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
