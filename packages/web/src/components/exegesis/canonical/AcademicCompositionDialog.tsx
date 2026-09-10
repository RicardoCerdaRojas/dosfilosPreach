import { useState } from 'react';
import { BookmarkPlus, Copy, Download, Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useExegesisPaper } from '@/hooks/exegesis/useExegesisPaper';
import { useCitationAnchoring } from '@/hooks/exegesis/useCitationAnchoring';
import { CitationAnchoringNotice } from './CitationAnchoringNotice';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import type { ComposeAcademicPaperOutput } from '@dosfilos/domain';

interface AcademicCompositionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    paperId: string;
    /** File-name stem suggested for the .md download (e.g., "hebreos-1-1-4"). */
    suggestedFilename: string;
    /**
     * Existing composition saved on `paper.assembledMarkdown`, when
     * present. Used to surface a "previously saved" state in the
     * dialog so the user knows recomposing will overwrite. Empty
     * string when the paper has no saved composition.
     */
    savedAssembledMarkdown: string;
}

/**
 * Modal that orchestrates an academic-paper composition run and
 * renders the resulting markdown. Triggered from the paper detail
 * page's overflow menu.
 *
 * Flow inside the dialog:
 *   1. Idle — "Componer" CTA visible, explanatory copy.
 *   2. Composing — spinner + status text.
 *   3. Success — formatter status banner + tabs to switch between
 *      rendered markdown preview and raw markdown + copy/download
 *      buttons.
 *   4. Error — error banner + retry CTA.
 *
 * The composition is NOT auto-persisted — see the use case docstring
 * for the rationale (multi-format reuse). The user copies or
 * downloads from here; if they want the markdown saved on the paper
 * itself, they paste it into the assembled-markdown surface (a
 * future feature).
 */
