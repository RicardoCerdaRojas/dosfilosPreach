import { useEffect, useMemo, useRef } from 'react';
import { Sparkles, AlertTriangle, CheckCircle2, Loader2, RefreshCw, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';
import {
    formatPassageReference,
    isStepPlanStale,
    pertenceAlDocumento,
    pinnedSourcesInCorpus,
    type ExegeticalPaper,
    type ExegeticalStep,
    type ExegeticalStepKind,
    type SourceRole,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import {
    useProposeStepCorpusAllocations,
    useUpdateStepCorpusAllocation,
} from '@/hooks/exegesis/useStepCorpusAllocations';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { PinnedSourcesPicker } from './PinnedSourcesPicker';

interface CorpusUsagePlanSubStepProps {
    paper: ExegeticalPaper;
}

/**
 * v1.7 corpus-usage planning sub-step.
 *
 * Renders the per-step pinned-sources allocation: rows = generation
 * steps (introduction / verses / conclusion), cells = chips with the
 * pinned `ProjectSource` ids + the LLM rationale.
 *
 * Three states:
 *   - **Empty** (planner never ran): "Proponer plan" CTA + helper copy
 *     explaining what the planner does.
 *   - **Proposed/Accepted** (`stepPlan.proposedAt` set): table is
 *     visible + editable; "Regenerar plan" available; if the corpus
 *     changed since proposal (`isStepPlanStale`), a non-blocking
 *     amber banner appears.
 *   - **No corpus**: gentle empty state pointing the user back to the
 *     Corpus tab.
 *
 * Edits are individual chip add/remove on each row via
 * `PinnedSourcesPicker`. The full regenerate is the propose-mutation
 * (overwrites all per-step allocations but preserves manual edits to
 * `note`/`emphasis`/`suppressedSources` per the use case spec).
 */
export function CorpusUsagePlanSubStep({ paper }: CorpusUsagePlanSubStepProps) {
    const { t } = useTranslation('exegesis');
    const propose = useProposeStepCorpusAllocations();
    const updateAllocation = useUpdateStepCorpusAllocation();
    const { seedSteps } = useExegesisPapers();

    // Filter to LLM-driven steps (assembly is mechanical and doesn't
    // consume the corpus). Sort by `order` so the table follows the
    // wizard's own step order.
    // Sólo lo que va al documento: un paso que el encuadre deja fuera no se
    // planifica (TP #6: el plan repartió fuentes en los doce versículos).
    const plannableSteps = useMemo(
        () => paper.steps.filter(s => s.kind !== 'assembly' && pertenceAlDocumento(s)).sort((a, b) => a.order - b.order),
        [paper.steps],
    );
    const fueraDelDocumento = paper.steps.filter(s => s.kind !== 'assembly' && !pertenceAlDocumento(s)).length;

    const stale = isStepPlanStale(paper);
    const hasProposal = paper.stepPlan.proposedAt != null;
    const hasCorpus = paper.sources.length > 0;
    const hasSteps = plannableSteps.length > 0;

    // Auto-seed steps when entering this tab and the paper still has
    // none. The setup wizard runs BEFORE the user clicks "Comenzar
    // generación" on the paper detail (which is what historically
    // seeded steps), so without this the planner would always show
    // "Aún no hay pasos generables" — confusing because the user IS
    // configuring the corpus and expects to be able to plan.
    //
    // SeedStepsForPassage is idempotent: if steps already exist it
    // returns without changes. Calling it here is safe even if the
    // user later seeds again from the detail page. We don't toast on
    // success to keep the UX silent — the table just appears.
    const seedAttemptedRef = useRef(false);
    useEffect(() => {
        if (paper.steps.length > 0) return; // already seeded
        if (!hasCorpus) return; // wait for corpus first
        if (seedAttemptedRef.current) return; // one shot per mount
        if (seedSteps.isPending) return;
        seedAttemptedRef.current = true;
        seedSteps.mutate({ paperId: paper.id }, {
            onError: (err) => {
                console.error('[CorpusUsagePlan] auto-seed failed:', err);
                // Reset so the user can retry by leaving and coming back.
                seedAttemptedRef.current = false;
            },
        });
    }, [paper.id, paper.steps.length, hasCorpus, seedSteps]);

    const handlePropose = async () => {
        try {
            const result = await propose.mutateAsync({ paperId: paper.id });
            toast.success(
                t('paperSetup.subSteps.corpus-plan.toastPropose', {
                    count: result.nonEmptyAllocationCount,
                }),
            );
        } catch (err) {
            console.error('[CorpusUsagePlan] propose failed:', err);
            toast.error(t('paperSetup.subSteps.corpus-plan.toastProposeError'));
        }
    };

    const handleUpdateRow = async (stepId: string, pinnedSources: ReadonlyArray<string>) => {
        try {
            await updateAllocation.mutateAsync({
                paperId: paper.id,
                stepId,
                pinnedSources,
            });
        } catch (err) {
            console.error('[CorpusUsagePlan] update failed:', err);
            toast.error(t('paperSetup.subSteps.corpus-plan.toastUpdateError'));
        }
    };

    /**
     * Cambiar el rol de una fuente sin tocar la lista de fuentes.
     *
     * Se manda el mapa ENTERO —el que había con este cambio aplicado— porque
     * el caso de uso distingue «ausente, conserva lo que hay» de «aquí está el
     * mapa, reemplaza». Mandar sólo el par cambiado borraría los otros dos.
     */
    const handleUpdateRole = async (
        stepId: string, sourceId: string, role: SourceRole | null,
    ) => {
        const entry = paper.stepPlan.perStep[stepId];
        const siguiente: Record<string, SourceRole> = { ...(entry?.pinnedSourceRoles ?? {}) };
        const vigentes = pinnedSourcesInCorpus(entry?.pinnedSources, paper.sources);
        for (const id of Object.keys(siguiente)) if (!vigentes.includes(id)) delete siguiente[id];
        if (role) siguiente[sourceId] = role;
        else delete siguiente[sourceId];
        try {
            await updateAllocation.mutateAsync({
                paperId: paper.id,
                stepId,
                // Sin fantasmas: un id que salió del corpus hacía fallar la edición.
                pinnedSources: vigentes,
                pinnedSourceRoles: siguiente,
            });
        } catch (err) {
            console.error('[CorpusUsagePlan] update role failed:', err);
            toast.error(t('paperSetup.subSteps.corpus-plan.toastUpdateError'));
        }
    };

    return (
        <div className="space-y-4">
            <header className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-success mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-foreground">
                        {t('paperSetup.subSteps.corpus-plan.heading')}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {t('paperSetup.subSteps.corpus-plan.description')}
                    </p>
                </div>
            </header>

            {!hasCorpus && <EmptyCorpusState />}
            {hasCorpus && !hasSteps && (
                seedSteps.isPending
                    ? <SeedingState />
                    : <NoStepsState />
            )}

            {hasCorpus && hasSteps && (
                <>
                    {!hasProposal && (
                        <EmptyProposalState
                            isLoading={propose.isPending}
                            onPropose={handlePropose}
                        />
                    )}

                    {hasProposal && stale && (
                        <StaleBanner
                            isLoading={propose.isPending}
                            onRegenerate={handlePropose}
                        />
                    )}

                    {hasProposal && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs text-muted-foreground">
                                    {t('paperSetup.subSteps.corpus-plan.lastProposed', {
                                        when: formatLastProposed(paper.stepPlan.proposedAt!),
                                    })}
                                </p>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handlePropose}
                                    disabled={propose.isPending}
                                    className="text-xs gap-1.5"
                                >
                                    {propose.isPending
                                        ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                                        : <RefreshCw className="h-3 w-3" aria-hidden />}
                                    {t('paperSetup.subSteps.corpus-plan.regenerate')}
                                </Button>
                            </div>

                            <div className="relative">
                                {/* Wrap the coverage panel + table so the
                                    regenerate overlay covers both — visually
                                    locking the whole "current plan" section
                                    while the new one is being built. */}
                                <div
                                    className={[
                                        'space-y-2 transition-opacity duration-200',
                                        propose.isPending ? 'opacity-30 pointer-events-none' : '',
                                    ].join(' ')}
                                >
                                    <CoveragePanel paper={paper} plannableSteps={plannableSteps} />
                                    {fueraDelDocumento > 0 && (
                                        <p className="text-[11px] text-muted-foreground">
                                            {t('paperSetup.subSteps.corpus-plan.outsideDocument', { count: fueraDelDocumento })}
                                        </p>
                                    )}

                                    <div className="rounded-lg border border-border bg-card overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                                                <tr>
                                                    <th className="text-left px-3 py-2 w-[140px]">
                                                        {t('paperSetup.subSteps.corpus-plan.colStep')}
                                                    </th>
                                                    <th className="text-left px-3 py-2">
                                                        {t('paperSetup.subSteps.corpus-plan.colPinned')}
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {plannableSteps.map(step => (
                                                    <PlanRow
                                                        key={step.id}
                                                        step={step}
                                                        paper={paper}
                                                        onChangePinned={pinned => handleUpdateRow(step.id, pinned)}
                                                        onChangeRole={(sourceId, role) => handleUpdateRole(step.id, sourceId, role)}
                                                        disabled={updateAllocation.isPending}
                                                    />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {propose.isPending && <RegenerateOverlay />}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ── Sub-components ──────────────────────────────────────────────────────

/**
 * Overlay shown on top of the plan table while a regenerate is in
 * flight. Anchors a centered card with spinner + helper copy so the
 * user understands the whole section is being recomputed (vs a
 * single-row edit). The underlying content fades to ~30% opacity so
 * the user keeps spatial context but knows it's stale.
 */
function RegenerateOverlay() {
    const { t } = useTranslation('exegesis');
    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-2 rounded-xl border border-primary/30 bg-card/95 backdrop-blur-sm px-6 py-5 shadow-lg">
                <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
                <p className="text-sm font-semibold text-foreground">
                    {t('paperSetup.subSteps.corpus-plan.regenerating.title')}
                </p>
                <p className="text-[11px] text-muted-foreground">
                    {t('paperSetup.subSteps.corpus-plan.regenerating.body')}
                </p>
            </div>
        </div>
    );
}

/**
 * Aggregates pinned-source usage across every step in the plan and
 * surfaces two numbers: how many sources got at least one assignment,
 * and how many were left out. Unused sources show as removable chips
 * the user can click to act on (today: highlights they need manual
 * placement; future: opens a quick-pin popover).
 *
 * Two visual states:
 *   - All sources used → green "todo asignado" pill, no chips.
 *   - Some unused      → amber callout listing them so the user can
 *                        decide whether to manually pin or accept.
 */
function CoveragePanel({
    paper,
    plannableSteps,
}: {
    paper: ExegeticalPaper;
    plannableSteps: ReadonlyArray<ExegeticalStep>;
}) {
    const { t } = useTranslation('exegesis');

    const { totalSources, usedCount, unusedSources } = useMemo(() => {
        const usage = new Set<string>();
        for (const step of plannableSteps) {
            const entry = paper.stepPlan.perStep[step.id];
            if (!entry?.pinnedSources) continue;
            for (const id of entry.pinnedSources) usage.add(id);
        }
        const unused = paper.sources.filter(s => !usage.has(s.id));
        return {
            totalSources: paper.sources.length,
            usedCount: paper.sources.length - unused.length,
            unusedSources: unused,
        };
    }, [paper.stepPlan.perStep, paper.sources, plannableSteps]);

    if (totalSources === 0) return null;

    const allCovered = unusedSources.length === 0;

    return (
        <div
            className={[
                'rounded-lg border px-3 py-2.5 flex items-start gap-2.5',
                allCovered
                    ? 'border-success/30 bg-success-subtle/40'
                    : 'border-warning/30 bg-warning-subtle/40',
            ].join(' ')}
        >
            {allCovered
                ? <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" aria-hidden />
                : <AlertTriangle className="h-4 w-4 text-warning-subtle-foreground mt-0.5 shrink-0" aria-hidden />}
            <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-foreground">
                    {allCovered
                        ? t('paperSetup.subSteps.corpus-plan.coverage.allCovered', { count: totalSources })
                        : t('paperSetup.subSteps.corpus-plan.coverage.partial', {
                            used: usedCount,
                            total: totalSources,
                            unused: unusedSources.length,
                        })}
                </p>
                {!allCovered && (
                    <>
                        <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                            {t('paperSetup.subSteps.corpus-plan.coverage.partialBody')}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                            {unusedSources.map(s => (
                                <span
                                    key={s.id}
                                    className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-card px-2 py-0.5 text-[11px] text-foreground"
                                    title={s.displayLabel}
                                >
                                    {s.displayLabel.length > 40
                                        ? `${s.displayLabel.slice(0, 38)}…`
                                        : s.displayLabel}
                                </span>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function PlanRow({
    step,
    paper,
    onChangePinned,
    onChangeRole,
    disabled,
}: {
    step: ExegeticalStep;
    paper: ExegeticalPaper;
    onChangePinned: (next: ReadonlyArray<string>) => void;
    onChangeRole: (sourceId: string, role: SourceRole | null) => void;
    disabled: boolean;
}) {
    const { t } = useTranslation('exegesis');
    const entry = paper.stepPlan.perStep[step.id];
    const pinned = pinnedSourcesInCorpus(entry?.pinnedSources, paper.sources);
    const roles = entry?.pinnedSourceRoles;
    const note = entry?.note ?? null;
    const label = stepLabel(step, paper.displayLanguage, t);

    return (
        <tr className="border-t border-border/60 align-top">
            <td className="px-3 py-2.5 text-[12.5px] font-medium text-foreground">
                {label}
                <span className="block text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                    {t(`paperSetup.subSteps.corpus-plan.kind.${step.kind}`)}
                </span>
            </td>
            <td className="px-3 py-2.5 space-y-1.5">
                <PinnedSourcesPicker
                    sources={paper.sources}
                    selected={pinned}
                    roles={roles}
                    onChange={onChangePinned}
                    onChangeRole={onChangeRole}
                    disabled={disabled}
                />
                {note && (
                    <p className="text-[11px] text-muted-foreground italic leading-snug">
                        <Lightbulb className="inline h-2.5 w-2.5 mr-1 text-info" aria-hidden />
                        {note}
                    </p>
                )}
            </td>
        </tr>
    );
}

function EmptyCorpusState() {
    const { t } = useTranslation('exegesis');
    return (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
            {t('paperSetup.subSteps.corpus-plan.emptyCorpus')}
        </div>
    );
}

function NoStepsState() {
    const { t } = useTranslation('exegesis');
    return (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
            {t('paperSetup.subSteps.corpus-plan.noSteps')}
        </div>
    );
}

function SeedingState() {
    const { t } = useTranslation('exegesis');
    return (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {t('paperSetup.subSteps.corpus-plan.seedingSteps')}
        </div>
    );
}

function EmptyProposalState({
    isLoading,
    onPropose,
}: {
    isLoading: boolean;
    onPropose: () => void;
}) {
    const { t } = useTranslation('exegesis');
    return (
        <div className="rounded-lg border border-info/30 bg-info-subtle/40 p-4 space-y-3">
            <div className="flex items-start gap-3">
                <Lightbulb className="h-4 w-4 text-info mt-0.5 shrink-0" aria-hidden />
                <div className="flex-1 min-w-0 space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">
                        {t('paperSetup.subSteps.corpus-plan.emptyProposalTitle')}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-snug">
                        {t('paperSetup.subSteps.corpus-plan.emptyProposalBody')}
                    </p>
                </div>
            </div>
            <Button
                type="button"
                onClick={onPropose}
                disabled={isLoading}
                className="w-full sm:w-auto gap-2"
            >
                {isLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    : <Sparkles className="h-4 w-4" aria-hidden />}
                {isLoading
                    ? t('paperSetup.subSteps.corpus-plan.proposingCta')
                    : t('paperSetup.subSteps.corpus-plan.proposeCta')}
            </Button>
        </div>
    );
}

function StaleBanner({
    isLoading,
    onRegenerate,
}: {
    isLoading: boolean;
    onRegenerate: () => void;
}) {
    const { t } = useTranslation('exegesis');
    return (
        <div className="rounded-lg border border-warning/40 bg-warning-subtle p-3 space-y-2">
            <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" aria-hidden />
                <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-warning-subtle-foreground">
                        {t('paperSetup.subSteps.corpus-plan.staleTitle')}
                    </p>
                    <p className="text-[11px] text-warning-subtle-foreground leading-snug mt-0.5">
                        {t('paperSetup.subSteps.corpus-plan.staleBody')}
                    </p>
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onRegenerate}
                    disabled={isLoading}
                    className="text-[11px] gap-1 shrink-0"
                >
                    {isLoading
                        ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        : <RefreshCw className="h-3 w-3" aria-hidden />}
                    {t('paperSetup.subSteps.corpus-plan.staleRegenerate')}
                </Button>
            </div>
        </div>
    );
}

// ── Helpers ─────────────────────────────────────────────────────────────

function stepLabel(
    step: ExegeticalStep,
    language: 'es' | 'en',
    t: (key: string) => string,
): string {
    if (step.kind === 'verse' && step.verseRef) {
        return formatPassageReference(step.verseRef, language);
    }
    if (step.kind === 'introduction') return t('paperSetup.subSteps.corpus-plan.kind.introduction');
    if (step.kind === 'conclusion') return t('paperSetup.subSteps.corpus-plan.kind.conclusion');
    return step.kind as ExegeticalStepKind;
}

function formatLastProposed(when: Date): string {
    return when.toLocaleString();
}
