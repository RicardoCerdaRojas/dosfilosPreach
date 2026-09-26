import { useState, useEffect, useMemo } from 'react';
import {
    Wand2,
    Loader2,
    CheckCircle2,
    RotateCcw,
    Pencil,
    AlertCircle,
    Save,
    BookOpen,
    Bookmark,
    BookText,
    Layers,
    ChevronDown,
    ChevronRight,
    NotebookPen,
    ShieldCheck,
    MoreVertical,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { useReopenStep } from '@/hooks/exegesis/useReopenStep';
import { CanonicalAnalysisStudyView } from '@/components/exegesis/canonical/CanonicalAnalysisStudyView';
import { CitationSourceModal, type CitationTarget } from '@/components/exegesis/citation/CitationSourceModal';
import { VerseRecomposeDialog } from '@/components/exegesis/VerseRecomposeDialog';
import { RegenerateStepDialog } from '@/components/exegesis/RegenerateStepDialog';
import { Link, useNavigate } from 'react-router-dom';
import { assemblyContents, isUnreviewedCitationsError, parseBriefQuestions, questionsForVerse, unansweredQuestions } from '@dosfilos/domain';
import type { AssemblyContents, AssemblyPart, PaperFormatting } from '@dosfilos/domain';
import { CitationVerificationDialog } from '@/components/exegesis/CitationVerificationDialog';
import { ExegesisOutOfCreditsDialog } from '@/components/exegesis/ExegesisOutOfCreditsDialog';
import { ExegesisPreConfirmDialog } from '@/components/exegesis/ExegesisPreConfirmDialog';
import {
    ComposeSectionPrecheckDialog,
    type ComposeSectionPrecheckMissing,
} from '@/components/exegesis/ComposeSectionPrecheckDialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreditPacksDialog } from '@/pages/library/components/CreditPacksDialog';
import {
    formatPassageReference,
    isAbandonedGeneration,
    ABANDONED_GENERATION_AFTER_MS,
    operationRequiresPreConfirm,
    type ExegesisOperationKey,
    type ExegeticalStep,
    type SupportedLanguage,
    type VerifiedCitation,
    type VerificationSummary,
} from '@dosfilos/domain';

interface StepCardProps {
    step: ExegeticalStep;
    paperId: string;
    language: SupportedLanguage;
    /**
     * Sibling steps in the paper. Needed by section composers
     * (conclusion / introduction) to pre-check verse acceptance
     * before dispatching the mutation. Optional for backwards
     * compatibility with callers that only render verse cards.
     */
    allSteps?: ReadonlyArray<ExegeticalStep>;
    /** El encuadre del trabajo, para decir qué pregunta responde cada paso. */
    assignmentBrief?: string | null;
    /** Si el trabajo ya está ensamblado: decide si recomponer lo alcanza. */
    hasAssembly?: boolean;
    /** Palabras que le tocan a este verso según la rúbrica, si la hay. */
    targetWordsPerVerse?: number | null;
    /** El formato de la entrega: decide cuántas palabras entran en la página. */
    formatting?: PaperFormatting | null;
}

/**
 * One step in the wizard timeline. Renders state-specific UI:
 *
 *   pending          → "Generate" button only
 *   generating       → spinner with "Generating..." label
 *   awaiting-review  → markdown preview + 4 actions (Accept / Regenerate /
 *                      Hint+Regenerate / Edit manually)
 *   accepted         → markdown preview + "Edit" link (no Generate; the
 *                      user can still edit a prior accepted version)
 *   failed           → error banner with "Try again" → goes back to pending
 *
 * Edit mode swaps the preview for a textarea + Save/Cancel buttons.
 *
 * The `state` field is the source of truth — UI never derives state from
 * version count or other heuristics. This keeps the component dumb and
 * the state machine debuggable from inspecting the Firestore doc alone.
 *
 * LA ÚNICA EXCEPCIÓN, y va escrita porque contradice el párrafo de arriba: un
 * `generating` más viejo que `ABANDONED_GENERATION_AFTER_MS` se renderiza como
 * `failed`. No es una heurística sobre el contenido —eso sigue prohibido— sino
 * sobre el reloj, y existe porque `generating` lo escribe el navegador y sólo
 * el navegador lo limpia: si la pestaña muere en el medio, la bandera queda
 * huérfana y la tarjeta gira para siempre. Pasó en producción, tres horas.
 * El documento sigue siendo legible por sí solo: dice `generating`, y el
 * `updatedAt` que está al lado dice desde cuándo.
 */
/**
 * Qué entra al documento y qué se queda fuera.
 *
 * El ensamblador volcaba el análisis estructurado de los versículos sin prosa
 * «para que el ensamble nunca sea sólo intro + conclusión». Ese miedo era
 * legítimo —que el autor descubriera la ausencia al abrir el archivo— y la
 * respuesta era la equivocada: informar no ensucia el entregable, volcar sí.
 * Esta lista es la respuesta correcta al mismo miedo.
 *
 * Lee la MISMA función que usa el ensamblador, así la lista y el archivo no
 * pueden discrepar.
 */
function AssemblyManifest({ contents, paperId, preguntas }: {
    contents: AssemblyContents;
    paperId: string;
    preguntas: ReturnType<typeof parseBriefQuestions>;
}) {
    const { t } = useTranslation('exegesis');
    const { setStepInclusion } = useExegesisPapers();

    const fila = (p: AssemblyPart, estado: 'in' | 'pending' | 'out') => (
        <li key={p.stepId} className="flex items-baseline gap-2 text-[12px]">
            <input
                type="checkbox"
                id={`inc-${p.stepId}`}
                checked={estado !== 'out'}
                onChange={(e) => setStepInclusion.mutate(
                    { paperId, stepId: p.stepId, include: e.target.checked },
                    { onError: () => toast.error(t('detail.steps.assembly.toggleFailed')) },
                )}
                className="mt-0.5 shrink-0 rounded border-border"
            />
            <label
                htmlFor={`inc-${p.stepId}`}
                className={cn('flex-1 truncate cursor-pointer',
                    estado === 'out' ? 'text-muted-foreground line-through' : 'text-foreground')}
            >
                {p.label}
            </label>
            <span className="text-[11px] tabular-nums text-muted-foreground">
                {estado === 'pending'
                    ? t('detail.steps.assembly.pendingMark')
                    : estado === 'out'
                        ? ''
                        : t('detail.steps.assembly.words', { count: p.words })}
            </span>
        </li>
    );

    return (
        <div className="mb-4 rounded-lg border border-border bg-muted/40 px-3 py-2.5 space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('detail.steps.assembly.manifestTitle', { count: contents.words })}
            </p>
            <ul className="space-y-1">
                {contents.included.map(p => fila(p, 'in'))}
                {contents.pending.map(p => fila(p, 'pending'))}
                {contents.excluded.map(p => fila(p, 'out'))}
            </ul>
            {contents.pending.length > 0 && (
                <p className="border-t border-border pt-2 text-[11px] text-warning-subtle-foreground">
                    {t('detail.steps.assembly.pendingHint', { count: contents.pending.length })}
                </p>
            )}
            {(() => {
                // Preguntas que ninguna sección elegida va a responder. Es el
                // aviso que convierte un documento incompleto —que hoy se
                // descubre leyendo— en algo que el sistema dice antes de
                // exportar.
                const versiculos = contents.included
                    .concat(contents.pending)
                    .map(p => p.label.match(/(\d+):(\d+)/))
                    .filter((m): m is RegExpMatchArray => !!m)
                    .map(m => ({ chapter: Number(m[1]), verse: Number(m[2]) }));
                const sinResponder = unansweredQuestions(preguntas, versiculos);
                if (sinResponder.length === 0) return null;
                return (
                    <p className="border-t border-border pt-2 text-[11px] text-warning-subtle-foreground">
                        {t('detail.steps.assembly.unanswered', {
                            count: sinResponder.length,
                            numbers: sinResponder.map(q => q.number).join(', '),
                        })}
                    </p>
                );
            })()}
            <p className="text-[11px] leading-snug text-muted-foreground">
                {t('detail.steps.assembly.hint')}
            </p>
        </div>
    );
}

export function StepCard({ step, paperId, language, allSteps, assignmentBrief = null, hasAssembly = false, targetWordsPerVerse = null, formatting = null }: StepCardProps) {
    const { t } = useTranslation('exegesis');
    const {
        generateStep,
        acceptStep,
        saveStepEdit,
        analyzeVerseCanonically,
        composeConclusionFromAnalyses,
        composeIntroductionFromAnalyses,
        composeVerseAcademicProse,
        verifyStepCitations,
    } = useExegesisPapers();

    const [editing, setEditing] = useState(false);
    const [recomposeOpen, setRecomposeOpen] = useState(false);
    const [editDraft, setEditDraft] = useState('');
    const [regenerateOpen, setRegenerateOpen] = useState(false);
    // Citation verifier dialog state. Last results live here so the
    // user can re-open the dialog without re-running the verifier.
    const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
    const [verifiedCitations, setVerifiedCitations] = useState<VerifiedCitation[]>([]);
    // Out-of-credits dialog. Triggered when any exegesis mutation
    // throws `InsufficientExegesisCreditsError` (Fase 2 reserve fails).
    const [outOfCreditsOpen, setOutOfCreditsOpen] = useState(false);
    const [outOfCreditsNeededUsd, setOutOfCreditsNeededUsd] = useState<number | undefined>(undefined);
    const [packsOpen, setPacksOpen] = useState(false);
    const [pendingConfirm, setPendingConfirm] = useState<
        { operation: ExegesisOperationKey; run: () => void } | null
    >(null);
    // Pre-check modal for section composers — opens with a list of
    // missing verses when the user clicks "Componer desde análisis"
    // before having any accepted verse analyses.
    const [precheckOpen, setPrecheckOpen] = useState(false);
    const [precheckMissing, setPrecheckMissing] = useState<ComposeSectionPrecheckMissing | null>(null);
    // Collapse behavior:
    //   - Accepted steps default to COLLAPSED (the user already
    //     approved; detail is rarely re-read in the same session).
    //   - Awaiting-review steps default to EXPANDED (user needs to
    //     read before deciding) but can be collapsed manually so
    //     long multi-verse papers don't force them to scroll past
    //     several open cards.
    //   - Pending / generating / failed are not collapsible — the
    //     header is the entire content there.
    // Lazy-init so the initial value reflects the step's state on
    // first mount; later state changes don't re-derive (the user's
    // explicit toggle takes precedence).
    const reopenStep = useReopenStep();
    const [collapsed, setCollapsed] = useState(() => step.state === 'accepted');
    const isExpanded = !collapsed || editing;
    const collapsible = step.state === 'accepted' || step.state === 'awaiting-review';
    // View mode toggle for verse steps that have a CanonicalVerseAnalysis
    // attached (Phase 2 architecture). Defaults to 'prose' so legacy
    // markdown output stays visible by default; users opt in to the
    // structured study view via the toggle.
    const [viewMode, setViewMode] = useState<'prose' | 'study'>('prose');
    const canonicalAnalysis = step.state === 'awaiting-review'
        ? step.current?.canonicalAnalysis ?? step.accepted?.canonicalAnalysis ?? null
        : step.accepted?.canonicalAnalysis ?? step.current?.canonicalAnalysis ?? null;
    const supportsStudyView = step.kind === 'verse' && !!canonicalAnalysis;

    const displayLabel = stepDisplayLabel(step, language, t);

    // Un `generating` cruza el umbral de abandono sin que nada cambie en
    // Firestore, así que no hay re-render que lo delate: sin este reloj la
    // tarjeta seguiría girando hasta que el usuario recargue a mano. Un solo
    // temporizador, disparado exactamente al vencer, y sólo mientras genera.
    // Cita abierta en el visor del documento original. `null` = cerrado.
    const [openCitation, setOpenCitation] = useState<CitationTarget | null>(null);
    const navigate = useNavigate();
    const reviewPath = `/dashboard/exegesis/${paperId}/pasos/${step.id}/revision`;

    const [now, setNow] = useState(() => new Date());
    const stepUpdatedAtMs = step.updatedAt?.getTime?.();
    useEffect(() => {
        if (step.state !== 'generating') return;
        if (typeof stepUpdatedAtMs !== 'number' || Number.isNaN(stepUpdatedAtMs)) return;
        const remaining = stepUpdatedAtMs + ABANDONED_GENERATION_AFTER_MS - Date.now();
        if (remaining <= 0) return;
        const timer = setTimeout(() => setNow(new Date()), remaining + 1_000);
        return () => clearTimeout(timer);
    }, [step.state, stepUpdatedAtMs]);

    // Una generación abandonada se trata EXACTAMENTE como un fallo: mismas
    // acciones, mismo camino de reintento. Lo único propio es el texto, porque
    // "algo falló" sería inexacto —no falló nada, el navegador se fue.
    const abandoned = isAbandonedGeneration(step, now);

    const isPending = step.state === 'pending';
    const isGenerating = step.state === 'generating' && !abandoned;
    const isReview = step.state === 'awaiting-review';
    const isAccepted = step.state === 'accepted';
    const isFailed = step.state === 'failed' || abandoned;

    // In awaiting-review, the user must see the NEW draft (step.current),
    // not a previously accepted version. After regenerating from an
    // accepted state, step.accepted still holds the old version while
    // step.current holds the fresh draft — rendering accepted there
    // makes the UI lie about what was just produced.
    const previewMarkdown = isReview
        ? step.current?.markdown ?? step.accepted?.markdown ?? ''
        : step.accepted?.markdown ?? step.current?.markdown ?? '';

    const showActions = isReview;
    const showAccepted = isAccepted;

    const startEdit = () => {
        setEditDraft(previewMarkdown);
        setEditing(true);
    };

    /**
     * Catches the Fase-2 InsufficientExegesisCreditsError thrown by
     * any exegesis mutation (the use case calls
     * `processingBalanceService.consumeExegesis` before the LLM call;
     * if the bucket can't cover the catalog cost, the error
     * propagates here). Opens the OutOfCredits dialog with the
     * needed-USD pre-populated. Returns true when handled so the
     * caller can skip the generic toast.
     */
    const handleQuotaError = (err: unknown): boolean => {
        if (
            err instanceof Error
            && (err as { code?: string }).code === 'insufficient-exegesis-credits'
        ) {
            const neededUsd = (err as { neededUsd?: number }).neededUsd;
            setOutOfCreditsNeededUsd(neededUsd);
            setOutOfCreditsOpen(true);
            return true;
        }
        return false;
    };

    const cancelEdit = () => {
        setEditDraft('');
        setEditing(false);
    };

    const runGenerate = async (regenerationHint?: string) => {
        try {
            await generateStep.mutateAsync({ paperId, stepId: step.id, regenerationHint });
        } catch (err) {
            if (handleQuotaError(err)) return;
            console.error('[exegesis] generate failed:', err);
            toast.error(t('detail.steps.toast.generateFailed'));
        }
    };

    const handleGenerate = (regenerationHint?: string) => {
        if (operationRequiresPreConfirm('generateStep')) {
            setPendingConfirm({
                operation: 'generateStep',
                run: () => { void runGenerate(regenerationHint); },
            });
            return;
        }
        void runGenerate(regenerationHint);
    };

    // Phase 2 path: structured analysis instead of free markdown.
    // Only meaningful for verse-kind steps. Other kinds keep the
    // legacy `generateStep` path until composers for them ship.
    const runAnalyzeCanonically = async (regenerationHint?: string) => {
        if (step.kind !== 'verse') return;
        try {
            await analyzeVerseCanonically.mutateAsync({
                paperId,
                stepId: step.id,
                regenerationHint: regenerationHint ?? null,
            });
            setViewMode('study');
        } catch (err) {
            if (handleQuotaError(err)) return;
            console.error('[exegesis] canonical analysis failed:', err);
            toast.error(t('canonical.toast.analyzeFailed'));
        }
    };

    const handleAnalyzeCanonically = (regenerationHint?: string) => {
        if (step.kind !== 'verse') return;
        if (operationRequiresPreConfirm('analyzeVerseCanonically')) {
            setPendingConfirm({
                operation: 'analyzeVerseCanonically',
                run: () => { void runAnalyzeCanonically(regenerationHint); },
            });
            return;
        }
        void runAnalyzeCanonically(regenerationHint);
    };
    const preguntas = useMemo(() => parseBriefQuestions(assignmentBrief), [assignmentBrief]);
    /** La pregunta del encuadre que le toca a este versículo. */
    const preguntaPropia = step.kind === 'verse' && step.verseRef
        ? questionsForVerse(preguntas, step.verseRef.chapterStart, step.verseRef.verseStart ?? 1)
        : [];

    const isAssembly = step.kind === 'assembly';
    // Qué va a entrar al documento y qué no. La misma regla que usa el
    // ensamblador, leída del dominio: así la lista y el archivo no pueden
    // discrepar.
    const contents = useMemo(
        () => (isAssembly && allSteps ? assemblyContents(allSteps, language) : null),
        [isAssembly, allSteps, language],
    );

    const isVerse = step.kind === 'verse';
    const isConclusion = step.kind === 'conclusion';
    const isIntroduction = step.kind === 'introduction';

    // Phase 5: section composers. Conclusion runs over accepted verse
    // analyses; introduction runs over verse analyses + accepted
    // conclusion. Use cases enforce ordering — UI just exposes the
    // CTA when the kind matches.
    //
    // Pre-check: when allSteps is available, compute the missing
    // verses before mutating. If the composer would fail because no
    // verse is accepted yet, open the precheck dialog instead so the
    // user gets an actionable jump-to list rather than the raw error
    // toast.
    const buildPrecheckMissing = (
        section: 'conclusion' | 'introduction',
    ): ComposeSectionPrecheckMissing | null => {
        if (!allSteps) return null;
        const verses = allSteps.filter(s => s.kind === 'verse');
        const acceptedCount = verses.filter(s => s.accepted?.canonicalAnalysis).length;
        const conclusionMissing = section === 'introduction'
            && !(allSteps.find(s => s.kind === 'conclusion')?.accepted?.markdown?.trim());
        if (acceptedCount > 0 && !conclusionMissing) return null;
        const awaitingReview = verses.filter(
            s => s.state === 'awaiting-review' && s.current?.canonicalAnalysis,
        );
        const awaitingReviewIds = new Set(awaitingReview.map(s => s.id));
        const noAnalysis = verses.filter(
            s => !s.accepted?.canonicalAnalysis && !awaitingReviewIds.has(s.id),
        );
        return { awaitingReview, noAnalysis, conclusionMissing };
    };

    const handleComposeConclusion = async () => {
        const missing = buildPrecheckMissing('conclusion');
        if (missing) {
            setPrecheckMissing(missing);
            setPrecheckOpen(true);
            return;
        }
        try {
            await composeConclusionFromAnalyses.mutateAsync({ paperId });
        } catch (err) {
            if (handleQuotaError(err)) return;
            console.error('[exegesis] compose conclusion failed:', err);
            toast.error(t('canonical.toast.composeSectionFailed', {
                message: (err as Error).message ?? '',
            }));
        }
    };
    const handleComposeIntroduction = async () => {
        const missing = buildPrecheckMissing('introduction');
        if (missing) {
            setPrecheckMissing(missing);
            setPrecheckOpen(true);
            return;
        }
        try {
            await composeIntroductionFromAnalyses.mutateAsync({ paperId });
        } catch (err) {
            if (handleQuotaError(err)) return;
            console.error('[exegesis] compose introduction failed:', err);
            toast.error(t('canonical.toast.composeSectionFailed', {
                message: (err as Error).message ?? '',
            }));
        }
    };

    /**
     * El markdown, renderizado una sola vez por texto.
     *
     * `ReactMarkdown` parsea y construye el árbol en cada render, y el paso de
     * ensamble llegó a 29.000 caracteres. Marcar una casilla del documento
     * cambia la identidad del trabajo, eso re-renderiza los dieciséis pasos, y
     * cada uno volvía a parsear su markdown: el hilo principal quedaba
     * bloqueado unos tres segundos —el tiempo que el usuario veía todo gris y
     * sin responder—.
     *
     * El texto no cambia al marcar una casilla. Atarlo a `previewMarkdown`
     * hace que ese re-render no cueste nada.
     */
    const markdownRenderizado = useMemo(() => (
        <div className="prose prose-base dark:prose-invert max-w-none leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {previewMarkdown}
            </ReactMarkdown>
        </div>
    ), [previewMarkdown]);

    const anyPipelinePending =
        generateStep.isPending
        || analyzeVerseCanonically.isPending
        || composeConclusionFromAnalyses.isPending
        || composeIntroductionFromAnalyses.isPending
        || composeVerseAcademicProse.isPending;

    /**
     * La versión actual del paso está por cambiar: nada que trabaje sobre ella
     * debe poder dispararse.
     *
     * `Aceptar` y `Verificar citas` operan sobre `step.current`. Durante una
     * regeneración esa versión es la VIEJA —la nueva todavía no aterriza—, así
     * que aceptar fija la anterior y deja al paso volviendo a revisión cuando
     * llega la nueva, y verificar gasta una pasada sobre un texto que está por
     * desaparecer, dejando veredictos atados a una versión que deja de ser la
     * actual.
     *
     * Se nombra una vez porque estaba escrita a mano en cuatro botones con
     * cuatro combinaciones distintas, y dos de ellos se habían quedado sin la
     * parte de `anyPipelinePending`. Cuatro copias de una condición son cuatro
     * condiciones en cuanto alguien toca una.
     */
    const versionEnVuelo =
        anyPipelinePending || acceptStep.isPending || verifyStepCitations.isPending;


    // Per-verse academic prose composer. Persists on the version's
    // `markdown` field, so re-rendering after the user clicks once is
    // free until the analysis itself changes.
    const handleComposeVerseProse = async (guidance?: string, targetWords?: number | null) => {
        if (step.kind !== 'verse') return;
        try {
            const result = await composeVerseAcademicProse.mutateAsync({
                paperId,
                stepId: step.id,
                ...(guidance ? { guidance } : {}),
                ...(targetWords ? { targetWords } : {}),
            });
            setRecomposeOpen(false);
            // Si el trabajo ya estaba ensamblado y su sección no se pudo
            // encontrar, el ensamblado quedó con la prosa vieja: decirlo es
            // la diferencia entre entregar lo corregido y entregar lo de antes.
            // El aviso ya no depende de que hubiera indicación: recomponer sin
            // decir nada también cambia el verso, y dejar el ensamblado atrás
            // es igual de caro en los dos casos.
            if (!result.assemblyUpdated && hasAssembly) {
                toast.warning(t('canonical.recompose.toast.assemblyUntouched'));
            } else {
                toast.success(t('canonical.recompose.toast.done'));
            }
            // Surface the prose by switching the view toggle so the
            // user sees the result immediately. The toggle is otherwise
            // controlled by the user's last choice.
            setViewMode('prose');
        } catch (err) {
            if (handleQuotaError(err)) return;
            console.error('[exegesis] compose verse prose failed:', err);
            toast.error(t('canonical.verseProse.toast.failed'));
        }
    };

    // Adaptive regenerate routing — picks the right pipeline for the
    // step kind so "Regenerar" / "Aplicar hint" land in the same flow
    // that produced the current version:
    //   - verse + canonicalAnalysis present → canonical analyzer
    //   - conclusion → ComposeConclusionFromAnalysesUseCase (carries the
    //     pinned-source contract + textContent — issue #126 follow-up)
    //   - introduction → ComposeIntroductionFromAnalysesUseCase (same)
    //   - everything else → legacy GenerateStepUseCase fallback
    // Routing conclusion/intro through the legacy path here would
    // bypass the composer's plan-pinned source contract and re-fall
    // into the cross-pollination bug from issue #126.
    const currentHasCanonical = !!step.current?.canonicalAnalysis;
    const shouldRegenerateCanonically = isVerse && currentHasCanonical;
    const stepLabel = step.verseRef
        ? formatPassageReference(step.verseRef, language)
        : t(`detail.steps.kind.${step.kind}`);
    const handleAdaptiveRegenerate = (regenerationHint?: string) => {
        if (shouldRegenerateCanonically) {
            return handleAnalyzeCanonically(regenerationHint);
        }
        // Hint flow keeps the legacy generateStep path because the
        // composer use cases don't accept regenerationHint yet — TODO
        // in issue #126 follow-up. Plain "Regenerar" (no hint) goes
        // through the composer so the pinned-source contract +
        // textContent injection apply.
        if (isConclusion && !regenerationHint) {
            return handleComposeConclusion();
        }
        if (isIntroduction && !regenerationHint) {
            return handleComposeIntroduction();
        }
        return handleGenerate(regenerationHint);
    };

    const handleAccept = async () => {
        if (!step.current) return;
        try {
            await acceptStep.mutateAsync({ paperId, stepId: step.id, versionId: step.current.id });
            toast.success(t('detail.steps.toast.accepted'));
        } catch (err) {
            if (isUnreviewedCitationsError(err)) {
                toast.error(t('canonical.review.toast.acceptBlocked', { count: err.paths.length }), {
                    action: { label: t('canonical.review.link'), onClick: () => navigate(reviewPath) },
                });
                return;
            }
            console.error('[exegesis] accept failed:', err);
            toast.error(t('detail.steps.toast.acceptFailed'));
        }
    };

    const handleSaveEdit = async () => {
        try {
            await saveStepEdit.mutateAsync({ paperId, stepId: step.id, markdown: editDraft });
            setEditing(false);
            toast.success(t('detail.steps.toast.edited'));
        } catch (err) {
            console.error('[exegesis] saveEdit failed:', err);
            toast.error(t('detail.steps.toast.editFailed'));
        }
    };

    // Citation verifier — runs over the version the UI is currently
    // displaying (`accepted ?? current`, the use case picks). The
    // dialog opens regardless of success/failure so the user always
    // sees feedback.
    const handleVerifyCitations = async () => {
        const targetVersion = step.accepted ?? step.current;
        if (!targetVersion) return;
        setVerifyDialogOpen(true);
        try {
            const result = await verifyStepCitations.mutateAsync({
                paperId,
                stepId: step.id,
                versionId: targetVersion.id,
            });
            setVerifiedCitations(result.citations);
        } catch (err) {
            if (handleQuotaError(err)) {
                setVerifyDialogOpen(false);
                return;
            }
            console.error('[exegesis] verify failed:', err);
            toast.error(t('canonical.verify.toast.failed'));
            setVerifiedCitations([]);
        }
    };

    // Display-only summary lookup — picks from the version the UI is
    // showing so the badge in the header reflects the same content the
    // user is reading. Null until verification has ever run.
    const displayVerificationSummary: VerificationSummary | null = (() => {
        const v = isReview
            ? step.current?.verifications ?? step.accepted?.verifications ?? null
            : step.accepted?.verifications ?? step.current?.verifications ?? null;
        if (!v || !v.lastRunAt) return null;
        return v;
    })();

    return (
        <article
            id={`exegesis-step-${step.id}`}
            className={cn(
                'rounded-2xl border bg-white dark:bg-zinc-900 transition-all duration-300',
                isAccepted ? 'border-emerald-200 dark:border-emerald-900/40' : 'border-slate-200 dark:border-zinc-800'
            )}
        >
            {/* Header — clickable when collapsible (accepted or
                awaiting-review) to toggle collapse. For pending /
                generating / failed the header is the entire content,
                so the click target is inert. */}
            <header
                className={cn(
                    'flex items-center gap-3 px-5 py-3 border-b border-slate-100 dark:border-zinc-800',
                    collapsible && 'cursor-pointer select-none',
                    collapsible && !isExpanded && 'border-b-0',
                )}
                onClick={collapsible ? () => setCollapsed(c => !c) : undefined}
                role={collapsible ? 'button' : undefined}
                tabIndex={collapsible ? 0 : undefined}
                onKeyDown={collapsible ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCollapsed(c => !c);
                    }
                } : undefined}
                aria-expanded={collapsible ? isExpanded : undefined}
            >
                {collapsible && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setCollapsed(c => !c); }}
                        className="shrink-0 p-0.5 -ml-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        aria-label={isExpanded ? t('detail.steps.action.collapse') : t('detail.steps.action.expand')}
                    >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                )}
                <StepIcon kind={step.kind} state={step.state} />
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {displayLabel}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <span>
                            {t(`detail.steps.state.${step.state}`)}
                            {step.versions.length > 0 ? ` · v${step.versions.length}` : ''}
                        </span>
                        {/* Qué pregunta del encuadre le toca a este paso. Se
                            dice acá para que el emparejamiento sea visible sin
                            que nadie tenga que ir a buscarlo: si se equivocó,
                            se ve; si acertó, da confianza. */}
                        {preguntaPropia.length > 0 && (
                            <span className="text-[11px] text-muted-foreground">
                                · {t('detail.steps.answersQuestion', {
                                    numbers: preguntaPropia.map(q => q.number).join(', '),
                                })}
                            </span>
                        )}
                        {displayVerificationSummary && (
                            <VerificationBadge summary={displayVerificationSummary} />
                        )}
                    </p>
                </div>
                {isPending && (
                    <div className="flex items-center gap-1.5">
                        {/* Recommended-path primary CTA per kind. The
                            legacy Generar path lives in the overflow
                            menu for sections (it bypasses the pinned-
                            source contract) and as a downgraded
                            secondary for verses (it skips canonical
                            analysis → can't feed downstream composers). */}
                        {isVerse && (
                            <>
                                <Button
                                    size="sm"
                                    onClick={() => handleAnalyzeCanonically()}
                                    disabled={anyPipelinePending}
                                    title={t('canonical.actions.analyzeTooltip')}
                                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-900"
                                >
                                    {analyzeVerseCanonically.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <NotebookPen className="h-3.5 w-3.5 mr-1.5" />}
                                    {t('canonical.actions.analyze')}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleGenerate()}
                                    disabled={anyPipelinePending}
                                    title={t('detail.steps.action.generateLegacyVerseTooltip')}
                                >
                                    {generateStep.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1.5" />}
                                    {t('detail.steps.action.generateLegacyVerse')}
                                </Button>
                            </>
                        )}
                        {isConclusion && (
                            <>
                                <Button
                                    size="sm"
                                    onClick={handleComposeConclusion}
                                    disabled={anyPipelinePending}
                                    title={t('canonical.actions.composeConclusionTooltip')}
                                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-900"
                                >
                                    {composeConclusionFromAnalyses.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <NotebookPen className="h-3.5 w-3.5 mr-1.5" />}
                                    {t('canonical.actions.composeFromAnalyses')}
                                </Button>
                                <SectionOverflowMenu
                                    onLegacyGenerate={() => handleGenerate()}
                                    isPending={generateStep.isPending}
                                    disabled={anyPipelinePending}
                                />
                            </>
                        )}
                        {isIntroduction && (
                            <>
                                <Button
                                    size="sm"
                                    onClick={handleComposeIntroduction}
                                    disabled={anyPipelinePending}
                                    title={t('canonical.actions.composeIntroductionTooltip')}
                                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-900"
                                >
                                    {composeIntroductionFromAnalyses.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <NotebookPen className="h-3.5 w-3.5 mr-1.5" />}
                                    {t('canonical.actions.composeFromAnalyses')}
                                </Button>
                                <SectionOverflowMenu
                                    onLegacyGenerate={() => handleGenerate()}
                                    isPending={generateStep.isPending}
                                    disabled={anyPipelinePending}
                                />
                            </>
                        )}
                        {/* assembly + any other non-verse/section kinds
                            keep the legacy Generate as the only path. */}
                        {!isVerse && !isConclusion && !isIntroduction && (
                            <Button
                                size="sm"
                                onClick={() => handleGenerate()}
                                disabled={anyPipelinePending}
                                className="bg-emerald-500 hover:bg-emerald-400 text-slate-900"
                            >
                                {generateStep.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1.5" />}
                                {t('detail.steps.action.generate')}
                            </Button>
                        )}
                    </div>
                )}
                {isFailed && (
                    <div className="flex items-center gap-1.5">
                        {isVerse && (
                            <>
                                <Button
                                    size="sm"
                                    onClick={() => handleAnalyzeCanonically()}
                                    disabled={anyPipelinePending}
                                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-900"
                                >
                                    {analyzeVerseCanonically.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <NotebookPen className="h-3.5 w-3.5 mr-1.5" />}
                                    {t('canonical.actions.analyzeRetry')}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleGenerate()}
                                    disabled={anyPipelinePending}
                                    title={t('detail.steps.action.generateLegacyVerseTooltip')}
                                >
                                    {generateStep.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1.5" />}
                                    {t('detail.steps.action.generateLegacyVerse')}
                                </Button>
                            </>
                        )}
                        {isConclusion && (
                            <>
                                <Button
                                    size="sm"
                                    onClick={handleComposeConclusion}
                                    disabled={anyPipelinePending}
                                    title={t('canonical.actions.composeConclusionTooltip')}
                                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-900"
                                >
                                    {composeConclusionFromAnalyses.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
                                    {t('canonical.actions.composeRetry')}
                                </Button>
                                <SectionOverflowMenu
                                    onLegacyGenerate={() => handleGenerate()}
                                    isPending={generateStep.isPending}
                                    disabled={anyPipelinePending}
                                />
                            </>
                        )}
                        {isIntroduction && (
                            <>
                                <Button
                                    size="sm"
                                    onClick={handleComposeIntroduction}
                                    disabled={anyPipelinePending}
                                    title={t('canonical.actions.composeIntroductionTooltip')}
                                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-900"
                                >
                                    {composeIntroductionFromAnalyses.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
                                    {t('canonical.actions.composeRetry')}
                                </Button>
                                <SectionOverflowMenu
                                    onLegacyGenerate={() => handleGenerate()}
                                    isPending={generateStep.isPending}
                                    disabled={anyPipelinePending}
                                />
                            </>
                        )}
                        {!isVerse && !isConclusion && !isIntroduction && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleGenerate()}
                                disabled={anyPipelinePending}
                                className="border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300"
                            >
                                {generateStep.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
                                {t('detail.steps.action.retry')}
                            </Button>
                        )}
                    </div>
                )}
                {/* Awaiting-review + collapsed → expose Accept in the
                    header so the user can move the queue forward
                    without expanding each card. Stop propagation so the
                    button doesn't toggle the collapse. Tooltip warns to
                    review first — accepting closes the canonical
                    analysis into the composer's input set. */}
                {isReview && !isExpanded && (
                    <div className="flex items-center gap-1.5">
                        <Button
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); void handleAccept(); }}
                            disabled={versionEnVuelo || !step.current}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-900"
                            title={t('detail.steps.action.acceptCollapsedTooltip')}
                        >
                            {acceptStep.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                            {t('detail.steps.action.accept')}
                        </Button>
                    </div>
                )}
            </header>

            {/* Body + footer — hidden when a collapsible step is
                collapsed (accepted or awaiting-review). Pending /
                generating / failed always render their body since
                the header alone isn't informative there. */}
            {(!collapsible || isExpanded) && (
            <>
            {/* Body — state-aware */}
            <div className="px-5 py-4">
                {contents && <AssemblyManifest contents={contents} paperId={paperId} preguntas={preguntas} />}
                {isGenerating && (
                    <div className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('detail.steps.generating')}
                    </div>
                )}

                {isFailed && !isGenerating && (
                    <div className="inline-flex items-start gap-2 text-sm text-rose-700 dark:text-rose-300">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{t(abandoned ? 'detail.steps.abandonedHint' : 'detail.steps.failedHint')}</span>
                    </div>
                )}

                {(isReview || showAccepted) && !editing && (previewMarkdown || canonicalAnalysis) && (
                    <div className="relative space-y-3">
                        {/* Optimistic spinner overlay — fires the moment
                            the user clicks Regenerar/Aplicar hint, before
                            Firestore propagates the 'generating' state.
                            Closes the visual gap where the buttons go
                            disabled but nothing tells the user "something
                            is happening". */}
                        {anyPipelinePending && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-white/70 dark:bg-zinc-900/70 backdrop-blur-sm">
                                <div className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-zinc-800 px-3 py-2 rounded-md border border-slate-200 dark:border-zinc-700 shadow-sm">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {t('detail.steps.regenerating')}
                                </div>
                            </div>
                        )}
                        {/* View mode toggle — only when both modes have
                            content. Lets the user inspect the structured
                            analysis OR read the legacy markdown rendering. */}
                        {supportsStudyView && previewMarkdown && (
                            <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-[11px]">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('prose')}
                                    className={cn(
                                        'px-2.5 py-1 rounded transition-colors',
                                        viewMode === 'prose'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    {t('canonical.view.prose')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('study')}
                                    className={cn(
                                        'px-2.5 py-1 rounded transition-colors',
                                        viewMode === 'study'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    {t('canonical.view.study')}
                                </button>
                            </div>
                        )}
                        {supportsStudyView && viewMode === 'study' ? (
                            <CanonicalAnalysisStudyView analysis={canonicalAnalysis!} onOpenCitation={setOpenCitation} />
                        ) : previewMarkdown ? (
                            markdownRenderizado
                        ) : (
                            // Canonical analysis exists but no markdown yet —
                            // composer hasn't run on this version. Default
                            // straight to study view so the user sees the
                            // structured payload that came back.
                            canonicalAnalysis && <CanonicalAnalysisStudyView analysis={canonicalAnalysis} onOpenCitation={setOpenCitation} />
                        )}
                    </div>
                )}

                {editing && (
                    <div className="space-y-2">
                        <textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            className="w-full min-h-[200px] rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                        />
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                onClick={handleSaveEdit}
                                disabled={saveStepEdit.isPending}
                                className="bg-emerald-500 hover:bg-emerald-400 text-slate-900"
                            >
                                {saveStepEdit.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                                {t('detail.steps.action.saveEdit')}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saveStepEdit.isPending}>
                                {t('setup.cancel')}
                            </Button>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-auto">
                                {t('detail.steps.editHint')}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Action bar — only for awaiting-review */}
            {showActions && !editing && (
                <footer className="px-5 py-3 border-t border-slate-100 dark:border-zinc-800 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            size="sm"
                            onClick={handleAccept}
                            disabled={versionEnVuelo || !step.current}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-900"
                        >
                            {acceptStep.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                            {t('detail.steps.action.accept')}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRegenerateOpen(true)}
                            disabled={versionEnVuelo}
                        >
                            {anyPipelinePending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
                            {anyPipelinePending ? t('detail.steps.action.regenerating') : t('detail.steps.action.regenerate')}
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={startEdit}
                            disabled={versionEnVuelo}
                        >
                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                            {t('detail.steps.action.editManual')}
                        </Button>
                        {/* Migrate-to-canonical entry point also lives in
                            the awaiting-review footer for verse steps that
                            haven't yet been analyzed canonically. Saves the
                            user a "accept then migrate" two-click. */}
                        {isVerse && !canonicalAnalysis && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleAnalyzeCanonically()}
                                disabled={versionEnVuelo}
                                title={t('canonical.actions.analyzeFromAcceptedTooltip')}
                            >
                                {analyzeVerseCanonically.isPending
                                    ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                    : <NotebookPen className="h-3.5 w-3.5 mr-1.5" />}
                                {t('canonical.actions.analyzeFromAccepted')}
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleVerifyCitations}
                            disabled={versionEnVuelo || !step.current}
                            className="ml-auto"
                            title={t('canonical.verify.button.tooltip')}
                        >
                            {verifyStepCitations.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
                            {t('canonical.verify.button.label')}
                        </Button>
                    </div>
                </footer>
            )}

            {showAccepted && !editing && (
                <footer className="px-5 py-2.5 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <button
                        type="button"
                        onClick={startEdit}
                        disabled={anyPipelinePending}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300 disabled:opacity-50"
                    >
                        <Pencil className="h-3 w-3" />
                        {t('detail.steps.action.editAccepted')}
                    </button>
                    <button
                        type="button"
                        onClick={() => reopenStep.mutate({ paperId, stepId: step.id })}
                        disabled={reopenStep.isPending || anyPipelinePending}
                        title={t('detail.steps.action.redoTooltip')}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300 disabled:opacity-50"
                    >
                        <RotateCcw className="h-3 w-3" />
                        {t('detail.steps.action.redo')}
                    </button>
                    {canonicalAnalysis ? (
                        <Link
                            to={reviewPath}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-success"
                            title={t('canonical.review.linkTooltip')}
                        >
                            <ShieldCheck className="h-3 w-3" />
                            {t('canonical.review.link')}
                        </Link>
                    ) : (
                    <button
                        type="button"
                        onClick={handleVerifyCitations}
                        disabled={versionEnVuelo}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300 disabled:opacity-50"
                        title={t('canonical.verify.button.tooltip')}
                    >
                        {verifyStepCitations.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                        {t('canonical.verify.button.label')}
                    </button>
                    )}

                    {/* Verse-only affordances. Two paths:
                        - Legacy (no canonicalAnalysis): offer the
                          canonical-analyzer entry point so the user can
                          migrate accepted legacy verses to the new
                          structured pipeline without recreating them.
                        - Canonical (has canonicalAnalysis): offer the
                          per-verse prose composer + the regen / hint
                          flow that the awaiting-review footer exposes
                          but the accepted footer used to hide. */}
                    {isVerse && !canonicalAnalysis && (
                        <button
                            type="button"
                            onClick={() => handleAnalyzeCanonically()}
                            disabled={anyPipelinePending}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300 disabled:opacity-50"
                            title={t('canonical.actions.analyzeFromAcceptedTooltip')}
                        >
                            {analyzeVerseCanonically.isPending
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <NotebookPen className="h-3 w-3" />}
                            {t('canonical.actions.analyzeFromAccepted')}
                        </button>
                    )}
                    {isVerse && canonicalAnalysis && (
                        <>
                            <button
                                type="button"
                                onClick={() => (previewMarkdown.trim().length > 0 ? setRecomposeOpen(true) : handleComposeVerseProse())}
                                disabled={anyPipelinePending}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300 disabled:opacity-50"
                                title={t('canonical.verseProse.button.tooltip')}
                            >
                                {composeVerseAcademicProse.isPending
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <Wand2 className="h-3 w-3" />}
                                {previewMarkdown.trim().length > 0
                                    ? t('canonical.verseProse.button.recompose')
                                    : t('canonical.verseProse.button.compose')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setRegenerateOpen(true)}
                                disabled={anyPipelinePending}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300 disabled:opacity-50"
                                title={t('canonical.actions.regenAnalysisTooltip')}
                            >
                                {analyzeVerseCanonically.isPending
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <RotateCcw className="h-3 w-3" />}
                                {t('canonical.actions.regenAnalysis')}
                            </button>
                        </>
                    )}

                    {/* Section composer re-trigger for accepted
                        intro / conclusion. Lets the user run the
                        composer again after acceptance — useful when
                        the accepted output missed a pinned source
                        and a re-run with the tightened prompts (issue
                        #126 / Approach A) should produce a compliant
                        version. */}
                    {(isConclusion || isIntroduction) && (
                        <button
                            type="button"
                            onClick={isConclusion ? handleComposeConclusion : handleComposeIntroduction}
                            disabled={anyPipelinePending}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300 disabled:opacity-50"
                            title={t(isConclusion
                                ? 'canonical.actions.composeConclusionTooltip'
                                : 'canonical.actions.composeIntroductionTooltip')}
                        >
                            {(composeConclusionFromAnalyses.isPending || composeIntroductionFromAnalyses.isPending)
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <RotateCcw className="h-3 w-3" />}
                            {t('canonical.actions.recomposeFromAnalyses')}
                        </button>
                    )}

                </footer>
            )}

            </>
            )}
            <CitationVerificationDialog
                open={verifyDialogOpen}
                onOpenChange={setVerifyDialogOpen}
                citations={verifiedCitations}
                sourcesNamedWithoutCitation={displayVerificationSummary?.sourcesNamedWithoutCitation ?? 0}
                witnessClaimsWithoutCitation={displayVerificationSummary?.witnessClaimsWithoutCitation ?? 0}
                isVerifying={verifyStepCitations.isPending}
                onReverify={handleVerifyCitations}
            />
            <ExegesisOutOfCreditsDialog
                open={outOfCreditsOpen}
                onOpenChange={setOutOfCreditsOpen}
                neededUsd={outOfCreditsNeededUsd}
                onBuyPacks={() => setPacksOpen(true)}
            />
            <CreditPacksDialog
                open={packsOpen}
                onOpenChange={setPacksOpen}
                focusMode="exegesis"
            />
            {pendingConfirm && (
                <ExegesisPreConfirmDialog
                    open
                    onOpenChange={(open) => { if (!open) setPendingConfirm(null); }}
                    operation={pendingConfirm.operation}
                    onConfirm={() => {
                        pendingConfirm.run();
                        setPendingConfirm(null);
                    }}
                />
            )}
            {precheckMissing && (isConclusion || isIntroduction) && (
                <ComposeSectionPrecheckDialog
                    open={precheckOpen}
                    onOpenChange={(open) => {
                        setPrecheckOpen(open);
                        if (!open) setPrecheckMissing(null);
                    }}
                    section={isConclusion ? 'conclusion' : 'introduction'}
                    missing={precheckMissing}
                    language={language}
                />
            )}
            <RegenerateStepDialog
                open={regenerateOpen}
                onOpenChange={setRegenerateOpen}
                stepLabel={stepLabel}
                stepKind={step.kind}
                redoesAnalysis={shouldRegenerateCanonically}
                isPending={anyPipelinePending}
                onRegenerate={(hint) => { setRegenerateOpen(false); handleAdaptiveRegenerate(hint); }}
            />
            <VerseRecomposeDialog
                open={recomposeOpen}
                onOpenChange={setRecomposeOpen}
                verseLabel={stepLabel}
                currentProse={previewMarkdown}
                suggestedWords={targetWordsPerVerse}
                formatting={formatting}
                isComposing={composeVerseAcademicProse.isPending}
                onRecompose={(guidance, targetWords) => handleComposeVerseProse(guidance, targetWords)}
            />
            <CitationSourceModal
                open={!!openCitation}
                onOpenChange={(open) => { if (!open) setOpenCitation(null); }}
                paperId={paperId}
                citation={openCitation}
            />
        </article>
    );
}

/**
 * Overflow menu for conclusion / introduction section steps. Hosts
 * the legacy GenerateStepUseCase path, which bypasses the pinned-
 * source contract (issue #126) and produces inferior output. Kept
 * available behind the kebab so power users can still reach it
 * without it being a foot-gun in the primary action area.
 */
function SectionOverflowMenu({
    onLegacyGenerate,
    isPending,
    disabled,
}: {
    onLegacyGenerate: () => void;
    isPending: boolean;
    disabled: boolean;
}) {
    const { t } = useTranslation('exegesis');
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    onClick={(e) => e.stopPropagation()}
                    title={t('detail.steps.action.overflowMenuLabel')}
                    aria-label={t('detail.steps.action.overflowMenuLabel')}
                    className="px-2"
                >
                    {isPending
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <MoreVertical className="h-4 w-4" />}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                    onSelect={() => onLegacyGenerate()}
                    disabled={disabled}
                    className="flex flex-col items-start gap-0.5 py-2"
                >
                    <span className="text-xs font-medium">
                        {t('detail.steps.action.generateLegacySection')}
                    </span>
                    <span className="text-[10px] text-muted-foreground max-w-[280px] whitespace-normal leading-tight">
                        {t('detail.steps.action.generateLegacySectionTooltip')}
                    </span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}


/**
 * Compact summary chip the step header shows once verification has
 * run on the displayed version. Three flavors:
 *   - "all clear": green, count of verified.
 *   - "issues": orange/red, breakdown of mismatches.
 *   - empty (`null`) when verification has never run on this version.
 */
function VerificationBadge({ summary }: { summary: VerificationSummary }) {
    const { t } = useTranslation('exegesis');
    // `pageUnverifiable` cuenta acá o la insignia miente: una cita cuya
    // página no se pudo comprobar BLOQUEA la aceptación, y omitirla dejaba
    // el paso en verde de «todo en orden» mientras la puerta lo rechazaba.
    // Ausente en resúmenes viejos, que no midieron el estado.
    const issues = summary.counts.pageMismatch
        + summary.counts.notFound
        + summary.counts.fuzzyLow
        + (summary.counts.pageUnverifiable ?? 0);
    const allVerified = issues === 0 && summary.counts.verified > 0;
    if (summary.totalCitations === 0) return null;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px]',
                allVerified
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : issues > 0
                        ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                        : 'border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
            )}
            title={t('canonical.verify.badge.tooltip', {
                verified: summary.counts.verified,
                total: summary.totalCitations,
                issues,
            })}
        >
            <ShieldCheck className="h-2.5 w-2.5" />
            {summary.counts.verified}/{summary.totalCitations}
            {issues > 0 && (
                <span className="opacity-70">· {issues}!</span>
            )}
        </span>
    );
}

function StepIcon({ kind, state }: { kind: ExegeticalStep['kind']; state: ExegeticalStep['state'] }) {
    const Icon = STEP_ICONS[kind];
    const colorClass = state === 'accepted'
        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
        : state === 'failed'
            ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
            : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400';
    return (
        <div className={cn('shrink-0 w-8 h-8 rounded-full flex items-center justify-center', colorClass)}>
            <Icon className="h-4 w-4" />
        </div>
    );
}

const STEP_ICONS: Record<ExegeticalStep['kind'], typeof BookOpen> = {
    verse: BookOpen,
    conclusion: Bookmark,
    introduction: BookText,
    assembly: Layers,
};

function stepDisplayLabel(
    step: ExegeticalStep,
    language: SupportedLanguage,
    t: (key: string) => string
): string {
    if (step.kind === 'verse' && step.verseRef) {
        return formatPassageReference(step.verseRef, language);
    }
    return t(`detail.steps.kind.${step.kind}`);
}
