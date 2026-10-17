import { BookOpenText, Loader2, Sparkles, BookPlus, Type, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type BibleBookId, type PassageReference, type PreachableUnit } from '@dosfilos/domain';
import { PassagePicker } from '@/components/exegesis/PassagePicker';
import { BookPicker } from '@/components/exegesis/BookPicker';

export function CreateSeriesCard({
    seriesTitle,
    onSeriesTitleChange,
    startDate,
    onStartDateChange,
    frequency,
    onFrequencyChange,
    preachableUnits,
    creating,
    onCreate,
    t,
}: {
    seriesTitle: string;
    onSeriesTitleChange: (v: string) => void;
    startDate: string;
    onStartDateChange: (v: string) => void;
    frequency: 'weekly' | 'biweekly' | 'monthly' | 'flexible';
    onFrequencyChange: (v: 'weekly' | 'biweekly' | 'monthly' | 'flexible') => void;
    preachableUnits: ReadonlyArray<PreachableUnit>;
    creating: boolean;
    onCreate: () => void;
    t: (key: string, opts?: Record<string, unknown>) => string;
}) {
    return (
        <section className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/10 p-6">
            <header className="flex items-center gap-2 mb-4">
                <BookPlus className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    {t('expository.create.title')}
                </h2>
            </header>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                {t('expository.create.subtitle')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <Label htmlFor="seriesTitle">{t('expository.create.seriesTitle')}</Label>
                    <Input
                        id="seriesTitle"
                        value={seriesTitle}
                        onChange={(e) => onSeriesTitleChange(e.target.value)}
                        className="mt-1.5 bg-white dark:bg-zinc-900"
                    />
                </div>
                <div>
                    <Label htmlFor="startDate">{t('expository.create.startDate')}</Label>
                    <Input
                        id="startDate"
                        type="date"
                        value={startDate}
                        onChange={(e) => onStartDateChange(e.target.value)}
                        className="mt-1.5 bg-white dark:bg-zinc-900"
                    />
                </div>
                <div>
                    <Label htmlFor="frequency">{t('expository.create.frequency')}</Label>
                    <select
                        id="frequency"
                        value={frequency}
                        onChange={(e) => onFrequencyChange(e.target.value as typeof frequency)}
                        className="mt-1.5 w-full h-10 rounded-md border border-input bg-white dark:bg-zinc-900 px-3 text-sm"
                    >
                        <option value="weekly">{t('expository.create.freq.weekly')}</option>
                        <option value="biweekly">{t('expository.create.freq.biweekly')}</option>
                        <option value="monthly">{t('expository.create.freq.monthly')}</option>
                        <option value="flexible">{t('expository.create.freq.flexible')}</option>
                    </select>
                </div>
            </div>

            <div className="mt-5 flex justify-end">
                <Button
                    onClick={onCreate}
                    disabled={creating || preachableUnits.length === 0}
                    className="bg-primary-solid hover:bg-primary-solid-hover text-primary-foreground disabled:opacity-50"
                >
                    {creating && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                    {t('expository.create.cta', { count: preachableUnits.length })}
                </Button>
            </div>
        </section>
    );
}

export function toastErrorMessage(
    err: any,
    t: (key: string) => string,
    fallbackKey: string,
): string {
    if (err?.isExegesisOverload) return t('expository.toast.overloaded') as string;
    if (err?.message) return err.message;
    return t(fallbackKey) as string;
}

// ── Setup card ──────────────────────────────────────────────────────────

export function SetupCard({
    bookId,
    onBookIdChange,
    targetCount,
    onTargetCountChange,
    twoTierMode,
    onTwoTierModeChange,
    strictMode,
    onStrictModeChange,
    lang,
    allBooks,
    isRunning,
    onStart,
    textZoom,
    onTextZoomChange,
    onOpenMethodology,
    scopeMode,
    onScopeModeChange,
    passageScope,
    onPassageScopeChange,
    scopeError,
    t,
}: {
    bookId: BibleBookId;
    onBookIdChange: (id: BibleBookId) => void;
    targetCount: number | '';
    onTargetCountChange: (n: number | '') => void;
    twoTierMode: boolean;
    onTwoTierModeChange: (next: boolean) => void;
    strictMode: boolean;
    onStrictModeChange: (next: boolean) => void;
    lang: 'es' | 'en';
    allBooks: ReadonlyArray<{ id: BibleBookId; nameEs: string; nameEn: string; testament: 'OT' | 'NT'; chapterCount: number }>;
    isRunning: boolean;
    onStart: () => void;
    textZoom: 1 | 2 | 3;
    onTextZoomChange: (z: 1 | 2 | 3) => void;
    onOpenMethodology: () => void;
    scopeMode: 'whole-book' | 'passage';
    onScopeModeChange: (next: 'whole-book' | 'passage') => void;
    passageScope: PassageReference | null;
    onPassageScopeChange: (ref: PassageReference | null) => void;
    scopeError: string | null;
    t: (key: string, opts?: Record<string, unknown>) => string;
}) {
    const selectedBook = allBooks.find((b) => b.id === bookId);
    const chapterCount = selectedBook?.chapterCount ?? 0;
    return (
        <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <header className="mb-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <BookOpenText className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                            {t('expository.setup.title')}
                        </h2>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t('expository.setup.subtitle')}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onOpenMethodology}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:border-emerald-300 dark:hover:border-emerald-800 transition-colors"
                        title={t('expository.setup.methodologyButtonHint') as string}
                    >
                        <GraduationCap className="h-3.5 w-3.5" />
                        {t('expository.setup.methodologyButton')}
                    </button>
                    <TextZoomControl value={textZoom} onChange={onTextZoomChange} t={t} />
                </div>
            </header>

            {/* 1. Alcance — define mode FIRST so the picker below
                matches the chosen idiom (book vs passage). */}
            <div className="space-y-3">
                <Label className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                    {t('expository.setup.scope.label')}
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label
                        className={`flex items-start gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                            scopeMode === 'whole-book'
                                ? 'border-primary bg-primary/5'
                                : 'border-input hover:border-primary/40'
                        } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <input
                            type="radio"
                            name="scopeMode"
                            value="whole-book"
                            checked={scopeMode === 'whole-book'}
                            onChange={() => onScopeModeChange('whole-book')}
                            disabled={isRunning}
                            className="mt-1 h-3.5 w-3.5 text-primary focus:ring-primary/40"
                        />
                        <span className="flex flex-col text-[12px]">
                            <span className="font-medium text-slate-800 dark:text-slate-100">
                                {t('expository.setup.scope.modeWholeBook')}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                {t('expository.setup.scope.modeWholeBookHint', { count: chapterCount }) as string}
                            </span>
                        </span>
                    </label>
                    <label
                        className={`flex items-start gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                            scopeMode === 'passage'
                                ? 'border-primary bg-primary/5'
                                : 'border-input hover:border-primary/40'
                        } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <input
                            type="radio"
                            name="scopeMode"
                            value="passage"
                            checked={scopeMode === 'passage'}
                            onChange={() => onScopeModeChange('passage')}
                            disabled={isRunning}
                            className="mt-1 h-3.5 w-3.5 text-primary focus:ring-primary/40"
                        />
                        <span className="flex flex-col text-[12px]">
                            <span className="font-medium text-slate-800 dark:text-slate-100">
                                {t('expository.setup.scope.modePassage')}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                {t('expository.setup.scope.modePassageHint')}
                            </span>
                        </span>
                    </label>
                </div>
            </div>

            {/* 2. Selector (book OR passage, never both) + Cantidad. */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                    <Label>
                        {scopeMode === 'whole-book'
                            ? t('expository.setup.book')
                            : t('expository.setup.scope.modePassage')}
                    </Label>
                    <div className="mt-1.5">
                        {scopeMode === 'whole-book' ? (
                            <BookPicker
                                value={bookId}
                                onChange={onBookIdChange}
                                displayLanguage={lang}
                                disabled={isRunning}
                            />
                        ) : (
                            <PassagePicker
                                value={passageScope}
                                onChange={(ref) => onPassageScopeChange(ref)}
                                displayLanguage={lang}
                            />
                        )}
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {t('expository.setup.scope.passageHelper')}
                    </p>
                </div>
                <div>
                    <Label htmlFor="target">{t('expository.setup.targetCount')}</Label>
                    <Input
                        id="target"
                        type="number"
                        min={3}
                        max={60}
                        value={targetCount}
                        disabled={isRunning}
                        onChange={(e) => {
                            const v = e.target.value;
                            onTargetCountChange(v === '' ? '' : Math.max(1, Number(v)));
                        }}
                        placeholder={t('expository.setup.targetCountPlaceholder') as string}
                        className="mt-1.5"
                    />
                </div>
            </div>

            {scopeError && (
                <p className="mt-3 text-[12px] font-medium text-destructive">{scopeError}</p>
            )}

            <label className="mt-4 flex items-start gap-2 text-[12px] text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                    type="checkbox"
                    checked={twoTierMode}
                    onChange={(e) => onTwoTierModeChange(e.target.checked)}
                    disabled={isRunning}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 dark:border-zinc-700 text-emerald-500 focus:ring-emerald-400 disabled:opacity-50"
                />
                <span className="flex flex-col">
                    <span className="font-medium">{t('expository.setup.twoTierLabel')}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{t('expository.setup.twoTierHint')}</span>
                </span>
            </label>

            <label className="mt-3 flex items-start gap-2 text-[12px] text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                    type="checkbox"
                    checked={strictMode}
                    onChange={(e) => onStrictModeChange(e.target.checked)}
                    disabled={isRunning}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 dark:border-zinc-700 text-emerald-500 focus:ring-emerald-400 disabled:opacity-50"
                />
                <span className="flex flex-col">
                    <span className="font-medium">{t('expository.setup.strictLabel')}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{t('expository.setup.strictHint')}</span>
                </span>
            </label>

            <div className="mt-4 flex items-center justify-between gap-4">
                <p className="text-[11px] text-amber-700 dark:text-amber-300 max-w-xl">
                    {t('expository.setup.translationNote')}
                </p>
                <Button
                    onClick={onStart}
                    disabled={isRunning}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 disabled:opacity-50"
                >
                    {isRunning ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                        <Sparkles className="h-4 w-4 mr-1.5" />
                    )}
                    {isRunning ? t('expository.setup.running') : t('expository.setup.start')}
                </Button>
            </div>
        </section>
    );
}

