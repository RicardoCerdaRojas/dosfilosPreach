import { useEffect, useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import {
    estimateExtractionDurationMs,
    formatEstimateShort,
    type LibraryResourceEntity,
} from '@dosfilos/domain';
import type { IndexStatus } from '../hooks/useLibraryResources';

interface ExtractionStepperProps {
    resource: LibraryResourceEntity;
    indexStatus: IndexStatus;
}

type PhaseId = 'uploading' | 'extracting' | 'indexing' | 'ready';
type PhaseState = 'pending' | 'active' | 'done' | 'failed';

interface PhaseDescriptor {
    id: PhaseId;
    state: PhaseState;
}

/**
 * Visual progression stepper for the library extraction pipeline.
 *
 * Renders 4 phases (Subiendo → Extrayendo → Indexando → Listo) with
 * the current phase highlighted, completed phases checked, and pending
 * phases muted. Replaces the static "Por procesar" / "Procesando…"
 * label with a visual journey so the user sees WHERE they are in the
 * pipeline, not just the current state.
 *
 * Drives off `resource.textExtractionStatus` + `indexStatus`:
 *
 *   pending/processing            → Extrayendo (active)
 *   ready ext + indexing          → Extrayendo (done) + Indexando (active)
 *   ready ext + indexed           → all done (Listo)
 *   ready ext + not-indexed/legacy → Extrayendo (done) + Indexando (failed/idle)
 *   failed (any)                  → first failed phase shown red
 *
 * Hidden once the resource hits 'ready' (the card already has a "Listo"
 * pill — no need to also render the stepper, which would just duplicate
 * the signal once the user is done caring).
 *
 * Pure component, ~80 lines. Tone tokens only (no raw colour literals).
 */
export function ExtractionStepper({ resource, indexStatus }: ExtractionStepperProps) {
    const { t } = useTranslation('library');
    // Rules of Hooks: every hook MUST be called unconditionally on every
    // render. Previously `useElapsedLabel` (which calls useState/useEffect
    // internally) sat AFTER the early `return null` for indexed resources,
    // so when a card transitioned indexing → indexed in place, the hook
    // count dropped and React threw error #310. Hook calls now happen
    // first; the early return is below, after all hooks have run.
    const elapsedLabel = useElapsedLabel(resource, indexStatus, t);

    // Don't render once the user no longer cares about progression —
    // the green "Listo" pill above already conveys completion.
    if (indexStatus === 'indexed') return null;
    // Catalog entries (`isSystemSource`) never enter the extraction
    // pipeline — they are metadata-only records of a canonical source.
    // Rendering a 4-step progress bar for them showed a spinner on work
    // that was never queued; the card's system badge already says what
    // they are.
    if (resource.isSystemSource) return null;

    const phases = computePhases(resource, indexStatus);

    return (
        <div className="space-y-0.5">
            <div
                // Envuelve en vez de desbordar. Los cuatro pasos con sus
                // etiquetas y conectores tienen un ancho mínimo mayor que el de
                // la tarjeta —el texto no encoge por debajo de su contenido—,
                // así que sin `flex-wrap` el riel se salía del borde derecho en
                // cuanto la tarjeta era angosta. `min-w-0` deja que el
                // contenedor ceda ancho, y `shrink-0` mantiene cada paso entero
                // consigo mismo: lo que se parte es la fila, nunca un paso.
                className="flex flex-wrap items-center gap-x-1 gap-y-1 min-w-0 text-[10px] text-muted-foreground"
                role="list"
                aria-label={t('stepper.ariaLabel')}
            >
                {phases.map((phase, idx) => (
                    <div key={phase.id} className="flex shrink-0 items-center gap-1" role="listitem">
                        <PhaseDot state={phase.state} />
                        <span
                            className={cn(
                                'tracking-wide',
                                phase.state === 'active' && 'text-foreground font-medium',
                                phase.state === 'done' && 'text-foreground/70',
                                phase.state === 'failed' && 'text-destructive font-medium',
                            )}
                        >
                            {t(`stepper.phase.${phase.id}`)}
                        </span>
                        {idx < phases.length - 1 && (
                            <span
                                aria-hidden
                                className={cn(
                                    'mx-0.5 h-px w-3',
                                    phase.state === 'done' ? 'bg-foreground/40' : 'bg-border',
                                )}
                            />
                        )}
                    </div>
                ))}
            </div>
            {elapsedLabel && (
                <p className="text-[10px] text-muted-foreground/80 tabular-nums">
                    {elapsedLabel}
                </p>
            )}
        </div>
    );
}

/**
 * Live "Procesando hace Xm Ys" label, anchored on the server-stamped
 * `processingStartedAt` field (so client clock skew can't make the
 * elapsed go negative). Refreshes every 5s while the resource is
 * actively processing or indexing; returns `null` for terminal states
 * (failed, indexed, no field set) so the caller can hide the line.
 */
function useElapsedLabel(
    resource: LibraryResourceEntity,
    indexStatus: IndexStatus,
    t: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
    // Re-render every 5s to advance the elapsed text. Cheaper than 1s,
    // imperceptible at this granularity.
    const [, setTick] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setTick(n => n + 1), 5000);
        return () => clearInterval(interval);
    }, []);

    const startedAt = resource.processingStartedAt;
    if (!startedAt) return null;

    // Don't render a stale "elapsed" once the work finished — the
    // stepper itself disappears at indexed; this just covers the
    // failed states + the brief gap before the doc reflects ready.
    const isActive =
        resource.textExtractionStatus === 'pending'
        || resource.textExtractionStatus === 'processing'
        || indexStatus === 'indexing'
        || indexStatus === 'checking';
    if (!isActive) return null;

    const elapsedMs = Date.now() - startedAt.getTime();
    if (elapsedMs < 0) return null; // server-time clock skew safety

    // ETA: heuristic estimate from file size + requested mode. Pure
    // function in the domain layer — see `extractionEstimate.ts` for
    // the calibration sources. We render it ALONGSIDE elapsed (not
    // "remaining") because remaining gets weird when our estimate is
    // off — better to show the user the actual elapsed AND the
    // expected total so they can judge.
    const requestedMode = resource.requestedExtractionMode;
    const estimateMs = estimateExtractionDurationMs({
        sizeBytes: resource.sizeBytes,
        mode: requestedMode,
    });
    const showEstimate = estimateMs > 0;

    const elapsedText = t('stepper.elapsed', { duration: formatDuration(elapsedMs) });
    if (!showEstimate) return elapsedText;
    return `${elapsedText} · ${t('stepper.estimated', { duration: formatEstimateShort(estimateMs) })}`;
}

