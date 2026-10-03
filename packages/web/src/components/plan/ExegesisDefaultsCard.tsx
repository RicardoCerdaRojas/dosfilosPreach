import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BookOpenCheck,
    Check,
    ChevronDown,
    ChevronRight,
    ExternalLink,
    FileText,
    Library,
    Loader2,
    Pencil,
    Plus,
    Sparkles,
    Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n';
import { exegesisDefaultsToSave, rubricIdFromOption } from './exegesisDefaultsToSave';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { exegesisService, libraryService, seriesService } from '@dosfilos/application';
import {
    findBooksByAlias,
    getSourceRecommendations,
    type BibleBookId,
    type LibraryResource,
    type SeriesExegesisDefaults,
    type SeriesExegesisSourceRef,
    type SourceRecommendation,
    type SourceType,
    type UserRubric,
    type UserStyleGuide,
} from '@dosfilos/domain';

interface ExegesisDefaultsCardProps {
    seriesId: string;
    ownerId: string;
    defaults: SeriesExegesisDefaults | undefined;
    /** Display name of the series' primary book (e.g. "Mateo"). Used
     *  to resolve the recommendation catalog. Undefined for thematic
     *  series; widget skips recommendations gracefully. */
    book?: string;
    /** UI language passed to recommendations + label localization. */
    language: 'es' | 'en';
    onChanged: () => void;
}

/**
 * Card that surfaces the series-level exegesis defaults (rubric
 * template, style guide, initial corpus) and lets the pastor edit
 * them in a single modal. Defaults flow into every auto-created
 * paper as a snapshot at creation time (see
 * `SeriesService.autoCreatePapersForPericopes`). Editing here does
 * NOT mutate existing papers — those keep their own copy. A
 * follow-up affordance ("apply to existing pericopes") is planned
 * for Fase 2a.
 *
 * Recommendations widget (Fase 2a) will live inside the source
 * section of the edit modal, surfacing the existing PR #93 catalog
 * keyed to the series' primary book.
 */
export function ExegesisDefaultsCard({ seriesId, ownerId, defaults }: ExegesisDefaultsCardProps) {
    const { t } = useTranslation('series');
    const navigate = useNavigate();
    const [editing] = useState(true); // precarga los nombres del resumen
    const [rubrics, setRubrics] = useState<UserRubric[] | null>(null);
    const [styleGuides, setStyleGuides] = useState<UserStyleGuide[] | null>(null);

    useEffect(() => {
        if (!editing || !ownerId) return;
        let cancelled = false;
        Promise.all([
            exegesisService.listUserRubrics.execute(ownerId),
            exegesisService.listStyleGuides.execute(ownerId),
        ])
            .then(([r, g]) => {
                if (cancelled) return;
                setRubrics(r);
                setStyleGuides(g);
            })
            .catch((err) => {
                console.error('[ExegesisDefaultsCard] load failed', err);
                toast.error(t('detail.exegesisDefaults.loadFailed') as string);
            });
        return () => {
            cancelled = true;
        };
    }, [editing, ownerId, t]);

    const rubricName = useMemo(() => {
        // Sin plantilla elegida, un trabajo de la serie nace con la rúbrica de
        // predicación (`CreateExegeticalPaperUseCase`): `null` y ausente
        // significan lo mismo.
        if (!defaults?.rubricTemplateId) return t('detail.exegesisDefaults.systemRubric') as string;
        return rubrics?.find((r) => r.id === defaults.rubricTemplateId)?.displayName
            ?? t('detail.exegesisDefaults.unknownRubric') as string;
    }, [defaults, rubrics, t]);

    const styleName = useMemo(() => {
        if (!defaults?.styleGuideId) return t('detail.exegesisDefaults.noStyle') as string;
        return styleGuides?.find((g) => g.id === defaults.styleGuideId)?.displayName
            ?? t('detail.exegesisDefaults.unknownStyle') as string;
    }, [defaults, styleGuides, t]);

    const sourceCount = defaults?.sourceRefs?.length ?? 0;

    return (
        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
            <header className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                    <BookOpenCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                        <h3 className="text-[14px] font-semibold text-foreground">
                            {t('detail.exegesisDefaults.title')}
                        </h3>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                            {t('detail.exegesisDefaults.subtitle')}
                        </p>
                    </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate(`/dashboard/plans/${seriesId}/exegesis`)} className="shrink-0">
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    {t('detail.exegesisDefaults.edit')}
                </Button>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[12px]">
                <SummaryItem
                    icon={<FileText className="h-3.5 w-3.5" />}
                    label={t('detail.exegesisDefaults.rubricLabel') as string}
                    value={rubricName}
                />
                <SummaryItem
                    icon={<BookOpenCheck className="h-3.5 w-3.5" />}
                    label={t('detail.exegesisDefaults.styleLabel') as string}
                    value={styleName}
                />
                <SummaryItem
                    icon={<Library className="h-3.5 w-3.5" />}
                    label={t('detail.exegesisDefaults.sourcesLabel') as string}
                    value={t('detail.exegesisDefaults.sourcesCount', { count: sourceCount }) as string}
                />
            </div>
        </section>
    );
}

function SummaryItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="rounded-md border border-border/70 bg-muted/30 px-2.5 py-1.5">
            <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground">
                {icon}
                <span>{label}</span>
            </div>
            <p className="mt-0.5 text-foreground line-clamp-2">{value}</p>
        </div>
    );
}

interface ExegesisDefaultsFormProps {
    /** Vuelve a la serie: lo llama Cancelar y el guardado exitoso. */
    onDone: () => void;
    seriesId: string;
    ownerId: string;
    initial: SeriesExegesisDefaults | undefined;
    rubrics: ReadonlyArray<UserRubric>;
    styleGuides: ReadonlyArray<UserStyleGuide>;
    isLoadingOptions: boolean;
    book?: string;
    language: 'es' | 'en';
    onSaved: () => void;
}

export function ExegesisDefaultsForm({
    onDone,
    seriesId,
    ownerId,
    initial,
    rubrics,
    styleGuides,
    isLoadingOptions,
    book,
    language,
    onSaved,
}: ExegesisDefaultsFormProps) {
    const { t } = useTranslation('series');
    const [rubricId, setRubricId] = useState<string | null | undefined>(initial?.rubricTemplateId);
    const [styleGuideId, setStyleGuideId] = useState<string | null | undefined>(initial?.styleGuideId);
    const [sourceRefs, setSourceRefs] = useState<SeriesExegesisSourceRef[]>(initial?.sourceRefs ?? []);
    const [saving, setSaving] = useState(false);

    // Resolve series book → BibleBookId so we can query the curated
    // recommendation catalog. Returns null for thematic series or for
    // books the alias resolver doesn't recognize — in that case the
    // recommendations widget hides itself gracefully.
    const bookId: BibleBookId | null = useMemo(() => {
        if (!book) return null;
        const matches = findBooksByAlias(book.toLowerCase().trim());
        return matches[0]?.id ?? null;
    }, [book]);

    // User's library — fetched lazily when the modal opens so the
    // "Desde tu biblioteca" picker has something to list and the
    // recommendations widget can auto-match recs against existing
    // uploads.
    const [libraryResources, setLibraryResources] = useState<LibraryResource[] | null>(null);
    useEffect(() => {
        if (!ownerId) return;
        let cancelled = false;
        libraryService
            .getUserResources(ownerId)
            .then((resources) => {
                if (!cancelled) setLibraryResources(resources);
            })
            .catch((err) => {
                console.error('[ExegesisDefaultsForm] library load failed', err);
            });
        return () => {
            cancelled = true;
        };
    }, [ownerId]);

    useEffect(() => {

        setRubricId(initial?.rubricTemplateId);
        setStyleGuideId(initial?.styleGuideId);
        setSourceRefs(initial?.sourceRefs ?? []);
    }, [open, initial]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const next = exegesisDefaultsToSave({ rubricId, styleGuideId, sourceRefs });
            await seriesService.updateExegesisDefaults(seriesId, next);
            toast.success(t('detail.exegesisDefaults.savedToast') as string);
            onSaved();
        } catch (err: any) {
            console.error('[ExegesisDefaultsForm] save failed', err);
            toast.error(err?.message ?? (t('detail.exegesisDefaults.saveFailed') as string));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-3xl px-5 py-6">
            <div>
                <header className="mb-5">
                    <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                        <BookOpenCheck className="h-4 w-4" />
                        {t('detail.exegesisDefaults.modalTitle')}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t('detail.exegesisDefaults.modalDescription')}
                    </p>
                    {/* El alcance va en el encabezado y no en letra chica: el
                        malentendido que motivó esto fue entrar acá buscando las
                        fuentes de un trabajo YA creado, que viven en el paper. */}
                    <p className="mt-3 rounded-md border border-info/30 bg-info-subtle px-3 py-2 text-[13px] text-info-subtle-foreground">
                        {t('detail.exegesisDefaults.scopeNotice')}
                    </p>
                </header>

                <div className="space-y-5 pt-2">
                    {/* Rubric */}
                    <div className="space-y-2">
                        <Label className="text-[13px] font-semibold">
                            {t('detail.exegesisDefaults.rubricLabel')}
                        </Label>
                        <p className="text-[12px] text-muted-foreground">
                            {t('detail.exegesisDefaults.rubricHelp')}
                        </p>
                        <select
                            value={rubricId ?? '__auto'}
                            onChange={(e) => {
                                const v = e.target.value;
                                setRubricId(rubricIdFromOption(v));
                            }}
                            disabled={isLoadingOptions || saving}
                            className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                        >
                            <option value="__auto">{t('detail.exegesisDefaults.systemRubricOption')}</option>
                            {rubrics.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.displayName}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Style guide */}
                    <div className="space-y-2">
                        <Label className="text-[13px] font-semibold">
                            {t('detail.exegesisDefaults.styleLabel')}
                        </Label>
                        <p className="text-[12px] text-muted-foreground">
                            {t('detail.exegesisDefaults.styleHelp')}
                        </p>
                        <select
                            value={styleGuideId ?? '__none'}
                            onChange={(e) => {
                                const v = e.target.value;
                                setStyleGuideId(v === '__none' ? null : v);
                            }}
                            disabled={isLoadingOptions || saving}
                            className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                        >
                            <option value="__none">{t('detail.exegesisDefaults.noStyleOption')}</option>
                            {styleGuides.map((g) => (
                                <option key={g.id} value={g.id}>
                                    {g.displayName}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Sources */}
                    <div className="space-y-2">
                        <Label className="text-[13px] font-semibold">
                            {t('detail.exegesisDefaults.sourcesLabel')}
                        </Label>
                        <p className="text-[12px] text-muted-foreground">
                            {t('detail.exegesisDefaults.sourcesHelp')}
                        </p>
                        {sourceRefs.length === 0 ? (
                            <p className="text-[12px] text-muted-foreground italic py-3 text-center border border-dashed border-border rounded-md">
                                {t('detail.exegesisDefaults.sourcesEmpty')}
                            </p>
                        ) : (
                            <ul className="space-y-1.5">
                                {sourceRefs.map((s, i) => (
                                    <li
                                        key={`${s.libraryResourceId}-${i}`}
                                        className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5"
                                    >
                                        <Library className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12.5px] font-medium text-foreground truncate">
                                                {s.displayLabel}
                                            </p>
                                            <p className="text-[10.5px] text-muted-foreground">
                                                {s.sourceType} · {s.mode === 'full-document' ? t('detail.exegesisDefaults.modeFull') : t('detail.exegesisDefaults.modeExcerpts')}
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setSourceRefs(sourceRefs.filter((_, idx) => idx !== i))}
                                            className="h-6 w-6 p-0 shrink-0"
                                            aria-label={t('detail.exegesisDefaults.removeSource') as string}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {/* Library picker — add sources from the user's
                            existing library to the series defaults. */}
                        <LibrarySourcePicker
                            libraryResources={libraryResources}
                            existingRefs={sourceRefs}
                            onAdd={(ref) => setSourceRefs([...sourceRefs, ref])}
                            t={t}
                        />
                    </div>

                    {/* Recommendations widget — curated catalog (PR #93)
                        for the series' primary book. Auto-matches with
                        the user's library and offers "Agregar al corpus"
                        when a match exists. */}
                    {bookId && (
                        <RecommendationsForSeries
                            bookId={bookId}
                            language={language}
                            libraryResources={libraryResources}
                            existingRefs={sourceRefs}
                            onAdd={(ref) => setSourceRefs([...sourceRefs, ref])}
                            t={t}
                        />
                    )}
                </div>

                <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
                    <Button variant="ghost" onClick={() => onDone()} disabled={saving}>
                        {t('detail.exegesisDefaults.cancel')}
                    </Button>
                    <Button onClick={handleSave} disabled={saving || isLoadingOptions}>
                        {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                        {t('detail.exegesisDefaults.save')}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ── Library picker (subcomponent) ───────────────────────────────────────

const SOURCE_TYPE_OPTIONS: ReadonlyArray<{ value: SourceType; labelKey: string }> = [
    { value: 'commentary-expository', labelKey: 'commentaryExpository' },
    { value: 'commentary-critical', labelKey: 'commentaryCritical' },
    { value: 'lexicon-technical', labelKey: 'lexiconTechnical' },
    { value: 'theological-dictionary', labelKey: 'theologicalDictionary' },
    { value: 'grammar-syntax', labelKey: 'grammarSyntax' },
    { value: 'biblical-text-edition', labelKey: 'biblicalTextEdition' },
    { value: 'historical-background', labelKey: 'historicalBackground' },
    { value: 'theological-monograph', labelKey: 'theologicalMonograph' },
    { value: 'primary-source-ancient', labelKey: 'primarySourceAncient' },
    { value: 'other', labelKey: 'other' },
];

function LibrarySourcePicker({
    libraryResources,
    existingRefs,
    onAdd,
    t,
}: {
    libraryResources: LibraryResource[] | null;
    existingRefs: ReadonlyArray<SeriesExegesisSourceRef>;
    onAdd: (ref: SeriesExegesisSourceRef) => void;
    t: (key: string, opts?: Record<string, unknown>) => string;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [pendingType, setPendingType] = useState<Record<string, SourceType>>({});

    const alreadyAdded = useMemo(() => new Set(existingRefs.map((r) => r.libraryResourceId)), [existingRefs]);
    const available = useMemo(() => {
        if (!libraryResources) return [];
        const q = query.trim().toLowerCase();
        return libraryResources
            .filter((r) => !alreadyAdded.has(r.id))
            .filter((r) => !q || r.title.toLowerCase().includes(q) || r.author.toLowerCase().includes(q));
    }, [libraryResources, alreadyAdded, query]);

    if (libraryResources === null) {
        return (
            <p className="text-[11.5px] text-muted-foreground inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('detail.exegesisDefaults.loadingLibrary')}
            </p>
        );
    }
    if (libraryResources.length === 0) {
        return (
            <p className="text-[11.5px] text-muted-foreground italic">
                {t('detail.exegesisDefaults.emptyLibrary')}
            </p>
        );
    }

    return (
        <div className="rounded-md border border-border bg-muted/20">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between px-2.5 py-2 text-[12px] font-medium text-foreground hover:bg-accent/40 transition-colors"
            >
                <span className="inline-flex items-center gap-1.5">
                    {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    <Plus className="h-3.5 w-3.5" />
                    {t('detail.exegesisDefaults.addFromLibrary')}
                </span>
                <span className="text-[10.5px] text-muted-foreground font-normal">
                    {t('detail.exegesisDefaults.libraryAvailable', { count: available.length }) as string}
                </span>
            </button>
            {open && (
                <div className="border-t border-border px-2.5 py-2 space-y-2">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t('detail.exegesisDefaults.searchLibraryPlaceholder') as string}
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    {available.length === 0 ? (
                        <p className="text-[11.5px] text-muted-foreground italic py-3 text-center">
                            {query
                                ? t('detail.exegesisDefaults.libraryNoMatches')
                                : t('detail.exegesisDefaults.libraryAllAdded')}
                        </p>
                    ) : (
                        <ul className="space-y-1 max-h-64 overflow-y-auto">
                            {available.map((r) => {
                                const selectedType = pendingType[r.id] ?? 'commentary-expository';
                                return (
                                    <li
                                        key={r.id}
                                        className="flex items-center gap-2 rounded border border-border bg-background px-2 py-1.5"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-medium text-foreground truncate">{r.title}</p>
                                            <p className="text-[10.5px] text-muted-foreground truncate">{r.author}</p>
                                        </div>
                                        <select
                                            value={selectedType}
                                            onChange={(e) =>
                                                setPendingType({ ...pendingType, [r.id]: e.target.value as SourceType })
                                            }
                                            className="h-7 text-[11px] rounded border border-input bg-background px-1"
                                        >
                                            {SOURCE_TYPE_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {t(`detail.exegesisDefaults.sourceTypes.${opt.labelKey}`) as string}
                                                </option>
                                            ))}
                                        </select>
                                        <Button
                                            size="sm"
                                            onClick={() =>
                                                onAdd({
                                                    libraryResourceId: r.id,
                                                    corpusId: r.id,
                                                    displayLabel: r.title,
                                                    sourceType: selectedType,
                                                    mode: 'full-document',
                                                })
                                            }
                                            className="h-7 text-[11px]"
                                        >
                                            <Plus className="h-3 w-3 mr-1" />
                                            {t('detail.exegesisDefaults.add')}
                                        </Button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Recommendations widget (subcomponent) ───────────────────────────────

const RECOMMENDED_SOURCE_TYPES: ReadonlyArray<SourceType> = [
    'commentary-expository',
    'commentary-critical',
    'lexicon-technical',
    'theological-dictionary',
    'grammar-syntax',
    'biblical-text-edition',
    'historical-background',
];

interface RecCategory {
    type: SourceType;
    labelKey: string;
    items: ReadonlyArray<SourceRecommendation>;
}

function RecommendationsForSeries({
    bookId,
    language,
    libraryResources,
    existingRefs,
    onAdd,
    t,
}: {
    bookId: BibleBookId;
    language: 'es' | 'en';
    libraryResources: LibraryResource[] | null;
    existingRefs: ReadonlyArray<SeriesExegesisSourceRef>;
    onAdd: (ref: SeriesExegesisSourceRef) => void;
    t: (key: string, opts?: Record<string, unknown>) => string;
}) {
    const hasAnySources = existingRefs.length > 0;
    const [expanded, setExpanded] = useState(!hasAnySources);

    const categories: RecCategory[] = useMemo(() => {
        return RECOMMENDED_SOURCE_TYPES.map((type) => {
            const labelOption = SOURCE_TYPE_OPTIONS.find((o) => o.value === type);
            return {
                type,
                labelKey: labelOption?.labelKey ?? 'other',
                items: getSourceRecommendations(bookId, type, language),
            };
        }).filter((c) => c.items.length > 0);
    }, [bookId, language]);

    if (categories.length === 0) return null;

    /**
     * Best-effort library auto-match: find a LibraryResource whose
     * title contains the recommendation's title (case-insensitive).
     * Mirrors the lighter version used in the paper setup page. When
     * a match exists the card surfaces an "Agregar al corpus" button
     * that wires the corpusId directly; otherwise it falls back to a
     * "Buscar en mi biblioteca" hint (same UX as the existing
     * recommendation cards in the paper setup).
     */
    const findMatch = (rec: SourceRecommendation): LibraryResource | null => {
        if (!libraryResources) return null;
        const recTitle = rec.title.toLowerCase();
        return libraryResources.find((r) => r.title.toLowerCase().includes(recTitle.slice(0, 20))) ?? null;
    };

    const alreadyAdded = new Set(existingRefs.map((r) => r.libraryResourceId));

    return (
        <div className="rounded-md border border-border bg-muted/20">
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-2.5 py-2 text-[12px] font-medium text-foreground hover:bg-accent/40 transition-colors"
            >
                <span className="inline-flex items-center gap-1.5">
                    {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    {t('detail.exegesisDefaults.recommendationsTitle')}
                </span>
                <span className="text-[10.5px] text-muted-foreground font-normal">
                    {t('detail.exegesisDefaults.recommendationsCount', { count: categories.length }) as string}
                </span>
            </button>
            {expanded && (
                <div className="border-t border-border px-2.5 py-2 space-y-3">
                    <p className="text-[11px] text-muted-foreground">
                        {t('detail.exegesisDefaults.recommendationsHelp')}
                    </p>
                    {categories.map((cat) => (
                        <div key={cat.type} className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                                    {t(`detail.exegesisDefaults.sourceTypes.${cat.labelKey}`)}
                                </span>
                                <Badge variant="outline" className="text-[10px]">
                                    {cat.items.length}
                                </Badge>
                            </div>
                            <ul className="space-y-1">
                                {cat.items.slice(0, 5).map((rec, idx) => {
                                    const match = findMatch(rec);
                                    const owned = match && alreadyAdded.has(match.id);
                                    return (
                                        <li
                                            key={`${cat.type}-${idx}`}
                                            className={cn(
                                                'rounded border bg-background px-2 py-1.5',
                                                rec.tier === 'essential'
                                                    ? 'border-primary/40'
                                                    : 'border-border',
                                            )}
                                        >
                                            <div className="flex items-start gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] font-medium text-foreground leading-tight">
                                                        {rec.title}
                                                    </p>
                                                    <p className="text-[10.5px] text-muted-foreground">
                                                        {rec.author} · {rec.publisher} · {rec.year}
                                                        {rec.series ? ` · ${rec.series}` : ''}
                                                    </p>
                                                    {rec.rationale && (
                                                        <p className="text-[10.5px] text-muted-foreground italic mt-0.5">
                                                            {rec.rationale}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="shrink-0 flex items-center gap-1">
                                                    {rec.tier === 'essential' && (
                                                        <Badge variant="outline" className="text-[9.5px] border-primary text-primary">
                                                            {t('detail.exegesisDefaults.tierEssential')}
                                                        </Badge>
                                                    )}
                                                    {owned ? (
                                                        <Badge variant="outline" className="text-[9.5px] border-success text-success inline-flex items-center gap-0.5">
                                                            <Check className="h-2.5 w-2.5" />
                                                            {t('detail.exegesisDefaults.alreadyAdded')}
                                                        </Badge>
                                                    ) : match ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() =>
                                                                onAdd({
                                                                    libraryResourceId: match.id,
                                                                    corpusId: match.id,
                                                                    displayLabel: match.title,
                                                                    sourceType: cat.type,
                                                                    mode: 'full-document',
                                                                })
                                                            }
                                                            className="h-6 text-[10.5px]"
                                                        >
                                                            <Plus className="h-2.5 w-2.5 mr-0.5" />
                                                            {t('detail.exegesisDefaults.addFromMatch')}
                                                        </Button>
                                                    ) : (
                                                        <a
                                                            href={`/dashboard/library?q=${encodeURIComponent(rec.title)}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-0.5 text-[10.5px] text-muted-foreground hover:text-foreground transition-colors"
                                                            title={t('detail.exegesisDefaults.searchInLibraryHint') as string}
                                                        >
                                                            <ExternalLink className="h-2.5 w-2.5" />
                                                            {t('detail.exegesisDefaults.searchInLibrary')}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
