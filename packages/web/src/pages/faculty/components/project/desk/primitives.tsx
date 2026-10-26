import { useCallback, type ComponentType, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import type { DeskPhaseStatus, DeskText } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Las piezas compartidas del escritorio del proyecto
 * (`docs/FASE_ESCRITORIO_PROYECTO_2026-10.md` §2 y §3): las usan el
 * recorrido, las secciones del Exegético y del Curso, y las herramientas.
 *
 * Reglas de la marca que valen para todas:
 *   - solo tokens; el texto de la marca va en `text-primary-text` (AA en
 *     todos los temas), nunca en `text-primary`;
 *   - el verde se reserva para «lista»; la fase activa lleva la marca, no
 *     `info`;
 *   - 44 px táctiles en el teléfono (`TOUCH`) y foco visible.
 */

/** En el teléfono, cada control mide al menos 44 px de alto. */
export const TOUCH = 'min-h-11 sm:min-h-0';

/**
 * El anillo de foco de la casa, para controles que no son `Button`: el token
 * `--focus` (el tono del texto de la marca), ≥ 3:1 sobre la tarjeta y el
 * fondo en todos los temas (`barraUnica.test.tsx`). `ring-primary/40` no
 * llegaba en varios temas.
 */
export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Un botón con un nombre largo («Agregar un estudio fuera de la serie»,
 * «Crear TP #10»): en el teléfono pasa a otra línea en vez de desbordar.
 * `Button` trae `whitespace-nowrap` y alto fijo.
 */
export const WRAP_LABEL = 'h-auto whitespace-normal py-1.5 text-left sm:h-8 sm:whitespace-nowrap sm:py-0';

/**
 * Una fase que todavía no toca: posterior a la activa y sin nada que mostrar.
 * Su sección se reduce a una línea, sin acción: el vacío completo (con su
 * invitación) es solo para la fase activa, para no llenar la página de
 * vacíos que compiten con «Ahora».
 */
export function isLaterEmptyPhase(
    phases: ReadonlyArray<{ id: string; status: DeskPhaseStatus }>,
    activePhaseId: string | null | undefined,
    phaseId: string,
): boolean {
    const i = phases.findIndex(p => p.id === phaseId);
    const activa = activePhaseId ? phases.findIndex(p => p.id === activePhaseId) : -1;
    return i >= 0 && activa >= 0 && i > activa && phases[i]!.status === 'todo';
}

/** El ancla de la sección de una fase: el recorrido salta a ella. */
export function deskSectionId(phaseId: string): string {
    return `fase-${phaseId}`;
}

/**
 * Lleva a la sección de una fase y le pasa el foco a su título, para que el
 * lector de pantalla y el teclado lleguen al mismo lugar que la vista. Si la
 * sección no está (todavía cargando, o el tipo no la tiene), no hace nada.
 */
export function scrollToDeskSection(phaseId: string): boolean {
    const seccion = typeof document !== 'undefined' ? document.getElementById(deskSectionId(phaseId)) : null;
    if (!seccion) return false;
    const reducido = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    seccion.scrollIntoView?.({ behavior: reducido ? 'auto' : 'smooth', block: 'start' });
    const titulo = seccion.querySelector<HTMLElement>('[data-desk-heading]') ?? seccion;
    titulo.focus?.({ preventScroll: true });
    return true;
}

/**
 * Un día `YYYY-MM-DD` como lo lee el pastor («vie, 30 oct»), sin pasar por
 * UTC: `new Date('2026-10-30')` sería el día anterior en América.
 */
export function formatDeskDay(day: string, lang: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
    if (!m) return day;
    const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return fecha.toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Traduce un texto del modelo del escritorio (`DeskText`: clave `desk.*` y
 * sus valores). Las fechas (`dueDate`) llegan como `YYYY-MM-DD` y se dicen
 * como día de la semana y fecha.
 */
export function useDeskText(): (text: DeskText) => string {
    const { t, i18n } = useTranslation('projects');
    const lang = i18n.language?.startsWith('en') ? 'en' : 'es';
    return useCallback((text: DeskText) => {
        const params: Record<string, string | number> = { ...(text.params ?? {}) };
        if (typeof params.dueDate === 'string' && params.dueDate) params.dueDate = formatDeskDay(params.dueDate, lang);
        return t(text.key, params);
    }, [t, lang]);
}

// ── StatusChip ─────────────────────────────────────────────────────────

const CHIP: Record<DeskPhaseStatus, string> = {
    ready: 'border-success/30 bg-success-subtle text-success-subtle-foreground',
    doing: 'border-primary/40 bg-card text-primary-text',
    todo: 'border-border bg-card text-muted-foreground',
};

/**
 * El estado de una fase en palabras: por empezar · en curso · lista. Nunca un
 * puntaje. Con `loading` (la fase 1 del Curso mientras llega el catálogo de
 * rúbricas, `DeskPhase.loading`) dice «cargando»: no está «en curso».
 */
export function StatusChip({ status, loading = false, className }: { status: DeskPhaseStatus; loading?: boolean; className?: string }) {
    const { t } = useTranslation('projects');
    return (
        <span
            data-status={loading ? 'loading' : status}
            className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4', loading ? CHIP.todo : CHIP[status], className)}
        >
            {!loading && status === 'ready' && <Check className="h-3 w-3" aria-hidden />}
            {t(loading ? 'desk.journey.status.loading' : `desk.journey.status.${status}`)}
        </span>
    );
}

// ── PhaseStep ──────────────────────────────────────────────────────────

interface PhaseStepProps {
    number: number;
    name: string;
    status: DeskPhaseStatus;
    /** La primera fase que no está lista: lleva la marca. */
    active?: boolean;
    /** Su estado todavía no se puede decidir (`DeskPhase.loading`). */
    loading?: boolean;
    /** Las fases NAVEGAN a su sección: nada se crea desde el recorrido. */
    onClick: () => void;
}

/** Una fase del recorrido: número, nombre y estado, en 44 px. */
export function PhaseStep({ number, name, status, active = false, loading = false, onClick }: PhaseStepProps) {
    const { t } = useTranslation('projects');
    const estado = t(loading ? 'desk.journey.status.loading' : `desk.journey.status.${status}`);
    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={active ? 'step' : undefined}
            aria-label={t('desk.journey.goToPhase', { number, name, status: estado })}
            data-phase-status={loading ? 'loading' : status}
            className={cn(
                'flex h-full min-h-11 w-full items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-primary/50',
                FOCUS_RING,
                active ? 'border-primary shadow-sm' : 'border-border',
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-medium tabular-nums',
                    status === 'ready'
                        // El ✓ blanco sobre `success` no llega a AA: el par sutil sí.
                        ? 'border border-success/30 bg-success-subtle text-success-subtle-foreground'
                        : active
                            ? 'bg-primary-solid text-primary-foreground'
                            : status === 'doing'
                                ? 'border border-primary/40 bg-card text-primary-text'
                                : 'bg-muted text-foreground',
                )}
            >
                {status === 'ready' ? <Check className="h-3.5 w-3.5" /> : number}
            </span>
            <span className="min-w-0 flex-1" aria-hidden>
                <span className={cn('block text-[13px] leading-snug text-foreground', active && 'font-medium')}>{name}</span>
                <span className="block text-[11.5px] leading-snug text-muted-foreground">{estado}</span>
            </span>
        </button>
    );
}

// ── DeskSection ────────────────────────────────────────────────────────

interface DeskSectionProps {
    /** El ancla: `deskSectionId(phaseId)` en las secciones de una fase. */
    id: string;
    /** El número de la fase: pone el rótulo «Fase n». */
    phase?: number;
    /** Un rótulo propio en lugar de «Fase n» (Herramientas, Material). */
    eyebrow?: ReactNode;
    title: ReactNode;
    status?: DeskPhaseStatus;
    /** El estado todavía no se puede decidir (`DeskPhase.loading`): «cargando». */
    loading?: boolean;
    /** La evidencia del estado, en texto («9 aprobadas · 3 por conseguir»). */
    evidence?: ReactNode;
    /** Una línea que explica la sección, debajo del título. */
    description?: ReactNode;
    /** Botones de contorno o enlaces: el único botón lleno es «Ahora». */
    actions?: ReactNode;
    /** Lo que se ve si la sección no tiene contenido (por defecto, cuando no hay `children`). */
    empty?: ReactNode;
    isEmpty?: boolean;
    children?: ReactNode;
    className?: string;
    'data-testid'?: string;
}

/**
 * Una sección del escritorio: rótulo «Fase n», título en la tipografía de
 * lectura, estado con su evidencia, acciones, cuerpo y vacío. El título
 * recibe el foco cuando el recorrido salta aquí.
 */
export function DeskSection({
    id, phase, eyebrow, title, status, loading, evidence, description, actions, empty, isEmpty, children, className, ...rest
}: DeskSectionProps) {
    const { t } = useTranslation('projects');
    const tituloId = `${id}-title`;
    const vacia = isEmpty ?? (children === null || children === undefined || children === false);
    const rotulo = eyebrow ?? (phase !== undefined ? t('desk.journey.phaseLabel', { number: phase }) : null);
    return (
        <section
            id={id}
            aria-labelledby={tituloId}
            data-testid={rest['data-testid']}
            className={cn('scroll-mt-4 space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5', className)}
        >
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1 space-y-1">
                    {rotulo && (
                        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary-text">{rotulo}</p>
                    )}
                    <h2
                        id={tituloId}
                        tabIndex={-1}
                        data-desk-heading
                        className={cn('rounded-sm font-reading text-[19px] leading-tight text-foreground', FOCUS_RING)}
                    >
                        {title}
                    </h2>
                    {(status || evidence) && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
                            {status && <StatusChip status={status} loading={loading} />}
                            {evidence && <p className="text-[13px] leading-snug text-muted-foreground">{evidence}</p>}
                        </div>
                    )}
                    {description && <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
            </header>
            {vacia ? (empty ?? null) : children}
        </section>
    );
}

// ── LaterPhase ─────────────────────────────────────────────────────────

interface LaterPhaseProps {
    /** El ancla de la sección: el recorrido sigue saltando aquí. */
    id: string;
    /** «Fase 3» o «Fases 3 y 4». */
    eyebrow: ReactNode;
    title: ReactNode;
    /** Cuándo se abre («se abre cuando…»): enseña el orden, no bloquea. */
    reason: string;
    'data-testid'?: string;
}

/**
 * Una fase posterior a la activa, todavía por empezar: una sola línea
 * («Fase 3 · División en perícopas · por empezar — se abre cuando…»), sin
 * acción. Conserva el ancla y el título enfocable para el recorrido.
 */
export function LaterPhase({ id, eyebrow, title, reason, ...rest }: LaterPhaseProps) {
    const { t } = useTranslation('projects');
    const tituloId = `${id}-title`;
    return (
        <section
            id={id}
            aria-labelledby={tituloId}
            data-testid={rest['data-testid']}
            data-later-phase
            className="scroll-mt-4 rounded-xl border border-dashed border-border bg-card px-4 py-3"
        >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px] leading-snug">
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary-text">{eyebrow}</span>
                <h2 id={tituloId} tabIndex={-1} data-desk-heading className={cn('rounded-sm font-medium text-foreground', FOCUS_RING)}>
                    {title}
                </h2>
                <p className="min-w-0 text-muted-foreground">
                    {t('desk.journey.laterLine', { status: t('desk.journey.status.todo').toLowerCase(), reason })}
                </p>
            </div>
        </section>
    );
}

// ── EmptyState ─────────────────────────────────────────────────────────

interface EmptyStateProps {
    icon?: ComponentType<{ className?: string }>;
    title?: ReactNode;
    children?: ReactNode;
    /** Una acción de contorno: invita, no se impone. */
    action?: ReactNode;
    className?: string;
}

/** El vacío de una sección: qué falta y para qué, con una acción opcional. */
export function EmptyState({ icon: Icon, title, children, action, className }: EmptyStateProps) {
    return (
        <div className={cn('flex flex-col gap-3 rounded-lg border border-dashed border-border p-4 sm:flex-row sm:items-center', className)}>
            {Icon && <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />}
            <div className="min-w-0 flex-1 space-y-1">
                {title && <p className="text-sm font-medium text-foreground">{title}</p>}
                {children && <div className="text-[13px] leading-relaxed text-muted-foreground">{children}</div>}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}
