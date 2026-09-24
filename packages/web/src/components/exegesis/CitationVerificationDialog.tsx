import { Loader2 } from 'lucide-react';
import { STATUS_TONE } from '@/components/exegesis/citation/citationStatusTone';
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
import type { CitationStatus, VerifiedCitation } from '@dosfilos/domain';

interface CitationVerificationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Per-citation results from the most recent verifier run. Empty until first run. */
    citations: VerifiedCitation[];
    /**
     * Fuentes que el texto nombra sin citarlas en un formato legible
     * para el verificador. Cero cuando no aplica o no se midió.
     */
    sourcesNamedWithoutCitation?: number;
    /**
     * Afirmaciones sobre manuscritos que ninguna cita respalda. Cero
     * cuando no aplica o no se midió.
     */
    witnessClaimsWithoutCitation?: number;
    isVerifying: boolean;
    onReverify: () => void;
}

/**
 * Modal that surfaces the per-citation verifier verdicts. Triggered
 * from the StepCard's "Verificar citas" button. The dialog is read-
 * only — fixing a flagged cite is the user's job (they edit the step
 * markdown and re-run verification).
 */
export function CitationVerificationDialog({
    open,
    onOpenChange,
    citations,
    sourcesNamedWithoutCitation = 0,
    witnessClaimsWithoutCitation = 0,
    isVerifying,
    onReverify,
}: CitationVerificationDialogProps) {
    const { t } = useTranslation('exegesis');

    const counts = countByStatus(citations);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{t('canonical.verify.dialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('canonical.verify.dialog.description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <CountChip kind="verified" count={counts.verified} />
                    <CountChip kind="page-mismatch" count={counts['page-mismatch']} />
                    <CountChip kind="page-unverifiable" count={counts['page-unverifiable']} />
                    <CountChip kind="fuzzy-low" count={counts['fuzzy-low']} />
                    <CountChip kind="not-found" count={counts['not-found']} />
                    <CountChip kind="manual-pending" count={counts['manual-pending']} />
                </div>

                {witnessClaimsWithoutCitation > 0 && (
                    <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                        ⚠ {t('canonical.verify.dialog.witnessClaims', { count: witnessClaimsWithoutCitation })}
                    </p>
                )}

                {sourcesNamedWithoutCitation > 0 && (
                    <p className="rounded-md border border-warning/30 bg-warning-subtle/40 px-3 py-2 text-[11px] text-warning-subtle-foreground">
                        ⚠ {t('canonical.verify.dialog.namedWithoutCitation', { count: sourcesNamedWithoutCitation })}
                    </p>
                )}

                <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-2">
                    {citations.length === 0 && !isVerifying && (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                            {t('canonical.verify.dialog.empty')}
                        </p>
                    )}
                    {isVerifying && citations.length === 0 && (
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-6">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t('canonical.verify.dialog.running')}
                        </div>
                    )}
                    {citations.map((c, idx) => (
                        <CitationRow key={`${c.offset}-${idx}`} citation={c} />
                    ))}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onReverify}
                        disabled={isVerifying}
                    >
                        {isVerifying && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                        {t('canonical.verify.dialog.rerun')}
                    </Button>
                    <Button size="sm" onClick={() => onOpenChange(false)}>
                        {t('canonical.verify.dialog.close')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function CitationRow({ citation }: { citation: VerifiedCitation }) {
    const { t } = useTranslation('exegesis');
    const tone = STATUS_TONE[citation.status];
    const Icon = tone.Icon;

    return (
        <article
            className={cn(
                'rounded-lg border p-3 space-y-1.5',
                tone.container,
            )}
        >
            <header className="flex items-start gap-2">
                <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', tone.icon)} />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">
                        {t(`canonical.verify.status.${citation.status}`)}
                        {citation.similarityScore !== null && (
                            <span className="ml-2 text-muted-foreground font-normal">
                                · {Math.round(citation.similarityScore * 100)}%
                            </span>
                        )}
                    </p>
                    <p className="text-sm font-mono text-foreground truncate">
                        {citation.raw}
                    </p>
                </div>
            </header>
            {citation.matchedSourceLabel && (
                <p className="text-[11px] text-muted-foreground pl-6">
                    {t('canonical.verify.dialog.matchedSource')}: {citation.matchedSourceLabel}
                    {(citation.matchedPageLabel || citation.matchedPage)
                        && ` · ${citation.matchedPageLabel || `p. ${citation.matchedPage}`}`}
                </p>
            )}
            {citation.evidence && (
                <blockquote className="pl-6 text-[12px] text-muted-foreground italic border-l-2 border-border ml-1.5">
                    {citation.evidenceIsQuoted ? `"${citation.evidence}"` : citation.evidence}
                </blockquote>
            )}
            {citation.note && (
                <p className="pl-6 text-[11px] text-muted-foreground">
                    {citation.note}
                </p>
            )}
        </article>
    );
}

function CountChip({ kind, count }: { kind: CitationStatus; count: number }) {
    const { t } = useTranslation('exegesis');
    if (count === 0) return null;
    const tone = STATUS_TONE[kind];
    const Icon = tone.Icon;
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 border',
                tone.badge,
            )}
        >
            <Icon className="h-3 w-3" />
            <span className="font-medium">{count}</span>
            <span className="text-muted-foreground">
                {t(`canonical.verify.status.${kind}`)}
            </span>
        </span>
    );
}

function countByStatus(citations: VerifiedCitation[]): Record<CitationStatus, number> {
    const counts: Record<CitationStatus, number> = {
        verified: 0,
        'page-mismatch': 0,
        'page-unverifiable': 0,
        'not-found': 0,
        'fuzzy-low': 0,
        'manual-pending': 0,
    };
    for (const c of citations) counts[c.status]++;
    return counts;
}

