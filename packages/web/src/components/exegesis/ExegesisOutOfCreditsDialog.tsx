import { Loader2, Sparkles, ShieldAlert } from 'lucide-react';
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
import { STUDY_UNIT_USD } from '@dosfilos/domain';
import { fireExegesisPricingEvent } from '@dosfilos/application';
import { useFirebase } from '@/context/firebase-context';

interface ExegesisOutOfCreditsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /**
     * USD that the operation needed but the bucket couldn't cover.
     * When undefined (e.g. user opens the dialog from a banner CTA
     * before triggering an op), the dialog renders the generic
     * "no quota" copy.
     */
    neededUsd?: number;
    /**
     * Triggered when the user clicks "Comprar pack". Caller wires
     * this to open the `CreditPacksDialog`. Optional — if omitted
     * the button just dismisses with a toast nudging settings.
     */
    onBuyPacks?: () => void;
    /** Triggered when the user clicks "Upgrade plan". Optional. */
    onUpgradePlan?: () => void;
}

/**
 * Shown when:
 *   - An exegesis mutation throws `InsufficientExegesisCreditsError`
 *     (post-Fase-2). The catch block opens this dialog with
 *     `neededUsd` set to the cost the operation tried to charge.
 *   - The user clicks the "Quota agotada" banner CTA proactively.
 *     `neededUsd` is omitted and the copy nudges them to top up.
 *
 * Three states inside the dialog:
 *   1. `noAccess` (Free / Personal plan) → upgrade-only path.
 *   2. Plan includes exegesis but balance is empty → buy pack OR
 *      wait until next billing cycle.
 *   3. Loading the user's quota state.
 */
export function ExegesisOutOfCreditsDialog({
    open,
    onOpenChange,
    neededUsd,
    onBuyPacks,
    onUpgradePlan,
}: ExegesisOutOfCreditsDialogProps) {
    const { t } = useTranslation('exegesis');
    const quota = useExegesisQuota();
    const { user } = useFirebase();

    const noAccess = quota?.noAccess === true;
    const hasPack = (quota?.packBalanceUsd ?? 0) > 0;

    const trackUpgradeClick = (surface: 'upgrade_plan' | 'buy_pack') => {
        fireExegesisPricingEvent('exegesis.upgrade.cta_clicked', {
            ownerId: user?.uid,
            surface,
        });
    };

    const neededStudies = neededUsd != null ? Math.max(0.1, neededUsd / STUDY_UNIT_USD) : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="inline-flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-warning" />
                        {t('quota.outOfCredits.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {noAccess
                            ? t('quota.outOfCredits.noAccessDescription')
                            : t('quota.outOfCredits.depletedDescription')}
                    </DialogDescription>
                </DialogHeader>

                {!quota && (
                    <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('quota.outOfCredits.loading')}
                    </div>
                )}

                {quota && (
                    <div className="space-y-3 text-sm">
                        {neededUsd != null && (
                            <div className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs">
                                <p className="font-medium text-warning-subtle-foreground">
                                    {t('quota.outOfCredits.neededLabel')}
                                </p>
                                <p className="mt-0.5 text-warning-subtle-foreground/90">
                                    {t('quota.outOfCredits.neededValue', {
                                        usd: neededUsd.toFixed(3),
                                        studies: neededStudies?.toFixed(1) ?? '0.1',
                                    })}
                                </p>
                            </div>
                        )}

                        <div className="rounded-md border border-border bg-card px-3 py-2 text-xs space-y-1">
                            <p className="text-muted-foreground">
                                {t('quota.outOfCredits.balanceLabel')}
                            </p>
                            <p>
                                <strong>{t('quota.outOfCredits.balancePlan', {
                                    usd: quota.planAllowanceUsd.toFixed(2),
                                })}</strong>
                                {' · '}
                                <span className="text-muted-foreground">
                                    {t('quota.outOfCredits.balancePack', {
                                        usd: quota.packBalanceUsd.toFixed(2),
                                    })}
                                </span>
                            </p>
                        </div>

                        <div className="flex flex-col gap-2 pt-2">
                            {noAccess ? (
                                <>
                                    <Button
                                        onClick={() => {
                                            trackUpgradeClick('upgrade_plan');
                                            onUpgradePlan?.();
                                            onOpenChange(false);
                                        }}
                                        className="bg-primary-solid hover:bg-primary-solid-hover text-primary-foreground w-full"
                                    >
                                        <Sparkles className="h-4 w-4 mr-1.5" />
                                        {t('quota.outOfCredits.upgradeCta')}
                                    </Button>
                                    <p className="text-[11px] text-muted-foreground text-center">
                                        {t('quota.outOfCredits.noAccessSeparator')}
                                    </p>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            trackUpgradeClick('buy_pack');
                                            onBuyPacks?.();
                                            onOpenChange(false);
                                        }}
                                        disabled={!onBuyPacks}
                                        className="w-full"
                                    >
                                        {t('quota.outOfCredits.buyPackCta')}
                                    </Button>
                                    <p className="text-[11px] text-muted-foreground italic text-center">
                                        {t('quota.outOfCredits.noAccessPackHint')}
                                    </p>
                                </>
                            ) : (
                                <>
                                    <Button
                                        onClick={() => {
                                            trackUpgradeClick('buy_pack');
                                            onBuyPacks?.();
                                            onOpenChange(false);
                                        }}
                                        disabled={!onBuyPacks}
                                        className="bg-primary-solid hover:bg-primary-solid-hover text-primary-foreground w-full"
                                    >
                                        <Sparkles className="h-4 w-4 mr-1.5" />
                                        {t('quota.outOfCredits.buyPackCta')}
                                    </Button>
                                    {!hasPack && (
                                        <p className="text-[11px] text-muted-foreground italic text-center">
                                            {t('quota.outOfCredits.waitForCycleHint')}
                                        </p>
                                    )}
                                </>
                            )}
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                {t('quota.outOfCredits.close')}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
