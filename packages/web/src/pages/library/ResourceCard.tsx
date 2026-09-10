import { LibraryResourceEntity, LibraryCategory, WorkflowPhase } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertCircle,
    AlertTriangle,
    Book,
    BookMarked,
    BookOpen,
    CheckCircle2,
    Edit2,
    Eye,
    FileQuestion,
    FileText,
    FileWarning,
    Landmark,
    Languages,
    Library,
    Loader2,
    Map,
    MessageSquare,
    Mic2,
    MoreHorizontal,
    PenTool,
    RefreshCw,
    ScrollText,
    Settings2,
    Sparkles,
    Trash2,
    Wand2,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractionHealthOf } from '@/hooks/library/useExtractionHealth';
import { ExtractionStepper } from './components/ExtractionStepper';
import {
    resolveResourceStatusPill,
    resolveResourceStatusTooltip,
    type IndexStatus,
} from './resourceStatusPill';

type ViewMode = 'grid' | 'list';

interface ResourceCardProps {
    resource: LibraryResourceEntity;
    categories: LibraryCategory[];
    indexStatus: IndexStatus;
    isIndexing: boolean;
    /**
     * True while a delete request is in flight for this card. Renders
     * a dim overlay + spinner + "Eliminando…" so the user has clear
     * feedback while the (potentially slow) Storage object delete +
     * chunk cleanup + Firestore doc delete cascade runs.
     */
    isDeleting?: boolean;
    /**
     * True while a "Reintentar Premium" request is in flight for this
     * card. Spinner replaces the action icon so the user has feedback
     * during the long-running LlamaParse extraction (1-15 min).
     */
    isRetryingPremium?: boolean;
    /**
     * True while a Cancel request is in flight for this card. Disables
     * the Cancel button + spins the icon so the user can't double-click.
     */
    isCancelling?: boolean;
    viewMode?: ViewMode;
    onEdit: () => void;
    onDelete: () => void;
    onIndex: () => void;
    onReindex?: () => void;
    /**
     * Triggered by the user when the cascade degraded from their
     * requested Premium tier (engine badge shows the warning amber).
     * Optional — when not provided the action is not rendered.
     */
    onRetryPremium?: () => void;
    /**
     * Triggered when the user wants to cancel an in-progress
     * extraction (uploaded the wrong file, doesn't want to wait).
     * Only visible while the resource is in pending/processing/indexing.
     * Optional — when not provided the action is not rendered.
     */
    onCancelExtraction?: () => void;
    onPreview: () => void;
    onSetPhases?: () => void;
    onConfigureCoreStores?: () => void; // Admin: assigns the resource to Core Library stores
    /**
     * Abre la calibración de numeración impresa. Mientras el recurso no la
     * tenga, sus citas dicen «hoja N» en vez de «p. N» — que es verdadero
     * pero incompleto para un trabajo académico.
     */
    onCalibrateNumbering?: () => void;
}

// Icon mapping for category icons. Keep keys identical to the icon
// names referenced from `LibraryCategory.icon` in domain/DEFAULT_CATEGORIES.
const iconMap: Record<string, typeof Book> = {
    Book,
    BookMarked,
    BookOpen,
    Landmark,
    Languages,
    Library,
    Map,
    MessageSquare,
    ScrollText,
    FileText,
    FileQuestion,
};

// ── Category icon palette (data-driven decoration) ─────────────────────────
// `LibraryCategory.color` is a user/admin-defined preset (one of: blue, purple,
// green, orange, red, yellow, pink, gray). Each maps to a soft icon background.
//
// DOCUMENTED EXCEPTION to the no-literals theming rule: this is an explicit
// **data palette** (a preset enum exposed to authors), NOT a theme token.
// Notion, Linear and similar tools expose the same kind of fixed colour
// palette for content tagging. We intentionally keep the Tailwind palette
// here (lower saturation `-50/600/950` levels) because:
//   - The category colour IS the visual identity of each category type
//   - Adding 8 semantic tokens (`category-blue`, `category-pink`...) bloats
//     the design system without semantic gain — they're just colour presets
//   - Centralised here in one place rather than scattered as ad-hoc literals
const colorMap: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
    purple: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30',
    indigo: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30',
    green: 'text-green-600 bg-green-50 dark:bg-green-950/30',
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
    teal: 'text-teal-600 bg-teal-50 dark:bg-teal-950/30',
    cyan: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30',
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
    orange: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30',
    rose: 'text-rose-600 bg-rose-50 dark:bg-rose-950/30',
    red: 'text-red-600 bg-red-50 dark:bg-red-950/30',
    yellow: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30',
    pink: 'text-pink-600 bg-pink-50 dark:bg-pink-950/30',
    gray: 'text-gray-600 bg-gray-50 dark:bg-gray-900/40',
};

