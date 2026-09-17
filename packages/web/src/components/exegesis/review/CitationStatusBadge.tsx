import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from 'lucide-react';
import type { CitationStatus } from '@dosfilos/domain';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';

/**
 * Una sola regla de color para los veredictos, compartida por la marca
 * junto a la cita, el panel de evidencia y los filtros.
 */
export const STATUS_TONE: Record<CitationStatus, { badge: string; dot: string }> = {
    verified: { badge: 'bg-success-subtle text-success-subtle-foreground border-success/30', dot: 'bg-success' },
    'page-mismatch': { badge: 'bg-warning-subtle text-warning-subtle-foreground border-warning/30', dot: 'bg-warning' },
    'fuzzy-low': { badge: 'bg-warning-subtle text-warning-subtle-foreground border-warning/30', dot: 'bg-warning' },
    'not-found': { badge: 'bg-destructive/10 text-destructive border-destructive/30', dot: 'bg-destructive' },
    'manual-pending': { badge: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' },
};

const ICON: Record<CitationStatus, typeof CheckCircle2> = {
    verified: CheckCircle2,
    'page-mismatch': AlertTriangle,
    'fuzzy-low': AlertTriangle,
    'not-found': XCircle,
    'manual-pending': CircleHelp,
};

export function CitationStatusBadge({ status, reviewed = false, count }: { status: CitationStatus; reviewed?: boolean; count?: number }) {
    const { t } = useTranslation('exegesis');
    const Icon = reviewed ? CheckCircle2 : ICON[status];
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
