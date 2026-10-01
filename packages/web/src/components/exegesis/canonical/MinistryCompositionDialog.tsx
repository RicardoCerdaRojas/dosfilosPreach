import { useState } from 'react';
import { BookmarkPlus, Copy, Download, Loader2, Mic, NotebookPen, Sparkles, Users } from 'lucide-react';
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
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';

type Format = 'sermon' | 'devotional' | 'studyGuide';
type SermonTone = 'pastoral' | 'expositivo' | 'narrativo';
type DevotionalAudience = 'general' | 'small-group' | 'individual';
type StudyGuideAudience = 'small-group' | 'sunday-school' | 'individual';

interface MinistryCompositionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    paperId: string;
    suggestedFilename: string;
}

/**
 * Modal that orchestrates ministry composition: sermon, devotional,
 * or study guide. Each format has its own option set (tone /
 * audience) and renders its result in the same view shell.
 *
 * Three composers live behind one dialog because they share the same
 * UX shape (pick options → compose → copy/download). Splitting them
 * into three dialogs would triplicate boilerplate without UX gain.
 */
export function MinistryCompositionDialog({
    open,
    onOpenChange,
    paperId,
    suggestedFilename,
}: MinistryCompositionDialogProps) {
    const { t } = useTranslation('exegesis');
    const {
        composeSermonFromAnalyses,
        composeDevotionalFromAnalyses,
        composeStudyGuideFromAnalyses,
        saveExegesisArtifact,
    } = useExegesisPapers();

    const [format, setFormat] = useState<Format>('sermon');
    const [sermonTone, setSermonTone] = useState<SermonTone>('expositivo');
    const [devotionalAudience, setDevotionalAudience] = useState<DevotionalAudience>('general');
    const [studyAudience, setStudyAudience] = useState<StudyGuideAudience>('small-group');
    const [result, setResult] = useState<{ markdown: string; modelId: string; tokensUsed: number | null } | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [view, setView] = useState<'rendered' | 'raw'>('rendered');
    const [saved, setSaved] = useState(false);

    const isPending =
        composeSermonFromAnalyses.isPending
        || composeDevotionalFromAnalyses.isPending
        || composeStudyGuideFromAnalyses.isPending;

    const handleCompose = async () => {
        setErrorMessage(null);
        setResult(null);
        setSaved(false);
        try {
            let output;
            if (format === 'sermon') {
                output = await composeSermonFromAnalyses.mutateAsync({ paperId, tone: sermonTone });
            } else if (format === 'devotional') {
                output = await composeDevotionalFromAnalyses.mutateAsync({ paperId, audience: devotionalAudience });
            } else {
                output = await composeStudyGuideFromAnalyses.mutateAsync({ paperId, audience: studyAudience });
            }
            setResult({ markdown: output.markdown, modelId: output.modelId, tokensUsed: output.tokensUsed });
            setView('rendered');
        } catch (err) {
            console.error('[exegesis] ministry composition failed:', err);
            setErrorMessage((err as Error).message ?? t('canonical.ministry.errorGeneric'));
        }
    };

    // Maps the dialog's local format ('sermon'/'devotional'/'studyGuide')
    // to the persistence artifactType taxonomy. The sermon format here
    // is the outline-style ministry doc, not a `sermons/{id}` entity
    // (which has its own dedicated "Generar sermón" path with wizard
    // metadata) — so it persists as SERMON_OUTLINE.
    const persistArtifactType = (): 'sermon-outline' | 'devotional' | 'study-guide' => {
        if (format === 'sermon') return 'sermon-outline';
        if (format === 'devotional') return 'devotional';
        return 'study-guide';
    };

    const handleSaveToResources = async () => {
        if (!result) return;
        try {
            await saveExegesisArtifact.mutateAsync({
                paperId,
                artifactType: persistArtifactType(),
                title: `${suggestedFilename} — ${t(`canonical.ministry.format.${format}`)}`,
                markdown: result.markdown,
            });
            setSaved(true);
            toast.success(t('canonical.ministry.savedToast'));
        } catch (err) {
            console.error('[exegesis] saveExegesisArtifact failed:', err);
            toast.error(t('canonical.ministry.saveFailed'));
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
        a.download = `${suggestedFilename}-${format}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleClose = (next: boolean) => {
        if (!next) {
            setResult(null);
            setErrorMessage(null);
            setView('rendered');
            setSaved(false);
        }
        onOpenChange(next);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="inline-flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-success" aria-hidden />
                        {t('canonical.ministry.title')}
                    </DialogTitle>
                    <DialogDescription>{t('canonical.ministry.subtitle')}</DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-3">
                    {/* Format tabs */}
                    <div className="grid grid-cols-3 gap-2">
                        <FormatTab
                            icon={<Mic className="h-4 w-4" />}
                            label={t('canonical.ministry.format.sermon')}
                            active={format === 'sermon'}
                            onClick={() => { setFormat('sermon'); setResult(null); setErrorMessage(null); }}
                            disabled={isPending}
                        />
                        <FormatTab
                            icon={<NotebookPen className="h-4 w-4" />}
                            label={t('canonical.ministry.format.devotional')}
                            active={format === 'devotional'}
                            onClick={() => { setFormat('devotional'); setResult(null); setErrorMessage(null); }}
                            disabled={isPending}
                        />
                        <FormatTab
                            icon={<Users className="h-4 w-4" />}
                            label={t('canonical.ministry.format.studyGuide')}
                            active={format === 'studyGuide'}
                            onClick={() => { setFormat('studyGuide'); setResult(null); setErrorMessage(null); }}
                            disabled={isPending}
                        />
                    </div>

                    {/* Format-specific options */}
                    {!result && !isPending && !errorMessage && (
                        <div className="space-y-3">
                            {format === 'sermon' && (
                                <OptionsBlock
                                    label={t('canonical.ministry.sermon.toneLabel')}
                                    options={[
                                        { value: 'pastoral', label: t('canonical.ministry.sermon.tone.pastoral') },
                                        { value: 'expositivo', label: t('canonical.ministry.sermon.tone.expositivo') },
                                        { value: 'narrativo', label: t('canonical.ministry.sermon.tone.narrativo') },
                                    ]}
                                    value={sermonTone}
                                    onChange={(v) => setSermonTone(v as SermonTone)}
                                />
                            )}
                            {format === 'devotional' && (
                                <OptionsBlock
                                    label={t('canonical.ministry.devotional.audienceLabel')}
                                    options={[
                                        { value: 'general', label: t('canonical.ministry.devotional.audience.general') },
                                        { value: 'small-group', label: t('canonical.ministry.devotional.audience.smallGroup') },
                                        { value: 'individual', label: t('canonical.ministry.devotional.audience.individual') },
                                    ]}
                                    value={devotionalAudience}
                                    onChange={(v) => setDevotionalAudience(v as DevotionalAudience)}
                                />
                            )}
                            {format === 'studyGuide' && (
                                <OptionsBlock
                                    label={t('canonical.ministry.studyGuide.audienceLabel')}
                                    options={[
                                        { value: 'small-group', label: t('canonical.ministry.studyGuide.audience.smallGroup') },
                                        { value: 'sunday-school', label: t('canonical.ministry.studyGuide.audience.sundaySchool') },
                                        { value: 'individual', label: t('canonical.ministry.studyGuide.audience.individual') },
                                    ]}
                                    value={studyAudience}
                                    onChange={(v) => setStudyAudience(v as StudyGuideAudience)}
                                />
                            )}
                            <p className="text-[11px] text-muted-foreground italic">
                                {t('canonical.ministry.idleHint')}
                            </p>
                            <Button onClick={handleCompose} className="bg-primary hover:bg-primary/90 text-primary-foreground self-start">
                                <Sparkles className="h-4 w-4 mr-1.5" />
                                {t('canonical.ministry.cta')}
                            </Button>
                        </div>
                    )}

                    {isPending && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-3">
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                            <p className="text-sm text-foreground">{t('canonical.ministry.composing')}</p>
                        </div>
                    )}

                    {errorMessage && !isPending && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
                            <p className="text-sm font-semibold text-destructive">{t('canonical.ministry.errorTitle')}</p>
                            <p className="text-xs text-muted-foreground max-w-md">{errorMessage}</p>
                            <Button onClick={handleCompose} variant="outline">
                                {t('canonical.compose.retry')}
                            </Button>
                        </div>
                    )}

                    {result && !isPending && (
                        <div className="flex-1 overflow-hidden flex flex-col gap-3">
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
                                    <Button
                                        size="sm"
                                        variant={saved ? 'ghost' : 'default'}
                                        onClick={handleSaveToResources}
                                        disabled={saveExegesisArtifact.isPending || saved}
                                    >
                                        {saveExegesisArtifact.isPending ? (
                                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                        ) : (
                                            <BookmarkPlus className="h-3.5 w-3.5 mr-1" />
                                        )}
                                        {saved
                                            ? t('canonical.ministry.savedCta')
                                            : t('canonical.ministry.saveCta')}
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={handleCopy}>
                                        <Copy className="h-3.5 w-3.5 mr-1" />
                                        {t('canonical.compose.copy')}
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={handleDownload}>
                                        <Download className="h-3.5 w-3.5 mr-1" />
                                        {t('canonical.compose.download')}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={handleCompose}>
                                        <Sparkles className="h-3.5 w-3.5 mr-1" />
                                        {t('canonical.compose.recompose')}
                                    </Button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto rounded-md border border-border bg-card p-4">
                                {view === 'rendered' ? (
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.markdown}</ReactMarkdown>
                                    </div>
                                ) : (
                                    <pre className="text-[11px] font-mono whitespace-pre-wrap text-foreground/90">{result.markdown}</pre>
                                )}
                            </div>
                            {result.tokensUsed !== null && (
                                <p className="text-[10px] text-muted-foreground italic text-right">
                                    {t('canonical.compose.tokensUsed', {
                                        tokens: result.tokensUsed.toLocaleString(),
                                    })}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function FormatTab({
    icon,
    label,
    active,
    onClick,
    disabled,
}: {
    icon: React.ReactNode;
    label: string;
    active: boolean;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={[
                'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                active
                    ? 'border-success bg-success-subtle text-success-subtle-foreground'
                    : 'border-border bg-card text-foreground hover:bg-accent',
                disabled ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
        >
            <span className={active ? 'text-success' : 'text-muted-foreground'}>{icon}</span>
            <span className="font-medium">{label}</span>
        </button>
    );
}

function OptionsBlock({
    label,
    options,
    value,
    onChange,
}: {
    label: string;
    options: Array<{ value: string; label: string }>;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">{label}</p>
            <div className="grid grid-cols-3 gap-2">
                {options.map(opt => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className={[
                            'rounded-md border px-3 py-2 text-xs transition-colors text-left',
                            value === opt.value
                                ? 'border-primary bg-primary/5 text-foreground'
                                : 'border-border bg-card text-foreground hover:bg-accent',
                        ].join(' ')}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
