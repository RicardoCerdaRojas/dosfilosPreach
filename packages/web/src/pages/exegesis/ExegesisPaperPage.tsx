import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
    ArrowLeft,
    AlertCircle,
    Download,
    Loader2,
    Archive,
    MoreVertical,
    NotebookPen,
    FileCheck2,
    FileStack,
    Wand2,
    Settings2,
    Pencil,
    X,
    BookOpenText,
    BookOpen,
    BookText,
    PenLine,
    MessageCircle,
    PanelRightClose,
    PanelRightOpen,
    ShieldAlert,
    Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/i18n';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { usePaperDerivedArtifacts } from '@/hooks/exegesis/usePaperDerivedArtifacts';
import { useExegesisPaper } from '@/hooks/exegesis/useExegesisPaper';
import { usePaperBibliographyEntries } from '@/hooks/exegesis/usePaperBibliography';
import { useUserRubrics } from '@/hooks/exegesis/useUserRubrics';
import { useUserStyleGuides } from '@/hooks/exegesis/useUserStyleGuides';
import { StepCard } from '@/components/exegesis/StepCard';
import { PaperLengthCard } from '@/components/exegesis/PaperLengthCard';
import { PaperBibliographyCard } from '@/components/exegesis/PaperBibliographyCard';
import { GlossaryCheckCard } from '@/components/exegesis/GlossaryCheckCard';
import { CorpusCoverageReport } from '@/components/exegesis/corpus-plan/CorpusCoverageReport';
import { PaperFacultyDrawer } from '@/components/exegesis/PaperFacultyDrawer';
import { AcademicCompositionDialog } from '@/components/exegesis/canonical/AcademicCompositionDialog';
import { MinistryCompositionDialog } from '@/components/exegesis/canonical/MinistryCompositionDialog';
import { CoherencePassDialog } from '@/components/exegesis/CoherencePassDialog';
import { ExegesisQuotaBadge } from '@/components/exegesis/ExegesisQuotaBadge';
import { PaperDerivedArtifactsPanel } from '@/components/exegesis/PaperDerivedArtifactsPanel';
import { TextZoomControl } from '@/components/ui/text-zoom-control';
import { getTextZoomClass, type TextZoomLevel } from '@/lib/textZoom';
import { exportPaperToDocx } from '@/lib/exegesis/exportPaperToDocx';
import {
    exportPaperToMarkdown,
    formatPassageReference,
    passageToReader,
    type ExegeticalPaper,
    type ProjectSource,
    type SupportedLanguage,
    documentSections,
    sectionBudgets,
} from '@dosfilos/domain';

/**
 * Detail view for a single exegetical paper.
 *
 * v1 thin slice: shows the paper's configuration (passage, style guide,
 * sources) and a "steps" panel that's empty until the orchestrator
 * (D) lands. Source removal is wired so the user can fix mistakes
 * after creation; adding new sources from this page and changing the
 * style guide are flagged as v1.5 and surfaced as locked actions —
 * better than hiding the gap.
 */
