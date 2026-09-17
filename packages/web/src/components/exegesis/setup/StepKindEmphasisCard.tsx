import {
    useMemo,
    useState } from 'react';
import { CheckCircle2,
    RotateCcw,
    Sparkles,
    X,
    Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
    getEffectiveSectionStructuralExpectation,
    SOURCE_TYPE_GROUPS,
    suggestRoleForType,
    type ExegeticalPaper,
    type SourceRole,
    type SourceType,
    type StepEmphasis,
    usesRoleCoverage,
} from '@dosfilos/domain';
import { UpdateStepPlanUseCase } from '@dosfilos/application';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { useBorradorDeEnfasis } from './useBorradorDeEnfasis';

/**
 * Editor for one step kind's emphasis (introduction / verse / conclusion).
 *
 * The card is the unit of pedagogy: it shows the rubric's suggested
 * emphasis with academic justification, then lets the student
 * adjust. "Reset to rubric suggestion" puts the chips back to what
 * the rubric proposed; "Save plan" persists the override on
 * `paper.stepPlan.defaults[kind]`.
 *
 * Design choices:
 *   - Chips for emphasized types — multi-select via add/remove.
 *     Each chip carries its localized label so non-experts can read
 *     it without docs.
 *   - De-emphasized types are hidden behind a toggle ("Show types
 *     to de-emphasize") because most students never need them; they
 *     dilute the primary signal.
 *   - Note is local-only state that's NOT persisted in v1 (the
 *     domain `StepEmphasis` doesn't carry a note today; per-step
 *     notes live in `StepSourcePlanEntry.note` which v1.5 wires).
 *     Keeping the textarea in the UI lets the student think out
 *     loud and primes the v1.5 surface.
 *
 * Edits are staged in local state; nothing persists until "Save plan"
 * fires. This keeps the orchestrator's view of the plan stable while
 * the student is mid-edit.
 */
interface StepKindEmphasisCardProps {
    paper: ExegeticalPaper;
    kind: 'introduction' | 'verse' | 'conclusion';
    icon: React.ReactNode;
}

