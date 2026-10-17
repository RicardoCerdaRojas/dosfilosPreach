import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import type { CoherenceIssue, CoherenceIssueCategory, CoherenceReviewOutput } from '@dosfilos/domain';

interface CoherencePassDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    paperId: string;
    /** Paper's display language — drives the reviewer's output language. */
    language: 'es' | 'en';
}

/**
 * Triggered from the paper detail page header. Runs the coherence
 * reviewer and renders the resulting issue list grouped by category +
 * severity. Read-only; the user fixes issues by editing the affected
 * step cards.
 */
export function CoherencePassDialog({
    open,
    onOpenChange,
    paperId,
    language,
}: CoherencePassDialogProps) {
    const { t } = useTranslation('exegesis');
    const { runCoherencePass } = useExegesisPapers();
    const [result, setResult] = useState<CoherenceReviewOutput | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleRun = async () => {
        setResult(null);
        setErrorMessage(null);
        try {
            const out = await runCoherencePass.mutateAsync({ paperId, language });
            setResult(out);
        } catch (err) {
            console.error('[exegesis] coherence pass failed:', err);
            setErrorMessage((err as Error).message || t('coherence.dialog.errorGeneric'));
        }
    };

    const issueCount = result?.issues.length ?? 0;
    const allClear = result !== null && issueCount === 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="inline-flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-amber-600" />
                        {t('coherence.dialog.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('coherence.dialog.description')}
                    </DialogDescription>
                </DialogHeader>

                {!result && !runCoherencePass.isPending && !errorMessage && (
                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {t('coherence.dialog.idleBody')}
                        </p>
                        <p className="text-[11px] text-muted-foreground italic">
                            {t('coherence.dialog.cost')}
                        </p>
                        <Button
                            onClick={handleRun}
                            className="bg-primary-solid hover:bg-primary-solid-hover text-primary-foreground"
                        >
                            <Sparkles className="h-4 w-4 mr-1.5" />
                            {t('coherence.dialog.runCta')}
                        </Button>
                    </div>
                )}

                {runCoherencePass.isPending && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('coherence.dialog.running')}
                    </div>
                )}

                {errorMessage && !runCoherencePass.isPending && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                        <p className="text-sm font-medium text-destructive inline-flex items-center gap-1.5">
                            <AlertTriangle className="h-4 w-4" />
                            {t('coherence.dialog.errorTitle')}
                        </p>
                        <p className="text-xs text-destructive/90">{errorMessage}</p>
                        <Button size="sm" variant="outline" onClick={handleRun}>
                            {t('coherence.dialog.retry')}
                        </Button>
                    </div>
                )}

                {result && !runCoherencePass.isPending && (
                    <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-3">
                        {allClear ? (
                            <div className="rounded-md border border-success/40 bg-success-subtle p-4 space-y-1.5">
                                <p className="text-sm font-semibold text-success-subtle-foreground inline-flex items-center gap-1.5">
                                    <CheckCircle2 className="h-4 w-4" />
                                    {t('coherence.dialog.allClear')}
                                </p>
                                <p className="text-[12px] text-success-subtle-foreground leading-snug">
                                    {result.summary}
                                </p>
                            </div>
                        ) : (
                            <>
                                <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-amber-400 pl-3">
                                    {result.summary}
                                </p>
                                {result.issues.map((issue, idx) => (
                                    <IssueCard key={idx} issue={issue} />
                                ))}
                            </>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-border">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRun}
                                disabled={runCoherencePass.isPending}
                            >
                                {t('coherence.dialog.rerun')}
                            </Button>
                            <Button size="sm" onClick={() => onOpenChange(false)}>
                                {t('coherence.dialog.close')}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function IssueCard({ issue }: { issue: CoherenceIssue }) {
    const { t } = useTranslation('exegesis');
    const tone = SEVERITY_TONES[issue.severity];
    return (
        <article className={cn('rounded-md border p-3 space-y-1', tone.container)}>
            <header className="flex items-center gap-2 text-[11px] font-medium">
                <AlertTriangle className={cn('h-3.5 w-3.5', tone.icon)} />
                <span className={tone.label}>
                    {t(`coherence.severity.${issue.severity}`)}
                </span>
                <span className="text-muted-foreground">
                    · {t(`coherence.category.${issue.category}`)}
                </span>
            </header>
            <p className="text-sm text-foreground leading-relaxed">
                {issue.message}
            </p>
            {issue.relatedStepIds.length > 0 && (
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t('coherence.dialog.relatedSteps', { count: issue.relatedStepIds.length })}
                </p>
            )}
        </article>
    );
}

const SEVERITY_TONES: Record<'high' | 'medium' | 'low', {
    container: string;
    icon: string;
    label: string;
}> = {
    high: {
        container: 'border-rose-300 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/30',
        icon: 'text-rose-600',
        label: 'text-rose-700 dark:text-rose-300',
    },
    medium: {
        container: 'border-amber-300 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/30',
        icon: 'text-amber-600',
        label: 'text-amber-700 dark:text-amber-300',
    },
    low: {
        container: 'border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-900/30',
        icon: 'text-slate-500',
        label: 'text-slate-600 dark:text-slate-300',
    },
};

// Re-exported for type clarity in the page that opens the dialog.
export type { CoherenceIssueCategory };
