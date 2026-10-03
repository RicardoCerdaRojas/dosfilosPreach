import { useState, useMemo, useEffect } from 'react';
import { usePastoralFidelityGate } from '@/hooks/usePastoralFidelityGate';
import { useTranslation } from '@/i18n';
import { WizardStepHeader } from './WizardStepHeader';
import { useWizard } from './WizardContext';
import { WizardLayout } from './WizardLayout';
import { WizardStepShell } from './WizardStepShell';
import { ToolbarIconButton } from './ToolbarIconButton';
import { PanelGroup } from '@/components/ui/PanelGroup';
import { DerivedContextBanner } from './DerivedContextBanner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, ArrowRight, ArrowLeft, Mic2, Sparkles, BookOpen, RefreshCw } from 'lucide-react';
import { sermonGeneratorService, generatorChatService } from '@dosfilos/application';
import { toast } from 'sonner';
import { applyPropositionContract, applyPastorDirectives, type PastorDirective } from '@dosfilos/domain';
import { ContentCanvas } from '@/components/canvas-chat/ContentCanvas';
import { PropositionContractPanel } from './homiletics/PropositionContractPanel';
import { OutlineDirectivePanel } from './homiletics/OutlineDirectivePanel';
import { ChatInterface } from '@/components/canvas-chat/ChatInterface';
import { ResizableChatPanel } from '@/components/canvas-chat/ResizableChatPanel';
import { useFirebase } from '@/context/firebase-context';
import { WorkflowPhase, HomileticalAnalysis, CoachingStyle } from '@dosfilos/domain';
import { useContentHistory } from '@/hooks/useContentHistory';
import { useGeneratorChat } from '@/hooks/useGeneratorChat';
import { ApproachSelectionView } from './homiletics/ApproachSelectionView';
import { BibleReaderPanel } from '@/components/bible/BibleReaderPanel';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { HomileticsLoadingScreen, HomileticsSavedIndicator } from './homiletics/HomileticsLoadingScreen';
import { useHomileticsRefinement } from './homiletics/useHomileticsRefinement';
import { useHomileticsVersions } from './homiletics/useHomileticsVersions';
import { useSeedThesis } from './homiletics/useSeedThesis';

/**
 * Sub-steps within the Homiletics phase.
 * @pattern State Machine — clear transitions between sub-steps.
 */
enum HomileticsSubStep {
    /** Step 2a: User selects from 4-5 approach previews. */
    APPROACH_SELECTION = 'selection',
    /** Step 2b: Shows developed proposition + outline. */
    PROPOSITION_DEVELOPMENT = 'development',
}

