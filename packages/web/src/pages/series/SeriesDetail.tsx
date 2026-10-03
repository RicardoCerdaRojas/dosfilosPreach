import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    BookOpenText,
    CalendarDays,
    CheckCircle2,
    Clock,
    ExternalLink,
    Loader2,
    MessageCircle,
    Mic,
    MoreHorizontal,
    NotebookPen,
    Pencil,
    Library,
    Link2,
    Sparkles,
    Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AddSermonDialog } from '@/components/plan/AddSermonDialog';
import { EditSermonDialog } from '@/components/plan/EditSermonDialog';
import { LinkExistingSermonDialog } from './components/LinkExistingSermonDialog';
import { ExegesisDefaultsCard } from '@/components/plan/ExegesisDefaultsCard';
import { InlineDateEditor } from '@/components/plan/InlineDateEditor';
import { SeriesTimelineModal } from '@/components/plan/SeriesTimelineModal';
import { useSeriesData, type SermonItem } from '@/hooks/useSeriesData';
import { useFirebase } from '@/context/firebase-context';
import { useTranslation } from '@/i18n';
import { toast } from 'sonner';
import { exegesisService, seriesService } from '@dosfilos/application';
import {
    findBooksByAlias,
    paperDefaultsFromSeries,
    parsePassageReference,
    type ExegeticalPaperPhase,
    type PlannedSermon,
    type SermonSeriesEntity,
    type SyntacticUnit,
} from '@dosfilos/domain';
import { cn } from '@/lib/utils';

