import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NotebookPen, Plus, Sparkles, Loader2, AlertCircle, Search, X, Archive, BookOpen, FileText, ListChecks, Languages, LayoutGrid, List, PanelRight, FolderKanban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { seriesService } from '@dosfilos/application';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useFirebase } from '@/context/firebase-context';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';
import { UserRubricsSection } from '@/components/exegesis/directory/UserRubricsSection';
import { UserStyleGuidesSection } from '@/components/exegesis/directory/UserStyleGuidesSection';
import { ExegesisQuotaBadge } from '@/components/exegesis/ExegesisQuotaBadge';
import { CreditPacksDialog } from '@/pages/library/components/CreditPacksDialog';
import {
    formatPassageReference,
    matchesProjectFilter,
    projectsOfPaper,
    type ExegesisPaperSummary,
    type ExegeticalPaperPhase,
    type SupportedLanguage,
} from '@dosfilos/domain';

// Phases shown as filter chips. 'archived' is excluded — it has its own
// toggle since archived papers are usually noise unless explicitly asked
// for. Order is the natural lifecycle order (configuring → in-progress →
// assembled).
const FILTERABLE_PHASES: ExegeticalPaperPhase[] = ['configuring', 'in-progress', 'assembled'];

/**
 * Exégesis — landing del módulo de redacción exegética asistida.
 *
 * Renders the user's papers list (live from Firestore via TanStack Query)
 * plus the entry point to the setup wizard. Empty state and loading state
 * keep the page coherent before the data arrives. The "v1 en construcción"
 * banner stays put as honest comms while step generation and citation
 * verification land in subsequent commits.
 */
