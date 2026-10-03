import { AlertTriangle, ClipboardPaste, Lock, Plus, Trash2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
    InsightField,
    InsightStepData,
    PASTORAL_SEED_THRESHOLDS,
    PasteEvent,
    type PastoralSeed,
    StepValidationResult,
} from '@dosfilos/domain';
import { StepShell } from './StepShell';
import { InsightField as Field } from './InsightField';
import { StepHelp } from './StepHelp';
import { useStepTimer } from './stepTimer';
import { useInlineCoreTripwire } from '@/hooks/useInlineCoreTripwire';
import { useTranslation } from '@/i18n';
import {
    canRemoveObservation,
    observationSlots,
    readyObservations,
    writeObservation,
} from './insightObservations';

interface Props {
    passage: string;
    seed: PastoralSeed;
    data: InsightStepData;
    validation?: StepValidationResult;
    onChange: (patch: Partial<InsightStepData>) => void;
    onPasteEvent: (event: PasteEvent) => void;
}

const T = PASTORAL_SEED_THRESHOLDS.insight;

/**
 * Paso 6 — Insight.
 *
 * AI-forbidden by design (ADR-002 + manifesto Step 5). No suggestions,
 * no chat panel, no autocomplete. The pastor produces:
 *  - Idea central (≥30 chars) — verbatim required in the final draft.
 *  - 3+ observaciones (≥40 chars each), siempre a la vista como casillas
 *    (`insightObservations`, #30 del ejercicio de Jonás)
 *  - Pregunta abierta (≥30 chars)
 *  - Anécdota pastoral (≥80 chars)
 *  - Aplicación doxológica (manifiesto Paso 8, ≥80 chars)
 *
 * DOM paste events on any of the AI-forbidden fields are logged via
 * `onPasteEvent`. We never block paste (intrusive + frustrating for
 * normal flows like copying their own outline) — we audit it.
 */