export function ExegesisPaperPage() {
    const { paperId } = useParams<{ paperId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { t, i18n } = useTranslation('exegesis');
    const activeLanguage: SupportedLanguage = i18n.language?.split('-')[0] === 'en' ? 'en' : 'es';

    // Context-aware back: when the user came from a planner / series /
    // dashboard surface, return them there instead of the global paper
    // list. The originating page passes `{ from, fromLabel }` via
    // react-router state when navigating in.
    const navState = (location.state ?? null) as { from?: string; fromLabel?: string } | null;
    const backTo = navState?.from && navState.from.startsWith('/') ? navState.from : '/dashboard/exegesis';
    const backLabel = navState?.fromLabel ?? (t('detail.back') as string);

    const {
        archivePaper,
        removeSource,
        seedSteps,
        startStudyFromPaper,
    } = useExegesisPapers();
    // El paper COMPLETO, no el resumen de la lista. `listPaperSummaries` recorta
    // `sources`, `steps` y `assembledMarkdown` para que la lista cargue rápido
    // (#296), y esta página los lee los tres. Leerlo con `papers.find(...)`
    // dejaba `paper.sources` en undefined y el render moría en
    // `paper.sources.length` — pantalla en blanco al abrir cualquier paper.
    // La página de setup ya usaba este hook; esta se quedó atrás.
    const { paper, isLoading, error } = useExegesisPaper(paperId);
    // Antes del `if (!paper)` de más abajo: los hooks no pueden vivir detrás
    // de un retorno temprano. El hook tolera `paper` nulo y devuelve lista
    // vacía.
    const bibliography = usePaperBibliographyEntries(paper);

    const [facultyDrawerOpen, setFacultyDrawerOpen] = useState(false);
    const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
    const [composeDialogOpen, setComposeDialogOpen] = useState(false);
    const [ministryDialogOpen, setMinistryDialogOpen] = useState(false);
    const [coherenceDialogOpen, setCoherenceDialogOpen] = useState(false);

    // Reading layout preferences — persisted so the user's last choice
    // sticks across navigations. Sidebar visibility, reading mode (forces
    // 800px centered + larger zoom), and a 3-level text zoom.
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => readLayoutPref('sidebarCollapsed', false));
    const [readingMode, setReadingMode] = useState<boolean>(() => readLayoutPref('readingMode', false));
    const [textZoom, setTextZoom] = useState<TextZoomLevel>(() => readZoomPref());
    useEffect(() => {
        writeLayoutPref('sidebarCollapsed', sidebarCollapsed);
    }, [sidebarCollapsed]);
    useEffect(() => {
        writeLayoutPref('readingMode', readingMode);
    }, [readingMode]);
    useEffect(() => {
        writeZoomPref(textZoom);
    }, [textZoom]);
    // Reading mode implies sidebar hidden and at least zoom level 2 — a
    // narrow centered column with tiny text would defeat the purpose.
    const effectiveSidebarHidden = readingMode || sidebarCollapsed;
    const effectiveZoom: TextZoomLevel = readingMode && textZoom < 2 ? 2 : textZoom;

    const containerMaxWidthClass = readingMode
        ? 'max-w-[820px]'
        : effectiveSidebarHidden
            ? 'max-w-[1400px]'
            : 'max-w-7xl';
    const gridTemplateClass = effectiveSidebarHidden
        ? 'grid-cols-1'
        : 'grid-cols-1 lg:grid-cols-[1fr_320px]';

    if (isLoading) {
        return <CenteredMessage icon={<Loader2 className="h-5 w-5 animate-spin" />} text={t('detail.loading')} />;
    }
    if (error) {
        return <CenteredMessage icon={<AlertCircle className="h-5 w-5" />} text={t('list.loadFailed')} tone="error" />;
    }
    if (!paper) {
        return <NotFound />;
    }

    const handleArchive = async () => {
        try {
            await archivePaper.mutateAsync({ paperId: paper.id, archived: true });
            toast.success(t('detail.toast.archived'));
            navigate('/dashboard/exegesis');
        } catch (err) {
            console.error('[exegesis] archive failed:', err);
            toast.error(t('detail.toast.archiveFailed'));
        }
    };

    const handleRemoveSource = async (sourceId: string) => {
        try {
            await removeSource.mutateAsync({ paperId: paper.id, sourceId });
            toast.success(t('detail.toast.sourceRemoved'));
        } catch (err) {
            console.error('[exegesis] removeSource failed:', err);
            toast.error(t('detail.toast.sourceRemoveFailed'));
        }
    };

    const handleStartStudy = async () => {
        try {
            const result = await startStudyFromPaper.mutateAsync({ paperId: paper.id });
            // El aviso distingue los dos casos. Un paper sin análisis
            // aceptados abre el estudio igual —el pasaje ya es algo—
            // pero decirle "tu paper te acompaña" sería mentira: no
            // hay nada que mostrar al lado de los pasos todavía.
            toast.success(
                result.hasStudyMaterial
                    ? t('detail.startStudy.toast.success')
                    : t('detail.startStudy.toast.successNoMaterial'),
            );
            // Paso 1 del estudio pastoral, con el material del paper a
            // la vista en cada paso. El paper NO redacta el sermón: lo
            // escribe el pastor en el Paso 3, después del estudio.
            navigate(`/dashboard/sermons/generate?id=${result.sermonId}`);
        } catch (err) {
            console.error('[exegesis] startStudyFromPaper failed:', err);
            toast.error(t('detail.startStudy.toast.failed'));
        }
    };

    const handleStartGeneration = async () => {
        try {
            await seedSteps.mutateAsync({ paperId: paper.id });
            toast.success(t('detail.steps.toast.seeded'));
        } catch (err: any) {
            console.error('[exegesis] seedSteps failed:', err);
            // Surface the repo's specific error (e.g. "v1 only supports
            // single-chapter passages") so the user knows how to fix it.
            const msg = err?.message?.includes('single-chapter') || err?.message?.includes('explicit verses')
                ? t('detail.steps.toast.seedShapeError')
                : t('detail.steps.toast.seedFailed');
            toast.error(msg);
        }
    };

    const buildSafeFilename = (extension: 'md' | 'docx'): string => {
        const stem = (paper.title || formatPassageReference(paper.passage, activeLanguage))
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60) || 'paper';
        return `${stem}.${extension}`;
    };

    const triggerDownload = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    /**
     * Avisa por los libros citados a los que les falta la ficha.
     *
     * El documento los imprime igual, con lo que falta entre corchetes, para
     * que no se pierda una obra citada. Pero eso se ve al abrir el archivo, y
     * quien descarga suele mandarlo sin abrirlo: el aviso va acá, en el gesto
     * de descargar.
     */
    const avisarFichasIncompletas = () => {
        const cojas = bibliography.filter(e => !e.text);
        if (cojas.length === 0) return;
        toast.warning(t('detail.bibliography.incompleteToast', {
            count: cojas.length,
            sources: cojas.map(e => e.displayLabel).join(', '),
        }));
    };

    const handleExportMarkdown = () => {
        const markdown = exportPaperToMarkdown(paper, { bibliography });
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        triggerDownload(blob, buildSafeFilename('md'));
        toast.success(t('detail.exportMarkdown.toast.exported'));
        avisarFichasIncompletas();
    };

    const handleExportDocx = async () => {
        try {
            const blob = await exportPaperToDocx(paper, { bibliography });
            triggerDownload(blob, buildSafeFilename('docx'));
            toast.success(t('detail.exportDocx.toast.exported'));
            avisarFichasIncompletas();
        } catch (err) {
            console.error('[exegesis] export docx failed:', err);
            toast.error(t('detail.exportDocx.toast.failed'));
        }
    };

    const passageShape = passageEligibleForGeneration(paper);

    // El paper se queda en la numeración del TEXTO ORIGINAL, que es la
    // convención académica para un trabajo sobre el hebreo o el griego: sus
    // pasos, sus citas y su aparato hablan esa numeración. Lo que NO puede
    // pasar es que el pastor no se entere, porque va a predicar desde su
    // Biblia. Cuando difieren, se declara la equivalencia acá mismo.
    const passageDisplay = formatPassageReference(paper.passage, activeLanguage);
    const readerPassage = passageToReader(paper.passage);
    const readerPassageDisplay = readerPassage.differs
        ? formatPassageReference(readerPassage.passage, activeLanguage)
        : null;
    const titleDisplay = paper.title || passageDisplay;

    return (
        <div className="flex flex-col h-full bg-slate-50/50 dark:bg-zinc-950/50 font-sans overflow-y-auto">
            {/* Header */}
            <div className="border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center gap-3">
                    <Link
                        to={backTo}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                        aria-label={backLabel}
                        title={backLabel}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100 font-serif truncate">
                            {titleDisplay}
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {passageDisplay} · {t(`list.phase.${paper.phase}`)}
                            {readerPassageDisplay && (
                                <span
                                    className="ml-2 text-info"
                                    title={t('detail.versification.hint') as string}
                                >
                                    {t('detail.versification.inYourBible', { passage: readerPassageDisplay })}
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Reading layout toggles — sidebar collapse + reading
                        mode + text zoom. Persisted via localStorage so the
                        user's choice survives navigations. */}
                    <div className="hidden md:inline-flex items-center gap-1.5 mr-1">
                        <button
                            type="button"
                            onClick={() => {
                                if (readingMode) setReadingMode(false);
                                setSidebarCollapsed(c => !c);
                            }}
                            aria-pressed={effectiveSidebarHidden}
                            disabled={readingMode}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={t(effectiveSidebarHidden ? 'detail.layout.sidebarShow' : 'detail.layout.sidebarHide') as string}
                            aria-label={t(effectiveSidebarHidden ? 'detail.layout.sidebarShow' : 'detail.layout.sidebarHide') as string}
                        >
                            {effectiveSidebarHidden
                                ? <PanelRightOpen className="h-3.5 w-3.5" />
                                : <PanelRightClose className="h-3.5 w-3.5" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => setReadingMode(r => !r)}
                            aria-pressed={readingMode}
                            className={`inline-flex items-center justify-center h-8 w-8 rounded-md border transition-colors ${
                                readingMode
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                                    : 'border-border text-foreground hover:bg-accent'
                            }`}
                            title={t(readingMode ? 'detail.layout.readingExit' : 'detail.layout.readingEnter') as string}
                            aria-label={t(readingMode ? 'detail.layout.readingExit' : 'detail.layout.readingEnter') as string}
                        >
                            <BookText className="h-3.5 w-3.5" />
                        </button>
                        <TextZoomControl
                            value={textZoom}
                            onChange={setTextZoom}
                            label={t('detail.layout.textZoomLabel') as string}
                            levelLabels={[
                                t('detail.layout.textZoomLevel1') as string,
                                t('detail.layout.textZoomLevel2') as string,
                                t('detail.layout.textZoomLevel3') as string,
                            ]}
                        />
                    </div>

                    {/* Persistent exégesis quota badge — visible from
                        every paper detail page so the user always
                        sees their remaining studies before triggering
                        a costly op. Click opens the OutOfCredits
                        dialog with breakdown + buy/upgrade CTAs. */}
                    <ExegesisQuotaBadge variant="compact" />

                    {/* Secondary actions — icon-only with tooltips. Visually
                        grouped tight so they read as a strip rather than
                        peer-priority with the primary CTA below. */}
                    <div className="flex items-center gap-1">
                        <Link
                            to={`/dashboard/exegesis/${paper.id}/setup`}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border text-foreground hover:bg-accent transition-colors"
                            title={t('detail.openSetup') as string}
                            aria-label={t('detail.openSetup') as string}
                        >
                            <Settings2 className="h-3.5 w-3.5" />
                        </Link>
                        <button
                            type="button"
                            onClick={() => setFacultyDrawerOpen(true)}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border text-foreground hover:bg-accent transition-colors"
                            title={t('detail.askFaculty.cta') as string}
                            aria-label={t('detail.askFaculty.cta') as string}
                        >
                            <MessageCircle className="h-3.5 w-3.5" />
                        </button>
                        {(() => {
                            const hasContent = paper.assembledMarkdown !== null
                                || paper.steps.some(s => s.accepted !== null);
                            return (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            disabled={!hasContent}
                                            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border text-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                            title={hasContent
                                                ? t('detail.export.menuTooltip') as string
                                                : t('detail.exportMarkdown.disabledHint') as string}
                                            aria-label={t('detail.export.menuTooltip') as string}
                                        >
                                            <Download className="h-3.5 w-3.5" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="min-w-[220px]">
                                        <DropdownMenuItem onClick={handleExportMarkdown}>
                                            {t('detail.exportMarkdown.cta')}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={handleExportDocx}>
                                            {t('detail.exportDocx.cta')}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            );
                        })()}
                    </div>

                    {/* Acción principal — conserva la etiqueta de texto
                        porque es la que dirige el módulo entero. */}
                    <StartStudyButton
                        paper={paper}
                        onStart={handleStartStudy}
                        pending={startStudyFromPaper.isPending}
                        t={t}
                    />

                    {/* Overflow menu — low-frequency / destructive actions
                        live here so they don't add noise to the header. */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border text-foreground hover:bg-accent transition-colors"
                                aria-label={t('detail.moreActions') as string}
                                title={t('detail.moreActions') as string}
                            >
                                <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setComposeDialogOpen(true)}>
                                <NotebookPen className="h-4 w-4 mr-2" />
                                {t('canonical.compose.menuItem')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setMinistryDialogOpen(true)}>
                                <Sparkles className="h-4 w-4 mr-2" />
                                {t('canonical.ministry.menuItem')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setCoherenceDialogOpen(true)}>
                                <ShieldAlert className="h-4 w-4 mr-2" />
                                {t('coherence.menuItem')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setArchiveConfirmOpen(true)}
                            >
                                <Archive className="h-4 w-4 mr-2" />
                                {t('detail.archive')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <AcademicCompositionDialog
                        open={composeDialogOpen}
                        onOpenChange={setComposeDialogOpen}
                        paperId={paper.id}
                        suggestedFilename={buildPaperFilename(paper, activeLanguage)}
                        savedAssembledMarkdown={paper.assembledMarkdown ?? ''}
                    />

                    <MinistryCompositionDialog
                        open={ministryDialogOpen}
                        onOpenChange={setMinistryDialogOpen}
                        paperId={paper.id}
                        suggestedFilename={buildPaperFilename(paper, activeLanguage)}
                    />

                    <CoherencePassDialog
                        open={coherenceDialogOpen}
                        onOpenChange={setCoherenceDialogOpen}
                        paperId={paper.id}
                        language={paper.displayLanguage}
                    />


                    <AlertDialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{t('detail.archiveConfirmTitle')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t('detail.archiveConfirmBody')}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={archivePaper.isPending}>
                                    {t('setup.cancel')}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={async (e) => {
                                        // Prevent the AlertDialog primitive
                                        // from auto-closing — we want the
                                        // spinner visible until the mutation
                                        // resolves. handleArchive navigates on
                                        // success (the dialog unmounts with
                                        // the page); on error we close here.
                                        e.preventDefault();
                                        await handleArchive();
                                        setArchiveConfirmOpen(false);
                                    }}
                                    disabled={archivePaper.isPending}
                                    className="bg-destructive text-white hover:bg-destructive/90"
                                >
                                    {archivePaper.isPending && (
                                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                    )}
                                    {t('detail.archiveConfirm')}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            {/* Body */}
            <main className={`flex-1 ${containerMaxWidthClass} w-full mx-auto px-6 py-8 ${getTextZoomClass(effectiveZoom)}`}>
                <div className={`grid ${gridTemplateClass} gap-6`}>
                    <StepsPanel
                        paper={paper}
                        language={activeLanguage}
                        passageEligible={passageShape.eligible}
                        passageHint={passageShape.hint(t)}
                        onStartGeneration={handleStartGeneration}
                        starting={seedSteps.isPending}
                        t={t}
                    />
                    {!effectiveSidebarHidden && (
                        <aside className="space-y-4">
                            <PaperLengthCard paper={paper} language={activeLanguage} />
                            <PaperBibliographyCard paper={paper} />
                            <GlossaryCheckCard paper={paper} />
                            <RubricCard paper={paper} t={t} />
                            <StyleGuideCard paper={paper} t={t} />
                            <SourcesCard
                                paper={paper}
                                onRemove={handleRemoveSource}
                                isRemoving={removeSource.isPending}
                                t={t}
                            />
                            <PaperDerivedArtifactsPanel paperId={paper.id} />
                        </aside>
                    )}
                </div>
            </main>

            <PaperFacultyDrawer
                open={facultyDrawerOpen}
                onOpenChange={setFacultyDrawerOpen}
                paper={paper}
            />
        </div>
    );
}

// ── Header pieces ───────────────────────────────────────────────────────

/**
 * Lleva el paper al estudio pastoral de 8 pasos.
 *
 * Antes era "Generar sermón": un popover de tonos que disparaba el
 * transformador paper→sermón y prometía "un sermón listo para predicar".
 * Ese botón se retiró — producía el output antes que la labor, y el
 * portón del wizard lo rebotaba igual. Ya no hay tono que elegir porque
 * ya no se redacta nada acá: el paper entra al estudio como material de
 * consulta, y el sermón lo escribe el pastor al final.
 *
 * Por eso tampoco exige `phase === 'assembled'`. El estudio se nutre de
 * los análisis aceptados verso a verso, que existen mucho antes del
 * ensamble, y empezar el estudio temprano es exactamente lo que el
 * producto quiere fomentar.
 */
function StartStudyButton({
    paper,
    onStart,
    pending,
    t,
}: {
    paper: ExegeticalPaper;
    onStart: () => void;
    pending: boolean;
    t: (key: string) => string;
}) {
    const hasAcceptedAnalysis = paper.steps.some(
        (step) => step.kind === 'verse' && Boolean(step.accepted?.canonicalAnalysis),
    );
    // Si este paper ya abrió un borrador, el botón NO empieza nada: vuelve.
    // Decir «comenzar» sobre algo ya empezado fue lo que llevó a cinco
    // borradores del mismo pasaje, todos parados en el paso 1.
    const derivados = usePaperDerivedArtifacts(paper.id);
    const yaHayBorrador = (derivados.data ?? []).some(a => a.kind === 'sermon' && a.isDraft);

    return (
        <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={onStart}
            className="text-success border-success/40 hover:bg-success-subtle/40 disabled:opacity-50"
            title={
                yaHayBorrador
                    ? t('detail.startStudy.hintResume')
                    : hasAcceptedAnalysis
                        ? t('detail.startStudy.hint')
                        : t('detail.startStudy.hintNoMaterial')
            }
        >
            {pending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
                // Una pluma y no un micrófono: lo que abre es el estudio donde
                // el pastor ESCRIBE el sermón, no el momento de predicarlo.
                <PenLine className="h-3.5 w-3.5 mr-1.5" />
            )}
            {t(yaHayBorrador ? 'detail.startStudy.ctaResume' : 'detail.startStudy.cta')}
        </Button>
    );
}

// ── Main panel — Steps ──────────────────────────────────────────────────

interface StepsPanelProps {
    paper: ExegeticalPaper;
    language: SupportedLanguage;
    passageEligible: boolean;
    passageHint: string | null;
    onStartGeneration: () => void;
    starting: boolean;
    t: (key: string, opts?: Record<string, unknown>) => string;
}

function StepsPanel({
    paper,
    language,
    passageEligible,
    passageHint,
    onStartGeneration,
    starting,
    t,
}: StepsPanelProps) {
    const steps = paper.steps ?? [];
    const hasSteps = steps.length > 0;
    const sortedSteps = [...steps].sort((a, b) => a.order - b.order);
    // Cuánto le toca a cada verso para llegar a la extensión que exige la
    // rúbrica: es el número que el diálogo de recomposición propone.
    const targetWordsPerVerse = sectionBudgets(
        paper.rubric?.expectedLength ?? null,
        documentSections(steps),
    ).perVerse;

    return (
        <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <header className="flex items-start justify-between gap-3 mb-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <NotebookPen className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                            {t('detail.stepsTitle')}
                        </h2>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t('detail.stepsSubtitle')}
                    </p>
                </div>
                {!hasSteps && (
                    <Button
                        size="sm"
                        onClick={onStartGeneration}
                        disabled={!passageEligible || starting}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 disabled:opacity-50"
                    >
                        {starting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1.5" />}
                        {t('detail.steps.startCta')}
                    </Button>
                )}
            </header>

            {!hasSteps ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900/40 px-6 py-10 text-center">
                    <div className="mx-auto w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mb-3">
                        <Wand2 className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
                        {t('detail.stepsEmpty.title')}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        {countVerses(paper) !== null
                            ? t('detail.stepsEmpty.body_other', { verseCount: countVerses(paper) })
                            : t('detail.stepsEmpty.body')}
                    </p>
                    {!passageEligible && passageHint && (
                        <p className="mt-3 text-[11px] text-amber-700 dark:text-amber-300 inline-flex items-start gap-1.5 max-w-md mx-auto text-left">
                            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>{passageHint}</span>
                        </p>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {sortedSteps.map(step => (
                        <StepCard
                            key={step.id}
                            step={step}
                            paperId={paper.id}
                            language={language}
                            allSteps={paper.steps}
                            hasAssembly={!!paper.assembledMarkdown?.trim()}
                            targetWordsPerVerse={targetWordsPerVerse}
                        />
                    ))}
                    {/* v1.7 corpus-usage planning — coverage report
                        once the user starts accepting steps. Self-hides
                        when there's nothing to report (no sources or
                        no accepted steps yet). */}
                    <CorpusCoverageReport paper={paper} />
                </div>
            )}
        </section>
    );
}

// ── Sidebar — Rubric ────────────────────────────────────────────────────

/**
 * Surfaces `paper.rubric` (embedded snapshot) so the detail view shows
 * the same source of truth the setup wizard edits.
 *
 * Headline resolution priority:
 *   1. If the rubric came from a saved template AND that template
 *      still exists in the user's library → show the template's
 *      `displayName`. That's the identity the user picked and
 *      remembers.
 *   2. Otherwise fall back to the provenance label ("Desde plantilla",
 *      "Editada", "Default del sistema", "Extraída de…").
 *
 * The provenance label still appears as a smaller hint when the
 * headline is the template name AND the rubric has been edited since
 * apply (so the user sees "Trabajo Exegético TMS · editada") — this
 * keeps the breadcrumb honest without losing the name.
 */
function RubricCard({ paper, t }: { paper: ExegeticalPaper; t: (key: string, opts?: Record<string, unknown>) => string }) {
    const rubric = paper.rubric;
    const { rubrics: userRubrics } = useUserRubrics();
    const sourceTemplate = rubric?.sourceTemplateId
        ? userRubrics.find(r => r.id === rubric.sourceTemplateId) ?? null
        : null;
    const lengthLabel = rubric?.expectedLength ? formatExpectedLength(rubric.expectedLength, t) : null;

    const headline = sourceTemplate
        ? sourceTemplate.displayName
        : rubric
            ? t(`paperSetup.subSteps.rubric.provenance.${rubric.provenance}`)
            : null;

    // Show provenance as hint only when (a) the headline is the
    // template name and (b) the rubric has been edited since apply
    // (provenance flipped to 'user-edited'). Otherwise the headline
    // already conveys the provenance.
    const provenanceHint = sourceTemplate && rubric && rubric.provenance === 'user-edited'
        ? t(`paperSetup.subSteps.rubric.provenance.${rubric.provenance}`)
        : null;

    return (
        <section className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <header className="flex items-center gap-2 mb-3">
                <FileCheck2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {t('detail.rubric.title')}
                </h3>
            </header>
            {rubric ? (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 px-3 py-2">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                        {headline}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {provenanceHint ? `${provenanceHint} · ` : ''}
                        {t('detail.rubric.requirementsCount', { count: rubric.sourceRequirements.length })}
                        {lengthLabel ? ` · ${lengthLabel}` : ''}
                    </p>
                </div>
            ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    {t('detail.rubric.none')}
                </p>
            )}
            <Link
                to={`/dashboard/exegesis/${paper.id}/setup?tab=rubric`}
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-success hover:text-success-subtle-foreground"
            >
                <Pencil className="h-3 w-3" />
                {t('detail.rubric.changeCta')}
            </Link>
        </section>
    );
}

/**
 * Renders an `ExpectedLengthRange` as a compact label. Picks the right
 * unit and handles the "min only" case (open upper bound) separately
 * since `min–null` reads awkwardly.
 */
function formatExpectedLength(
    range: NonNullable<ExegeticalPaper['rubric']>['expectedLength'],
    t: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
    if (!range) return null;
    const { unit, min, max } = range;
    if (min !== null && max !== null) {
        return t(unit === 'pages' ? 'detail.rubric.lengthPages' : 'detail.rubric.lengthWords', { min, max });
    }
    if (min !== null) {
        return t(unit === 'pages' ? 'detail.rubric.lengthMinPages' : 'detail.rubric.lengthMinWords', { min });
    }
    return null;
}

// ── Sidebar — Style guide ───────────────────────────────────────────────

function StyleGuideCard({ paper, t }: { paper: ExegeticalPaper; t: (key: string) => string }) {
    const { guides, activeGuide } = useUserStyleGuides();
    // Resolution order matches the orchestrator + setup view: a paper
    // may pin a specific guide via `paper.styleGuideId`; if not, it
    // inherits the user-level active guide. The detail card has to
    // mirror this — otherwise the user sees "no guide" here while the
    // setup shows one, contradicting itself.
    const pinned = paper.styleGuideId
        ? guides.find(g => g.id === paper.styleGuideId) ?? null
        : null;
    const effective = pinned ?? activeGuide;
    // Distinguish "explicitly chosen for this paper" from "inherited
    // because it's your active guide" — both work for generation but
    // the user should know which they're looking at.
    const isInherited = !pinned && effective !== null;

    return (
        <section className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <header className="flex items-center gap-2 mb-3">
                <BookOpen className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {t('detail.styleGuide.title')}
                </h3>
            </header>
            {effective ? (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 px-3 py-2">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                        {effective.displayName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {isInherited ? t('detail.styleGuide.inheritedHint') : null}
                        {isInherited && effective.version ? ' · ' : ''}
                        {effective.version ? `v${effective.version}` : ''}
                    </p>
                </div>
            ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    {t('detail.styleGuide.none')}
                </p>
            )}
            <Link
                to={`/dashboard/exegesis/${paper.id}/setup?tab=manifest`}
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-success hover:text-success-subtle-foreground"
            >
                <Pencil className="h-3 w-3" />
                {t('detail.styleGuide.changeCta')}
            </Link>
        </section>
    );
}

// ── Sidebar — Sources ───────────────────────────────────────────────────

function SourcesCard({
    paper,
    onRemove,
    isRemoving,
    t,
}: {
    paper: ExegeticalPaper;
    onRemove: (sourceId: string) => Promise<void>;
    isRemoving: boolean;
    t: (key: string) => string;
}) {
    return (
        <section className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <header className="flex items-center gap-2 mb-3">
                <FileStack className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {t('detail.sources.title')}
                </h3>
                <span className="ml-auto text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {paper.sources.length}
                </span>
            </header>

            {paper.sources.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    {t('detail.sources.none')}
                </p>
            ) : (
                <ul className="space-y-1.5">
                    {paper.sources.map(s => (
                        <SourceRow key={s.id} source={s} onRemove={() => onRemove(s.id)} disabled={isRemoving} t={t} />
                    ))}
                </ul>
            )}

            <Link
                to={`/dashboard/exegesis/${paper.id}/setup?tab=corpus`}
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-success hover:text-success-subtle-foreground"
            >
                <Pencil className="h-3 w-3" />
                {t('detail.sources.addCta')}
            </Link>
        </section>
    );
}

function SourceRow({
    source,
    onRemove,
    disabled,
    t,
}: {
    source: ProjectSource;
    onRemove: () => void;
    disabled: boolean;
    t: (key: string) => string;
}) {
    const isStyleTemplate = source.sourceType === 'style-template-paper';
    return (
        <li className="group flex items-start gap-2 rounded-md border border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 px-2.5 py-2">
            <BookOpenText className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">
                    {source.displayLabel}
                </p>
                <p className={
                    isStyleTemplate
                        ? 'text-[10px] text-amber-700 dark:text-amber-300 truncate'
                        : 'text-[10px] text-slate-500 dark:text-slate-400 truncate'
                }>
                    {t(`sourceTypes.${source.sourceType}.label`)}
                    {source.citationKey && !isStyleTemplate ? ` · ${source.citationKey}` : ''}
                </p>
            </div>
            <button
                type="button"
                onClick={onRemove}
                disabled={disabled}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all disabled:opacity-30"
                aria-label={t('detail.sources.remove')}
                title={t('detail.sources.remove')}
            >
                <X className="h-3 w-3" />
            </button>
        </li>
    );
}

// ── Misc helpers ────────────────────────────────────────────────────────

function CenteredMessage({
    icon,
    text,
    tone = 'neutral',
}: {
    icon: React.ReactNode;
    text: string;
    tone?: 'neutral' | 'error';
}) {
    return (
        <div className="flex items-center justify-center h-full bg-slate-50/50 dark:bg-zinc-950/50">
            <div className={
                tone === 'error'
                    ? 'inline-flex items-center gap-2 text-sm text-rose-700 dark:text-rose-300'
                    : 'inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400'
            }>
                {icon}
                <span>{text}</span>
            </div>
        </div>
    );
}

function NotFound() {
    const { t } = useTranslation('exegesis');
    return (
        <div className="flex flex-col items-center justify-center h-full bg-slate-50/50 dark:bg-zinc-950/50 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 flex items-center justify-center mb-3">
                <NotebookPen className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">
                {t('detail.notFound.title')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-md">
                {t('detail.notFound.body')}
            </p>
            <Link
                to="/dashboard/exegesis"
                className="text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:underline"
            >
                {t('detail.notFound.backCta')}
            </Link>
        </div>
    );
}

/**
 * Number of verses in the paper's passage range. Used in the empty
 * step state to set expectations ("we'll generate N verses + conclusion +
 * intro + assembly"). Falls back to "this passage" for chapter-only or
 * multi-chapter ranges where verse counting requires verses-per-chapter
 * data we don't carry in v1.
 */
function countVerses(paper: ExegeticalPaper): number | null {
    const { chapterStart, chapterEnd, verseStart, verseEnd } = paper.passage;
    if (verseStart === null || verseEnd === null) return null;
    if (chapterStart !== chapterEnd) return null; // multi-chapter, can't count without per-chapter data
    return verseEnd - verseStart + 1;
}

/**
 * Builds a filesystem-safe filename stem for academic-paper download.
 * Strips diacritics, lowercases, swaps non-alphanumeric for hyphens.
 * "Hebreos 1:1-4" → "hebreos-1-1-4".
 */
function buildPaperFilename(paper: ExegeticalPaper, language: SupportedLanguage): string {
    const base = paper.title?.trim() || formatPassageReference(paper.passage, language);
    const normalized = base
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || 'paper';
}

/**
 * Whether the paper's passage shape qualifies for generation in v1
 * (single chapter with explicit verses). Mirror of the seedSteps repo
 * check — surfaced upfront so the user sees the gate BEFORE clicking
 * "Iniciar generación" instead of as an error toast after.
 */
function passageEligibleForGeneration(paper: ExegeticalPaper): {
    eligible: boolean;
    hint: (t: (key: string) => string) => string | null;
} {
    const { chapterStart, chapterEnd, verseStart, verseEnd } = paper.passage;
    if (chapterStart !== chapterEnd) {
        return { eligible: false, hint: (t) => t('detail.steps.gate.multiChapter') };
    }
    if (verseStart === null || verseEnd === null) {
        return { eligible: false, hint: (t) => t('detail.steps.gate.noVerses') };
    }
    return { eligible: true, hint: () => null };
}

// ── Layout preference persistence ───────────────────────────────────────

const LAYOUT_PREF_STORAGE_KEY = 'exegesisPaperLayoutPrefs';
const TEXT_ZOOM_STORAGE_KEY = 'exegesisPaperTextZoom';

type LayoutPrefKey = 'sidebarCollapsed' | 'readingMode';

function readLayoutPref(key: LayoutPrefKey, fallback: boolean): boolean {
    if (typeof window === 'undefined') return fallback;
    try {
        const raw = window.localStorage.getItem(LAYOUT_PREF_STORAGE_KEY);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw) as Partial<Record<LayoutPrefKey, boolean>>;
        return typeof parsed[key] === 'boolean' ? parsed[key]! : fallback;
    } catch {
        return fallback;
    }
}

function writeLayoutPref(key: LayoutPrefKey, value: boolean): void {
    if (typeof window === 'undefined') return;
    try {
        const raw = window.localStorage.getItem(LAYOUT_PREF_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as Partial<Record<LayoutPrefKey, boolean>>) : {};
        parsed[key] = value;
        window.localStorage.setItem(LAYOUT_PREF_STORAGE_KEY, JSON.stringify(parsed));
    } catch {
        // localStorage may be unavailable (private mode, quota) — silent fail.
    }
}

function readZoomPref(): TextZoomLevel {
    if (typeof window === 'undefined') return 1;
    const stored = window.localStorage.getItem(TEXT_ZOOM_STORAGE_KEY);
    const parsed = stored ? Number(stored) : 1;
    return parsed === 2 || parsed === 3 ? (parsed as 2 | 3) : 1;
}

function writeZoomPref(level: TextZoomLevel): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(TEXT_ZOOM_STORAGE_KEY, String(level));
    } catch {
        // ignore
    }
}
