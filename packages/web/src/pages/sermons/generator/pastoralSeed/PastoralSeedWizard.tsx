import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sprout, Save, Loader2, BookOpen, PanelRightOpen, Scale } from 'lucide-react';
import { usePastoralSeed } from '@/hooks/usePastoralSeed';
import { useThreeWitnessesGate, usePastoralFidelityGate, useStudyDepthGate } from '@/hooks/usePastoralFidelityGate';
import { useStudyDepth } from '@/hooks/useStudyDepth';
import { usePastoralSeedShadow } from '@/hooks/usePastoralSeedShadow';
import { useWizard } from '../WizardContext';
import { PASTORAL_SEED_STEP_ORDER, PastoralSeedStepKey, detectMethodErrorForStep } from '@dosfilos/domain';
import { StudyDepthBadge } from './StudyDepthBadge';
import { MethodErrorNote } from './MethodErrorNote';
import { PaperStudyReferencePanel } from './PaperStudyReferencePanel';
import { StepCompanion } from './StepCompanion';
import { ORIENTABLE_STEPS, pastorInputForStep } from './stepCompanionWiring';
import { StudyDepthPreGenerationGate } from './StudyDepthPreGenerationGate';
import type { StudyDepthSnapshot } from '@dosfilos/domain';
import { computeExpertModeStatus } from '@dosfilos/domain';
import { useUserProfile } from '@/hooks/useUserProfile';
import { sermonService } from '@dosfilos/application';
import { toast } from 'sonner';
import { StructuralPuzzleSheet } from './puzzle/StructuralPuzzleSheet';
import { WitnessGate } from './witnesses/WitnessGate';
import { PastoralSeedBreadcrumb, BreadcrumbStep } from './PastoralSeedBreadcrumb';
import { ReadingStep } from './ReadingStep';
import { ContextGenreStep } from './ContextGenreStep';
import { StructuralAnalysisStep } from './StructuralAnalysisStep';
import { WordStudiesStep } from './WordStudiesStep';
import { RecognitionStep } from './RecognitionStep';
import { FunctionStep } from './FunctionStep';
import { TimelessPrincipleStep } from './TimelessPrincipleStep';
import { InsightStep } from './InsightStep';
import { BibleReaderPanel } from '@/components/bible/BibleReaderPanel';
import { cn } from '@/lib/utils';

const STEP_TITLES: Record<PastoralSeedStepKey, string> = {
    reading: 'Lectura',
    contextGenre: 'Contexto y Género',
    structuralAnalysis: 'Análisis Estructural',
    wordStudies: 'Estudio de Palabras',
    recognition: 'Reconocimiento',
    function: 'Función',
    timelessPrinciple: 'Principio Atemporal',
    insight: 'Insight',
};

const TOTAL_STEPS = PASTORAL_SEED_STEP_ORDER.length;

interface Props {
    sermonId: string | null;
    userId: string;
    passage: string;
    /**
     * Fired when the seed has all six steps valid and the pastor clicks
     * "Continuar al borrador". Receives the completed `PastoralSeed`
     * so the caller can synthesize an `ExegeticalStudy` payload (via
     * `seedToExegesis`) for the downstream homiletics + draft phases
     * — those legacy steps still require the `exegesis` slot to be
     * populated. The wizard does NOT navigate; the parent decides
     * (typically `setStep(2)`).
     */
    onSeedCompleted: (seed: import('@dosfilos/domain').PastoralSeed) => void;
    /** Optional pre-fill payload from derivedContext (paper / Faculty). */
    derivedSuggestions?: {
        firstImpression?: string;
        mainClauseNote?: string;
        originalAudienceFunction?: string;
        note: string;
    };
    /** Optional banner above the wizard summarising the origin (paper / Faculty). */
    headerBanner?: React.ReactNode;
    /**
     * Material que el paper exegético del pastor ya estableció, indexado
     * por paso. Se MUESTRA junto al paso; nunca se escribe en la
     * semilla. Ausente cuando el sermón no viene de un paper.
     */
    paperReference?: import('@dosfilos/domain').PaperStudyReference;
}

/**
 * Orchestrator for the six-step spine (ADR-002). Linear breadcrumb,
 * one sub-step rendered at a time, autosave via `usePastoralSeed`.
 * The wizard never lets the pastor jump forward to an unfinished step;
 * "Continuar a homiletics" only enables once every sub-step validates.
 */
