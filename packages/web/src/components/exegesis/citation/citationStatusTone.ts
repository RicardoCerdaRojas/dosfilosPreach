import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from 'lucide-react';
import type { CitationStatus } from '@dosfilos/domain';

/**
 * Una sola regla de color e ícono para los veredictos de cita.
 *
 * Vivía dos veces: el diálogo de verificación tenía su propia tabla con
 * literales de color (`emerald-200`, `rose-50`) y la página de revisión
 * otra con fichas semánticas. El mismo veredicto se veía de dos colores
 * distintos según por dónde se entrara, y la copia del diálogo se saltaba
 * el tema oscuro del producto.
 */
export const STATUS_TONE: Record<CitationStatus, {
    Icon: typeof CheckCircle2;
    /** Color del ícono suelto. */
    icon: string;
    /** Píldora con el nombre del estado. */
    badge: string;
    /** Punto de color junto a la cita. */
    dot: string;
    /** Tarjeta que envuelve una cita en el listado. */
    container: string;
}> = {
    verified: {
        Icon: CheckCircle2,
        icon: 'text-success',
        badge: 'bg-success-subtle text-success-subtle-foreground border-success/30',
        dot: 'bg-success',
        container: 'border-success/30 bg-success-subtle/40',
    },
    'page-mismatch': {
        Icon: AlertTriangle,
        icon: 'text-warning',
        badge: 'bg-warning-subtle text-warning-subtle-foreground border-warning/30',
        dot: 'bg-warning',
        container: 'border-warning/30 bg-warning-subtle/40',
    },
    'page-unverifiable': {
        Icon: AlertTriangle,
        icon: 'text-warning',
        badge: 'bg-warning-subtle text-warning-subtle-foreground border-warning/30',
        dot: 'bg-warning',
        container: 'border-warning/30 bg-warning-subtle/40',
    },
    'fuzzy-low': {
        Icon: AlertTriangle,
        icon: 'text-warning',
        badge: 'bg-warning-subtle text-warning-subtle-foreground border-warning/30',
        dot: 'bg-warning',
        container: 'border-warning/30 bg-warning-subtle/30',
    },
    'not-found': {
        Icon: XCircle,
        icon: 'text-destructive',
        badge: 'bg-destructive/10 text-destructive border-destructive/30',
        dot: 'bg-destructive',
        container: 'border-destructive/30 bg-destructive/5',
    },
    'manual-pending': {
        Icon: CircleHelp,
        icon: 'text-muted-foreground',
        badge: 'bg-muted text-muted-foreground border-border',
        dot: 'bg-muted-foreground',
        container: 'border-border bg-muted/40',
    },
};
