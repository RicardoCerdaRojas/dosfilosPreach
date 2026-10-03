import { useState } from 'react';
import { countReadySections } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { CitationManifestContext } from '@/lib/citationMarkers';
import { ContraScanModal } from '@/components/sermons/ContraScanModal';
import { SermonCitationVerificationDialog } from '@/components/sermons/SermonCitationVerificationDialog';
import { DerivedContextBanner } from './DerivedContextBanner';
import { SermonPersonalizationPanel } from './SermonPersonalizationPanel';
import { WizardStepShell } from './WizardStepShell';
import { HomileticsSavedIndicator } from './homiletics/HomileticsLoadingScreen';
import { useDraftStep } from './draft/useDraftStep';
import { WorkshopActions, WorkshopPanel } from './draft/WorkshopSurfaces';
import { DraftPathChooser } from './draft/DraftPathChooser';
import { DraftStepHeader } from './draft/DraftStepHeader';
import { DraftCanvasPanel } from './draft/DraftCanvasPanel';
import { DraftPreviewDialog } from './draft/DraftPreviewDialog';
import { DraftWorkspace } from './draft/DraftWorkspace';
import { ConsultPanel } from './draft/ConsultPanel';
import { ExternalProposalsProvider } from './draft/externalProposals';
import { DraftLoadingScreen } from './draft/DraftLoadingScreen';
import { EmptyDraftNotice } from './draft/EmptyDraftNotice';

/**
 * Paso de Redacción: el taller de decisiones y el borrador, en un solo paso.
 *
 * ESTE ARCHIVO SÓLO DECIDE QUÉ SE MUESTRA. Llegó a tener 1.319 líneas porque
 * cada capacidad nueva se sumaba adentro: generar, publicar, verificar citas,
 * medir, regenerar un punto y dibujar tres pantallas convivían en un componente.
 * Cada arreglo se volvió cirugía, y un `useMemo` que quedó bajo un retorno
 * temprano tiró el paso entero con "Rendered fewer hooks than expected".
 *
 * Ahora los datos y las acciones viven en `useDraftStep`, cada responsabilidad
 * tiene su módulo en `draft/`, y acá queda la composición: tres superficies —la
 * banda, el borrador y el taller— más las dos compuertas antes de publicar.
 */