export function InsightStep({ passage, seed, data, validation, onChange, onPasteEvent }: Props) {
    const { t } = useTranslation('generator');
    const tripwire = useInlineCoreTripwire();
    useStepTimer({
        enabled: true,
        onFlush: (delta) =>
            delta > 0 && onChange({ timeSpentSeconds: (data.timeSpentSeconds ?? 0) + delta }),
    });

    const handleCentralIdeaChange = (value: string) => {
        onChange({ centralIdea: value });
        // Tier-1 inline tripwire (core-only, non-blocking) — ADR-023.
        tripwire.check({
            seed: { ...seed, insight: { ...data, centralIdea: value } },
            claimKey: 'centralIdea',
            text: value,
        });
    };

    const handlePaste = (field: InsightField) => (e: React.ClipboardEvent) => {
        const text = e.clipboardData?.getData('text') ?? '';
        if (!text) return;
        onPasteEvent({
            step: 'insight',
            field,
            charsCount: text.length,
            at: new Date(),
        });
    };

    const observations = data.observations ?? [];
    const slots = observationSlots(observations, T.minObservations);
    const removable = canRemoveObservation(observations, T.minObservations);
    const ready = readyObservations(observations, T.observationMinChars);
    const pasteCount = data.pasteEvents?.length ?? 0;

    const updateObservation = (i: number, value: string) =>
        onChange({ observations: writeObservation(observations, i, value) });

    const addObservation = () => onChange({ observations: [...slots, ''] });

    const removeObservation = (i: number) => {
        const next = [...observations];
        next.splice(i, 1);
        onChange({ observations: next });
    };

    return (
        <StepShell
            stepNumber={8}
            title={t('insightStep.title')}
            subtitle={t('insightStep.subtitle')}
            passage={passage}
            validation={validation}
        >
            <div className="space-y-6">
                <StepHelp
                    label={t('insightStep.help.label')}
                    examples={[
                        {
                            title: t('insightStep.help.exampleCentralIdeaTitle'),
                            body: <p>{t('insightStep.help.exampleCentralIdea')}</p>,
                        },
                        {
                            title: t('insightStep.help.exampleDoxologyTitle'),
                            body: <p>{t('insightStep.help.exampleDoxology')}</p>,
                        },
                    ]}
                >
                    <p>{t('insightStep.help.intro')}</p>
                    <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                        <li>{t('insightStep.help.centralIdea')}</li>
                        <li>{t('insightStep.help.observations')}</li>
                        <li>{t('insightStep.help.openQuestion')}</li>
                        <li>{t('insightStep.help.anecdote')}</li>
                        <li>{t('insightStep.help.doxology')}</li>
                    </ul>
                </StepHelp>

                <div className="border-l-4 border-success bg-success/10 p-4 rounded-r-md">
                    <p className="text-sm font-medium flex items-center gap-2 text-success">
                        <Lock className="h-4 w-4" />
                        {t('insightStep.noAssistant.title')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{t('insightStep.noAssistant.body')}</p>
                    {pasteCount > 0 && (
                        <p className="text-xs text-warning mt-2 flex items-center gap-1">
                            <ClipboardPaste className="h-3 w-3" />
                            {t('insightStep.noAssistant.pastes', { count: pasteCount })}
                        </p>
                    )}
                </div>

                <Field
                    label={t('insightStep.centralIdea.label', { min: T.centralIdeaMinChars })}
                    hint={t('insightStep.centralIdea.hint')}
                    value={data.centralIdea}
                    min={T.centralIdeaMinChars}
                    rows={2}
                    onChange={handleCentralIdeaChange}
                    onPaste={handlePaste('centralIdea')}
                />
                {tripwire.warning?.claimKey === 'centralIdea' && (
                    <div className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
                        <p className="font-medium text-warning flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4" /> {t('insightStep.tripwire.title')}
                        </p>
                        <p className="text-foreground/80 text-xs mt-1">{tripwire.warning.reasoning}</p>
                        <button
                            type="button"
                            onClick={tripwire.dismiss}
                            className="text-xs underline text-warning mt-1"
                        >
                            {t('insightStep.tripwire.dismiss')}
                        </button>
                    </div>
                )}

                <section className="rounded-lg border bg-card p-4 space-y-3" aria-labelledby="insight-observations">
                    <div className="flex items-baseline justify-between gap-3">
                        <h3 id="insight-observations" className="text-sm font-medium">
                            {t('insightStep.observations.label')}
                        </h3>
                        <span
                            className={`text-xs font-medium tabular-nums ${
                                // Verde sólo con TODAS las casillas listas: una vacía de más
                                // también la rechaza el validador (revisión adversarial de F2).
                                ready === slots.length ? 'text-success' : 'text-muted-foreground'
                            }`}
                        >
                            {t('insightStep.observations.progress', { ready, total: slots.length })}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {t('insightStep.observations.hint', { minChars: T.observationMinChars })}
                    </p>
                    <ol className="space-y-3">
                        {slots.map((obs, i) => {
                            const len = obs.trim().length;
                            const n = i + 1;
                            return (
                                <li key={i} className="space-y-1">
                                    <div className="flex items-start gap-2">
                                        <span className="w-5 shrink-0 pt-2 text-right text-xs font-medium text-muted-foreground">
                                            {n}.
                                        </span>
                                        <Textarea
                                            value={obs}
                                            rows={2}
                                            onChange={(e) => updateObservation(i, e.target.value)}
                                            onPaste={handlePaste('observations')}
                                            aria-label={t('insightStep.observations.slotLabel', { n })}
                                            placeholder={t('insightStep.observations.placeholder', { n })}
                                            className="flex-1"
                                        />
                                        {removable && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeObservation(i)}
                                                type="button"
                                                aria-label={t('insightStep.observations.remove', { n })}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    <p
                                        className={`text-right text-xs ${
                                            len >= T.observationMinChars ? 'text-success' : 'text-muted-foreground'
                                        }`}
                                    >
                                        {len} / {T.observationMinChars}
                                    </p>
                                </li>
                            );
                        })}
                    </ol>
                    <Button variant="outline" size="sm" onClick={addObservation} type="button" className="w-full border-dashed">
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        {t('insightStep.observations.add')}
                    </Button>
                </section>

                <Field
                    label={t('insightStep.openQuestion.label', { min: T.openQuestionMinChars })}
                    hint={t('insightStep.openQuestion.hint')}
                    value={data.openQuestion}
                    min={T.openQuestionMinChars}
                    rows={2}
                    onChange={(v) => onChange({ openQuestion: v })}
                    onPaste={handlePaste('openQuestion')}
                />

                <Field
                    label={t('insightStep.anecdote.label', { min: T.pastoralAnecdoteMinChars })}
                    hint={t('insightStep.anecdote.hint')}
                    value={data.pastoralAnecdote}
                    min={T.pastoralAnecdoteMinChars}
                    rows={4}
                    onChange={(v) => onChange({ pastoralAnecdote: v })}
                    onPaste={handlePaste('pastoralAnecdote')}
                />

                <Field
                    label={t('insightStep.doxology.label', { min: T.doxologicalApplicationMinChars })}
                    hint={t('insightStep.doxology.hint')}
                    value={data.doxologicalApplication}
                    min={T.doxologicalApplicationMinChars}
                    rows={4}
                    onChange={(v) => onChange({ doxologicalApplication: v })}
                    onPaste={handlePaste('doxologicalApplication')}
                />
            </div>
        </StepShell>
    );
}