export function ExegesisPage() {
    const { t, i18n } = useTranslation('exegesis');
    const navigate = useNavigate();
    const goToSetup = () => navigate('/dashboard/exegesis/new');
    const goToBilling = () => navigate('/dashboard/settings/billing');
    const { papers, isLoading, error } = useExegesisPapers();
    const { user } = useFirebase();
    const [packsOpen, setPacksOpen] = useState(false);
    const activeLanguage: SupportedLanguage = i18n.language?.split('-')[0] === 'en' ? 'en' : 'es';

    // Fetch the user's series so we can show "belongs to series X" on
    // each paper card. A planned sermon inside a series can carry a
    // `paperId` pointing at an ExegeticalPaper — when present, the
    // paper is part of an expository series and the user benefits
    // from seeing that link without having to remember the
    // relationship themselves. Index lookup is built once per series
    // refetch.
    const { data: seriesList = [] } = useQuery({
        queryKey: ['series', 'forExegesisPapers', user?.uid],
        queryFn: async () => {
            if (!user?.uid) return [];
            return seriesService.getUserSeries(user.uid);
        },
        enabled: !!user?.uid,
    });

    const paperToSeries = useMemo(() => {
        const idx = new Map<string, { id: string; title: string }>();
        for (const series of seriesList) {
            const planned = series.metadata?.plannedSermons ?? [];
            for (const sermon of planned) {
                if (sermon.paperId) {
                    idx.set(sermon.paperId, { id: series.id, title: series.title });
                }
            }
        }
        return idx;
    }, [seriesList]);

    // Client-side filter state. The data set is per-user (rarely more
    // than a few dozen papers), so filtering in memory is fine — no need
    // to push these into the Firestore query.
    const [search, setSearch] = useState('');
    const [phaseFilter, setPhaseFilter] = useState<ExegeticalPaperPhase | 'all'>('all');
    const [includeArchived, setIncludeArchived] = useState(false);
    // Por proyecto (ADR-046): 'all', 'none' (sueltos) o el id del proyecto.
    const [projectFilter, setProjectFilter] = useState<string>('all');
    const { projects } = useFacultyProjects();
    const projectTitle = useMemo(() => new Map((projects ?? []).map(p => [p.id, p.title] as const)), [projects]);

    // Layout state. Both persist via localStorage so the user's
    // preference survives reloads.
    const VIEW_KEY = 'dosfilos.exegesis.viewMode';
    const SIDEBAR_KEY = 'dosfilos.exegesis.sidebar';
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
        if (typeof window === 'undefined') return 'grid';
        try {
            return window.localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
        } catch { return 'grid'; }
    });
    const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        try {
            return window.localStorage.getItem(SIDEBAR_KEY) === 'open';
        } catch { return false; }
    });
    const setViewModePersisted = (v: 'grid' | 'list') => {
        setViewMode(v);
        try { window.localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
    };
    const toggleSidebar = () => {
        setSidebarOpen((open) => {
            const next = !open;
            try { window.localStorage.setItem(SIDEBAR_KEY, next ? 'open' : 'closed'); } catch { /* ignore */ }
            return next;
        });
    };

    const filteredPapers = useMemo(() => {
        const q = search.trim().toLowerCase();
        return papers.filter(p => {
            // Archived papers are hidden by default. The 'archived' phase
            // and the soft-delete `archivedAt` marker can both signal an
            // archived paper depending on history; treat either as such.
            const isArchived = p.phase === 'archived' || p.archivedAt !== null;
            if (isArchived && !includeArchived) return false;
            if (phaseFilter !== 'all' && p.phase !== phaseFilter) return false;
            if (!matchesProjectFilter(p, projectFilter)) return false;
            if (q.length > 0) {
                const haystack = `${p.title ?? ''} ${formatPassageReference(p.passage, activeLanguage)}`.toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }, [papers, search, phaseFilter, includeArchived, activeLanguage, projectFilter]);

    const hasActiveFilters = search.length > 0 || phaseFilter !== 'all' || includeArchived || projectFilter !== 'all';
    const clearFilters = () => {
        setSearch('');
        setPhaseFilter('all');
        setIncludeArchived(false);
        setProjectFilter('all');
    };
    /** El proyecto de origen, o el primero con que colabora, para el rótulo de la tarjeta. */
    const projectChip = (p: ExegesisPaperSummary): { title: string; linked: boolean } | null => {
        const [primero] = projectsOfPaper(p);
        const title = primero ? projectTitle.get(primero) : undefined;
        return title ? { title, linked: p.projectId !== primero } : null;
    };

    return (
        <div className="flex flex-col h-full bg-background font-sans overflow-y-auto">
            {/* Compact hero. Description is onboarding copy — only
                shows when the user hasn't created any paper yet. Once
                populated, the page is operational and the description
                becomes noise. Same pattern Projects uses. */}
            <div className={cn(
                "border-b border-border bg-gradient-to-b from-card to-muted/40 dark:from-slate-900 dark:to-slate-950 px-6 sm:px-10 shrink-0",
                papers.length === 0 ? "pt-8 pb-10" : "py-4",
            )}>
                <div className="max-w-7xl mx-auto flex items-center gap-3">
                    <div className={cn(
                        "shrink-0 rounded-lg bg-primary/10 border border-primary/20 text-primary dark:bg-primary/15 dark:border-primary/30 flex items-center justify-center",
                        papers.length === 0 ? "w-12 h-12 rounded-xl" : "w-9 h-9",
                    )}>
                        <NotebookPen className={papers.length === 0 ? "w-6 h-6" : "w-5 h-5"} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className={cn(
                            "font-bold tracking-tight text-foreground leading-tight font-serif",
                            papers.length === 0 ? "text-2xl md:text-3xl" : "text-lg md:text-xl",
                        )}>
                            {t('directory.heroTitle')}
                        </h1>
                        {papers.length === 0 && (
                            <p className="text-muted-foreground text-sm leading-snug mt-1 max-w-3xl">
                                {t('directory.heroSubtitle')}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Body — 2-column grid. Papers dominate the main column;
                resources (rubrics + style guides) sit in a sticky
                sidebar so the user always has them in peripheral
                vision while scrolling through papers. On narrow
                screens the columns stack. */}
            <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-5">
                <div className="mb-4">
                    <ExegesisQuotaBadge
                        variant="banner"
                        onBuyPacks={() => setPacksOpen(true)}
                        onUpgradePlan={goToBilling}
                    />
                </div>

                {/* Single-line sub-header — count + view toggle +
                    sidebar toggle + new btn. Replaces the previous
                    H2 + subtitle + button block (50% less vertical). */}
                <header className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                    <div className="flex items-baseline gap-2">
                        <h2 className="font-reading text-[20px] font-bold text-foreground">
                            {t('directory.papersTitle')}
                        </h2>
                        {papers.length > 0 && (
                            <span className="text-[13px] text-muted-foreground tabular-nums">
                                · {papers.length}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {/* View toggle — only relevant once data exists */}
                        {papers.length > 0 && (
                            <div className="hidden sm:flex items-center border border-border/60 rounded-md overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setViewModePersisted('grid')}
                                    className={cn(
                                        'h-8 w-8 inline-flex items-center justify-center transition-colors',
                                        viewMode === 'grid'
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                                    )}
                                    aria-label="Vista de cuadrícula"
                                    title="Vista de cuadrícula"
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewModePersisted('list')}
                                    className={cn(
                                        'h-8 w-8 inline-flex items-center justify-center transition-colors',
                                        viewMode === 'list'
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                                    )}
                                    aria-label="Vista de lista"
                                    title="Vista de lista"
                                >
                                    <List className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                        {/* Sidebar toggle — defaults closed so cards
                            get the full canvas. */}
                        <Button
                            variant={sidebarOpen ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={toggleSidebar}
                            title="Mis recursos (rúbricas + guías)"
                        >
                            <PanelRight className="h-4 w-4 mr-1.5" />
                            Recursos
                        </Button>
                        <Button
                            onClick={goToSetup}
                            className="bg-primary-solid hover:bg-primary-solid-hover text-primary-foreground shrink-0"
                            size="sm"
                        >
                            <Plus className="h-4 w-4 mr-1.5" />
                            {t('directory.newPaperCta')}
                        </Button>
                    </div>
                </header>

                <div className={cn(
                    "grid gap-6 items-start",
                    sidebarOpen ? "grid-cols-1 lg:grid-cols-[1fr_320px]" : "grid-cols-1",
                )}>
                    {/* Main column — papers */}
                    <section>

                        {/* Toolbar: only render once there's data worth filtering.
                            Empty/loading/error states have nothing for the user
                            to filter against, so showing the toolbar then would
                            just be noise. */}
                        {!isLoading && !error && papers.length > 0 && (
                            <PapersToolbar
                                t={t}
                                search={search}
                                onSearchChange={setSearch}
                                phaseFilter={phaseFilter}
                                onPhaseFilterChange={setPhaseFilter}
                                includeArchived={includeArchived}
                                onIncludeArchivedChange={setIncludeArchived}
                                visibleCount={filteredPapers.length}
                                totalCount={papers.length}
                                hasActiveFilters={hasActiveFilters}
                                onClear={clearFilters}
                                projects={(projects ?? []).filter(p => !p.deletedAt)}
                                projectFilter={projectFilter}
                                onProjectFilterChange={setProjectFilter}
                            />
                        )}

                        {isLoading ? (
                            <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-8 py-10 text-center text-sm text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-success" />
                                {t('list.loading')}
                            </div>
                        ) : error ? (
                            <ErrorBlock error={error} fallbackMessage={t('list.loadFailed')} />
                        ) : papers.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-8 py-12 text-center">
                                <div className="mx-auto w-12 h-12 rounded-full bg-success-subtle text-success flex items-center justify-center mb-4">
                                    <NotebookPen className="h-6 w-6" />
                                </div>
                                <h3 className="text-base font-semibold text-foreground mb-2">
                                    {t('directory.empty.title')}
                                </h3>
                                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
                                    {t('directory.empty.body')}
                                </p>
                                <Button
                                    onClick={goToSetup}
                                    variant="outline"
                                    className="border-success/40 text-success-subtle-foreground"
                                >
                                    <Sparkles className="h-4 w-4 mr-1.5" />
                                    {t('directory.empty.cta')}
                                </Button>
                            </div>
                        ) : filteredPapers.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center">
                                <Search className="h-6 w-6 text-muted-foreground mx-auto mb-3" />
                                <h3 className="text-sm font-semibold text-foreground mb-1">
                                    {t('list.filters.noMatches')}
                                </h3>
                                <p className="text-xs text-muted-foreground mb-4">
                                    {t('list.filters.noMatchesHint')}
                                </p>
                                <Button onClick={clearFilters} variant="outline" size="sm">
                                    {t('list.filters.clear')}
                                </Button>
                            </div>
                        ) : viewMode === 'list' ? (
                            <ul className="border border-border/60 rounded-lg overflow-hidden divide-y divide-border/60 bg-card">
                                {filteredPapers.map(p => (
                                    <PaperListRow
                                        key={p.id}
                                        paper={p}
                                        language={activeLanguage}
                                        t={t}
                                        seriesLink={paperToSeries.get(p.id) ?? null}
                                        projectChip={projectChip(p)}
                                    />
                                ))}
                            </ul>
                        ) : (
                            <ul className={cn(
                                "grid gap-3 grid-cols-1",
                                sidebarOpen ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3",
                            )}>
                                {filteredPapers.map(p => (
                                    <PaperCard
                                        key={p.id}
                                        paper={p}
                                        language={activeLanguage}
                                        t={t}
                                        seriesLink={paperToSeries.get(p.id) ?? null}
                                        projectChip={projectChip(p)}
                                    />
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* Sidebar — collapsible. Defaults closed; the
                        "Recursos" button in the page header toggles it.
                        When closed, the cards grid expands to fill the
                        full canvas (3 columns at xl). */}
                    {sidebarOpen && (
                        <aside className="space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
                            <UserRubricsSection />
                            <UserStyleGuidesSection />
                        </aside>
                    )}
                </div>
            </main>
            <CreditPacksDialog
                open={packsOpen}
                onOpenChange={setPacksOpen}
                focusMode="exegesis"
            />
        </div>
    );
}

// ── Toolbar ─────────────────────────────────────────────────────────────

interface PapersToolbarProps {
    t: (key: string, opts?: Record<string, unknown>) => string;
    search: string;
    onSearchChange: (s: string) => void;
    phaseFilter: ExegeticalPaperPhase | 'all';
    onPhaseFilterChange: (p: ExegeticalPaperPhase | 'all') => void;
    includeArchived: boolean;
    onIncludeArchivedChange: (v: boolean) => void;
    visibleCount: number;
    totalCount: number;
    hasActiveFilters: boolean;
    onClear: () => void;
    projects: ReadonlyArray<{ id: string; title: string }>;
    projectFilter: string;
    onProjectFilterChange: (v: string) => void;
}

function PapersToolbar({
    t,
    search,
    onSearchChange,
    phaseFilter,
    onPhaseFilterChange,
    includeArchived,
    onIncludeArchivedChange,
    visibleCount,
    totalCount,
    hasActiveFilters,
    onClear,
    projects,
    projectFilter,
    onProjectFilterChange,
}: PapersToolbarProps) {
    return (
        <div className="mb-4 space-y-3">
            {projects.length > 0 && (
                <select
                    aria-label={t('paperProjects.filterLabel')}
                    value={projectFilter}
                    onChange={(e) => onProjectFilterChange(e.target.value)}
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                    <option value="all">{t('paperProjects.filterAll')}</option>
                    <option value="none">{t('paperProjects.filterNone')}</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
            )}
            <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                    type="search"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={t('list.filters.searchPlaceholder')}
                    className="w-full rounded-lg border border-border bg-card pl-9 pr-9 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
                {search.length > 0 && (
                    <button
                        type="button"
                        onClick={() => onSearchChange('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                        aria-label={t('list.filters.clear')}
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <PhaseChip
                    active={phaseFilter === 'all'}
                    onClick={() => onPhaseFilterChange('all')}
                    label={t('list.filters.all')}
                />
                {FILTERABLE_PHASES.map(phase => (
                    <PhaseChip
                        key={phase}
                        active={phaseFilter === phase}
                        onClick={() => onPhaseFilterChange(phase)}
                        label={t(`list.phase.${phase}`)}
                    />
                ))}

                <button
                    type="button"
                    onClick={() => onIncludeArchivedChange(!includeArchived)}
                    className={[
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        includeArchived
                            ? 'border-success bg-success-subtle text-success-subtle-foreground'
                            : 'border-border bg-card text-muted-foreground hover:bg-accent',
                    ].join(' ')}
                    aria-pressed={includeArchived}
                >
                    <Archive className="h-3 w-3" />
                    {t('list.filters.showArchived')}
                </button>

                <span className="text-xs text-muted-foreground ml-auto">
                    {hasActiveFilters
                        ? t('list.filters.countFiltered', { visible: visibleCount, total: totalCount })
                        : t('list.filters.countAll', { count: totalCount })}
                </span>

                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                    >
                        {t('list.filters.clear')}
                    </button>
                )}
            </div>
        </div>
    );
}

function PhaseChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                active
                    ? 'border-primary bg-primary-solid text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-accent',
            ].join(' ')}
            aria-pressed={active}
        >
            {label}
        </button>
    );
}

// ── Card ────────────────────────────────────────────────────────────────

interface PaperCardProps {
    paper: ExegesisPaperSummary;
    language: SupportedLanguage;
    t: (key: string) => string;
    /**
     * When the paper is referenced from a sermon series'
     * `plannedSermons[].paperId`, surface that link on the card so
     * the user understands the paper's larger preaching context. Null
     * when the paper is standalone.
     */
    seriesLink: { id: string; title: string } | null;
    /** El proyecto del estudio (ADR-046), solo como rótulo. */
    projectChip?: { title: string; linked: boolean } | null;
}

// Phase → semantic-token color map. Driving badge color from phase is
// the cheapest scannability win in a 2-col grid: the user can tell at a
// glance which papers are still in setup vs being written vs assembled.
const PHASE_BADGE: Record<ExegeticalPaperPhase, string> = {
    'configuring': 'bg-warning-subtle text-warning-subtle-foreground border-warning/30',
    'in-progress': 'bg-info-subtle text-info-subtle-foreground border-info/30',
    'assembled': 'bg-success-subtle text-success-subtle-foreground border-success/30',
    'archived': 'bg-muted text-muted-foreground border-border',
};

function PaperCard({ paper, language, t, seriesLink, projectChip }: PaperCardProps) {
    const navigate = useNavigate();
    const open = () => navigate(`/dashboard/exegesis/${paper.id}`);
    const isArchived = paper.phase === 'archived' || paper.archivedAt !== null;

    // Compose the headline. When the paper carries a custom `title`
    // (typically from the sermon planner where the user named the
    // sermon) we use it as the headline AND show the passage as a
    // secondary chip below — that way two papers on the same passage
    // with different sermon titles are distinguishable AND a paper
    // with a passage-only identity still reads naturally.
    const formattedPassage = formatPassageReference(paper.passage, language);
    const hasCustomTitle = !!paper.title && paper.title.trim().length > 0
        && paper.title.trim() !== formattedPassage;
    const headline = hasCustomTitle ? paper.title!.trim() : formattedPassage;

    // Brief slice — the first ~110 chars of the user's assignmentBrief.
    // The strongest single discriminator when two papers share a passage
    // (e.g. \"apertura cristológica\" vs \"énfasis en superioridad sobre los profetas\").
    const briefSlice = paper.assignmentBrief
        ? truncateAtWordBoundary(paper.assignmentBrief.trim(), 110)
        : null;

    // Step progress — accepted vs total. Tells the user at a glance
    // whether this paper is sitting at setup (no steps), mid-write
    // (X/Y), or fully accepted (Y/Y). Matches what the detail page shows.
    const totalSteps = paper.stepCount;
    const acceptedSteps = paper.acceptedStepCount;
    const showStepProgress = totalSteps > 0;

    const sourceCount = paper.sourceCount;

    const handleSeriesClick = (e: React.MouseEvent) => {
        // Stop the parent button's onClick (which navigates to the
        // paper detail) so the user lands on the series instead.
        e.stopPropagation();
        if (seriesLink) navigate(`/dashboard/plans/${seriesLink.id}`);
    };

    return (
        <li>
            <button
                type="button"
                onClick={open}
                className={[
                    'w-full h-full text-left rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all px-4 py-3 flex flex-col gap-2.5',
                    isArchived ? 'border-border opacity-70' : 'border-border',
                ].join(' ')}
            >
                <div className="flex items-start gap-3">
                    <div className="shrink-0 w-9 h-9 rounded-full bg-success-subtle text-success flex items-center justify-center">
                        <NotebookPen className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground truncate">
                            {headline}
                        </h3>
                        {/* Passage chip — ALWAYS visible. When the headline
                            already IS the passage we render a less-loud
                            language badge instead of repeating ourselves. */}
                        {hasCustomTitle ? (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                                    <BookOpen className="h-3 w-3" aria-hidden />
                                    {formattedPassage}
                                </span>
                                <span className="text-border">·</span>
                                <span className="uppercase tracking-wide">{paper.displayLanguage}</span>
                            </div>
                        ) : (
                            <div className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1.5">
                                <Languages className="h-3 w-3" aria-hidden />
                                <span className="uppercase tracking-wide">{paper.displayLanguage}</span>
                            </div>
                        )}
                    </div>
                </div>

                {briefSlice && (
                    <p className="text-[11.5px] text-muted-foreground italic leading-snug line-clamp-2">
                        “{briefSlice}”
                    </p>
                )}

                {projectChip && (
                    <span className="inline-flex items-center gap-1.5 self-start max-w-full rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground">
                        <FolderKanban className="h-3 w-3 shrink-0" />
                        <span className="truncate">{projectChip.title}</span>
                        {projectChip.linked && <span className="shrink-0">· {t('paperProjects.chipLinked')}</span>}
                    </span>
                )}

                {seriesLink && (
                    <div
                        onClick={handleSeriesClick}
                        role="link"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleSeriesClick(e as unknown as React.MouseEvent);
                            }
                        }}
                        className="inline-flex items-center gap-1.5 text-[11px] text-info-subtle-foreground bg-info-subtle border border-info/30 rounded-md px-2 py-1 hover:bg-info-subtle/80 transition-colors max-w-full self-start"
                        title={t('list.seriesLink.tooltip')}
                    >
                        <BookOpen className="h-3 w-3 shrink-0" />
                        <span className="font-medium shrink-0">{t('list.seriesLink.label')}:</span>
                        <span className="truncate">{seriesLink.title}</span>
                    </div>
                )}

                {/* Step progress bar — visualizes accepted/total
                    steps. Only render when there's something to show. */}
                {showStepProgress && (
                    <div className="space-y-1">
                        <div className="h-1 w-full bg-border/40 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${Math.round((acceptedSteps / totalSteps) * 100)}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                                <ListChecks className="h-3 w-3" aria-hidden />
                                {acceptedSteps}/{totalSteps} pasos
                            </span>
                            <span>{Math.round((acceptedSteps / totalSteps) * 100)}%</span>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                    <div className="flex items-center gap-2.5 text-[10.5px] text-muted-foreground min-w-0">
                        {sourceCount > 0 && (
                            <span className="inline-flex items-center gap-1 shrink-0" title={t('list.meta.sourcesTooltip', { count: sourceCount })}>
                                <FileText className="h-3 w-3" aria-hidden />
                                {t('list.meta.sources', { count: sourceCount })}
                            </span>
                        )}
                        <span className="truncate" title={paper.updatedAt.toLocaleString()}>
                            {paper.updatedAt.toLocaleDateString()}
                        </span>
                    </div>
                    <span className={[
                        'inline-flex items-center text-[10px] font-semibold rounded-full border px-2 py-0.5 shrink-0',
                        PHASE_BADGE[paper.phase],
                    ].join(' ')}>
                        {t(`list.phase.${paper.phase}`)}
                    </span>
                </div>
            </button>
        </li>
    );
}

// ── List Row (compact alt view) ─────────────────────────────────────────

function PaperListRow({ paper, language, t, seriesLink, projectChip }: PaperCardProps) {
    const navigate = useNavigate();
    const open = () => navigate(`/dashboard/exegesis/${paper.id}`);
    const isArchived = paper.phase === 'archived' || paper.archivedAt !== null;
    const formattedPassage = formatPassageReference(paper.passage, language);
    const hasCustomTitle = !!paper.title && paper.title.trim().length > 0
        && paper.title.trim() !== formattedPassage;
    const headline = hasCustomTitle ? paper.title!.trim() : formattedPassage;
    const totalSteps = paper.stepCount;
    const acceptedSteps = paper.acceptedStepCount;
    const sourceCount = paper.sourceCount;

    return (
        <li>
            <button
                type="button"
                onClick={open}
                className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors text-left",
                    isArchived && "opacity-70",
                )}
            >
                <NotebookPen className="h-4 w-4 text-success shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                        <span className="font-medium text-[14px] text-foreground truncate">{headline}</span>
                        {hasCustomTitle && (
                            <span className="text-[11px] text-muted-foreground truncate hidden md:inline">
                                {formattedPassage}
                            </span>
                        )}
                    </div>
                    {seriesLink && (
                        <div className="text-[11px] text-info-subtle-foreground truncate mt-0.5">
                            Serie: {seriesLink.title}
                        </div>
                    )}
                    {projectChip && (
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {projectChip.title}{projectChip.linked ? ` · ${t('paperProjects.chipLinked')}` : ''}
                        </div>
                    )}
                </div>
                {totalSteps > 0 && (
                    <div className="hidden md:flex items-center gap-2 shrink-0 w-32">
                        <div className="flex-1 h-1 bg-border/40 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${Math.round((acceptedSteps / totalSteps) * 100)}%` }}
                            />
                        </div>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                            {acceptedSteps}/{totalSteps}
                        </span>
                    </div>
                )}
                <div className="hidden lg:flex items-center gap-3 text-[11.5px] text-muted-foreground shrink-0">
                    {sourceCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {sourceCount}
                        </span>
                    )}
                    <span className="w-20 text-right">{paper.updatedAt.toLocaleDateString()}</span>
                </div>
                <span className={cn(
                    'inline-flex items-center text-[10px] font-semibold rounded-full border px-2 py-0.5 shrink-0',
                    PHASE_BADGE[paper.phase],
                )}>
                    {t(`list.phase.${paper.phase}`)}
                </span>
            </button>
        </li>
    );
}

/**
 * Truncate `text` at the last whole-word boundary at or before `max`.
 * Falls back to a hard cut + ellipsis when no boundary is found.
 * Used by `PaperCard` to slice the assignmentBrief without mid-word cuts.
 */
function truncateAtWordBoundary(text: string, max: number): string {
    if (text.length <= max) return text;
    const slice = text.slice(0, max);
    const lastSpace = slice.lastIndexOf(' ');
    const cut = lastSpace > max * 0.6 ? lastSpace : max;
    return text.slice(0, cut) + '…';
}

/**
 * Surfaces query errors with their actual message instead of a
 * generic "no se pudo cargar" toast. The Firestore SDK throws
 * specific messages we want visible during testing — Permission
 * denied (rules out of date), failed-precondition (missing index),
 * deserialization errors (corrupt doc), etc.
 *
 * Falls back to the i18n string when the error has no message.
 */
function ErrorBlock({ error, fallbackMessage }: { error: unknown; fallbackMessage: string }) {
    // Always console.error so the full stack is captured in devtools
    // even when the visible message is short.
    console.error('[exegesis] directory query error:', error);
    const message = error instanceof Error
        ? error.message
        : typeof error === 'string'
            ? error
            : fallbackMessage;
    return (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-5 text-sm text-destructive inline-flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="font-medium">{fallbackMessage}</p>
                <p className="text-[11px] mt-1 font-mono break-all opacity-80">{message}</p>
            </div>
        </div>
    );
}