export function AcademicCompositionDialog({
    open,
    onOpenChange,
    paperId,
    suggestedFilename,
    savedAssembledMarkdown,
}: AcademicCompositionDialogProps) {
    const { t } = useTranslation('exegesis');
    const { paper } = useExegesisPaper(open ? paperId : undefined);
    const anchoring = useCitationAnchoring(paper);
    const { composeAcademicPaper, saveAssembledPaper, saveExegesisArtifact } = useExegesisPapers();
    const [result, setResult] = useState<ComposeAcademicPaperOutput | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [view, setView] = useState<'rendered' | 'raw'>('rendered');
    const [savedAsArtifact, setSavedAsArtifact] = useState(false);

    const handleCompose = async (persist = false) => {
        setErrorMessage(null);
        setResult(null);
        try {
            const output = await composeAcademicPaper.mutateAsync({ paperId, persist });
            setResult(output);
            setView('rendered');
            if (persist) {
                toast.success(t('canonical.compose.savedToast'));
            }
        } catch (err) {
            console.error('[exegesis] composeAcademicPaper failed:', err);
            // The use case throws ComposeAcademicPaperPersistError when
            // composition succeeded but saving to the paper failed.
            // We still surface the markdown so the user can copy/download.
            const persistErr = err as { isPersistError?: boolean; output?: ComposeAcademicPaperOutput };
            if (persistErr?.isPersistError && persistErr.output) {
                setResult(persistErr.output);
                setView('rendered');
                toast.warning(t('canonical.compose.persistWarning'));
                return;
            }
            setErrorMessage((err as Error).message ?? t('canonical.compose.errorGeneric'));
        }
    };

    const handleSaveToPaper = async () => {
        if (!result) return;
        // Guarda EXACTAMENTE lo que el usuario está viendo. Antes esto
        // recomponía con `persist: true`: dos llamadas de Gemini Pro por
        // un paper, y lo archivado no era el texto aprobado.
        try {
            await saveAssembledPaper.mutateAsync({ paperId, markdown: result.markdown });
            toast.success(t('canonical.compose.savedToast'));
        } catch (err) {
            console.error('[exegesis] saveAssembledPaper failed:', err);
            toast.error(t('canonical.compose.persistWarning'));
        }
    };

    const handleSaveToResources = async () => {
        if (!result) return;
        try {
            await saveExegesisArtifact.mutateAsync({
                paperId,
                artifactType: 'academic-paper',
                title: `${suggestedFilename} — ${t('canonical.compose.title')}`,
                markdown: result.markdown,
            });
            setSavedAsArtifact(true);
            toast.success(t('canonical.compose.savedToResourcesToast'));
        } catch (err) {
            console.error('[exegesis] saveExegesisArtifact failed:', err);
            toast.error(t('canonical.compose.saveToResourcesFailed'));
        }
    };

    const handleCopy = async () => {
        if (!result) return;
        try {
            await navigator.clipboard.writeText(result.markdown);
            toast.success(t('canonical.compose.copied'));
        } catch (err) {
            console.error('[exegesis] clipboard copy failed:', err);
            toast.error(t('canonical.compose.copyFailed'));
        }
    };

    const handleDownload = () => {
        if (!result) return;
        const blob = new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${suggestedFilename}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleClose = (next: boolean) => {
        if (!next) {
            // Reset composition when the user closes — opening again
            // gives a fresh run, not a stale cached output. The hook's
            // mutation cache is per-paperId so this is purely local.
            setResult(null);
            setErrorMessage(null);
            setView('rendered');
            setSavedAsArtifact(false);
        }
        onOpenChange(next);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="inline-flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-success" aria-hidden />
                        {t('canonical.compose.title')}
                    </DialogTitle>
                    <DialogDescription>{t('canonical.compose.subtitle')}</DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-3">
                    {/* Sólo antes de componer: después el documento ya existe y
                        el aviso llegaría tarde para hacer algo con él. */}
                    {!result && !composeAcademicPaper.isPending && !errorMessage && (
                        <CitationAnchoringNotice summary={anchoring} />
                    )}

                    {!result && !composeAcademicPaper.isPending && !errorMessage && (
                        savedAssembledMarkdown
                            ? <SavedCompositionState
                                savedMarkdown={savedAssembledMarkdown}
                                onCompose={() => handleCompose(false)}
                            />
                            : <IdleState onCompose={handleCompose} />
                    )}

                    {composeAcademicPaper.isPending && <ComposingState />}

                    {errorMessage && !composeAcademicPaper.isPending && (
                        <ErrorState message={errorMessage} onRetry={handleCompose} />
                    )}

                    {result && !composeAcademicPaper.isPending && (
                        <SuccessView
                            result={result}
                            view={view}
                            onViewChange={setView}
                            onCopy={handleCopy}
                            onDownload={handleDownload}
                            onRecompose={() => handleCompose(false)}
                            onSaveToPaper={handleSaveToPaper}
                            onSaveToResources={handleSaveToResources}
                            savingToResources={saveExegesisArtifact.isPending}
                            savedToResources={savedAsArtifact}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Sub-components ──────────────────────────────────────────────────────

/**
 * Idle state for papers that already have a saved composition.
 * Shows the saved markdown rendered + offers Recompose / Copy /
 * Download actions. Recomposing will overwrite when the user opts
 * into "Save to paper" later in the success view.
 */
function SavedCompositionState({
    savedMarkdown,
    onCompose,
}: {
    savedMarkdown: string;
    onCompose: () => void;
}) {
    const { t } = useTranslation('exegesis');
    const [view, setView] = useState<'rendered' | 'raw'>('rendered');

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(savedMarkdown);
            toast.success(t('canonical.compose.copied'));
        } catch (err) {
            console.error('[exegesis] copy saved markdown failed:', err);
            toast.error(t('canonical.compose.copyFailed'));
        }
    };

    return (
        <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="rounded-md border border-success/30 bg-success-subtle/40 px-3 py-2 text-[11px] text-success-subtle-foreground inline-flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                {t('canonical.compose.savedExists')}
            </div>

            <div className="flex items-center justify-between gap-2">
                <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-[11px]">
                    <button
                        type="button"
                        onClick={() => setView('rendered')}
                        className={[
                            'px-2.5 py-1 rounded transition-colors',
                            view === 'rendered'
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground',
                        ].join(' ')}
                    >
                        {t('canonical.compose.viewRendered')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setView('raw')}
                        className={[
                            'px-2.5 py-1 rounded transition-colors',
                            view === 'raw'
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground',
                        ].join(' ')}
                    >
                        {t('canonical.compose.viewRaw')}
                    </button>
                </div>
                <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" onClick={handleCopy}>
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        {t('canonical.compose.copy')}
                    </Button>
                    <Button size="sm" onClick={onCompose} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        <Sparkles className="h-3.5 w-3.5 mr-1" />
                        {t('canonical.compose.recompose')}
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto rounded-md border border-border bg-card p-4">
                {view === 'rendered' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{savedMarkdown}</ReactMarkdown>
                    </div>
                ) : (
                    <pre className="text-[11px] font-mono whitespace-pre-wrap text-foreground/90">{savedMarkdown}</pre>
                )}
            </div>

            <p className="text-[10px] text-muted-foreground italic text-center">
                {t('canonical.compose.savedHint')}
            </p>
        </div>
    );
}

function IdleState({ onCompose }: { onCompose: (persist?: boolean) => void }) {
    const { t } = useTranslation('exegesis');
    return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4">
            <div className="rounded-full bg-success/10 p-3">
                <Sparkles className="h-6 w-6 text-success" aria-hidden />
            </div>
            <p className="text-sm text-foreground max-w-md leading-relaxed">
                {t('canonical.compose.idleBody')}
            </p>
            <Button onClick={() => onCompose(false)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Sparkles className="h-4 w-4 mr-1.5" />
                {t('canonical.compose.cta')}
            </Button>
            <p className="text-[11px] text-muted-foreground italic max-w-md">
                {t('canonical.compose.cost')}
            </p>
        </div>
    );
}

function ComposingState() {
    const { t } = useTranslation('exegesis');
    return (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-foreground">
                {t('canonical.compose.composingTitle')}
            </p>
            <p className="text-[11px] text-muted-foreground italic max-w-md text-center">
                {t('canonical.compose.composingBody')}
            </p>
        </div>
    );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
    const { t } = useTranslation('exegesis');
    return (
        <div className="flex flex-col items-center justify-center py-12 px-6 space-y-3 text-center">
            <p className="text-sm font-semibold text-destructive">
                {t('canonical.compose.errorTitle')}
            </p>
            <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
                {message}
            </p>
            <Button onClick={onRetry} variant="outline">
                {t('canonical.compose.retry')}
            </Button>
        </div>
    );
}

function SuccessView({
    result,
    view,
    onViewChange,
    onCopy,
    onDownload,
    onRecompose,
    onSaveToPaper,
    onSaveToResources,
    savingToResources,
    savedToResources,
}: {
    result: ComposeAcademicPaperOutput;
    view: 'rendered' | 'raw';
    onViewChange: (v: 'rendered' | 'raw') => void;
    onCopy: () => void;
    onDownload: () => void;
    onRecompose: () => void;
    onSaveToPaper: () => void;
    onSaveToResources: () => void;
    savingToResources: boolean;
    savedToResources: boolean;
}) {
    const { t } = useTranslation('exegesis');
    return (
        <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <FormatterStatusBanner status={result.formatterStatus} />
            <CoverageBanner coverage={result.coverage} />

            <div className="flex items-center justify-between gap-2">
                <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-[11px]">
                    <button
                        type="button"
                        onClick={() => onViewChange('rendered')}
                        className={[
                            'px-2.5 py-1 rounded transition-colors',
                            view === 'rendered'
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground',
                        ].join(' ')}
                    >
                        {t('canonical.compose.viewRendered')}
                    </button>
                    <button
                        type="button"
                        onClick={() => onViewChange('raw')}
                        className={[
                            'px-2.5 py-1 rounded transition-colors',
                            view === 'raw'
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground',
                        ].join(' ')}
                    >
                        {t('canonical.compose.viewRaw')}
                    </button>
                </div>
                <div className="flex items-center gap-1.5">
                    <Button
                        size="sm"
                        variant={savedToResources ? 'ghost' : 'outline'}
                        onClick={onSaveToResources}
                        disabled={savingToResources || savedToResources}
                        title={t('canonical.compose.saveToResourcesTooltip')}
                    >
                        {savingToResources ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                            <BookmarkPlus className="h-3.5 w-3.5 mr-1" />
                        )}
                        {savedToResources
                            ? t('canonical.compose.savedToResources')
                            : t('canonical.compose.saveToResources')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={onCopy}>
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        {t('canonical.compose.copy')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={onDownload}>
                        <Download className="h-3.5 w-3.5 mr-1" />
                        {t('canonical.compose.download')}
                    </Button>
                    <Button
                        size="sm"
                        onClick={onSaveToPaper}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        title={t('canonical.compose.saveToPaperTooltip')}
                    >
                        <Sparkles className="h-3.5 w-3.5 mr-1" />
                        {t('canonical.compose.saveToPaper')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onRecompose}>
                        <Sparkles className="h-3.5 w-3.5 mr-1" />
                        {t('canonical.compose.recompose')}
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto rounded-md border border-border bg-card p-4">
                {view === 'rendered' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {result.markdown}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <pre className="text-[11px] font-mono whitespace-pre-wrap text-foreground/90">
                        {result.markdown}
                    </pre>
                )}
            </div>

            {result.tokensUsed !== null && (
                <p className="text-[10px] text-muted-foreground italic text-right">
                    {t('canonical.compose.tokensUsed', {
                        tokens: result.tokensUsed.toLocaleString(),
                        model: result.modelId,
                    })}
                </p>
            )}
        </div>
    );
}

/**
 * Cuánto del análisis llegó al paper.
 *
 * El daño que este aviso hace visible es el que nadie notaba: el
 * documento salía bien escrito y con catorce campos del análisis
 * afuera. Ahora esos campos se publican igual, y esto dice cuáles
 * fueron y en qué versos, que es lo que hay que revisar antes de
 * entregar.
 */
function CoverageBanner({ coverage }: { coverage: ComposeAcademicPaperOutput['coverage'] }) {
    const { t } = useTranslation('exegesis');
    if (!coverage || coverage.totalItems === 0) return null;

    const recovered = coverage.recoveredItemLabels;
    if (recovered.length === 0) {
        return (
            <div className="rounded-md border border-success/30 bg-success-subtle/40 px-3 py-2 text-[11px] text-success-subtle-foreground">
                ✓ {t('canonical.compose.coverage.complete', { count: coverage.totalItems })}
            </div>
        );
    }

    const SHOWN = 8;
    const shown = recovered.slice(0, SHOWN);
    const rest = recovered.length - shown.length;
    const items = rest > 0
        ? `${shown.join(' · ')} · ${t('canonical.compose.coverage.more', { count: rest })}`
        : shown.join(' · ');

    return (
        <div className="rounded-md border border-warning/30 bg-warning-subtle/40 px-3 py-2 text-[11px] text-warning-subtle-foreground space-y-1">
            <p>⚠ {t('canonical.compose.coverage.recovered', { count: recovered.length })}</p>
            {coverage.renderedVerses.length > 0 && (
                <p className="opacity-90">
                    {t('canonical.compose.coverage.versesLabel', { verses: coverage.renderedVerses.join(', ') })}
                </p>
            )}
            <p className="opacity-90">{t('canonical.compose.coverage.itemsLabel', { items })}</p>
            {coverage.sectioningFailed && (
                <p className="opacity-90">{t('canonical.compose.coverage.sectioningFailed')}</p>
            )}
        </div>
    );
}

function FormatterStatusBanner({ status }: { status: ComposeAcademicPaperOutput['formatterStatus'] }) {
    const { t } = useTranslation('exegesis');
    if (status === 'applied') {
        return (
            <div className="rounded-md border border-success/30 bg-success-subtle/40 px-3 py-2 text-[11px] text-success-subtle-foreground">
                ✓ {t('canonical.compose.formatterApplied')}
            </div>
        );
    }
    if (status === 'skipped') {
        return (
            <div className="rounded-md border border-warning/30 bg-warning-subtle/40 px-3 py-2 text-[11px] text-warning-subtle-foreground">
                ⚠ {t('canonical.compose.formatterSkipped')}
            </div>
        );
    }
    return (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
            ⚠ {t('canonical.compose.formatterError')}
        </div>
    );
}
