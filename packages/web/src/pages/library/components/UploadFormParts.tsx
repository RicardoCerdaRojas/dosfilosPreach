import { useTranslation } from '@/i18n';
import { AlertTriangle, BookOpen, Sparkles, Wand2 } from 'lucide-react';
import { getBookById, type ModeRecommendation } from '@dosfilos/domain';
import { cn } from '@/lib/utils';
import type { SmartMatchInferenceResult, TierAvailabilityProp } from './LibraryUploadForm';

/**
 * Piezas de presentación del formulario de subida.
 *
 * Viven aparte porque el formulario pasó de 402 a 479 líneas al reordenarse en
 * pasos, y lo que creció fue el marcado, no la lógica. Separarlas deja el
 * componente principal contando lo que decide —qué motor conviene, qué paso se
 * habilita— en vez de cómo se dibuja cada azulejo.
 */

/** Un paso del formulario, numerado. La numeración no decora: dice el orden en
 *  que las decisiones dependen unas de otras. */
export function Paso({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
    return (
        <section className="space-y-2.5">
            <h3 className="flex items-center gap-2 text-[12.5px] font-medium text-foreground">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] tabular-nums text-muted-foreground">
                    {numero}
                </span>
                {titulo}
            </h3>
            <div className="space-y-2 pl-7">{children}</div>
        </section>
    );
}

/**
 * Qué motor conviene para ESTE archivo, y por qué.
 *
 * Cuando ninguna ruta sirve —un escaneo que no entra en visión— lo dice en
 * rojo: seguir igual produce un recurso lleno de basura que entra al corpus sin
 * error y se cita.
 */
export function ModeAdvice({ recommendation, t }: { recommendation: ModeRecommendation; t: (k: string) => string }) {
    // Sin diagnóstico NO se calla. Ese silencio dejaba Premium marcado —que la
    // interfaz pinta en verde y se lee como «esta es la buena»— sin una sola
    // palabra, y sobre un escaneo Premium destruye el texto. Decir «no pude
    // leerlo, fijate vos si es un escaneo» es peor consejo que uno bueno y
    // mucho mejor que ninguno.
    const bloqueante = recommendation.recommended === null && recommendation.reasonKey !== 'unknown';
    return (
        <p className={cn(
            'flex items-start gap-2 rounded-md border px-3 py-2 text-[11px]',
            bloqueante
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-info/30 bg-info-subtle/40 text-info-subtle-foreground',
        )}>
            {bloqueante
                ? <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                : <Wand2 className="mt-px h-3.5 w-3.5 shrink-0" />}
            <span>{t(`upload.modeAdvice.${recommendation.reasonKey}`)}</span>
        </p>
    );
}

interface ModeTileProps {
    active: boolean;
    /** When true, click is suppressed and the tile renders dimmed. */
    disabled?: boolean;
    /** Tooltip shown when disabled. Explains why the tier isn't available. */
    disabledHint?: string;
    /** El diagnóstico del archivo señala esta ruta. */
    recommended?: boolean;
    recommendedLabel?: string;
    onClick: () => void;
    icon: React.ReactNode;
    title: string;
    description: string;
    tone: 'info' | 'success';
}

/**
 * Radio-style tile for the standard/premium extraction-mode toggle.
 * Click selects; `aria-pressed` exposes state to assistive tech.
 * Tone (`info` / `success`) drives the active border color so each
 * mode is visually distinct at a glance.
 *
 * `disabled` mutes the tile when the file exceeds the tier's hard
 * cap (LlamaParse 100MB / Gemini 50MB). The disabled tile keeps its
 * label so the user understands what they CAN'T pick — hiding it
 * would just look broken.
 */