export function StepDraft() {
    const { t, language } = useTranslation('generator');
    const paso = useDraftStep(t, language === 'en' ? 'en' : 'es');
    const { homiletics, exegesis, draft, canvas, publicacion } = paso;
    // El chat de consulta (hallazgo 32): antes de los retornos tempranos.
    const [consultando, setConsultando] = useState(false);

    if (!homiletics) return <div>{t('drafting.errors.noHomiletics')}</div>;
    if (paso.loading) return <DraftLoadingScreen />;

    const taller = paso.hayTaller ? (
        <WorkshopPanel
            walk={paso.socraticWalk}
            activeSection={paso.activeSection}
            homiletics={homiletics}
            exegesis={exegesis}
            elements={paso.sectionElements}
            prose={paso.sectionProse}
            audienceRigor={paso.rules.audienceRigor}
            manuscriptStyle={paso.manuscriptStyle}
            passage={paso.passage}
            onSelectSection={paso.setActiveSectionId}
            onChangeElements={paso.setSectionElements}
            onChangeProse={paso.setSectionProse}
        />
    ) : null;

    const stepHeader = (
        <DraftStepHeader
            activeTab={paso.activeTab}
            hasWorkshop={paso.hayTaller}
            title={draft?.title || t('drafting.title')}
            readySections={{
                done: countReadySections(paso.socraticWalk, paso.sectionElements),
                total: paso.socraticWalk.length,
            }}
            assembledFrom={draft?.assembledFrom}
            passage={paso.passage}
            onTogglePassage={canvas.togglePassage}
            generating={paso.loading}
            workshopHasDecisions={paso.hayDecisiones}
            onGoToWorkshop={() => paso.setActiveTab('workshop')}
            onRegenerate={(opciones) => void paso.generar(opciones)}
            workshopActions={
                <WorkshopActions
                    walk={paso.socraticWalk}
                    homiletics={homiletics}
                    exegesis={exegesis}
                    elements={paso.sectionElements}
                    prose={paso.sectionProse}
                    audienceRigor={paso.rules.audienceRigor}
                    manuscriptStyle={paso.manuscriptStyle}
                    hasDraft={!!draft}
                    onProseChange={paso.setSectionProse}
                    onAssemble={paso.armarBorrador}
                />
            }
            onConsult={() => setConsultando(true)}
            onBack={() => paso.setStep(2)}
            onPreview={() => paso.setShowPreview(true)}
            onSaveAndExit={publicacion.guardarYSalir}
            onPublish={publicacion.publicar}
            publishing={publicacion.publishing}
            scanning={publicacion.contraScan.scanning}
            canPublish={Boolean(paso.sermonId)}
        />
    );

    const draftBody = draft ? (
        <DraftCanvasPanel
            draft={draft}
            {...canvas.canvasProps}
            onSendMessage={paso.refinamiento.handleSendMessage}
            isAiLoading={paso.refinamiento.isAiProcessing || paso.isChatLoading}
        />
    ) : (
        <EmptyDraftNotice />
    );

    const leftPanel = paso.mostrarSelector ? (
        <DraftPathChooser
            personalization={<SermonPersonalizationPanel />}
            proposition={homiletics.homileticalProposition}
            pointTitles={(homiletics.outline?.mainPoints ?? []).map((p: any) => p.title).filter(Boolean)}
            onEnterWorkshop={
                taller
                    ? () => {
                          paso.setCaminoElegido(true);
                          paso.setActiveTab('workshop');
                      }
                    : undefined
            }
            onGenerate={() => void paso.generar()}
            generating={paso.loading}
        />
    ) : (
        <DraftWorkspace
            activeTab={paso.activeTab}
            onTabChange={paso.setActiveTab}
            header={stepHeader}
            draftBody={draftBody}
            workshop={taller}
        />
    );

    const seccionAbierta = paso.hayTaller && paso.activeSection
        ? {
              id: paso.activeSection.id,
              label: t(paso.activeSection.labelKey, paso.activeSection.labelParams),
              pointTitle: paso.activeSection.parentLabel,
          }
        : null;

    return (
        <ExternalProposalsProvider>
            <HomileticsSavedIndicator visible={paso.saving} />
            <ConsultPanel
                open={consultando}
                onOpenChange={setConsultando}
                passage={paso.passage}
                proposition={homiletics.homileticalProposition}
                section={seccionAbierta}
            />

            <WizardStepShell banner={<DerivedContextBanner stepHintKey="draftHint" />}>
                {/* ADR-031 — el manifiesto de citas hace que las anclas [N] del
                    editor se rendericen como popovers verificables. */}
                <CitationManifestContext.Provider value={draft?.citationManifest}>
                    {leftPanel}
                </CitationManifestContext.Provider>
            </WizardStepShell>

            <DraftPreviewDialog
                open={paso.showPreview}
                onOpenChange={paso.setShowPreview}
                draft={draft}
                exegesis={exegesis}
                homiletics={homiletics}
                fullContent={paso.showPreview ? paso.getFullContent() : ''}
                authorName={paso.user?.displayName}
            />

            {/* «Versión nueva (la N)» al re-publicar algo que cambió (#2). */}
            {publicacion.confirmDialog}

            {/* Compuerta 1 — contra-scan antes de publicar (Fase 4 PR 1, ADR-033) */}
            <ContraScanModal
                open={publicacion.contraScan.modalOpen}
                onOpenChange={publicacion.contraScan.setModalOpen}
                centralIdea={publicacion.contraScan.centralIdea}
                dissentingChunks={publicacion.contraScan.dissentingChunks}
                publishing={publicacion.contraScan.persisting}
                onProceed={publicacion.contraScan.confirmProceed}
                onConsider={publicacion.contraScan.confirmConsideration}
                onOverride={publicacion.contraScan.confirmOverride}
            />

            {/* Compuerta 2 — verificación de citas (PR #218) */}
            <SermonCitationVerificationDialog
                open={publicacion.verificationDialogOpen}
                onOpenChange={publicacion.setVerificationDialogOpen}
                result={publicacion.verificationResult}
                loading={publicacion.verifying}
                onProceedAnyway={publicacion.publicarAhora}
                onEditSermon={() => publicacion.setVerificationDialogOpen(false)}
            />
        </ExternalProposalsProvider>
    );
}