export function PastoralSeedWizard({
    sermonId,
    userId,
    passage,
    onSeedCompleted,
    derivedSuggestions,
    headerBanner,
    paperReference,
}: Props) {
    const [currentIndex, setCurrentIndex] = useState(0);
    // Phase 2 (ADR-011): after the six-step seed completes, the wizard
    // can route through a three-witnesses validation gate before the
    // draft. Only when the `three_witnesses` sub-flag is on; otherwise
    // "Continuar al borrador" calls `onSeedCompleted` as in Phase 1.
    const [phase, setPhase] = useState<'seed' | 'witnesses'>('seed');
    const threeWitnesses = useThreeWitnessesGate();
    const { confessionalWitnessesEnabled } = usePastoralFidelityGate();
    // Bible reader sticky to the right by default — pastor needs the
    // text visible while doing every step. Toggleable so power users
    // can reclaim horizontal real estate when working on Insight (the
    // single step that's pure pastor output, no text consultation).
    const [bibleOpen, setBibleOpen] = useState(true);

    const {
        seed,
        loading,
        saving,
        lastSavedAt,
        evaluation,
        updateStep,
        appendToolUsage,
        appendPasteEvent,
        addWordStudy,
        saveWitnessReview,
        logAiAssist,
        flush,
    } = usePastoralSeed({
        sermonId,
        userId,
        passage,
        enabled: true,
    });

    // Phase 2.5 (ADR-025/026) — Study Companion: coverage badge + per-step
    // orientation. Behind the `study_depth` sub-flag; flag-off pastors get
    // the Phase 1.6 wizard unchanged.
    const studyDepthGate = useStudyDepthGate();
    const { assessment, setOverride, orient } = useStudyDepth({
        seed,
        enabled: studyDepthGate.enabled,
    });

    // Phase 2.5 PR C (ADR-027) — Pre-generation gate state + expert-mode
    // status. The gate fires once the seed completes (or witnesses pass)
    // BEFORE handing the pastor to homiletics. Expert mode softens the
    // ceremony but never silences the confrontation on red dims (P3).
    const { profile } = useUserProfile();
    const [gateOpen, setGateOpen] = useState(false);
    const expertMode = useMemo(
        () => computeExpertModeStatus({ expertModeOn: profile?.expertModeOn }, 0).isOn,
        [profile?.expertModeOn],
    );

    const handleGateProceed = async (snapshot: StudyDepthSnapshot) => {
        try {
            if (sermonId) {
                await sermonService.updateSermon(sermonId, { studyDepthSnapshot: snapshot });
            }
        } catch (err) {
            console.error('[PastoralSeedWizard] failed to persist snapshot', err);
            toast.error('No se pudo guardar la nota del estudio, pero podés seguir.');
        } finally {
            setGateOpen(false);
            if (seed) onSeedCompleted(seed);
        }
    };

    // Phase 2.5 Tier 3 — structural puzzle (proposal `structural-puzzle-tier3.md`).
    const [puzzleOpen, setPuzzleOpen] = useState(false);

    // Publish live completed-steps counter to the wizard context so
    // the global header pipeline can show `n/6` updating in real time
    // as the pastor types. Without this lift, the header relied on a
    // one-shot Firestore fetch and stayed stale until step navigation.
    const { setSeedCompletedSteps } = useWizard();
    // Redacción v2 §4.5 — el wizard también reporta a la sombra del estudio.
    const seedShadow = usePastoralSeedShadow();
    useEffect(() => {
        setSeedCompletedSteps(evaluation?.completedSteps.length ?? 0);
    }, [evaluation, setSeedCompletedSteps]);

    const breadcrumbSteps = useMemo<BreadcrumbStep[]>(
        () =>
            PASTORAL_SEED_STEP_ORDER.map((key, i) => ({
                key,
                index: i + 1,
                title: STEP_TITLES[key],
                completed: evaluation?.perStep[key]?.valid ?? false,
            })),
        [evaluation],
    );

    const currentKey = PASTORAL_SEED_STEP_ORDER[currentIndex];

    const handleAdvance = async () => {
        await flush();
        // Redacción v2 §4.5 — cerrar el paso 3 es el acto que la vara mide.
        // Fire-and-forget bajo `passage_profile`; jamás bloquea el avance.
        if (currentKey === 'structuralAnalysis') seedShadow.recordStructuralSufficiency(seed);
        if (currentIndex < PASTORAL_SEED_STEP_ORDER.length - 1) {
            setCurrentIndex((i) => i + 1);
            return;
        }
        if (!evaluation?.completed || !seed) return;
        // Last seed step done. Route through the witness gate when the
        // sub-flag is on; otherwise check the study-depth gate (Phase 2.5
        // PR C) before advancing.
        if (threeWitnesses.enabled) {
            setPhase('witnesses');
            return;
        }
        if (studyDepthGate.enabled && assessment) {
            setGateOpen(true);
            return;
        }
        onSeedCompleted(seed);
    };

    const handleJumpTo = (key: PastoralSeedStepKey) => {
        const next = PASTORAL_SEED_STEP_ORDER.indexOf(key);
        if (next === -1) return;
        // Salir del paso 3 por el breadcrumb también lo cierra. El hook deduplica,
        // así que ir y volver no infla el conteo.
        if (currentKey === 'structuralAnalysis' && key !== 'structuralAnalysis') {
            seedShadow.recordStructuralSufficiency(seed);
        }
        setCurrentIndex(next);
    };

    if (loading || !seed) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">Cargando tu estudio…</p>
            </div>
        );
    }

    // Phase 2 — three-witnesses validation gate (7th "Validación" phase).
    if (phase === 'witnesses') {
        return (
            <div className="max-w-7xl mx-auto py-3 px-2 space-y-4">
                <header className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Scale className="h-4 w-4 text-success" />
                        <h1 className="text-base font-semibold">Validación final</h1>
                        <span className="text-xs text-muted-foreground hidden md:inline">
                            · Tres testigos antes del borrador.
                        </span>
                    </div>
                </header>
                <WitnessGate
                    seed={seed}
                    confessionalWitnessesEnabled={confessionalWitnessesEnabled}
                    onProceed={async (review) => {
                        await saveWitnessReview(review);
                        // Phase 2.5 PR C — chain into the study-depth gate
                        // when active; otherwise proceed directly.
                        if (studyDepthGate.enabled && assessment) {
                            setPhase('seed');
                            setGateOpen(true);
                            return;
                        }
                        onSeedCompleted(seed);
                    }}
                    onReviseClaim={() => {
                        setPhase('seed');
                        setCurrentIndex(PASTORAL_SEED_STEP_ORDER.indexOf('insight'));
                    }}
                    onBack={() => setPhase('seed')}
                />
            </div>
        );
    }

    const stepValidation = evaluation?.perStep[currentKey];
    const stepValid = stepValidation?.valid ?? false;

    // Observación de método: MISMA vara que el acompañante socrático del chat.
    // Es heurística local (sin LLM, sin callable), así que se puede evaluar en
    // cada render sin costo ni latencia — por eso puede aparecer sola en vez de
    // esperar a que el pastor la pida, que era la asimetría entre superficies.
    // NO va detrás de `studyDepthGate`: dejarla ahí reproduciría justamente la
    // asimetría que se viene a cerrar.
    const methodError = currentKey
        ? detectMethodErrorForStep(currentKey, pastorInputForStep(seed, currentKey), {
              genre: seed.contextGenre?.genreConfirmed ? seed.contextGenre.genre || undefined : undefined,
          })
        : null;

    const renderStep = () => {
        const common = { passage } as const;
        switch (currentKey) {
            case 'reading':
                return (
                    <ReadingStep
                        {...common}
                        data={seed.reading}
                        suggestion={derivedSuggestions?.firstImpression}
                        validation={stepValidation}
                        onChange={(patch) => updateStep('reading', patch)}
                    />
                );
            case 'contextGenre':
                return (
                    <ContextGenreStep
                        {...common}
                        data={seed.contextGenre}
                        validation={stepValidation}
                        onChange={(patch) => updateStep('contextGenre', patch)}
                        onLogAiAssist={(assistType, edited) =>
                            logAiAssist({ stepKey: 'contextGenre', assistType, outputWasEditedByUser: edited })
                        }
                    />
                );
            case 'structuralAnalysis':
                return (
                    <StructuralAnalysisStep
                        {...common}
                        data={seed.structuralAnalysis}
                        suggestion={derivedSuggestions?.mainClauseNote}
                        validation={stepValidation}
                        onChange={(patch) => updateStep('structuralAnalysis', patch)}
                        onLogToolUsage={(tool) =>
                            appendToolUsage({
                                tool,
                                step: 'structuralAnalysis',
                                invokedAt: new Date(),
                                durationSeconds: 0,
                            })
                        }
                        onLogAiAssist={(assistType, edited) =>
                            logAiAssist({ stepKey: 'structuralAnalysis', assistType, outputWasEditedByUser: edited })
                        }
                    />
                );
            case 'wordStudies':
                return (
                    <WordStudiesStep
                        {...common}
                        sermonId={sermonId}
                        data={seed.wordStudies}
                        validation={stepValidation}
                        onAddWordStudy={addWordStudy}
                        onChange={(patch) => updateStep('wordStudies', patch)}
                        onLogToolUsage={(tool) =>
                            appendToolUsage({
                                tool,
                                step: 'wordStudies',
                                invokedAt: new Date(),
                                durationSeconds: 0,
                            })
                        }
                        onLogAiAssist={(assistType, edited) =>
                            logAiAssist({ stepKey: 'wordStudies', assistType, outputWasEditedByUser: edited })
                        }
                    />
                );
            case 'recognition':
                return (
                    <RecognitionStep
                        {...common}
                        data={seed.recognition}
                        validation={stepValidation}
                        onChange={(patch) => updateStep('recognition', patch)}
                        onLogToolUsage={(tool) =>
                            appendToolUsage({
                                tool,
                                step: 'recognition',
                                invokedAt: new Date(),
                                durationSeconds: 0,
                            })
                        }
                        onLogAiAssist={(assistType, edited) =>
                            logAiAssist({ stepKey: 'recognition', assistType, outputWasEditedByUser: edited })
                        }
                    />
                );
            case 'function':
                return (
                    <FunctionStep
                        {...common}
                        data={seed.function}
                        suggestion={derivedSuggestions?.originalAudienceFunction}
                        validation={stepValidation}
                        onChange={(patch) => updateStep('function', patch)}
                        onLogToolUsage={(tool) =>
                            appendToolUsage({
                                tool,
                                step: 'function',
                                invokedAt: new Date(),
                                durationSeconds: 0,
                            })
                        }
                    />
                );
            case 'timelessPrinciple':
                return (
                    <TimelessPrincipleStep
                        {...common}
                        seed={seed}
                        data={seed.timelessPrinciple}
                        validation={stepValidation}
                        onChange={(patch) => updateStep('timelessPrinciple', patch)}
                        onPasteEvent={(charsCount) =>
                            appendPasteEvent({
                                step: 'timelessPrinciple',
                                field: 'principle',
                                charsCount,
                                at: new Date(),
                            })
                        }
                        onLogAiAssist={(assistType, edited) =>
                            logAiAssist({ stepKey: 'timelessPrinciple', assistType, outputWasEditedByUser: edited })
                        }
                    />
                );
            case 'insight':
                return (
                    <InsightStep
                        {...common}
                        seed={seed}
                        data={seed.insight}
                        validation={stepValidation}
                        onChange={(patch) => updateStep('insight', patch)}
                        onPasteEvent={(event) => appendPasteEvent(event)}
                    />
                );
        }
    };

    const isLastStep = currentIndex === PASTORAL_SEED_STEP_ORDER.length - 1;
    const seedCompleted = evaluation?.completed ?? false;

    return (
        <div className="max-w-7xl mx-auto py-3 px-2">
            <header className="space-y-2 mb-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Sprout className="h-4 w-4 text-success" />
                            <h1 className="text-base font-semibold">Estudio personal</h1>
                        </div>
                        {passage && (
                            <div className="flex items-baseline gap-1.5 border-l pl-3">
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    Pasaje
                                </span>
                                <span className="font-serif text-lg font-semibold text-foreground leading-none">
                                    {passage}
                                </span>
                            </div>
                        )}
                        <span className="text-xs text-muted-foreground hidden md:inline">
                            · Tú estudias; el sistema desarrolla.
                        </span>
                    </div>
                    {!bibleOpen && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBibleOpen(true)}
                            title="Mostrar Biblia"
                        >
                            <PanelRightOpen className="h-4 w-4" />
                            <BookOpen className="h-4 w-4 ml-1" />
                            <span className="ml-1 hidden sm:inline">Biblia</span>
                        </Button>
                    )}
                </div>
                {derivedSuggestions && (
                    <Card className="p-3 bg-warning/10 border-warning/40 text-sm">
                        <p className="font-medium mb-1">Pre-llenado parcial disponible</p>
                        <p className="text-muted-foreground">{derivedSuggestions.note}</p>
                    </Card>
                )}
                {headerBanner}
                <PastoralSeedBreadcrumb
                    steps={breadcrumbSteps}
                    currentIndex={currentIndex}
                    onJumpTo={handleJumpTo}
                />
            </header>

            {/* Two-column layout: step content + sticky Bible reader.
                Bible defaults to open because every step (except Insight)
                benefits from having the text visible. Pastor can collapse. */}
            <div
                className={cn(
                    'grid gap-4',
                    bibleOpen ? 'grid-cols-1 lg:grid-cols-[1fr_420px]' : 'grid-cols-1',
                )}
            >
                <div className="space-y-4">
                    {studyDepthGate.enabled && assessment && (
                        <StudyDepthBadge assessment={assessment} onToggleOverride={setOverride} />
                    )}

                    <Card className="p-6">{renderStep()}</Card>

                    {/* Debajo del paso, no encima: el pastor lee la
                        pregunta antes que el material. Plegado por
                        defecto, y ausente en los pasos que el paper no
                        alimenta. */}
                    {paperReference && currentKey && (
                        <PaperStudyReferencePanel
                            reference={paperReference}
                            stepKey={currentKey}
                            onAddWordStudy={currentKey === 'wordStudies' ? addWordStudy : undefined}
                        />
                    )}

                    {methodError && <MethodErrorNote description={methodError.description} />}

                    {studyDepthGate.enabled && ORIENTABLE_STEPS[currentKey] && (
                        <StepCompanion
                            passage={passage}
                            stepKey={ORIENTABLE_STEPS[currentKey]}
                            pastorInput={pastorInputForStep(seed, currentKey)}
                            genre={seed.contextGenre?.genreConfirmed ? seed.contextGenre.genre || undefined : undefined}
                            orient={orient}
                            onLogOrientation={() =>
                                logAiAssist({
                                    stepKey: currentKey,
                                    assistType: 'stepOrientation',
                                    outputWasEditedByUser: false,
                                })
                            }
                            onOpenTier3={
                                currentKey === 'structuralAnalysis'
                                    ? () => setPuzzleOpen(true)
                                    : undefined
                            }
                        />
                    )}

                    <footer className="flex flex-wrap items-center justify-between gap-3 px-1">
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                            {saving ? (
                                <>
                                    <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
                                </>
                            ) : lastSavedAt ? (
                                <>
                                    <Save className="h-3 w-3" /> Guardado {lastSavedAt.toLocaleTimeString()}
                                </>
                            ) : (
                                <span>Cambios se guardan automáticamente.</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {currentIndex > 0 && (
                                <Button variant="outline" onClick={() => setCurrentIndex((i) => i - 1)}>
                                    Anterior
                                </Button>
                            )}
                            {!isLastStep && (
                                <Button onClick={handleAdvance} disabled={!stepValid}>
                                    Siguiente
                                </Button>
                            )}
                            {isLastStep && (
                                <Button
                                    onClick={handleAdvance}
                                    disabled={!seedCompleted}
                                    className="bg-success text-success-foreground hover:bg-success/90"
                                >
                                    {seedCompleted
                                        ? threeWitnesses.enabled
                                            ? 'Continuar a validación →'
                                            : 'Continuar al borrador →'
                                        : `Completa los ${TOTAL_STEPS} pasos para continuar`}
                                </Button>
                            )}
                        </div>
                    </footer>
                </div>

                {bibleOpen && (
                    <aside className="lg:sticky lg:top-4 lg:self-start lg:h-[calc(100vh-8rem)]">
                        <div className="h-full rounded-lg border bg-card overflow-hidden">
                            <BibleReaderPanel
                                passage={passage}
                                onClose={() => setBibleOpen(false)}
                            />
                        </div>
                    </aside>
                )}
            </div>
            {studyDepthGate.enabled && assessment && (
                <StudyDepthPreGenerationGate
                    open={gateOpen}
                    assessment={assessment}
                    expertMode={expertMode}
                    onProceed={handleGateProceed}
                    onCancel={() => setGateOpen(false)}
                />
            )}
            {studyDepthGate.enabled && currentKey === 'structuralAnalysis' && (
                <StructuralPuzzleSheet
                    open={puzzleOpen}
                    passage={passage}
                    onClose={() => setPuzzleOpen(false)}
                    onComplete={() =>
                        logAiAssist({
                            stepKey: 'structuralAnalysis',
                            assistType: 'structuralPuzzle',
                            outputWasEditedByUser: false,
                        })
                    }
                />
            )}
        </div>
    );
}
