import { CheckCircle2 } from 'lucide-react';
import type { CitationStatus } from '@dosfilos/domain';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { STATUS_TONE } from '@/components/exegesis/citation/citationStatusTone';

export { STATUS_TONE };

export function CitationStatusBadge({ status, reviewed = false, count }: { status: CitationStatus; reviewed?: boolean; count?: number }) {
    const { t } = useTranslation('exegesis');
    const Icon = reviewed ? CheckCircle2 : STATUS_TONE[status].Icon;
    const tone = reviewed ? STATUS_TONE.verified : STATUS_TONE[status];
    return (
        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', tone.badge)}>
            <Icon className="h-3 w-3" aria-hidden />
            {reviewed ? t('canonical.review.status.reviewed') : t(`canonical.verify.status.${status}`)}
            {typeof count === 'number' && <span className="tabular-nums">· {count}</span>}
        </span>
    );
}

/** Punto de color junto a la cita, dentro de la vista del análisis. */
export function CitationStatusDot({ status, reviewed = false }: { status: CitationStatus; reviewed?: boolean }) {
    const { t } = useTranslation('exegesis');
    const tone = reviewed ? STATUS_TONE.verified : STATUS_TONE[status];
    const label = reviewed ? t('canonical.review.status.reviewed') : t(`canonical.verify.status.${status}`);
    return <span className={cn('inline-block h-2 w-2 rounded-full', tone.dot)} title={label} aria-label={label} />;
}