export function StepKindEmphasisCard({ paper, kind, icon }: StepKindEmphasisCardProps) {
    const { t } = useTranslation('exegesis');
    const { updateStepPlan } = useExegesisPapers();

    const rubricSuggestion = useMemo(
        () => UpdateStepPlanUseCase.rubricDefaultEmphasis(paper, kind),
        [paper, kind],
    );
    const persistedEmphasis: StepEmphasis = paper.stepPlan.defaults[kind];

    // Whether the persisted plan diverges from the rubric suggestion.
    // Lets the UI badge "tu plan personalizado" vs "default".
    const isCustomized = useMemo(() => {
        const sameLength =
            persistedEmphasis.emphasizedTypes.length === rubricSuggestion.emphasizedTypes.length &&
            persistedEmphasis.deemphasizedTypes.length === rubricSuggestion.deemphasizedTypes.length;
        if (!sameLength) return true;
        const setEq = (a: ReadonlyArray<SourceType>, b: ReadonlyArray<SourceType>) => {
            const setA = new Set(a);
            return b.every(x => setA.has(x));
        };
        return !(setEq(persistedEmphasis.emphasizedTypes, rubricSuggestion.emphasizedTypes)
            && setEq(persistedEmphasis.deemphasizedTypes, rubricSuggestion.deemphasizedTypes));
    }, [persistedEmphasis, rubricSuggestion]);

    // Borrador local: arranca de lo guardado (o de la sugerencia) y solo se
    // resincroniza cuando ese contenido cambia. Ver `useBorradorDeEnfasis`.
    const { emphasized, setEmphasized, deemphasized, setDeemphasized, inicialAtenuados } =
        useBorradorDeEnfasis(persistedEmphasis, rubricSuggestion);
    const [note, setNote] = useState('');
    const [showDeemphasized, setShowDeemphasized] = useState(inicialAtenuados.length > 0);

    // v1.6 Phase 2 chokepoint: route paper-level structuralExpectations
    // lookup through the domain helper so the future strategy↔rubric
    // data move is one-file. Today this resolves to
    // `paper.rubric.structuralExpectations` (or the system default
    // when the rubric is silent); same semantics as before.
    const expectation = getEffectiveSectionStructuralExpectation(paper, kind);
    // Resolution order, most-specific to most-general:
    //   1. Data carries an explicit i18n key → use it. (Newly-applied
    //      system-default / strategy-only rubrics always do.)
    //   2. Data has no key but the rubric provenance is
    //      `system-default` → fall back to a kind-based lookup. This
    //      handles papers persisted BEFORE the `justificationKey`
    //      field existed: their stored `justification` is the
    //      English literal, but provenance tells us we're looking at
    //      a system-default structural expectation, so the canonical
    //      translated text is the right thing to render. Without this
    //      branch the user would see English on every pre-migration
    //      paper, even with the new keys defined.
    //   3. Anything else (extracted, user-edited, from-template) →
    //      render the literal text as authored. Extracted rubrics
    //      come back from the LLM in the user's chosen language;
    //      from-template / user-edited reflect the author's wording.
    const justification = (() => {
        if (!expectation) return undefined;
        if (expectation.justificationKey) return t(expectation.justificationKey);
        if (paper.rubric?.provenance === 'system-default') {
            return t(`paperSetup.subSteps.plan.rubricJustification.${kind}`);
        }
        return expectation.justification;
    })();

    const handleSave = async () => {
        const nextEmphasis: StepEmphasis = {
            emphasizedTypes: emphasized,
            deemphasizedTypes: showDeemphasized ? deemphasized : [],
            citationOverrides: persistedEmphasis.citationOverrides, // v1 doesn't edit overrides
        };
        try {
            await updateStepPlan.mutateAsync({
                paperId: paper.id,
                [kind]: nextEmphasis,
            } as any);
            toast.success(t('paperSetup.subSteps.plan.saved'));
        } catch (err) {
            console.error('[exegesis] save step plan failed:', err);
            toast.error(t('paperSetup.subSteps.plan.saveFailed'));
        }
    };

    const handleReset = () => {
        setEmphasized([...rubricSuggestion.emphasizedTypes]);
        setDeemphasized([...rubricSuggestion.deemphasizedTypes]);
    };

    const allSourceTypes = useMemo(() => SOURCE_TYPE_GROUPS.flatMap(g => g.types as ReadonlyArray<SourceType>), []);
    const availableForEmphasis = allSourceTypes.filter(t => !emphasized.includes(t) && !deemphasized.includes(t));
    const availableForDeemphasis = allSourceTypes.filter(t => !emphasized.includes(t) && !deemphasized.includes(t));

    return (
        <section className="rounded-lg border border-border bg-card p-4 space-y-4">
            <header className="flex items-start gap-3">
                <span className="text-success mt-0.5">{icon}</span>
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-foreground inline-flex items-center gap-2">
                        {t(`paperSetup.subSteps.plan.kinds.${kind}`)}
                        {isCustomized && (
                            <span className="text-[10px] uppercase tracking-wide font-semibold rounded-full bg-success-subtle text-success-subtle-foreground px-2 py-0.5">
                                {/* "personalizado" / "customized" via re-using the saved label is overkill; inline literal is simpler */}
                                {t('paperSetup.subSteps.plan.savedHint')}
                            </span>
                        )}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {t(`paperSetup.subSteps.plan.kindDescription.${kind}`)}
                    </p>
                </div>
            </header>

            {justification && (
                <div className="rounded-md bg-success-subtle border border-success/30 px-3 py-2 flex items-start gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] uppercase tracking-wide font-semibold text-success-subtle-foreground">
                            {t('paperSetup.subSteps.plan.rubricSuggestion')}
                        </p>
                        <p className="text-xs text-success-subtle-foreground leading-snug mt-0.5">
                            {justification}
                        </p>
                    </div>
                </div>
            )}

            {/* Dialectical-strategy hint. Translates the SourceType
                emphasis into role buckets (anchor / contrast /
                technical) so the user — who's been thinking in roles
                across corpus + plan-de-uso — sees the structural plan
                as the same conversation, not a context switch. Read-
                only summary; the SourceType chips below are the
                actual edit surface. */}
            {usesRoleCoverage(paper.exegeticalStrategy) && emphasized.length > 0 && (
                <DialecticalRoleSummary types={emphasized} />
            )}

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground">
                        {t('paperSetup.subSteps.plan.emphasizedTypesLabel')}
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                        {t('paperSetup.subSteps.plan.emphasizedTypesHint')}
                    </p>
                </div>
                <ChipMultiSelect
                    selected={emphasized}
                    available={availableForEmphasis}
                    rubricSuggested={rubricSuggestion.emphasizedTypes}
                    onAdd={(t) => setEmphasized([...emphasized, t])}
                    onRemove={(t) => setEmphasized(emphasized.filter(x => x !== t))}
                />
            </div>

            <button
                type="button"
                onClick={() => setShowDeemphasized(!showDeemphasized)}
                className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
                {t('paperSetup.subSteps.plan.deemphasizedToggle')}
            </button>

            {showDeemphasized && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-foreground">
                            {t('paperSetup.subSteps.plan.deemphasizedTypesLabel')}
                        </label>
                        <p className="text-[11px] text-muted-foreground">
                            {t('paperSetup.subSteps.plan.deemphasizedTypesHint')}
                        </p>
                    </div>
                    <ChipMultiSelect
                        selected={deemphasized}
                        available={availableForDeemphasis}
                        rubricSuggested={rubricSuggestion.deemphasizedTypes}
                        onAdd={(t) => setDeemphasized([...deemphasized, t])}
                        onRemove={(t) => setDeemphasized(deemphasized.filter(x => x !== t))}
                    />
                </div>
            )}

            <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                    {t('paperSetup.subSteps.plan.noteLabel')}
                </label>
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t('paperSetup.subSteps.plan.notePlaceholder')}
                    rows={2}
                    className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y"
                />
                <p className="text-[10px] text-muted-foreground">
                    {t('paperSetup.subSteps.plan.noteHint')}
                </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={handleReset}
                    className="text-xs"
                >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    {t('paperSetup.subSteps.plan.resetButton')}
                </Button>
                <Button
                    type="button"
                    onClick={handleSave}
                    disabled={updateStepPlan.isPending}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {t('paperSetup.subSteps.plan.saveButton')}
                </Button>
            </div>
        </section>
    );
}