export function ModeTile({ active, disabled = false, disabledHint, recommended = false, recommendedLabel, onClick, icon, title, description, tone }: ModeTileProps) {
    const activeBorder = tone === 'info'
        ? 'border-info bg-info-subtle'
        : 'border-success bg-success-subtle';
    const activeIcon = tone === 'info' ? 'text-info' : 'text-success';
    return (
        <button
            type="button"
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            aria-pressed={active}
            title={disabled ? disabledHint : undefined}
            className={cn(
                'text-left rounded-lg border px-3 py-2.5 transition-colors',
                disabled
                    ? 'border-border bg-muted/30 opacity-50 cursor-not-allowed'
                    : active
                        ? activeBorder
                        : 'border-border bg-card hover:border-foreground/30',
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div className={cn(
                    'inline-flex items-center gap-1.5 text-[12px] font-semibold',
                    disabled ? 'text-muted-foreground' : active ? activeIcon : 'text-foreground',
                )}>
                    {icon}
                    {title}
                </div>
                {recommended && !disabled && (
                    <span className="shrink-0 rounded-full border border-info/40 bg-info-subtle px-1.5 py-px text-[9.5px] font-medium uppercase tracking-wide text-info-subtle-foreground">
                        {recommendedLabel}
                    </span>
                )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                {description}
            </p>
        </button>
    );
}

/**
 * Surfaces WHY a tier got disabled (or both did). Renders below the
 * mode tiles so the user understands "Premium is greyed out because
 * the file is 114MB (cap is 100MB)" instead of guessing.
 *
 * Three visual variants:
 *   - both unavailable → callout amber, "se procesará con Básico"
 *   - only premium unavailable → callout amber, suggest Standard
 *   - only standard unavailable → callout neutral, "Premium sí cubre"
 */
export function TierCallout({ availability }: { availability: TierAvailabilityProp }) {
    const { t } = useTranslation('library');
    const sizeLabel = availability.fileSizeMB.toFixed(1);

    if (availability.bothUnavailable) {
        return (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-subtle px-3 py-2 text-[11.5px] text-warning-subtle-foreground">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
                <span className="leading-snug">
                    {t('upload.tierCalloutBoth', {
                        sizeMB: sizeLabel,
                        premiumCapMB: availability.premiumCapMB,
                        standardCapMB: availability.standardCapMB,
                    })}
                </span>
            </div>
        );
    }
    if (!availability.premium) {
        return (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-subtle px-3 py-2 text-[11.5px] text-warning-subtle-foreground">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
                <span className="leading-snug">
                    {t('upload.tierCalloutPremiumOnly', {
                        sizeMB: sizeLabel,
                        premiumCapMB: availability.premiumCapMB,
                    })}
                </span>
            </div>
        );
    }
    // Only standard unavailable — premium still works, less urgent.
    return (
        <div className="flex items-start gap-2 rounded-md border border-info/30 bg-info-subtle px-3 py-2 text-[11.5px] text-info-subtle-foreground">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
            <span className="leading-snug">
                {t('upload.tierCalloutStandardOnly', {
                    sizeMB: sizeLabel,
                    standardCapMB: availability.standardCapMB,
                })}
            </span>
        </div>
    );
}

interface SmartMatchPreviewProps {
    inference: SmartMatchInferenceResult;
    language: string;
    t: (key: string, opts?: Record<string, unknown>) => string;
}

/**
 * Inline preview of the v1.7 smart-match autocomplete. Renders only when
 * the title produced a confident inference — silent when the inferer
 * returned `null` scope (the user just hasn't typed enough title yet,
 * or it's a non-Bible work, in which case we don't promise anything).
 *
 * Read-only on purpose: the upload form stays lean. Adjustments live
 * on the metadata editor in the resource detail (A.3).
 */
export function SmartMatchPreview({ inference, language, t }: SmartMatchPreviewProps) {
    if (inference.inferredScope === null) return null;

    const isSpanish = language?.toLowerCase().startsWith('es');
    const bookLabels = inference.books
        .map(id => {
            const book = getBookById(id);
            if (!book) return id;
            return isSpanish ? book.nameEs : book.nameEn;
        })
        .join(', ');

    return (
        <div className="flex items-start gap-1.5 text-[10.5px] text-muted-foreground">
            <Sparkles className="h-3 w-3 mt-0.5 text-info shrink-0" aria-hidden />
            <span className="leading-snug">
                <span className="text-foreground/80 font-medium">
                    {t('upload.smartMatchLabel')}:
                </span>{' '}
                {inference.books.length > 0 ? (
                    <>
                        <span className="inline-flex items-center gap-1">
                            <BookOpen className="h-2.5 w-2.5" aria-hidden />
                            {bookLabels}
                        </span>
                        {' · '}
                    </>
                ) : null}
                <span>{t(`upload.smartMatchScope.${inference.inferredScope}`)}</span>
            </span>
        </div>
    );
}