// Phase + Store visual metadata — labels translated at render time via i18n,
// brand colours sourced from `phase-*` semantic tokens (see tailwind.config).
const PHASE_META = {
    [WorkflowPhase.EXEGESIS]: { icon: BookOpen, i18nKey: 'exegesis' as const, color: 'text-phase-exegesis' },
    [WorkflowPhase.HOMILETICS]: { icon: Mic2, i18nKey: 'homiletics' as const, color: 'text-phase-homiletics' },
    [WorkflowPhase.DRAFTING]: { icon: PenTool, i18nKey: 'drafting' as const, color: 'text-phase-drafting' },
} as const;

// Store badge tones — same semantic token system + foreground for legibility on
// the soft background. `/15` opacity yields a tinted chip; foreground stays
// consistent across light/dark via the token system.
const STORE_META = {
    exegesis: { icon: BookOpen, i18nKey: 'exegesis' as const, tone: 'bg-phase-exegesis/15 text-phase-exegesis' },
    homiletics: { icon: Mic2, i18nKey: 'homiletics' as const, tone: 'bg-phase-homiletics/15 text-phase-homiletics' },
    generic: { icon: Library, i18nKey: 'generic' as const, tone: 'bg-phase-generic/15 text-phase-generic' },
} as const;

export function ResourceCard({
    resource,
    categories,
    indexStatus,
    isIndexing,
    isDeleting = false,
    isRetryingPremium = false,
    isCancelling = false,
    viewMode = 'grid',
    onEdit,
    onDelete,
    onIndex,
    onReindex,
    onRetryPremium,
    onCancelExtraction,
    onPreview,
    onSetPhases,
    onConfigureCoreStores,
    onCalibrateNumbering,
}: ResourceCardProps) {
    const { t } = useTranslation('library');
    const category = categories.find(c => c.id === resource.type);
    // Category label comes from the user's category definitions which already
    // store localised display strings — no need to translate here.
    const label = category?.label || t('editModal.categoryOptions.other');
    const colorClasses = colorMap[category?.color || 'gray'] || colorMap.gray;
    const Icon = iconMap[category?.icon || 'FileQuestion'] || FileQuestion;
    // Catalog entries (`isSystemSource`) and legacy docs written before the
    // ingest stamped `sizeBytes` carry no size at all. Dividing `undefined`
    // rendered a literal "NaN MB" on the card, so the size is only shown
    // when there is a real file behind it.
    const fileSizeMB = resource.sizeBytes > 0
        ? (resource.sizeBytes / (1024 * 1024)).toFixed(2)
        : null;
    const pageCount = resource.pageCount || resource.metadata?.pageCount;
    const isProcessing = resource.textExtractionStatus === 'processing' || resource.textExtractionStatus === 'pending';

    const statusPill = resolveResourceStatusPill(resource, indexStatus);

    const StatusIcon = statusPill?.icon;

    // Premium-degradation surface: when the cascade ended up below the
    // user's requested tier, the cloud function writes
    // `extractionWarning` to the resource. We hoist the read here so
    // BOTH the inline action button and the engine-badge tooltip below
    // can use the same value.
    const extractionWarning = resource.extractionWarning;
    // Reintentar también desde el fallo. Una extracción que se quedó
    // sin tiempo en el trigger —540 s de tope— cabe en el callable de
    // reproceso, que tiene 900 s; sin este botón la única salida era
    // borrar el libro y volver a subirlo.
    const canRetryPremium = !!onRetryPremium && (
        (!!extractionWarning && resource.textExtractionStatus === 'ready')
        || resource.textExtractionStatus === 'failed'
    );

    // Cancel is available WHILE the resource is in an active processing
    // state — gives the user an out before the cascade finishes (and
    // burns LLM credits) on the wrong file. Hidden once 'ready' or
    // 'failed' since the regular Delete action covers those.
    const inProgress =
        resource.textExtractionStatus === 'pending'
        || resource.textExtractionStatus === 'processing'
        || (resource.textExtractionStatus === 'ready' && (indexStatus === 'indexing' || indexStatus === 'checking'));
    const canCancel = inProgress && !!onCancelExtraction;

    // ── Inline action buttons (visible) — kept to a max of three per card so the
    //    visual weight of each card stays controlled. The overflow menu below
    //    holds the rest.
    const inlineActions = (
        <>
            {canRetryPremium && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-warning-subtle-foreground hover:text-warning"
                    onClick={onRetryPremium}
                    disabled={isRetryingPremium}
                    title={t('card.actions.retryPremium')}
                >
                    {isRetryingPremium ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                </Button>
            )}
            {canCancel && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={onCancelExtraction}
                    disabled={isCancelling}
                    title={t('card.actions.cancelExtraction')}
                >
                    {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                </Button>
            )}
            <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={onPreview}
                title={t('card.actions.preview')}
            >
                <Eye className="h-4 w-4" />
            </Button>
            {!resource.isSystemSource && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    onClick={onEdit}
                    title={t('card.actions.edit')}
                >
                    <Edit2 className="h-4 w-4" />
                </Button>
            )}
            {!resource.isSystemSource && indexStatus === 'indexed' && onReindex ? (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                    onClick={onReindex}
                    disabled={isIndexing}
                    title={t('card.actions.reprocess')}
                >
                    {isIndexing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
            ) : !resource.isSystemSource && indexStatus === 'not-indexed' && resource.textExtractionStatus === 'ready' ? (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-warning-subtle-foreground hover:text-warning"
                    onClick={onIndex}
                    disabled={isIndexing}
                    title={t('card.actions.process')}
                >
                    {isIndexing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                </Button>
            ) : null}
        </>
    );

    // ── Overflow menu: secondary actions. Items are gated on resource state +
    //    admin context; if no items remain visible, the trigger is hidden.
    const hasPhasesAction = onSetPhases && indexStatus === 'indexed';
    const hasCoreStoresAction = !!onConfigureCoreStores;
    const showOverflow = hasPhasesAction || hasCoreStoresAction || true; // delete always available

    const overflowMenu = showOverflow ? (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    title={t('card.actions.moreActions')}
                >
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                {hasPhasesAction && (
                    <DropdownMenuItem onClick={onSetPhases} className="cursor-pointer">
                        <Settings2 className="h-4 w-4 mr-2" />
                        {t('card.actions.configurePhases')}
                    </DropdownMenuItem>
                )}
                {hasCoreStoresAction && (
                    <DropdownMenuItem onClick={onConfigureCoreStores} className="cursor-pointer">
                        <Library className="h-4 w-4 mr-2" />
                        {t('card.actions.assignToCore')}
                    </DropdownMenuItem>
                )}
                {onCalibrateNumbering && (
                    <DropdownMenuItem onClick={onCalibrateNumbering} className="cursor-pointer">
                        <BookMarked className="h-4 w-4 mr-2" />
                        {t('numbering.calibrate')}
                    </DropdownMenuItem>
                )}
                {(hasPhasesAction || hasCoreStoresAction || onCalibrateNumbering) && !resource.isSystemSource && <DropdownMenuSeparator />}
                {!resource.isSystemSource && (
                    <DropdownMenuItem
                        onClick={onDelete}
                        className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('card.actions.delete')}
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    ) : null;

    // ── Status / metadata badges shared between layouts
    const statusTooltip = resolveResourceStatusTooltip(resource, indexStatus);
    const statusBadge = statusPill && StatusIcon ? (
        <span
            className={cn('inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium', statusPill.tone)}
            title={statusTooltip}
        >
            <StatusIcon className={cn('h-3 w-3', statusPill.iconClass)} />
            {t(statusPill.textKey)}
        </span>
    ) : null;

    // Señal de extracción rota. No es un matiz de calidad: un comentario del
    // texto hebreo con cero letras hebreas no se puede citar, y hasta ahora
    // entraba al corpus indistinguible de uno sano. Cuatro obras de esta
    // biblioteca estaban así, dos de ellas citadas en trabajos entregados.
    const health = extractionHealthOf(resource);
    const scriptPill = health.status === 'missing-script' ? (
        <span
            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium border border-destructive/30 bg-destructive/10 text-destructive"
            title={t('card.extraction.missingScriptHint', {
                script: t(`card.extraction.script.${health.script}`),
            })}
        >
            <AlertTriangle className="h-3 w-3" />
            {t('card.extraction.missingScript', {
                script: t(`card.extraction.script.${health.script}`),
            })}
        </span>
    ) : null;

    // Engine badge — surfaces which extractor produced the text
    // (LlamaParse premium, Gemini standard, or pdf-parse fallback). Only
    // shown once extraction is `ready`; pre-ready the user only needs to
    // see "processing", and the extractor isn't decided yet anyway.
    const enginePill = (() => {
        if (resource.textExtractionStatus !== 'ready') return null;
        switch (resource.extractionVersion) {
            case '3.0-llamaparse':
                return {
                    tone: 'bg-success-subtle text-success-subtle-foreground border border-success/30',
                    icon: Sparkles,
                    text: t('engine.llamaparse'),
                    title: t('engine.llamaparseHint'),
                };
            case '4.0-gemini-standard':
            case '2.0-gemini':
                return {
                    tone: 'bg-info-subtle text-info-subtle-foreground border border-info/30',
                    icon: Wand2,
                    text: t('engine.gemini'),
                    title: t('engine.geminiHint'),
                };
            case 'fallback-pdfparse':
            case '5.0-pdfparse-structured':
                return {
                    tone: 'bg-warning-subtle text-warning-subtle-foreground border border-warning/30',
                    icon: FileWarning,
                    text: t('engine.pdfparse'),
                    title: t('engine.pdfparseHint'),
                };
            default:
                return null;
        }
    })();
    // Engine badge picks up the hoisted `extractionWarning` (defined
    // near the inline actions so the retry button can use it too).
    // When set, tooltip wins over the generic engine hint because the
    // warning is more actionable.
    const EngineIcon = enginePill?.icon;
    // v1.7 metadata-incomplete pill. Surfaces when the smart-match
    // schema is unset for a granularity that needs it ('book' /
    // 'pericope' with no books listed). Whole-bible / whole-testament
    // are correct with empty arrays so they never trip this. Hidden
    // when the resource is still extracting — no point nagging while
    // the user is waiting on the cascade.
    const scope = resource.scope ?? 'book';
    const coversBibleBooks = resource.coversBibleBooks ?? [];
    const metadataIncomplete =
        resource.textExtractionStatus === 'ready'
        && (scope === 'book' || scope === 'pericope')
        && coversBibleBooks.length === 0;
    const metadataBadge = metadataIncomplete ? (
        <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-warning-subtle text-warning-subtle-foreground border border-warning/40 hover:bg-warning/10 transition-colors"
            title={t('card.metadataIncompleteHint')}
        >
            <AlertCircle className="h-2.5 w-2.5" aria-hidden />
            {t('card.metadataIncomplete')}
        </button>
    ) : null;
    const engineBadge = enginePill && EngineIcon ? (
        <span
            className={cn(
                'inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                extractionWarning
                    ? 'bg-warning-subtle text-warning-subtle-foreground border border-warning/40'
                    : enginePill.tone,
            )}
            title={extractionWarning || enginePill.title}
        >
            {extractionWarning ? (
                <AlertCircle className="h-2.5 w-2.5" />
            ) : (
                <EngineIcon className="h-2.5 w-2.5" />
            )}
            {enginePill.text}
        </span>
    ) : null;

    // System badge — preloaded by the platform (e.g. SBL GNT). The
    // user didn't upload it; it doesn't consume their library quota
    // and edit/delete are disabled.
    const systemBadge = resource.isSystemSource ? (
        <span
            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary border border-primary/30"
            title={t('card.systemSourceHint')}
        >
            <Sparkles className="h-3 w-3" />
            {t('card.systemSourceLabel')}
        </span>
    ) : null;

    const coreStoreBadges = resource.coreStores && resource.coreStores.length > 0 ? (
        <>
            {(resource.coreStores as Array<keyof typeof STORE_META>).map(key => {
                const meta = STORE_META[key];
                if (!meta) return null;
                const StoreIcon = meta.icon;
                const storeLabel = t(`stores.${meta.i18nKey}`);
                return (
                    <span
                        key={key}
                        className={cn('inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium', meta.tone)}
                        title={t(`stores.${meta.i18nKey}Title`)}
                    >
                        <StoreIcon className="h-3 w-3" />
                        {storeLabel}
                    </span>
                );
            })}
        </>
    ) : null;

    const phaseBadges = resource.preferredForPhases && resource.preferredForPhases.length > 0 ? (
        <>
            {resource.preferredForPhases.map(phase => {
                const meta = PHASE_META[phase];
                if (!meta) return null;
                const PhaseIcon = meta.icon;
                return (
                    <span
                        key={phase}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground"
                    >
                        <PhaseIcon className={cn('h-3 w-3', meta.color)} />
                        {t(`phases.${meta.i18nKey}`)}
                    </span>
                );
            })}
        </>
    ) : null;

    // ── List layout: dense horizontal row, optimized for scanning many resources
    if (viewMode === 'list') {
        return (
            <article
                className={cn(
                    'group relative bg-card border border-border/60 rounded-xl px-4 py-3 transition-colors hover:border-foreground/30',
                    isProcessing && 'border-info/70',
                    isDeleting && 'opacity-60'
                )}
            >
                {isDeleting && <DeletingOverlay t={t} />}
                <div className="flex items-center gap-4">
                    <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', colorClasses)}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                            <h3 className="font-medium text-[14px] text-foreground truncate">{resource.title}</h3>
                            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground shrink-0">{label}</span>
                        </div>
                        <div className="text-[12.5px] text-muted-foreground truncate">
                            {resource.author}
                            {fileSizeMB ? (
                                <>
                                    <span className="mx-1.5 text-border">·</span>
                                    {fileSizeMB} MB
                                </>
                            ) : null}
                            {pageCount ? (
                                <>
                                    <span className="mx-1.5 text-border">·</span>
                                    {t('card.metaPagesActual', { count: pageCount })}
                                </>
                            ) : null}
                        </div>
                    </div>
                    <div className="hidden md:flex items-center gap-1.5 flex-wrap justify-end max-w-[40%]">
                        {systemBadge}
                        {statusBadge}
                    {scriptPill}
                        {scriptPill}
                        {engineBadge}
                        {metadataBadge}
                        {coreStoreBadges}
                        {phaseBadges}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                        {inlineActions}
                        {overflowMenu}
                    </div>
                </div>
            </article>
        );
    }

    // ── Grid layout: card with clear hierarchy — icon → title → meta → actions
    return (
        <article
            className={cn(
                'group relative bg-card border border-border/60 rounded-xl p-4 flex flex-col gap-3 transition-colors hover:border-foreground/30',
                isProcessing && 'border-info/70',
                isDeleting && 'opacity-60'
            )}
        >
            {isDeleting && <DeletingOverlay t={t} />}
            {/* Header: category icon + label */}
            <div className="flex items-start justify-between gap-2">
                <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', colorClasses)}>
                    <Icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium pt-1">
                    {label}
                </span>
            </div>

            {/* Title + author */}
            <div className="space-y-0.5 flex-1 min-h-0">
                <h3 className="font-medium text-[14px] leading-snug text-foreground line-clamp-2">
                    {resource.title}
                </h3>
                <p className="text-[12.5px] text-muted-foreground truncate">
                    {resource.author}
                </p>
            </div>

            {/* Status + assignment badges (single row, wraps if needed) */}
            {(statusBadge || engineBadge || metadataBadge || coreStoreBadges || phaseBadges) && (
                <div className="flex items-center gap-1.5 flex-wrap">
                    {statusBadge}
                    {engineBadge}
                    {metadataBadge}
                    {coreStoreBadges}
                    {phaseBadges}
                </div>
            )}

            {/* Phase stepper — visual journey shown WHILE in progress.
                Auto-hides once indexed (the green "Listo" pill above
                already conveys completion; the stepper would just
                duplicate the signal). Replaces the static "Por procesar"
                ambiguity with a clear "you're at step N of 4" picture. */}
            <ExtractionStepper resource={resource} indexStatus={indexStatus} />

            {/* Meta: size + page count, single line, mono for numeric anchor.
                Page count is only shown when actual (post-extraction) — the
                pre-extraction estimate from file size was wildly off for
                dense scholarly PDFs (~52KB/page vs the assumed ~2KB/page),
                so showing it just confused the user (e.g. "10076 p. (est.)"
                for a 378-page WBC volume). */}
            {(fileSizeMB || pageCount) ? (
                <div className="text-[12px] text-muted-foreground font-mono">
                    {fileSizeMB ? `${fileSizeMB} MB` : null}
                    {pageCount ? (
                        <>
                            {fileSizeMB ? <span className="mx-1.5 text-border">·</span> : null}
                            {t('card.metaPagesActual', { count: pageCount })}
                        </>
                    ) : null}
                </div>
            ) : null}

            {/* Action bar */}
            <div className="flex items-center gap-0.5 pt-1 border-t border-border/40 -mx-1 px-1">
                {inlineActions}
                <span className="ml-auto" />
                {overflowMenu}
            </div>
        </article>
    );
}

/**
 * Inline overlay used while a delete request is in flight. Sits on
 * top of the card content (which is also dimmed by the parent's
 * `opacity-60`), centering a spinner + "Eliminando…" label so the
 * feedback is unmistakable. Pointer-events disabled so accidental
 * clicks during the delete don't fire on the underlying buttons.
 */
function DeletingOverlay({ t }: { t: (key: string) => string }) {
    return (
        <div className="absolute inset-0 flex items-center justify-center bg-card/40 backdrop-blur-[1px] rounded-xl pointer-events-none z-10">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-foreground bg-card border border-border rounded-full px-3 py-1.5 shadow-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-destructive" />
                {t('card.deleting')}
            </div>
        </div>
    );
}
