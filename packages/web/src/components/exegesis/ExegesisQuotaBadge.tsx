import { Sparkles, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { useExegesisQuota } from '@/hooks/exegesis/useExegesisQuota';
import { ExegesisOutOfCreditsDialog } from './ExegesisOutOfCreditsDialog';

interface ExegesisQuotaBadgeProps {
    /**
     * Optional handler when the user clicks "Comprar pack" inside the
     * out-of-credits dialog. Wire to `setCreditPacksOpen(true)` (or
     * the dialog the surface uses for pack purchase).
     */
    onBuyPacks?: () => void;
    /** Optional handler for "Upgrade plan" — wires to settings/billing nav. */
    onUpgradePlan?: () => void;
    /**
     * Visual size. `'compact'` for inline header chip, `'banner'` for
     * full-width contextual banner on module landing pages.
     */
    variant?: 'compact' | 'banner';
}

/**
 * Persistent quota indicator. Two visual modes:
 *
 *   - `'compact'` (default): pill chip "{N} estudios" with severity color
 *     by `capState`. Click opens the out-of-credits dialog (always
 *     useful, even when state is `ok` — it shows the breakdown).
 *   - `'banner'`: full-width card. Used on module landing pages so the
 *     user sees their ceiling before starting work.
 *
 * Hidden when the user isn't authenticated or the balance hasn't
 * loaded yet (avoids flash of empty state).
 */
export function ExegesisQuotaBadge({
    onBuyPacks,
    onUpgradePlan,
    variant = 'compact',
}: ExegesisQuotaBadgeProps) {
    const { t } = useTranslation('exegesis');
    const quota = useExegesisQuota();
    const [outOfCreditsOpen, setOutOfCreditsOpen] = useState(false);

    if (!quota) return null;

    const tone = TONE_BY_STATE[quota.capState];
    const Icon = quota.capState === 'ok' ? Sparkles : ShieldAlert;

    if (variant === 'banner') {
        return (
            <>
                <button
                    type="button"
                    onClick={() => setOutOfCreditsOpen(true)}
                    className={cn(
                        'w-full text-left rounded-lg border px-4 py-3 flex items-center gap-3 transition-colors',
                        tone.bannerClass,
                    )}
                >
                    <Icon className={cn('h-5 w-5 shrink-0', tone.iconClass)} />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">
                            {quota.noAccess
                                ? t('quota.badge.noAccessTitle')
                                : t('quota.badge.bannerTitle', {
                                    studies: quota.remainingStudies.toFixed(1),
                                })}
                        </p>
                        <p className="text-[11px] opacity-90 mt-0.5">
                            {quota.noAccess
                                ? t('quota.badge.noAccessHint')
                                : quota.capState === 'hard-cap'
                                    ? t('quota.badge.hardCapHint')
                                    : quota.capState === 'soft-warn'
                                        ? t('quota.badge.softWarnHint')
                                        : t('quota.badge.okHint')}
                        </p>
                    </div>
                    <span className="text-[11px] underline">{t('quota.badge.actionCta')}</span>
                </button>
                <ExegesisOutOfCreditsDialog
                    open={outOfCreditsOpen}
                    onOpenChange={setOutOfCreditsOpen}
                    onBuyPacks={onBuyPacks}
                    onUpgradePlan={onUpgradePlan}
                />
            </>
        );
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOutOfCreditsOpen(true)}
                className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                    tone.compactClass,
                )}
                title={t('quota.badge.compactTooltip')}
            >
                <Icon className="h-3 w-3" />
                <span className="font-medium">
                    {quota.noAccess
                        ? t('quota.badge.compactNoAccess')
                        : t('quota.badge.compactRemaining', {
                            studies: quota.remainingStudies.toFixed(1),
                        })}
                </span>
            </button>
            <ExegesisOutOfCreditsDialog
                open={outOfCreditsOpen}
                onOpenChange={setOutOfCreditsOpen}
                onBuyPacks={onBuyPacks}
                onUpgradePlan={onUpgradePlan}
            />
        </>
    );
}

const TONE_BY_STATE: Record<'ok' | 'soft-warn' | 'hard-cap', {
    iconClass: string;
    compactClass: string;
    bannerClass: string;
}> = {
    ok: {
        iconClass: 'text-success',
        compactClass: 'border-success/30 bg-success-subtle text-success-subtle-foreground hover:bg-success-subtle/80',
        bannerClass: 'border-success/30 bg-success-subtle text-success-subtle-foreground hover:bg-success-subtle/80',
    },
    'soft-warn': {
        iconClass: 'text-warning',
        compactClass: 'border-warning/30 bg-warning-subtle text-warning-subtle-foreground hover:bg-warning-subtle/80',
        bannerClass: 'border-warning/30 bg-warning-subtle text-warning-subtle-foreground hover:bg-warning-subtle/80',
    },
    'hard-cap': {
        iconClass: 'text-destructive',
        compactClass: 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15',
        bannerClass: 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15',
    },
};
