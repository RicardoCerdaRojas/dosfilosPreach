import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Sprout } from 'lucide-react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { track } from '@/lib/analytics/track';
import { useFirebase } from '@/context/firebase-context';
import { useFacultyChat, useFacultySessions, useFacultyAgents, useSessionExtractions, useExtractionMutations } from '../../hooks/faculty';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';
import { type SermonOutline } from '@/components/faculty/SermonOutlinePreviewModal';
import { FacultySessionSidebar } from '@/components/faculty/FacultySessionSidebar';
import { FacultyExtractionPanel } from '@/components/faculty/FacultyExtractionPanel';
import { PanelDivider } from '@/components/ui/PanelDivider';
import { FacultyChatMessages } from '@/components/faculty/FacultyChatMessages';
import { FacultyChatInput } from '@/components/faculty/FacultyChatInput';
import { GuidedSermonHeader } from '@/components/faculty/GuidedSermonHeader';
import { useGuidedSermonIntegration } from './hooks/useGuidedSermonIntegration';
import { FacultyChatGuidedZone } from './components/FacultyChatGuidedZone';
import { GuidedGenreSelector } from './components/GuidedGenreSelector';
import { GuidedWordStudyHelper } from './components/GuidedWordStudyHelper';
import { GuidedCrossRefHelper } from './components/GuidedCrossRefHelper';
import { GuidedInsightHelper } from './components/GuidedInsightHelper';
import { FacultyChatModals } from './components/FacultyChatModals';
import { FacultyDocumentEditor } from '@/components/faculty/FacultyDocumentEditor';
import { type Extraction, type ExtractionType } from '@dosfilos/domain';
import { FacultyHomeContent } from './index';
import { copyMessageToClipboard } from './utils/copyMessageToClipboard';
import { useAutoscrollChat } from './hooks/useAutoscrollChat';
import { useAutoSendQuestion } from './hooks/useAutoSendQuestion';
import { useExtractionListHandlers } from './hooks/useExtractionListHandlers';
import { useExtractionAction } from './hooks/useExtractionAction';
import { useDocumentEditor } from './hooks/useDocumentEditor';
import { useSendMessage } from './hooks/useSendMessage';
import { useDeleteMessage } from './hooks/useDeleteMessage';
import { useResponseModePref } from './hooks/useResponseModePref';
import { toast } from 'sonner';