function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds}s`;
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function PhaseDot({ state }: { state: PhaseState }) {
    if (state === 'active') {
        return <Loader2 className="h-3 w-3 animate-spin text-info" aria-hidden />;
    }
    if (state === 'done') {
        return (
            <span className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-success-subtle text-success-subtle-foreground">
                <Check className="h-2 w-2" aria-hidden />
            </span>
        );
    }
    if (state === 'failed') {
        return (
            <span className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-destructive/15 text-destructive text-[8px] font-bold" aria-hidden>
                !
            </span>
        );
    }
    // pending
    return <span className="inline-block h-3 w-3 rounded-full border border-border bg-background" aria-hidden />;
}

function computePhases(
    resource: LibraryResourceEntity,
    indexStatus: IndexStatus,
): PhaseDescriptor[] {
    // Phase 1: Upload always succeeds by the time the resource doc
    // exists (we only render this component for existing resources),
    // so it's always 'done'.
    const uploading: PhaseState = 'done';

    // Phase 2: Extracting maps to textExtractionStatus.
    let extracting: PhaseState;
    if (resource.textExtractionStatus === 'failed') extracting = 'failed';
    else if (resource.textExtractionStatus === 'pending'
        || resource.textExtractionStatus === 'processing') extracting = 'active';
    else extracting = 'done';

    // Phase 3: Indexing maps to indexStatus once extraction is done.
    let indexing: PhaseState;
    if (extracting !== 'done') {
        indexing = 'pending';
    } else if (indexStatus === 'indexing' || indexStatus === 'checking') {
        indexing = 'active';
    } else if (indexStatus === 'indexed') {
        indexing = 'done';
    } else if (indexStatus === 'not-indexed') {
        indexing = 'failed';
    } else {
        indexing = 'pending';
    }

    // Phase 4: Ready is reached when both prior phases are done.
    const ready: PhaseState = (extracting === 'done' && indexing === 'done')
        ? 'done'
        : 'pending';

    return [
        { id: 'uploading', state: uploading },
        { id: 'extracting', state: extracting },
        { id: 'indexing', state: indexing },
        { id: 'ready', state: ready },
    ];
}