// ── Text zoom control ──────────────────────────────────────────────────

export function TextZoomControl({
    value,
    onChange,
    t,
}: {
    value: 1 | 2 | 3;
    onChange: (z: 1 | 2 | 3) => void;
    /** `t` con sus parámetros de interpolación: la firma anterior declaraba
     *  un solo argumento y varias llamadas pasan dos, así que mentía. */
    t: (key: string, params?: Record<string, unknown>) => string;
}) {
    const levels: Array<{ level: 1 | 2 | 3; label: string }> = [
        { level: 1, label: 'A' },
        { level: 2, label: 'A' },
        { level: 3, label: 'A' },
    ];
    const sizeClass = ['text-xs', 'text-sm', 'text-base'];
    return (
        <div
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 p-0.5"
            role="group"
            aria-label={t('expository.setup.textZoomLabel') as string}
            title={t('expository.setup.textZoomLabel') as string}
        >
            <Type className="h-3.5 w-3.5 text-slate-400 ml-1.5" />
            {levels.map(({ level, label }) => (
                <button
                    key={level}
                    type="button"
                    onClick={() => onChange(level)}
                    aria-pressed={value === level}
                    aria-label={t(`expository.setup.textZoom.level${level}`) as string}
                    title={t(`expository.setup.textZoom.level${level}`) as string}
                    className={`px-2 py-1 rounded ${sizeClass[level - 1]} font-semibold transition-colors ${
                        value === level
                            ? 'bg-emerald-500 text-slate-900'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