export function FacultyChatPage() {
    const { t } = useTranslation('faculty');
    const { t: tGuided } = useTranslation('guidedSermon');
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // ── Route state ──────────────────────────────────────────────────────────
    const isHomeState = !sessionId;
    const isNewSession = sessionId === 'new';
    const effectiveSessionId = isHomeState || isNewSession ? '' : (sessionId ?? '');

    // ── Hooks ────────────────────────────────────────────────────────────────
    const { user } = useFirebase();
    const { sessions, isLoading: isLoadingSessions, deleteSession: deleteSessionMutation, createSession, renameSession } = useFacultySessions();
    const { projects, deleteProject: deleteProjectMutation, assignToProject } = useFacultyProjects();
    const { data: agents = [] } = useFacultyAgents();
    const {
        session,
        isLoadingSession,
        sendOrchestratedMessage,
        isOrchestrating,
        activeAgents,
        streamingMessage,
        isStreaming,
        extractContent,
        generateAndSaveExtraction,
        deleteMessage,
        processMicroAction,
        isProcessingMicroAction,
    } = useFacultyChat(effectiveSessionId);

    // Persisted extractions for this session — drives the "Generados" tab.
    const { extractions, error: extractionsError, refetch: refetchExtractions } = useSessionExtractions(effectiveSessionId);
    const { updateMarkdown: updateExtractionMarkdown, rename: renameExtraction, addToProject: addExtractionToProject, removeFromProject: removeExtractionFromProject, deleteExtraction } = useExtractionMutations();

    const isSending = isOrchestrating;

    // ── Agent context for new sessions ───────────────────────────────────────
    const agentNameForNew = searchParams.get('agentName') ?? t('header.orchestratorFallbackName');
    const agentIdForNew = searchParams.get('agent') ?? '';
    /**
     * When the user lands here from a project workspace (link
     * `/dashboard/faculty?projectId=...`), we propagate that id into the new
     * session so the orchestrator scopes RAG to the project's `sourceIds` and
     * injects `contextNote` into every message.
     */
    const projectIdForNew = searchParams.get('projectId') ?? undefined;

    /**
     * Phase 4 enrichment refs. When the user lands here from a paper /
     * series / pericope CTA (e.g. `?paperId=abc&seriesId=xyz&pericopeId=123`),
     * we propagate those ids into the new session so the orchestrator
     * hydrates them on every turn and injects a compact context block
     * into the user message. Hidden behind the new-session branch only —
     * existing sessions already carry their context in Firestore.
     */
    const contextForNew = (() => {
        const paperId = searchParams.get('paperId') ?? undefined;
        const seriesId = searchParams.get('seriesId') ?? undefined;
        const pericopeId = searchParams.get('pericopeId') ?? undefined;
        if (!paperId && !seriesId && !pericopeId) return undefined;
        return { paperId, seriesId, pericopeId };
    })();

    // ── Local state ──────────────────────────────────────────────────────────
    const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(
        () => localStorage.getItem('faculty-sidebar') !== 'false'
    );
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(
        () => localStorage.getItem('faculty-extraction-panel') !== 'false'
    );
    useEffect(() => {
        localStorage.setItem('faculty-extraction-panel', String(isRightSidebarOpen));
    }, [isRightSidebarOpen]);

    // Empty-state default: when the user has zero sessions, close
    // ONLY the left rail (Mis Sesiones) — its content is genuinely
    // empty so the placeholder there is just noise. The right rail
    // (Recursos) stays open as an affordance preview: the cards
    // surface what tools the user will get once they start a
    // session. They render disabled (already gated by messageCount < 2
    // in the panel) with a tooltip explaining the precondition.
    // Persisted choice always wins — we only intervene on first visit.
    const hasAppliedEmptyStateDefault = useRef(false);
    useEffect(() => {
        if (hasAppliedEmptyStateDefault.current) return;
        if (isLoadingSessions) return;
        hasAppliedEmptyStateDefault.current = true;
        if (sessions.length > 0) return;

        if (localStorage.getItem('faculty-sidebar') === null) {
            setIsLeftSidebarOpen(false);
        }
    }, [isLoadingSessions, sessions.length]);

    // Auto-collapse the global app sidebar when the user enters the
    // Faculty layout, since the page already has its own 3-panel chrome
    // (Mis Sesiones | center | Recursos) and the global nav competes
    // for horizontal space. Captures the user's previous state on
    // mount and restores it on unmount, so leaving Faculty puts the
    // sidebar back where they had it.
    const { open: appSidebarOpen, setOpen: setAppSidebarOpen } = useSidebar();
    const previousAppSidebarOpenRef = useRef<boolean | null>(null);
    useEffect(() => {
        previousAppSidebarOpenRef.current = appSidebarOpen;
        setAppSidebarOpen(false);
        return () => {
            if (previousAppSidebarOpenRef.current) {
                setAppSidebarOpen(true);
            }
        };
        // Mount-once capture; intentional dep-list omission.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Mode preference is shared with the directory landing input via
    // localStorage so the choice the user makes in either surface
    // carries to the other (the chat session inherits the home pick
    // and vice-versa).
    const [lengthPreference, setLengthPreference] = useResponseModePref();
    // Los anchos viven en estado para que el PanelDivider los redimensione
    // them by mutating these. Sane defaults match the previous
    // hardcoded `w-64` / `w-[28rem]`; clamps live in the resize
    // handler below.
    const [leftRailWidth, setLeftRailWidth] = useState(256);
    const [rightRailWidth, setRightRailWidth] = useState(448);
    const [sermonOutline, setSermonOutline] = useState<SermonOutline | null>(null);
    const [emailDialogExtraction, setEmailDialogExtraction] = useState<Extraction | null>(null);
    const [wpDialogExtraction, setWpDialogExtraction] = useState<Extraction | null>(null);
    const [projectDialog, setProjectDialog] = useState<{ mode: 'create' } | { mode: 'edit'; project: AIProject } | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [renameConfirmId, setRenameConfirmId] = useState<string | null>(null);

    // Unified document editor state. Either an in-memory sermon (the
    // sermons module owns its own collection — we just render the
    // markdown returned by the wizard modal) or a persisted Extraction.
    // Mutually exclusive sources; `closeDocument()` resets both. The
    // editor also autosaves extraction edits via debounced mutation.
    const {
        documentSource,
        documentExtractionId,
        documentTitle,
        documentMarkdown,
        isDocumentOpen,
        isZenMode,
        setDocumentTitle,
        setDocumentMarkdown,
        setIsZenMode,
        openExtractionInEditor,
        openSermonPreview,
        closeDocument,
    } = useDocumentEditor({
        extractions,
        updateExtractionMarkdown,
        onOpen: () => {
            // Reclaim horizontal space: both side rails collapse when a
            // document opens. User can re-expand from the header toggles.
            setIsLeftSidebarOpen(false);
            setIsRightSidebarOpen(false);
        },
    });

    // ── Scroll management ────────────────────────────────────────────────────
    const { messagesEndRef, chatScrollRef, scrollToBottom } = useAutoscrollChat([
        streamingMessage,
        session?.messages,
    ]);

    // ── Send + delete message hooks ──────────────────────────────────────────
    const {
        input,
        setInput,
        pendingAttachment,
        setPendingAttachment,
        handleSendMessage,
    } = useSendMessage({
        isNewSession,
        isSending,
        isStreaming,
        agentIdForNew,
        agents,
        projectIdForNew,
        contextForNew,
        lengthPreference,
        scrollToBottom,
        navigate,
        createSession,
        sendOrchestratedMessage,
    });

    // Phase 2.5 PR B (ADR-028) — Faculty Socratic Sermon Agent integration.
    // Owns: guided-mode detection, activation prompt state, send fork.
    const guidedIntegration = useGuidedSermonIntegration({
        session,
        effectiveSessionId,
        setInput,
        createSession,
        agentIdForNew,
        agents,
        navigate,
    });

    // Wrap the submit so guided turns route through the Socratic agent.
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const handled = await guidedIntegration.trySocraticSubmit(input);
        if (handled) return;
        await handleSendMessage(e);
    };

    const {
        deleteMessageConfirmId,
        deletingMessageId,
        requestDeleteMessage,
        cancelDelete: cancelDeleteMessage,
        handleConfirmDeleteMessage,
    } = useDeleteMessage({ deleteMessage });

    // ── Auto-send initial question from ?q= or sessionStorage ────────────────
    useAutoSendQuestion({
        isNewSession,
        effectiveSessionId,
        session,
        isSending,
        isStreaming,
        agentIdForNew,
        agents,
        projectIdForNew,
        contextForNew,
        lengthPreference,
        searchParams,
        setSearchParams,
        navigate,
        createSession,
        sendOrchestratedMessage,
        setInput,
    });

    // ── Handlers ─────────────────────────────────────────────────────────────

    const toggleSidebar = () => {
        setIsLeftSidebarOpen(prev => {
            const next = !prev;
            localStorage.setItem('faculty-sidebar', String(next));
            return next;
        });
    };

    const handleRename = (id: string, newTitle: string) => {
        if (!newTitle.trim()) { setRenameConfirmId(null); return; }
        // El título cambia en el riel al soltar el editor (escritura
        // optimista). Si el servidor rechaza, vuelve el anterior y hay
        // que decirlo: un título que se revierte solo parece un fallo
        // del editor.
        renameSession.mutate({ sessionId: id, title: newTitle.trim() }, {
            onError: () => toast.error(t('railErrors.sessionRename')),
        });
        setRenameConfirmId(null);
    };

    const { extractingType, handleExtract } = useExtractionAction({
        effectiveSessionId,
        session,
        isDocumentOpen,
        extractContent,
        generateAndSaveExtraction,
        setSermonOutline,
        openExtractionInEditor,
        // Phase 2.5 PR B reroute (ADR-028): under the `study_depth` flag the
        // SERMON-outline preview flow is replaced by the guided-sermon
        // agent activation. Returns `true` to short-circuit the legacy
        // preview path.
        sermonGuidedOverride: () => {
            if (guidedIntegration.isFlagEnabled && !guidedIntegration.hasGuidedSession) {
                guidedIntegration.openActivationPrompt();
                return true;
            }
            return false;
        },
    });

    // ── Extraction list handlers (panel "Generados" tab) ─────────────────────
    const {
        handleRenameExtraction,
        handleAddExtractionToProject,
        handleRemoveExtractionFromProject,
        handleDeleteExtraction,
        handleJumpToOrigin,
        confirmDialog: extractionConfirmDialog,
    } = useExtractionListHandlers({
        documentExtractionId,
        effectiveSessionId,
        navigate,
        setDocumentTitle,
        closeDocument,
        renameExtraction,
        addExtractionToProject,
        removeExtractionFromProject,
        deleteExtraction,
    });

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-[calc(100vh-var(--alto-barra))] bg-muted/30 font-sans">
            {/*
             * No global page header. Rail toggles live as edge-tabs
             * on each rail (FacultySessionSidebar / FacultyExtractionPanel),
             * the mode selector is colocated with the input it
             * affects, and the session context (back arrow + title)
             * is rendered as a thin sticky strip inside the message
             * area below — only when there's an actual session.
             */}

            <div className="flex-1 flex overflow-hidden">
                {/* Left sidebar */}
                <FacultySessionSidebar
                    isOpen={isLeftSidebarOpen}
                    width={leftRailWidth}
                    sessions={sessions}
                    projects={projects}
                    activeSessionId={effectiveSessionId || undefined}
                    isLoading={isLoadingSessions}
                    renameConfirmId={renameConfirmId}
                    onNewConversation={() => navigate(
                        projectIdForNew
                            ? `/dashboard/faculty/new?projectId=${projectIdForNew}`
                            : '/dashboard/faculty/new'
                    )}
                    onNewProject={() => setProjectDialog({ mode: 'create' })}
                    onNavigateSession={(id) => navigate(`/dashboard/faculty/${id}`)}
                    onDeleteSession={(id) => setDeleteConfirmId(id)}
                    onRenameSession={(id) => setRenameConfirmId(id)}
                    onSaveRename={handleRename}
                    onCancelRename={() => setRenameConfirmId(null)}
                    onAssignToProject={(sid, pid) => assignToProject.mutate({ sessionId: sid, projectId: pid }, {
                        onError: () => toast.error(t('railErrors.sessionAssign')),
                    })}
                    onEditProject={(project) => setProjectDialog({ mode: 'edit', project })}
                    onDeleteProject={(pid) => deleteProjectMutation.mutate(pid, {
                        onError: () => toast.error(t('railErrors.projectDelete')),
                    })}
                />

                {/*
                 * Divisor del riel IZQUIERDO. Clic alterna; arrastrar
                 * redimensiona (entre 200 y 400). Con el riel cerrado el
                 * arrastre se desactiva: sólo el clic abre.
                 *
                 * MISMO DIVISOR QUE EL RESTO DE LA APLICACIÓN. Faculty usaba
                 * `RailDivider`, que reservaba 12px de ancho en el layout con
                 * la línea "centrada" adentro — o sea, un hueco entre paneles
                 * con una raya en medio. `PanelDivider` ocupa 1px REAL y ES el
                 * borde compartido, así que queda centrado por construcción y
                 * los paneles quedan pegados.
                 */}
                <PanelDivider
                    panelSide="left"
                    isOpen={isLeftSidebarOpen}
                    onToggle={toggleSidebar}
                    onResize={isLeftSidebarOpen
                        ? (delta) => setLeftRailWidth(w => Math.min(400, Math.max(200, w + delta)))
                        : undefined
                    }
                    title={t('sidebar.openPanel')}
                />

                <div className="flex-1 flex overflow-hidden">
                    {/* Two-panel layout when an extracted document is open.
                        Resizable horizontally so the user can give more
                        space to the chat (skim reference messages while
                        editing the doc) or to the editor (full-document
                        focus). Persisted via `autoSaveId` so the split
                        survives reloads. */}
                    <PanelGroup
                        orientation="horizontal"
                        id="faculty-chat-doc-split"
                        className="w-full h-full"
                    >
                        {/* Main chat area */}
                        {!(isDocumentOpen && isZenMode) && (
                            <Panel defaultSize={isDocumentOpen ? 50 : 100} minSize={25} id="chat">
                                <main className="flex flex-col h-full min-w-0 relative">
                                    {isHomeState ? (
                                        <div className="flex-1 overflow-y-auto">
                                            <FacultyHomeContent />
                                        </div>
                                    ) : isLoadingSession && !isNewSession ? (
                                        <div className="flex-1 flex items-center justify-center">
                                            <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                                <p className="text-sm">{t('chat.loadingConversation')}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {/*
                                             * Compact session strip — replaces the
                                             * old global page header in session view.
                                             * Sticky at the top of the scroll area
                                             * so the user always has back-to-home
                                             * affordance + session title without a
                                             * full chrome bar.
                                             */}
                                            <div className="sticky top-0 z-10 flex items-center gap-2 px-4 md:px-8 py-2 bg-background/80 backdrop-blur border-b border-border">
                                                <button
                                                    onClick={() => navigate('/dashboard/faculty')}
                                                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                                    title={t('header.backToHome')}
                                                    aria-label={t('header.backToHome')}
                                                >
                                                    <ArrowLeft className="w-4 h-4" />
                                                </button>
                                                <h1 className="text-sm font-semibold leading-none truncate">
                                                    {isNewSession ? agentNameForNew : (session?.title || t('header.sessionActive'))}
                                                </h1>
                                                {isNewSession && (
                                                    <span className="text-[11px] text-muted-foreground ml-1 hidden sm:inline">
                                                        · {t('header.newSession')}
                                                    </span>
                                                )}
                                            </div>
                                            {session?.guidedSermonSession && (
                                                <GuidedSermonHeader
                                                    session={session.guidedSermonSession}
                                                    onPause={guidedIntegration.pause}
                                                    onResume={guidedIntegration.resume}
                                                    onOpenWizard={guidedIntegration.openCompletedWizard}
                                                />
                                            )}
                                            <div ref={chatScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-8 py-8 space-y-6 scroll-smooth pb-40">
                                                <div className="max-w-3xl mx-auto space-y-6 w-full">
                                                    <FacultyChatGuidedZone
                                                        activationPromptOpen={guidedIntegration.activationPromptOpen}
                                                        isProcessing={guidedIntegration.isProcessing}
                                                        closeActivationPrompt={guidedIntegration.closeActivationPrompt}
                                                        activate={guidedIntegration.activate}
                                                    />
                                                    <FacultyChatMessages
                                                        messages={session?.messages || []}
                                                        isNewSession={isNewSession}
                                                        isStreaming={isStreaming}
                                                        isSending={isSending || guidedIntegration.isProcessing}
                                                        deletingMessageId={deletingMessageId}
                                                        streamingMessage={streamingMessage}
                                                        activeAgents={activeAgents}
                                                        agentNameForNew={agentNameForNew}
                                                        onRequestDeleteMessage={requestDeleteMessage}
                                                        onCopyMessage={(content, messageId) => copyMessageToClipboard(content, messageId, t)}
                                                        sessionId={isNewSession ? undefined : effectiveSessionId}
                                                    />
                                                    {guidedIntegration.isGuidedActive
                                                        && session?.guidedSermonSession?.currentStep === 'contextGenre'
                                                        && session.guidedSermonSession.passage && (
                                                        <GuidedGenreSelector
                                                            passage={session.guidedSermonSession.passage}
                                                            onPronounce={(genre) =>
                                                                guidedIntegration.pronounceGenre(genre)
                                                            }
                                                            busy={guidedIntegration.isProcessing}
                                                        />
                                                    )}
                                                    {guidedIntegration.isGuidedActive
                                                        && session?.guidedSermonSession?.currentStep === 'wordStudies'
                                                        && session.guidedSermonSession.passage && (
                                                        <GuidedWordStudyHelper
                                                            passage={session.guidedSermonSession.passage}
                                                            onSubmit={(args) => guidedIntegration.submitWordStudies(args)}
                                                            busy={guidedIntegration.isProcessing}
                                                        />
                                                    )}
                                                    {guidedIntegration.isGuidedActive
                                                        && session?.guidedSermonSession?.currentStep === 'recognition'
                                                        && session.guidedSermonSession.passage && (
                                                        <GuidedCrossRefHelper
                                                            passage={session.guidedSermonSession.passage}
                                                            onInsert={(text) => setInput(input ? `${input}\n${text}` : text)}
                                                            busy={guidedIntegration.isProcessing}
                                                        />
                                                    )}
                                                    {guidedIntegration.isGuidedActive
                                                        && session?.guidedSermonSession?.currentStep === 'insight' && (
                                                        <GuidedInsightHelper
                                                            onSubmit={(args) => guidedIntegration.submitInsight(args)}
                                                            busy={guidedIntegration.isProcessing}
                                                            seedId={session.guidedSermonSession.seedId}
                                                        />
                                                    )}
                                                    <div ref={messagesEndRef} />
                                                </div>
                                            </div>

                                            <FacultyChatInput
                                                input={input}
                                                isSending={isSending}
                                                isStreaming={isStreaming}
                                                isLoading={isLoadingSession}
                                                streamingMessage={streamingMessage}
                                                isHidden={isHomeState}
                                                onInputChange={setInput}
                                                onSubmit={handleSubmit}
                                                attachment={pendingAttachment}
                                                onAttach={setPendingAttachment}
                                                lengthPreference={lengthPreference}
                                                onSetLengthPreference={setLengthPreference}
                                                leadingAction={
                                                    guidedIntegration.isFlagEnabled && !guidedIntegration.hasGuidedSession ? (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={guidedIntegration.openActivationPrompt}
                                                            className="h-7 gap-1.5 text-xs text-success hover:text-success hover:bg-success/10"
                                                            title={tGuided('cta.startGuided')}
                                                        >
                                                            <Sprout className="h-3.5 w-3.5" />
                                                            <span className="hidden sm:inline">{tGuided('cta.startGuided')}</span>
                                                        </Button>
                                                    ) : null
                                                }
                                            />
                                        </>
                                    )}
                                </main>
                            </Panel>
                        )}

                        {/* Resize handle — visible only when both panels
                            are shown (document open, not in zen mode). */}
                        {isDocumentOpen && !isZenMode && (
                            <PanelResizeHandle className="w-1 bg-border hover:bg-primary/40 active:bg-primary/60 transition-colors cursor-col-resize" />
                        )}

                        {/* Document editor panel. Single source of truth
                            for both ephemeral sermons (from the wizard
                            modal) and persisted extractions (from the
                            "Generados" tab). Title + close + view toggle
                            + copy buttons live in the editor toolbar. */}
                        {isDocumentOpen && (
                            <Panel
                                defaultSize={isZenMode ? 100 : 50}
                                minSize={30}
                                id="document"
                            >
                                <aside className="flex flex-col h-full bg-background shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10 relative border-l">
                                    <div className="flex-1 overflow-hidden bg-background">
                                        <FacultyDocumentEditor
                                            // Remount on artifact swap so MDXEditor
                                            // reads the fresh markdown. Without this,
                                            // selecting a second artifact from the
                                            // Generados list keeps the editor showing
                                            // the previously-loaded body. The
                                            // 'sermon-preview' branch covers the
                                            // ephemeral sermon flow from the wizard.
                                            key={documentExtractionId ?? 'sermon-preview'}
                                            title={documentTitle}
                                            onClose={closeDocument}
                                            markdown={documentMarkdown}
                                            onChange={setDocumentMarkdown}
                                            onMicroAction={(actionType, selectedText, context, customPrompt) => processMicroAction({ actionType, selectedText, documentContext: context, customPrompt })}
                                            isProcessing={isProcessingMicroAction}
                                            isZenMode={isZenMode}
                                            onToggleZenMode={() => setIsZenMode(prev => !prev)}
                                        />
                                    </div>
                                </aside>
                            </Panel>
                        )}
                    </PanelGroup>
                </div>

                {/*
                 * Divisor del panel DERECHO. Mismo patrón que el izquierdo:
                 * clic alterna, arrastrar redimensiona (entre 360 y 640).
                 */}
                <PanelDivider
                    panelSide="right"
                    isOpen={isRightSidebarOpen}
                    onToggle={() => setIsRightSidebarOpen(prev => !prev)}
                    onResize={isRightSidebarOpen
                        ? (delta) => setRightRailWidth(w => Math.min(640, Math.max(360, w + delta)))
                        : undefined
                    }
                    title={t('extraction.openPanel')}
                />

                {/* Right extraction panel */}
                <FacultyExtractionPanel
                    isOpen={isRightSidebarOpen}
                    width={rightRailWidth}
                    extractingType={extractingType}
                    messageCount={session?.messages.length || 0}
                    onExtract={handleExtract}
                    extractions={extractions}
                    selectedExtractionId={documentExtractionId}
                    onSelectExtraction={(extraction) => {
                        track('faculty_artifact_opened_from_library', {
                            type: extraction.type,
                            ageHours: Math.round((Date.now() - extraction.createdAt.getTime()) / 3_600_000),
                            sameSession: extraction.sessionId === effectiveSessionId,
                        });
                        openExtractionInEditor(extraction);
                    }}
                    onDeleteExtraction={handleDeleteExtraction}
                    onRenameExtraction={handleRenameExtraction}
                    onAddExtractionToProject={handleAddExtractionToProject}
                    onRemoveExtractionFromProject={handleRemoveExtractionFromProject}
                    projects={projects}
                    onJumpToOrigin={handleJumpToOrigin}
                    onOpenExternal={(extraction) => {
                        if (extraction.externalRef?.collection === 'sermons') {
                            navigate(`/dashboard/sermons/${extraction.externalRef.id}`);
                        }
                    }}
                    onShareByEmail={setEmailDialogExtraction}
                    onPublishToWordpress={setWpDialogExtraction}
                    extractionsError={extractionsError}
                    onRefreshExtractions={() => refetchExtractions()}
                    sessionId={isNewSession ? undefined : effectiveSessionId}
                    userId={user?.uid}
                    onEstudioCreated={() => refetchExtractions()}
                    onEstudioOpen={(extraction) => openExtractionInEditor(extraction)}
                />
            </div>

            <FacultyChatModals
                sermonOutline={sermonOutline}
                onSetSermonOutline={setSermonOutline}
                session={session}
                effectiveSessionId={effectiveSessionId}
                userId={user?.uid}
                onSermonGenerated={(sermonId) => navigate(`/dashboard/sermons/generate?id=${sermonId}`)}
                projectDialog={projectDialog}
                onCloseProjectDialog={() => setProjectDialog(null)}
                emailDialogExtraction={emailDialogExtraction}
                onCloseEmailDialog={() => setEmailDialogExtraction(null)}
                wpDialogExtraction={wpDialogExtraction}
                onCloseWpDialog={() => setWpDialogExtraction(null)}
                deleteConfirmId={deleteConfirmId}
                onCloseDeleteSession={() => setDeleteConfirmId(null)}
                onConfirmDeleteSession={() => {
                    if (deleteConfirmId) {
                        deleteSessionMutation.mutate(deleteConfirmId, {
                            onError: () => toast.error(t('railErrors.sessionDelete')),
                        });
                        setDeleteConfirmId(null);
                    }
                }}
                deleteMessageConfirmId={deleteMessageConfirmId}
                onCloseDeleteMessage={cancelDeleteMessage}
                onConfirmDeleteMessage={handleConfirmDeleteMessage}
            />

            {extractionConfirmDialog}
        </div>
    );
}