export function StepHomiletics() {
    const { exegesis, rules, setHomiletics, setStep, homiletics, saving, config, sermonId, selectHomileticalApproach } = useWizard();
    const { user } = useFirebase();
    const semilla = useSeedThesis(sermonId, user?.uid);
    const { t, language } = useTranslation('generator');
    const activeLanguage = language === 'en' ? 'en' : 'es';

    const [currentSubStep, setCurrentSubStep] = useState<HomileticsSubStep>(
        homiletics ? HomileticsSubStep.PROPOSITION_DEVELOPMENT : HomileticsSubStep.APPROACH_SELECTION,
    );

    const [loading, setLoading] = useState(false);
    const [developingApproach, setDevelopingApproach] = useState(false);
    const [selectedStyle, setSelectedStyle] = useState<CoachingStyle | 'auto'>('auto');
    const [rightPanelMode, setRightPanelMode] = useState<'chat' | 'bible'>('chat');

    const [approachPreviews, setApproachPreviews] = useState<any[]>([]);
    const [tempSelectedApproachId, setTempSelectedApproachId] = useState<string | undefined>(undefined);

    const {
        messages,
        setMessages,
        isLoading: isChatLoading,
        activeContext,
        refreshContext: handleRefreshContext,
        handleSendMessage: sendGeneralMessage,
    } = useGeneratorChat({
        phase: 'homiletics',
        content: homiletics,
        config,
        user,
        sermonId,
        initialCacheName: null,
        selectedResourceIds: [],
    });

    const contentHistory = useContentHistory('homiletics', sermonId ?? undefined);

    const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
    const [modifiedSections, setModifiedSections] = useState<Set<string>>(new Set());

    // Auto-generation: trigger once if exegesis exists but homiletics doesn't.
    //
    // Pastoral Fidelity (Phase 1 UI-audit Categoría 1): under the
    // `pastoral_fidelity_flow` flag this auto-fire violates P1 (labor
    // antes que output) — the pastor lands on Step 2 and previews
    // appear before they decide. Gate disables auto-fire whenever the
    // flag is on; the pastor clicks "Generar enfoques" explicitly.
    const pastoralGate = usePastoralFidelityGate();
    const [hasAttempted, setHasAttempted] = useState(false);

    const passage = useMemo(() => {
        return exegesis?.passage || homiletics?.exegeticalStudy?.passage || '';
    }, [exegesis, homiletics]);

    /**
     * Delega en la función pura de dominio: acá viviría la corrupción
     * silenciosa (descripciones pegadas al punto equivocado al borrar o
     * reordenar) y eso tiene que ser testeable sin montar la UI.
     */
    const applyContract = (patch: {
        proposition: string;
        points: { title: string; application?: string; passageRef?: string; srcIndex: number | null }[];
    }) => {
        if (!homiletics) return;
        setHomiletics(applyPropositionContract(homiletics, patch));
    };

    /**
     * Las directivas del pastor, EN UNA SOLA ESCRITURA.
     *
     * Escribe sólo los puntos que llegan en `entries`, así el refinamiento por
     * chat sobre los demás no se pisa. Y llegan juntos a propósito: una llamada
     * por punto calcularía cada una desde este mismo `homiletics` del render, y
     * sólo sobreviviría la última.
     */
    const applyDirective = (entries: { index: number; directive: PastorDirective | undefined }[]) => {
        if (!homiletics) return;
        setHomiletics(applyPastorDirectives(homiletics, entries));
    };

    const formattedHomiletics = useMemo(() => {
        if (!homiletics) return homiletics;
        const selectedApproach = homiletics.homileticalApproaches?.find(
            a => a.id === homiletics.selectedApproachId,
        );
        if (selectedApproach) {
            return {
                ...homiletics,
                approachDisplay:
                    `**${selectedApproach.type}** - ${selectedApproach.direction}\n\n` +
                    `**Tono:**\n${selectedApproach.tone}\n\n` +
                    `**Propósito:**\n${selectedApproach.purpose}\n\n` +
                    `**Audiencia:**\n${selectedApproach.targetAudience}\n\n` +
                    `**Justificación:**\n${selectedApproach.rationale}`,
            };
        }
        return {
            ...homiletics,
            approachDisplay: homiletics.homileticalApproach || 'No se ha seleccionado un enfoque',
        };
    }, [homiletics]);

    /**
     * Phase 1: Generate approach previews (FAST — 3-5 seconds).
     * Shows 4-5 lightweight options for the user to choose from.
     */
    const handleGenerate = async () => {
        if (!exegesis) return;

        setLoading(true);
        setApproachPreviews([]);

        // Regenerar enfoques DESCARTA la propuesta ya desarrollada.
        //
        // El diálogo de confirmación siempre prometió esto —"reiniciará todo el
        // proceso homilético… perderás la selección actual"— pero el código solo
        // reemplazaba los previews. La proposición y el bosquejo del enfoque
        // anterior sobrevivían, y la pantalla los seguía mostrando como si
        // correspondieran a los enfoques nuevos. Una propuesta huérfana de su
        // enfoque no es contenido viejo: es contenido que MIENTE sobre de dónde
        // salió, y el pastor no tiene forma de notarlo.
        //
        // Se limpia ANTES de la llamada, no después: si la generación falla, es
        // preferible quedar sin propuesta —con los enfoques a la vista para
        // reintentar— que conservar una que ya no pertenece a nada.
        setHomiletics(null);
        setTempSelectedApproachId(undefined);
        setExpandedSectionId(null);
        setModifiedSections(new Set());

        try {
            const baseConfig = config ? config[WorkflowPhase.HOMILETICS] : undefined;
            const homileticsConfig = baseConfig
                ? {
                      ...baseConfig,
                      aiModel: config?.advanced?.aiModel,
                      temperature:
                          config?.[WorkflowPhase.HOMILETICS]?.temperature || config?.advanced?.globalTemperature,
                  }
                : undefined;

            const { previews } = await sermonGeneratorService.generateHomileticsPreview(
                exegesis,
                rules,
                homileticsConfig,
                user?.uid,
                activeLanguage,
            );

            // Sort: expository approaches first (the user's primary approach).
            const sortedPreviews = (previews || []).sort((a: any, b: any) => {
                const isAExpository = a.type?.toLowerCase().includes('expositiv');
                const isBExpository = b.type?.toLowerCase().includes('expositiv');
                if (isAExpository && !isBExpository) return -1;
                if (!isAExpository && isBExpository) return 1;
                return 0;
            });

            setApproachPreviews(sortedPreviews);
            toast.success(t('homiletics.success.previewsGenerated', { count: sortedPreviews.length || 0 }));

            if (sortedPreviews.length > 0) {
                setCurrentSubStep(HomileticsSubStep.APPROACH_SELECTION);
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || t('homiletics.errors.generatePreviews'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (pastoralGate.allowed) return; // Phase 1 UI-audit Cat 1 — explicit user action required.
        if (exegesis && !homiletics && !loading && !approachPreviews.length && !hasAttempted) {
            setHasAttempted(true);
            handleGenerate();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exegesis, homiletics, hasAttempted, pastoralGate.allowed]);

    /**
     * Phase 2: Develop selected approach (DETAILED — 5-8 seconds).
     * Takes the chosen preview and generates the complete proposition + outline.
     */
    const handleconfirmApproach = async () => {
        if (!tempSelectedApproachId || !exegesis) return;

        const selectedPreview = approachPreviews.find(p => p.id === tempSelectedApproachId);
        if (!selectedPreview) {
            toast.error(t('homiletics.errors.notFound'));
            return;
        }

        setDevelopingApproach(true);

        try {
            const baseConfig = config ? config[WorkflowPhase.HOMILETICS] : undefined;
            const homileticsConfig = baseConfig
                ? {
                      ...baseConfig,
                      aiModel: config?.advanced?.aiModel,
                      temperature:
                          config?.[WorkflowPhase.HOMILETICS]?.temperature || config?.advanced?.globalTemperature,
                  }
                : undefined;

            const { approach } = await sermonGeneratorService.developSelectedApproach(
                exegesis,
                selectedPreview,
                rules,
                homileticsConfig,
                user?.uid,
                activeLanguage,
            );

            const homileticsAnalysis: HomileticalAnalysis = {
                exegeticalStudy: exegesis,
                homileticalApproaches: [approach],
                selectedApproachId: approach.id,
                homileticalApproach: approach.type,
                contemporaryApplication: approach.contemporaryApplication,
                homileticalProposition: approach.homileticalProposition,
                outlinePreview: approach.outlinePreview,
                outline: approach.outline,
            };

            setHomiletics(homileticsAnalysis);
            selectHomileticalApproach(approach.id);
            setCurrentSubStep(HomileticsSubStep.PROPOSITION_DEVELOPMENT);

            toast.success(t('homiletics.success.developed'));
        } catch (error: any) {
            console.error('[Phase 2] Error developing approach:', error);
            toast.error(error.message || t('homiletics.errors.develop'));
        } finally {
            setDevelopingApproach(false);
        }
    };

    const handleContinue = () => setStep(3);

    const { isAiProcessing, handleSendMessage } = useHomileticsRefinement({
        formattedHomiletics,
        homiletics,
        setHomiletics,
        expandedSectionId,
        modifiedSections,
        setModifiedSections,
        setMessages,
        sendGeneralMessage,
        config,
        rules,
        exegesis,
        passage,
    });

    const isTotalAiLoading = isAiProcessing || isChatLoading;

    const { handleUndo, handleRedo, handleRestoreVersion, handleSectionUpdate } = useHomileticsVersions({
        homiletics,
        setHomiletics,
        contentHistory,
        setModifiedSections,
    });

    const getSectionVersions = (sectionId: string) => contentHistory.getVersions(sectionId);
    const getCurrentVersionId = (sectionId: string) => contentHistory.getCurrentVersion(sectionId)?.id;

    const handleApplyChange = (messageId: string, newContent: any) => {
        setHomiletics(newContent);
        setMessages(prev => prev.map(msg => (msg.id === messageId ? { ...msg, appliedChange: true } : msg)));
    };

    if (!exegesis) {
        return <div>{t('homiletics.errorNoExegesis')}</div>;
    }

    if (loading) return <HomileticsLoadingScreen phase={1} />;
    if (developingApproach) return <HomileticsLoadingScreen phase={2} />;

    // ── Sub-step 2a: approach selection ─────────────────────────────────
    if (currentSubStep === HomileticsSubStep.APPROACH_SELECTION) {
        // A todo el ancho: la ayuda que ocupaba la columna derecha se abre a
        // pedido dentro de la vista (#31 del ejercicio de Jonás).
        return (
            <>
                <HomileticsSavedIndicator visible={saving} />
                <ApproachSelectionView
                    previews={approachPreviews}
                    selectedId={tempSelectedApproachId}
                    onSelect={setTempSelectedApproachId}
                    onConfirm={handleconfirmApproach}
                    onRegenerate={handleGenerate}
                    developing={developingApproach}
                    regenerating={loading}
                    thesis={semilla.centralIdea}
                />
            </>
        );
    }

    // ── Sub-step 2b: proposition development ────────────────────────────
    const stepHeader = (
        <WizardStepHeader
            title={t('homiletics.proposalTitle')}
            documentActions={<>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 bg-background border-primary/20 text-primary hover:text-primary hover:bg-primary/5"
                        onClick={() => setRightPanelMode(prev => (prev === 'bible' ? 'chat' : 'bible'))}
                    >
                        <BookOpen className="h-4 w-4" />
                        <span className="text-xs font-medium">{passage}</span>
                    </Button>
    
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <ToolbarIconButton
                                label={loading ? t('homiletics.regeneratingBtn') : t('homiletics.regenerateShort')}
                                disabled={loading}
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-4 w-4" />
                                )}
                            </ToolbarIconButton>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{t('homiletics.regenerateConfirm.title')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t('homiletics.regenerateConfirm.description')}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>{t('homiletics.regenerateConfirm.cancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleGenerate}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                    {t('homiletics.regenerateConfirm.confirm')}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
            </>}
            navigationActions={<>
                {/* La primaria del paso conserva el texto; volver es ícono. */}
                <ToolbarIconButton label={t('homiletics.backToExegesis')} onClick={() => setStep(1)} variant="ghost">
                    <ArrowLeft className="h-4 w-4" />
                </ToolbarIconButton>
                <Button onClick={handleContinue} size="sm">
                    {t('homiletics.continueToDrafting')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </>}
        />
    );

    const leftPanel = !homiletics ? (
        <div className="h-full flex flex-col">
            <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2">
                    <Mic2 className="h-6 w-6 text-primary" />
                    <h2 className="text-2xl font-bold">{t('homiletics.title')}</h2>
                </div>
                <p className="text-muted-foreground">{t('homiletics.subtitle2')}</p>
            </div>

            <Card className="p-6 space-y-4 bg-muted/50 mb-6">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                    {t('homiletics.exegeticalBasis')}
                </h3>
                <p className="text-lg font-medium italic">"{exegesis.exegeticalProposition}"</p>
            </Card>

            <Card className="p-6 flex-1 flex flex-col justify-center">
                <div className="text-center space-y-6">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Mic2 className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold mb-2">{t('homiletics.readyToGenerate')}</h3>
                        <p className="text-sm text-muted-foreground">{t('homiletics.readyDesc')}</p>
                    </div>
                    <Button onClick={handleGenerate} disabled={loading} size="lg" className="w-full max-w-md mx-auto">
                        <Sparkles className="mr-2 h-4 w-4" />
                        {t('homiletics.generateBtn')}
                    </Button>
                </div>
            </Card>
        </div>
    ) : (
        // `flex-1 min-w-0`: esta columna es un ítem flex y sin crecer se ajusta
        // a su contenido. Al colapsar las tarjetas se encogía y dejaba una
        // franja muerta a la derecha, con la ventana a medio usar. `min-w-0`
        // permite que su contenido se recorte en vez de empujar el ancho.
        <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0">
                <ContentCanvas
                    content={formattedHomiletics}
                    contentType="homiletics"
                    // El editor del contrato es el CUERPO de la sección
                    // 'proposition', no un bloque aparte: así conserva refinar
                    // por chat, historial y undo/redo, y deja de duplicar en
                    // pantalla lo que la tarjeta ya mostraba.
                    sectionBodies={
                        homiletics
                            ? {
                                  proposition: (
                                      <PropositionContractPanel
                                          homiletics={homiletics}
                                          sermonPassage={passage}
                                          {...(semilla.genre ? { genre: semilla.genre } : {})}
                                          onApply={applyContract}
                                      />
                                  ),
                                  // El bosquejo era solo-lectura: no había
                                  // dónde el pastor escribiera su dirección
                                  // sobre cada punto, sólo pedírsela al chat.
                                  outline: (
                                      <OutlineDirectivePanel
                                          homiletics={homiletics}
                                          onApply={applyDirective}
                                      />
                                  ),
                              }
                            : {}
                    }
                    expandedSectionId={expandedSectionId}
                    onSectionExpand={(sectionId) => {
                        setExpandedSectionId(sectionId);
                        setMessages([]);
                    }}
                    onSectionClose={() => {
                        setExpandedSectionId(null);
                        setMessages([]);
                    }}
                    onSectionUndo={handleUndo}
                    onSectionRedo={handleRedo}
                    canUndo={(sectionId) => contentHistory.canUndo(sectionId)}
                    canRedo={(sectionId) => contentHistory.canRedo(sectionId)}
                    getSectionVersions={getSectionVersions}
                    getCurrentVersionId={getCurrentVersionId}
                    onRestoreVersion={handleRestoreVersion}
                    onSectionUpdate={handleSectionUpdate}
                    modifiedSections={modifiedSections}
                />
            </div>

        </div>
    );

    const rightPanel = !homiletics ? (
        <Card className="p-6 h-full flex flex-col justify-center">
            <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mic2 className="h-8 w-8 text-primary" />
                </div>
                <div>
                    <h3 className="font-semibold mb-2">{t('homiletics.whatIsTitle')}</h3>
                    <p className="text-sm text-muted-foreground">{t('homiletics.whatIsDesc')}</p>
                </div>
                <div className="pt-4 border-t">
                    <h4 className="font-medium text-sm mb-2">{t('homiletics.afterGenerateTitle')}</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 text-left">
                        {(t('homiletics.afterGenerateList', { returnObjects: true }) as string[]).map((item, i) => (
                            <li key={i}>• {item}</li>
                        ))}
                    </ul>
                </div>
            </div>
        </Card>
    ) : (
        <ResizableChatPanel storageKey="homileticsChatWidth">
            {rightPanelMode === 'bible' && exegesis ? (
                <BibleReaderPanel passage={exegesis.passage} onClose={() => setRightPanelMode('chat')} />
            ) : (
                <ChatInterface
                    frameless
                    messages={messages}
                    contentType="homiletics"
                    content={homiletics}
                    selectedText=""
                    onSendMessage={handleSendMessage}
                    onApplyChange={handleApplyChange}
                    onContentUpdate={setHomiletics}
                    disableDefaultAI={true}
                    externalIsLoading={isTotalAiLoading}
                    showStyleSelector={true}
                    selectedStyle={selectedStyle}
                    onStyleChange={(style) => {
                        setSelectedStyle(style);
                        generatorChatService.setCoachingStyle(style);
                    }}
                    activeContext={activeContext}
                    onRefreshContext={handleRefreshContext}
                />
            )}
        </ResizableChatPanel>
    );

    return (
        <>
            <HomileticsSavedIndicator visible={saving} />

            <WizardStepShell banner={<DerivedContextBanner stepHintKey="homileticsHint" />}>
            {!homiletics ? (
                <WizardLayout header={stepHeader} leftPanel={leftPanel} rightPanel={rightPanel} />
            ) : (
                <div className="h-full flex flex-col gap-4 overflow-hidden p-4">
                    {/* LA BANDA VA EN LAS DOS RAMAS. Con el bosquejo ya
                        desarrollado este paso arma su propia fila en vez de
                        usar `WizardLayout`, así que pasarle `header` al layout
                        sólo lo mostraba en el estado VACÍO: en la pantalla
                        donde el pastor trabaja de verdad no había ni pasaje ni
                        continuar. Mientras las dos ramas existan, lo que se
                        agregue arriba hay que ponerlo en las dos. */}
                    {stepHeader}
                    {/* Un marco, paneles pegados — patrón VS Code, igual que
                        el borrador y el taller. */}
                    <PanelGroup>
                        {leftPanel}
                        {rightPanel}
                    </PanelGroup>
                </div>
            )}
            </WizardStepShell>
        </>
    );
}
