import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { FRAMING_TEXT_MAX } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import type { FramingForm, FramingFormError } from './ProjectFramingForm';

/**
 * Las piezas que comparten las secciones del diálogo del encuadre: estilos,
 * el aviso (patrón de advertencia con contraste AA; `text-destructive`
 * sobre el fondo no lo alcanza) y el campo con sus versículos.
 */
export const campo = 'w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';
export const etiqueta = 'block text-sm font-medium text-foreground';
export const ayuda = 'block text-xs text-muted-foreground';
/** Título de sección: texto chico en `text-primary` no alcanza AA. */
export const legend = 'text-sm font-semibold text-foreground';

export type SetField = <K extends keyof FramingForm>(k: K, v: FramingForm[K]) => void;

export interface SectionProps {
    form: FramingForm;
    set: SetField;
    errores: ReadonlyArray<FramingFormError>;
}

/** La clave del texto de cada error (el de los domingos lleva el tope). */
export const ERROR_KEY: Record<FramingFormError, string> = {
    noBooks: 'framing.dialog.noBooks',
    scope: 'framing.dialog.scopeError',
    scopeVerses: 'framing.dialog.versesNeeded',
    movementRange: 'framing.dialog.movementError',
    movementVerses: 'framing.dialog.versesNeeded',
    sundays: 'framing.dialog.sundaysError',
};

/** Un aviso: borde y fondo de advertencia, icono y texto con contraste AA. */
export function Aviso({ children, className, role, id }: { children: ReactNode; className?: string; role?: 'alert' | 'status'; id?: string }) {
    return (
        <p id={id} role={role} className={cn('flex items-start gap-2 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning-subtle-foreground', className)}>
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="min-w-0">{children}</span>
        </p>
    );
}

type EvidenceKey = 'genreReading' | 'occasion' | 'centralIdea' | 'christTrajectory';
type EvidenceOf = 'genreEvidence' | 'occasionEvidence' | 'centralIdeaEvidence' | 'christTrajectoryEvidence';

/**
 * Un campo de la lectura con sus «versículos que lo sostienen» (Kaiser). El
 * campo de versículos lleva un nombre propio interpolado: con tres iguales,
 * un lector de pantalla no sabría a cuál llegó.
 */
export function EvidenceField({ id, k, ke, label, hint, form, set }: {
    id: string;
    k: EvidenceKey;
    ke: EvidenceOf;
    label: string;
    hint?: string;
    form: FramingForm;
    set: SetField;
}) {
    const { t } = useTranslation('projects');
    return (
        <div className="space-y-1.5">
            <label htmlFor={`framing-${id}`} className={etiqueta}>{label}</label>
            {hint && <span className={ayuda}>{hint}</span>}
            <textarea id={`framing-${id}`} rows={2} maxLength={FRAMING_TEXT_MAX} className={campo} value={form[k]} onChange={e => set(k, e.target.value)} />
            <div className="space-y-1">
                <span className="block text-xs text-muted-foreground" aria-hidden>{t('framing.dialog.evidence')}</span>
                <input
                    className={campo}
                    maxLength={FRAMING_TEXT_MAX}
                    aria-label={t('framing.dialog.evidenceLabel', { field: label })}
                    placeholder={t('framing.dialog.evidencePlaceholder')}
                    value={form[ke]}
                    onChange={e => set(ke, e.target.value)}
                />
            </div>
        </div>
    );
}