// ── DialecticalRoleSummary ──────────────────────────────────────────────
//
// Counts the emphasized SourceTypes by their suggested dialectical
// role and renders three small badges (anchor / contrast / technical
// + "sin rol" if any). Bridges the role-based vocabulary used in the
// corpus + plan-de-uso steps with the SourceType-based vocabulary of
// the structural plan. The user sees "Énfasis dialéctico: Ancla 1 ·
// Contraste 2" instead of having to mentally translate each type.

const ROLE_BADGE_CLASSES: Record<SourceRole, string> = {
    anchor: 'bg-success text-success-foreground',
    contrast: 'bg-info text-info-foreground',
    technical: 'bg-warning text-warning-foreground',
};

function DialecticalRoleSummary({ types }: { types: ReadonlyArray<SourceType> }) {
    const { t } = useTranslation('exegesis');
    const counts = useMemo(() => {
        const out: Record<SourceRole | 'unrolled', number> = {
            anchor: 0, contrast: 0, technical: 0, unrolled: 0,
        };
        for (const ty of types) {
            const role = suggestRoleForType(ty);
            out[role ?? 'unrolled'] += 1;
        }
        return out;
    }, [types]);

    const roles: ReadonlyArray<SourceRole> = ['anchor', 'contrast', 'technical'];
    return (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                {t('paperSetup.subSteps.plan.dialectical.summaryLabel')}
            </span>
            {roles.map(role => (
                <span
                    key={role}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${counts[role] > 0 ? ROLE_BADGE_CLASSES[role] : 'bg-muted text-muted-foreground border-border'}`}
                >
                    {t(`paperSetup.subSteps.plan.dialectical.role.${role}`)} · {counts[role]}
                </span>
            ))}
            {counts.unrolled > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted text-muted-foreground px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide">
                    {t('paperSetup.subSteps.plan.dialectical.role.unrolled')} · {counts.unrolled}
                </span>
            )}
        </div>
    );
}

// ── ChipMultiSelect ─────────────────────────────────────────────────────

interface ChipMultiSelectProps {
    selected: ReadonlyArray<SourceType>;
    available: ReadonlyArray<SourceType>;
    rubricSuggested: ReadonlyArray<SourceType>;
    onAdd: (t: SourceType) => void;
    onRemove: (t: SourceType) => void;
}

function ChipMultiSelect({ selected, available, rubricSuggested, onAdd, onRemove }: ChipMultiSelectProps) {
    const { t } = useTranslation('exegesis');
    const [adding, setAdding] = useState(false);
    const rubricSet = useMemo(() => new Set(rubricSuggested), [rubricSuggested]);

    return (
        <div className="space-y-2">
            <ul className="flex flex-wrap gap-1.5">
                {selected.map(type => {
                    const fromRubric = rubricSet.has(type);
                    return (
                        <li
                            key={type}
                            className={[
                                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                                fromRubric
                                    ? 'bg-success-subtle text-success-subtle-foreground'
                                    : 'bg-muted text-muted-foreground',
                            ].join(' ')}
                        >
                            {fromRubric && <Sparkles className="h-2.5 w-2.5" />}
                            <span>{t(`sourceTypes.${type}.label`)}</span>
                            <button
                                type="button"
                                onClick={() => onRemove(type)}
                                className="hover:text-destructive"
                                aria-label={`Remove ${type}`}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </li>
                    );
                })}
                {selected.length === 0 && (
                    <li className="text-[11px] text-muted-foreground italic">
                        {t('paperSetup.subSteps.plan.rubricEmpty')}
                    </li>
                )}
            </ul>
            {adding ? (
                <select
                    autoFocus
                    onChange={(e) => {
                        const v = e.target.value as SourceType;
                        if (v) {
                            onAdd(v);
                            setAdding(false);
                        }
                    }}
                    onBlur={() => setAdding(false)}
                    className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                    <option value="">— {t('paperSetup.subSteps.plan.addType')} —</option>
                    {SOURCE_TYPE_GROUPS.map(group => {
                        const groupAvailable = group.types.filter(typ => available.includes(typ as SourceType)) as ReadonlyArray<SourceType>;
                        if (groupAvailable.length === 0) return null;
                        return (
                            <optgroup key={group.groupKey} label={t(`sourceTypeGroups.${group.groupKey}`)}>
                                {groupAvailable.map(typ => (
                                    <option key={typ} value={typ}>{t(`sourceTypes.${typ}.label`)}</option>
                                ))}
                            </optgroup>
                        );
                    })}
                </select>
            ) : (
                <button
                    type="button"
                    onClick={() => setAdding(true)}
                    disabled={available.length === 0}
                    className="inline-flex items-center gap-1 text-[11px] text-success hover:text-success-subtle-foreground disabled:opacity-50"
                >
                    <Plus className="h-3 w-3" />
                    {t('paperSetup.subSteps.plan.addType')}
                </button>
            )}
        </div>
    );
}
