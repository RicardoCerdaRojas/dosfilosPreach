import { Loader2, Sparkles } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useExegesisQuota } from '@/hooks/exegesis/useExegesisQuota';
import {
    EXEGESIS_OPERATION_CATALOG,
    STUDY_UNIT_USD,
    previewSpend,
    type ExegesisOperationKey,
} from '@dosfilos/domain';
import { processingBalanceService } from '@dosfilos/application';
import { useEffect, useState } from 'react';
import type { ProcessingBalance } from '@dosfilos/domain';
import { useFirebase } from '@/context/firebase-context';

interface ExegesisPreConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Operation key from the catalog. Drives cost + display copy. */
    operation: ExegesisOperationKey;
    /** Fired when the user clicks "Continuar". The caller dispatches the actual UC. */
    onConfirm: () => void;
    /** Whether the underlying operation is currently in flight. */
    isExecuting?: boolean;
}

/**
 * Cost-aware confirmation modal shown before running operations
 * marked `requiresPreConfirm: true` in the catalog (≥$0.10 single-shot
 * cost OR easily-re-triggered ops like recompose-academic).
 *
 * Renders:
 *   - Operation name (i18n key from catalog)
 *   - Estimated cost in $USD AND in display "estudios"
 *   - Post-operation balance preview
 *   - Continue / Cancel buttons
 *
 * Caller owns the open/close state. The simplest wiring pattern:
 *
 *   const [confirmOpen, setConfirmOpen] = useState(false);
 *   const handleAnalyze = () => {
 *       if (operationRequiresPreConfirm('analyzeVerseCanonically')) {
 *           setConfirmOpen(true);
 *       } else {
 *           runOperation();
 *       }
 *   };
 *   <ExegesisPreConfirmDialog
 *       open={confirmOpen} onOpenChange={setConfirmOpen}
 *       operation="analyzeVerseCanonically"
 *       onConfirm={() => { setConfirmOpen(false); runOperation(); }}
 *   />
 */
export function ExegesisPreConfirmDialog({
    open,
    onOpenChange,
    operation,
    onConfirm,
    isExecuting,
}: ExegesisPreConfirmDialogProps) {
    const { t } = useTranslation('exegesis');
    const quota = useExegesisQuota();
    const balance = useRawBalance();
    const def = EXEGESIS_OPERATION_CATALOG[operation];
    const cost = def?.estimatedCostUsd ?? 0;
    const operationLabel = def ? t(def.displayKeyI18n) : operation;
    const studiesCost = Math.max(0.1, cost / STUDY_UNIT_USD);

    const preview = balance ? previewSpend(balance, cost) : null;
    const insufficient = preview && !preview.affordable;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="inline-flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        {t('quota.preConfirm.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('quota.preConfirm.description', { operation: operationLabel })}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 text-sm">
                    <div className="rounded-md border border-border bg-card px-3 py-2 space-y-1">
                        <p className="text-xs text-muted-foreground">
                            {t('quota.preConfirm.costLabel')}
                        </p>
                        <p className="text-base font-semibold">
                            ~${cost.toFixed(3)} USD
                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                                {t('quota.preConfirm.costStudies', {
                                    studies: studiesCost.toFixed(1),
                                })}
                            </span>
                        </p>
                    </div>

                    {quota && preview && (
                        <div className="rounded-md border border-border bg-card px-3 py-2 text-xs space-y-1">
                            <p className="text-muted-foreground">
                                {t('quota.preConfirm.afterLabel')}
                            </p>
                            <p>
                                {t('quota.preConfirm.afterValue', {
                                    usd: preview.remainingAfterUsd.toFixed(2),
                                    studies: preview.remainingAfterStudies.toFixed(1),
                                })}
                            </p>
                        </div>
                    )}

                    {insufficient && (
                        <p className="text-xs text-destructive">
                            {t('quota.preConfirm.insufficientHint')}
                        </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExecuting}>
                            {t('quota.preConfirm.cancel')}
                        </Button>
                        <Button
                            onClick={onConfirm}
                            disabled={Boolean(insufficient) || Boolean(isExecuting)}
                            className="bg-primary-solid hover:bg-primary-solid-hover text-primary-foreground"
                        >
                            {isExecuting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                            {t('quota.preConfirm.confirm')}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Live `ProcessingBalance` for `previewSpend` — needs the raw object,
 * not the derived state. Kept private to this component since the
 * other surfaces only ever want the computed state.
 */
function useRawBalance(): ProcessingBalance | null {
    const { user } = useFirebase();
    const [balance, setBalance] = useState<ProcessingBalance | null>(null);

    useEffect(() => {
        if (!user) {
            setBalance(null);
            return;
        }
        const unsubscribe = processingBalanceService.subscribeToBalance(
            user.uid,
            setBalance,
            () => { /* logged inside the service */ },
        );
        return () => unsubscribe();
    }, [user]);

    return balance;
}