export function SeriesDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useFirebase();
    const { t, i18n } = useTranslation('series');
    const locale = i18n.language?.split('-')[0] === 'en' ? 'en-US' : 'es-ES';
    const lang: 'es' | 'en' = i18n.language?.split('-')[0] === 'en' ? 'en' : 'es';

    const [editingSermon, setEditingSermon] = useState<SermonItem | null>(null);
    const [linkingSermon, setLinkingSermon] = useState<SermonItem | null>(null);
    const [timelineOpen, setTimelineOpen] = useState(false);
    const [creatingPaperFor, setCreatingPaperFor] = useState<string | null>(null);
    const [generatingSermonFor, setGeneratingSermonFor] = useState<string | null>(null);

    const {
        series,
        sermonItems,
        loading,
        handleStartDraft,
        handleLinkExisting,
        handleContinueEditing,
        handleUpdateSermonDate,
        handleDeleteSermon,
        handleMarkComplete,
        reloadData,
    } = useSeriesData(id);

    // Index planned-sermon metadata by id so each table row can pull
    // pericope-only fields (syntacticUnit, paperId, expositoryEnrichment)
    // without re-walking the metadata array per row.
    const plannedById = useMemo(() => {
        const map = new Map<string, PlannedSermon>();
        for (const p of series?.metadata?.plannedSermons ?? []) {
            map.set(p.id, p);
        }
        return map;
    }, [series]);

    // Los borradores que ya ocupan una perícopa: no se ofrecen al vincular.
    const linkedDraftIds = useMemo(
        () => new Set((series?.metadata?.plannedSermons ?? []).map(p => p.draftId).filter((x): x is string => !!x)),
        [series],
    );

    // Paper phase per pericope. The pipeline stepper needs the actual
    // ExegeticalPaper phase (configuring / in-progress / assembled),
    // not just whether `paperId` exists — auto-created papers (PR #194)
    // start in 'configuring' with no real work yet, and showing them as
    // "iniciado" misleads pastors into thinking exegesis is done.
    const [paperPhases, setPaperPhases] = useState<Map<string, ExegeticalPaperPhase>>(new Map());
    useEffect(() => {
        if (!user?.uid || !series) return;
        let cancelled = false;
        exegesisService.listPapers
            .execute(user.uid)
            .then((papers) => {
                if (cancelled) return;
                const map = new Map<string, ExegeticalPaperPhase>();
                for (const p of papers) map.set(p.id, p.phase);
                setPaperPhases(map);
            })
            .catch((err) => {
                console.warn('[seriesDetail] paper phases fetch failed:', err);
            });
        return () => {
            cancelled = true;
        };
    }, [user?.uid, series]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }
    if (!series) return null;

    const plannedCount = sermonItems.filter((s) => s.status === 'planned').length;
    const inProgressCount = sermonItems.filter((s) => s.status === 'in_progress').length;
    const completedCount = sermonItems.filter((s) => s.status === 'complete').length;
    const totalCount = sermonItems.length;
    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const nextSermon = sermonItems
        .filter((s) => s.scheduledDate && s.status !== 'complete')
        .sort((a, b) => (a.scheduledDate!.getTime() - b.scheduledDate!.getTime()))[0];

    const startLabel = series.startDate
        ? new Date(series.startDate).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
        : (t('detail.header.noStart') as string);

    /**
     * Lleva al estudio pastoral el paper de una perícopa. Se usa cuando
     * el pipeline muestra paper=hecho / borrador=falta.
     *
     * Antes esta fila disparaba el transformador paper→sermón y dejaba
     * al pastor sobre un borrador ya redactado. Se retiró: producía el
     * output antes que la labor y el portón del wizard lo rebotaba
     * igual. Ahora abre el estudio de 8 pasos con el material del paper
     * a la vista, sin contactar ningún modelo — de ahí que no haya tono
     * que elegir ni error de saturación que atrapar.
     *
     * El caso de uso escribe `plannedSermons[].draftId` del lado del
     * servidor, así que la fila pasa a "Abrir estudio" al recargar.
     */
    const handleStartStudyFromPaper = async (
        planned: PlannedSermon & { paperId: string },
    ) => {
        if (!user?.uid || !series) return;
        setGeneratingSermonFor(planned.id);
        try {
            const result = await exegesisService.startStudyFromPaper.execute({
                paperId: planned.paperId,
                actorUserId: user.uid,
            });
            toast.success(t('detail.table.toast.studyStarted') as string);
            await reloadData();
            navigate(`/dashboard/sermons/generate?id=${result.sermonId}`);
        } catch (err) {
            console.error('[seriesDetail] startStudyFromPaper failed:', err);
            toast.error(t('detail.table.toast.studyStartFailed') as string);
        } finally {
            setGeneratingSermonFor(null);
        }
    };

    const handleCreatePaperForPlanned = async (
        planned: PlannedSermon & { syntacticUnit: SyntacticUnit },
    ) => {
        if (!user?.uid || !series) return;
        setCreatingPaperFor(planned.id);
        try {
            const passage = plannedPassage(planned);
            if (!passage) {
                throw new Error(t('pericope.panel.toast.bookUnresolved') as string);
            }
            const paper = await exegesisService.createPaper.execute({
                ownerId: user.uid,
                passage,
                displayLanguage: lang,
                title: planned.title,
                assignmentBrief: planned.syntacticUnit.justification ?? null,
                // La guía, la rúbrica y el corpus de la serie: antes este
                // camino los ignoraba y el trabajo nacía académico.
                ...paperDefaultsFromSeries(series.metadata?.exegesisDefaults),
                // Stamp back-reference so sermon generation can patch
                // this pericope's draftId without scanning all series.
                seriesId: series.id,
                pericopeId: planned.id,
            });

            const updated = (series.metadata?.plannedSermons ?? []).map((p) =>
                p.id === planned.id
                    ? { ...p, paperId: paper.id, status: 'paper-in-progress' as const }
                    : p,
            );
            await seriesService.updateSeries(series.id, {
                metadata: { ...series.metadata, plannedSermons: updated },
            } as any);
            toast.success(t('pericope.panel.toast.paperCreated') as string);
            await reloadData();
            navigate(`/dashboard/exegesis/${paper.id}`, {
                state: {
                    from: `/dashboard/plans/${series.id}`,
                    fromLabel: t('detail.backToSeries') as string,
                },
            });
        } catch (err: any) {
            console.error('[seriesDetail] createPaper failed:', err);
            toast.error(err?.message ?? (t('pericope.panel.toast.paperFailed') as string));
        } finally {
            setCreatingPaperFor(null);
        }
    };

    return (
        <div className="px-6 py-6 space-y-6 max-w-6xl mx-auto">
            {/* Compact header — 3 rows: breadcrumb + title/actions + meta */}
            <header className="space-y-3">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/dashboard/plans')}
                    className="pl-0 -ml-2 text-muted-foreground h-7"
                >
                    <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                    {t('detail.header.back')}
                </Button>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0 space-y-1.5">
                        <h1 className="font-reading text-[28px] md:text-[32px] leading-tight tracking-tight text-foreground">
                            {series.title}
                        </h1>
                        <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground flex-wrap">
                            <span className="inline-flex items-center gap-1">
                                <CalendarDays className="h-3.5 w-3.5" />
                                {startLabel}
                            </span>
                            <span>·</span>
                            <span>{t('detail.header.sermonCount', { count: totalCount }) as string}</span>
                            {inProgressCount > 0 && (
                                <>
                                    <span>·</span>
                                    <Badge
                                        variant="outline"
                                        className="text-[11px] uppercase tracking-wide font-medium border-amber-400 text-amber-700 dark:text-amber-300 dark:border-amber-700/60"
                                    >
                                        {t('detail.header.inProgressBadge', { count: inProgressCount }) as string}
                                    </Badge>
                                </>
                            )}
                        </div>
                        {series.description && (
                            <p className="text-[14px] text-muted-foreground leading-relaxed max-w-3xl pt-0.5">
                                {series.description}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTimelineOpen(true)}
                        >
                            <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                            {t('detail.header.viewTimeline')}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/dashboard/plans/${series.id}/edit`)}
                        >
                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                            {t('detail.header.edit')}
                        </Button>
                        <AddSermonDialog series={series} onSermonAdded={reloadData} />
                    </div>
                </div>
            </header>

            {/* KPI strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard
                    label={t('detail.kpi.progress')}
                    value={`${completedCount}/${totalCount}`}
                    hint={`${progressPct}%`}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                />
                <KpiCard
                    label={t('detail.kpi.next')}
                    value={nextSermon?.scheduledDate ? nextSermon.scheduledDate.toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '—'}
                    hint={nextSermon?.title ?? (t('detail.kpi.noNext') as string)}
                    icon={<CalendarDays className="h-4 w-4" />}
                    accent={!!nextSermon}
                />
                <KpiCard
                    label={t('detail.kpi.inDev')}
                    value={String(inProgressCount)}
                    hint={t('detail.kpi.inDevHint') as string}
                    icon={<Clock className="h-4 w-4" />}
                />
                <KpiCard
                    label={t('detail.kpi.done')}
                    value={String(completedCount)}
                    hint={t('detail.kpi.doneHint') as string}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                />
            </div>

            {/* Series-level exegesis defaults — Rubric / Style / Corpus
                seeded into every auto-created paper at creation. Only
                visible when the series has pericope-driven planned
                sermons (the only place auto paper creation runs). */}
            {user?.uid && (series.metadata?.plannedSermons?.some((p) => p.syntacticUnit) ?? false) && (
                <ExegesisDefaultsCard
                    seriesId={series.id}
                    ownerId={user.uid}
                    defaults={series.metadata?.exegesisDefaults}
                    book={series.metadata?.expository?.book}
                    language={lang}
                    onChanged={reloadData}
                />
            )}

            {/* Unified table — pericope + sermon fused */}
            <section className="space-y-3">
                <div className="flex items-center gap-2">
                    <BookOpenText className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-[15px] font-semibold text-foreground">
                        {t('detail.table.title')}
                    </h2>
                    <Badge variant="outline" className="text-[11px]">
                        {totalCount}
                    </Badge>
                </div>
                {totalCount === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-lg">
                        {t('detail.table.empty')}
                    </p>
                ) : (
                    <div className="rounded-lg border border-border bg-card divide-y divide-border">
                        {sermonItems.map((item, idx) => {
                            const planned = item.plannedSermonId ? plannedById.get(item.plannedSermonId) : undefined;
                            const hasPaper = Boolean(planned?.paperId);
                            const hasSyntacticUnit = Boolean(planned?.syntacticUnit);
                            const isCreatingPaper = creatingPaperFor === planned?.id;
                            const isGeneratingSermon = generatingSermonFor === planned?.id;
                            const paperPhase = planned?.paperId ? paperPhases.get(planned.paperId) : undefined;
                            return (
                                <SermonRow
                                    key={item.id}
                                    index={idx + 1}
                                    item={item}
                                    planned={planned}
                                    hasPaper={hasPaper}
                                    hasSyntacticUnit={hasSyntacticUnit}
                                    isCreatingPaper={isCreatingPaper}
                                    isGeneratingSermon={isGeneratingSermon}
                                    paperPhase={paperPhase}
                                    seriesId={series.id}
                                    onUpdateDate={(d) => handleUpdateSermonDate(item.id, d)}
                                    onStartDraft={() => handleStartDraft(item)}
                                    onLinkExisting={() => setLinkingSermon(item)}
                                    onStartStudyFromPaper={() => planned?.paperId && handleStartStudyFromPaper(planned as PlannedSermon & { paperId: string })}
                                    onContinueEditing={() => item.draftId && handleContinueEditing(item.draftId)}
                                    onEdit={() => setEditingSermon(item)}
                                    onDelete={() => handleDeleteSermon(item.id)}
                                    onMarkComplete={() => handleMarkComplete(item.id)}
                                    onOpenPaper={() => planned?.paperId && navigate(`/dashboard/exegesis/${planned.paperId}`, {
                                        state: {
                                            from: `/dashboard/plans/${series.id}`,
                                            fromLabel: t('detail.backToSeries') as string,
                                        },
                                    })}
                                    onCreatePaper={() => planned?.syntacticUnit && handleCreatePaperForPlanned(planned as PlannedSermon & { syntacticUnit: SyntacticUnit })}
                                    onOpenFaculty={() => navigate(`/dashboard/faculty/new?seriesId=${series.id}&pericopeId=${planned?.id ?? ''}`)}
                                    onOpenDraft={() => item.draftId && navigate(`/dashboard/sermons/generate?id=${item.draftId}`)}
                                    t={t}
                                />
                            );
                        })}
                    </div>
                )}
            </section>

            {linkingSermon && user && (
                <LinkExistingSermonDialog
                    pericopeLabel={linkingSermon.passage || linkingSermon.title}
                    pericopePassage={linkingSermon.passage ?? ''}
                    seriesId={series.id}
                    userId={user.uid}
                    linkedIds={linkedDraftIds}
                    onLink={sermonId => handleLinkExisting(linkingSermon, sermonId)}
                    onClose={() => setLinkingSermon(null)}
                />
            )}

            <EditSermonDialog
                series={series}
                sermon={editingSermon}
                open={!!editingSermon}
                onOpenChange={(open) => !open && setEditingSermon(null)}
                onSermonUpdated={reloadData}
            />

            <SeriesTimelineModal
                open={timelineOpen}
                onOpenChange={setTimelineOpen}
                sermons={sermonItems}
            />
        </div>
    );
}

function KpiCard({
    label,
    value,
    hint,
    icon,
    accent,
}: {
    label: string;
    value: string;
    hint?: string;
    icon: React.ReactNode;
    accent?: boolean;
}) {
    return (
        <div
            className={cn(
                'rounded-lg border bg-card px-3.5 py-2.5',
                accent ? 'border-primary/40 bg-primary/[0.03]' : 'border-border',
            )}
        >
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                {icon}
                <span>{label}</span>
            </div>
            <div className="mt-1 text-[22px] font-semibold text-foreground leading-tight">{value}</div>
            {hint && (
                <div className="text-[11.5px] text-muted-foreground line-clamp-1 mt-0.5">{hint}</div>
            )}
        </div>
    );
}

interface SermonRowProps {
    index: number;
    item: SermonItem;
    planned: PlannedSermon | undefined;
    hasPaper: boolean;
    hasSyntacticUnit: boolean;
    isCreatingPaper: boolean;
    isGeneratingSermon: boolean;
    paperPhase: ExegeticalPaperPhase | undefined;
    seriesId: string;
    onUpdateDate: (d: Date | null) => Promise<void>;
    onStartDraft: () => Promise<void>;
    onLinkExisting: () => void;
    onStartStudyFromPaper: () => Promise<void> | void;
    onContinueEditing: () => void;
    onEdit: () => void;
    onDelete: () => Promise<void>;
    onMarkComplete: () => Promise<void>;
    onOpenPaper: () => void;
    onCreatePaper: () => void;
    onOpenFaculty: () => void;
    onOpenDraft: () => void;
    t: (key: string, opts?: Record<string, unknown>) => string;
}

function SermonRow({
    index,
    item,
    planned,
    hasPaper,
    hasSyntacticUnit,
    isCreatingPaper,
    isGeneratingSermon,
    paperPhase,
    onUpdateDate,
    onStartDraft,
    onLinkExisting,
    onStartStudyFromPaper,
    onContinueEditing,
    onEdit,
    onDelete,
    onMarkComplete,
    onOpenPaper,
    onCreatePaper,
    onOpenFaculty,
    onOpenDraft,
    t,
}: SermonRowProps) {
    const navigate = useNavigate();
    const passageLabel = item.passage
        || (planned?.syntacticUnit ? formatUnitPassage(planned.syntacticUnit) : '');

    // Confirmation dialog state for "Iniciar sermón" when a paper
    // already exists for this pericope but is not yet assembled. The
    // pastor is about to start a blank sermon, which means the
    // in-progress paper's exegesis won't pre-populate the wizard —
    // they likely want to wait for the paper or continue working on
    // it first. The dialog surfaces both options instead of silently
    // dropping them into a blank Step 0.
    const [showStartDraftConfirm, setShowStartDraftConfirm] = useState(false);
    const requireConfirmBeforeStart = hasPaper && paperPhase !== 'assembled';
    const handleStartDraftClick = () => {
        if (requireConfirmBeforeStart) {
            setShowStartDraftConfirm(true);
        } else {
            onStartDraft();
        }
    };

    return (
        <div className="group px-3 py-2.5 hover:bg-accent/40 transition-colors">
            <div className="flex items-start gap-3">
                {/* Index + status dot */}
                <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
                    <div className="w-6 h-6 rounded-full bg-muted text-[11px] font-semibold text-muted-foreground flex items-center justify-center">
                        {index}
                    </div>
                    <StatusDot status={item.status} />
                </div>

                {/* Title + passage + status text */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={onEdit}
                            className="text-[14px] font-medium text-foreground hover:text-primary transition-colors truncate text-left"
                        >
                            {item.title}
                        </button>
                        {passageLabel && (
                            <span className="text-[11.5px] font-mono text-muted-foreground">
                                {passageLabel}
                            </span>
                        )}
                    </div>
                    {/* Pipeline stepper — paper → borrador → predicado.
                        Stage state distinguishes "doc exists" (auto-created
                        empty shell) from "work actually started" via paper
                        phase + draft wizardProgress.currentStep. */}
                    <PipelineStepper
                        paperState={derivePaperState(hasPaper, paperPhase)}
                        draftState={deriveDraftState(item)}
                        complete={item.status === 'complete'}
                        t={t}
                    />
                    <p className="mt-1 text-[11.5px] text-muted-foreground">
                        <NextStepHint
                            hasSyntacticUnit={hasSyntacticUnit}
                            paperState={derivePaperState(hasPaper, paperPhase)}
                            draftState={deriveDraftState(item)}
                            status={item.status}
                            t={t}
                        />
                    </p>
                </div>

                {/* Date editor */}
                <div className="shrink-0">
                    <InlineDateEditor
                        value={item.scheduledDate}
                        onChange={onUpdateDate}
                    />
                </div>

                {/* Primary actions inline */}
                <div className="shrink-0 flex items-center gap-1">
                    {hasSyntacticUnit && !hasPaper && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onCreatePaper}
                            disabled={isCreatingPaper}
                            className="h-7 text-[11.5px]"
                        >
                            {isCreatingPaper ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                                <NotebookPen className="h-3 w-3 mr-1" />
                            )}
                            {t('detail.table.createPaper')}
                        </Button>
                    )}
                    {hasPaper && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onOpenPaper}
                            className="h-7 text-[11.5px]"
                        >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            {t('detail.table.openPaper')}
                        </Button>
                    )}
                    {item.draftId ? (
                        <Button
                            size="sm"
                            onClick={onOpenDraft}
                            className="h-7 text-[11.5px]"
                        >
                            <Mic className="h-3 w-3 mr-1" />
                            {t('detail.table.openDraft')}
                        </Button>
                    ) : item.status === 'planned' && hasPaper ? (
                        // Hay paper — vale más entrar al estudio con su
                        // material a la vista que abrir un wizard en
                        // blanco. Ya no se exige `assembled`: el estudio
                        // se nutre de los análisis aceptados verso a
                        // verso, que existen antes del ensamble. El caso
                        // de uso escribe el draftId de la perícopa, así
                        // que al recargar la fila pasa a "Abrir estudio".
                        <Button
                            size="sm"
                            onClick={onStartStudyFromPaper}
                            disabled={isGeneratingSermon}
                            className="h-7 text-[11.5px]"
                        >
                            {isGeneratingSermon ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                                <Mic className="h-3 w-3 mr-1" />
                            )}
                            {t('detail.table.startStudyFromPaper')}
                        </Button>
                    ) : item.status === 'planned' && (
                        <Button
                            size="sm"
                            onClick={handleStartDraftClick}
                            className="h-7 text-[11.5px]"
                            variant={requireConfirmBeforeStart ? 'outline' : 'default'}
                            title={requireConfirmBeforeStart ? (t('detail.table.startDraftWarning.tooltip') as string) : undefined}
                        >
                            <Sparkles className="h-3 w-3 mr-1" />
                            {t('detail.table.startDraft')}
                        </Button>
                    )}

                    <AlertDialog open={showStartDraftConfirm} onOpenChange={setShowStartDraftConfirm}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{t('detail.table.startDraftWarning.title')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t('detail.table.startDraftWarning.description')}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>
                                    {t('detail.table.startDraftWarning.continuePaper')}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => {
                                        setShowStartDraftConfirm(false);
                                        onStartDraft();
                                    }}
                                >
                                    {t('detail.table.startDraftWarning.startAnyway')}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                aria-label={t('detail.table.moreActions') as string}
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                                {t('detail.table.actionsLabel')}
                            </DropdownMenuLabel>
                            {planned?.paperId && (
                                <DropdownMenuItem
                                    onClick={() => navigate(`/dashboard/exegesis/${planned.paperId}/setup?tab=corpus`)}
                                >
                                    <Library className="h-3.5 w-3.5 mr-2" />
                                    {t('detail.table.paperCorpus')}
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={onEdit}>
                                <Pencil className="h-3.5 w-3.5 mr-2" />
                                {t('detail.table.editFull')}
                            </DropdownMenuItem>
                            {!item.draftId && item.plannedSermonId && (
                                <DropdownMenuItem onClick={onLinkExisting}>
                                    <Link2 className="h-3.5 w-3.5 mr-2" />
                                    {t('detail.table.linkExisting.menu')}
                                </DropdownMenuItem>
                            )}
                            {hasSyntacticUnit && (
                                <DropdownMenuItem onClick={onOpenFaculty}>
                                    <MessageCircle className="h-3.5 w-3.5 mr-2" />
                                    {t('detail.table.askFaculty')}
                                </DropdownMenuItem>
                            )}
                            {item.draftId && item.status === 'in_progress' && (
                                <DropdownMenuItem onClick={onContinueEditing}>
                                    <NotebookPen className="h-3.5 w-3.5 mr-2" />
                                    {t('detail.table.continueDraft')}
                                </DropdownMenuItem>
                            )}
                            {item.status !== 'complete' && item.draftId && (
                                <DropdownMenuItem onClick={onMarkComplete}>
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                                    {t('detail.table.markComplete')}
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={onDelete}
                                className="text-destructive focus:text-destructive"
                            >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                {t('detail.table.delete')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    );
}

function StatusDot({ status }: { status: SermonItem['status'] }) {
    const tone =
        status === 'complete'
            ? 'bg-emerald-500'
            : status === 'in_progress'
              ? 'bg-amber-500'
              : 'bg-slate-300 dark:bg-slate-600';
    return <div className={cn('w-1.5 h-1.5 rounded-full', tone)} />;
}

type StageState = 'missing' | 'configuring' | 'in_progress' | 'done';

/**
 * Derive paper stage state from the actual ExegeticalPaper phase, not
 * just "doc exists". A paper auto-spawned for a pericope sits in
 * 'configuring' until the pastor opens it and runs any step — at that
 * point Firestore writes flip the phase to 'in-progress'.
 */
function derivePaperState(hasPaper: boolean, phase: ExegeticalPaperPhase | undefined): StageState {
    if (!hasPaper) return 'missing';
    if (phase === 'assembled') return 'done';
    if (phase === 'in-progress') return 'in_progress';
    // phase === 'configuring' OR phase undefined (still loading) → treat
    // as configuring: doc exists but no actual exegetical work done.
    return 'configuring';
}

/**
 * Derive draft stage state from the SermonItem's wizardProgress. PR
 * #195 auto-spawns drafts with `currentStep: 0` and `passage` only —
 * those are still "configuring" from the pastor's POV. Movement past
 * step 0 means the wizard actually advanced.
 */
function deriveDraftState(item: SermonItem): StageState {
    if (!item.draftId) return 'missing';
    if (item.status === 'complete') return 'done';
    const step = item.wizardProgress?.currentStep ?? 0;
    if (step > 0) return 'in_progress';
    return 'configuring';
}

/**
 * Three-stage horizontal stepper inline in each row. Stages:
 *   ① Paper exegético  ② Borrador del sermón  ③ Predicado
 *
 * Visual states per stage:
 *   - missing       → hollow dot, dashed connector
 *   - configuring   → hollow dot with amber border (started but empty)
 *   - in_progress   → filled amber dot with ring (actively working)
 *   - done          → filled emerald dot
 *
 * The pericope stage itself is implicit (the row exists ⇒ pericope
 * exists), so it's not drawn — keeps the stepper compact.
 */
function PipelineStepper({
    paperState,
    draftState,
    complete,
    t,
}: {
    paperState: StageState;
    draftState: StageState;
    complete: boolean;
    t: (key: string, opts?: Record<string, unknown>) => string;
}) {
    const preachedState: StageState = complete ? 'done' : 'missing';
    const stages: Array<{ key: string; label: string; state: StageState }> = [
        { key: 'paper', label: t('detail.table.stepper.paper'), state: paperState },
        { key: 'draft', label: t('detail.table.stepper.draft'), state: draftState },
        { key: 'preached', label: t('detail.table.stepper.preached'), state: preachedState },
    ];
    return (
        <div className="mt-1.5 flex items-center gap-1 text-[10.5px] uppercase tracking-wider font-medium text-muted-foreground">
            {stages.map((stage, idx) => (
                <span key={stage.key} className="inline-flex items-center gap-1">
                    <StageDot state={stage.state} isPreached={stage.key === 'preached'} />
                    <span className={cn(stageTextClass(stage.state, stage.key === 'preached'))}>
                        {stage.label}
                    </span>
                    {idx < stages.length - 1 && (
                        <span
                            className={cn(
                                'block w-4 h-px mx-0.5',
                                stage.state === 'done' || stage.state === 'in_progress'
                                    ? 'bg-slate-300 dark:bg-zinc-700'
                                    : 'border-t border-dashed border-slate-300 dark:border-zinc-700',
                            )}
                        />
                    )}
                </span>
            ))}
        </div>
    );
}

function StageDot({ state, isPreached }: { state: StageState; isPreached: boolean }) {
    if (state === 'done') {
        return (
            <span
                className={cn(
                    'inline-block h-2.5 w-2.5 rounded-full border',
                    isPreached
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'bg-emerald-500 border-emerald-500',
                )}
            />
        );
    }
    if (state === 'in_progress') {
        return (
            <span className="inline-block h-2.5 w-2.5 rounded-full border bg-amber-400 border-amber-500 ring-2 ring-amber-200 dark:ring-amber-900/40" />
        );
    }
    if (state === 'configuring') {
        return (
            <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-amber-400 bg-background" />
        );
    }
    // missing
    return (
        <span className="inline-block h-2.5 w-2.5 rounded-full border border-slate-300 dark:border-zinc-700 bg-background" />
    );
}

function stageTextClass(state: StageState, isPreached: boolean): string {
    if (state === 'done')
        return isPreached
            ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-emerald-700 dark:text-emerald-300';
    if (state === 'in_progress') return 'text-amber-700 dark:text-amber-300';
    if (state === 'configuring') return 'text-amber-700/70 dark:text-amber-300/70';
    return '';
}

/**
 * One-line hint that answers "what's the next thing I should do for
 * this pericope?". Reads from the same derived stage states the
 * stepper uses so visual + copy stay in sync.
 */
function NextStepHint({
    hasSyntacticUnit,
    paperState,
    draftState,
    status,
    t,
}: {
    hasSyntacticUnit: boolean;
    paperState: StageState;
    draftState: StageState;
    status: SermonItem['status'];
    t: (key: string, opts?: Record<string, unknown>) => string;
}) {
    if (status === 'complete') return <>{t('detail.table.nextStep.preached')}</>;
    if (paperState === 'missing' && hasSyntacticUnit) {
        return <>{t('detail.table.nextStep.createPaper')}</>;
    }
    if (paperState === 'configuring') {
        return <>{t('detail.table.nextStep.startPaper')}</>;
    }
    if (paperState === 'in_progress' && draftState === 'missing') {
        return <>{t('detail.table.nextStep.refinePaperStartDraft')}</>;
    }
    if (paperState === 'done' && draftState === 'missing') {
        return <>{t('detail.table.nextStep.startDraftPaperDone')}</>;
    }
    if (draftState === 'configuring') {
        return <>{t('detail.table.nextStep.startDraft')}</>;
    }
    if (draftState === 'in_progress') {
        return <>{t('detail.table.nextStep.continueDraft')}</>;
    }
    if (draftState === 'done' && status !== 'complete') {
        return <>{t('detail.table.nextStep.markPreached')}</>;
    }
    return <>{t('detail.table.nextStep.startDraft')}</>;
}

/**
 * El pasaje con el que se crea el paper de una perícopa.
 *
 * Manda `planned.passage` —la referencia de la perícopa, que es lo que el plan
 * muestra y lo que el predicador va a predicar— y NO el `syntacticUnit`, que es
 * una sub-unidad más chica producida por el asistente expositivo.
 *
 * Usar la sub-unidad venía recortando todos los papers de la serie. Medido en
 * la serie de Jonás: la perícopa 1:4-16 abría un paper de 1:1-3; la 2:1-11, uno
 * de 2:1; la 3:1-10, uno de 3:1-4; la 4:5-11, uno de 4:5-8. Solo coincidía la
 * 4:1-4, por casualidad. El predicador abría el trabajo de la semana y se
 * encontraba con los versículos de otra.
 *
 * El `syntacticUnit` queda de reserva: hay perícopas viejas sin `passage`
 * guardado, y para esas sigue siendo lo mejor que hay.
 */
function plannedPassage(planned: PlannedSermon & { syntacticUnit: SyntacticUnit }) {
    if (planned.passage) {
        const parsed = parsePassageReference(planned.passage);
        if (parsed.ok) return parsed.ref;
    }
    return syntacticUnitToPassage(planned.syntacticUnit);
}

function syntacticUnitToPassage(unit: SyntacticUnit) {
    const matches = findBooksByAlias(unit.book.toLowerCase().trim());
    if (matches.length === 0) return null;
    const book = matches[0]!;
    return {
        bookId: book.id,
        chapterStart: unit.chapterStart,
        verseStart: unit.verseStart,
        chapterEnd: unit.chapterEnd,
        verseEnd: unit.verseEnd,
    };
}

function formatUnitPassage(unit: SyntacticUnit): string {
    const { book, chapterStart, verseStart, chapterEnd, verseEnd } = unit;
    if (chapterStart === chapterEnd) {
        if (verseStart === verseEnd) return `${book} ${chapterStart}:${verseStart}`;
        return `${book} ${chapterStart}:${verseStart}-${verseEnd}`;
    }
    return `${book} ${chapterStart}:${verseStart}-${chapterEnd}:${verseEnd}`;
}
