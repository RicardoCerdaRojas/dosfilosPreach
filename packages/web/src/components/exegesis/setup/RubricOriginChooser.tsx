import { useEffect, useState } from 'react';
import {
    AlertTriangle,
    Camera,
    CheckCircle2,
    Clipboard,
    GraduationCap,
    Loader2,
    Minus,
    Sparkles,
    Star,
    BookOpenCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    rubricPreset,
    type ExegeticalPaper,
    type PaperRubric,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { useTranslation } from '@/i18n';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { useUserRubrics } from '@/hooks/exegesis/useUserRubrics';

/**
 * De dónde sale la rúbrica: el elegidor de origen (foto/PDF, pegar texto, las
 * del sistema, una plantilla, ninguna) y los paneles de extracción.
 *
 * Vivía dentro de `RubricSubStep`, plegado detrás de «Cambiar de dónde sale la
 * rúbrica», un texto chico bajo el título que el fundador no encontraba
 * (Jonás 4:5-11). Ahora lo abre el botón «Rúbrica» del encabezado
 * (`PaperRubricButton`), en un modal, como el encuadre y la portada.
 */

// ── Extract-from-text panel ────────────────────────────────────────────

interface RubricExtractFromTextPanelProps {
    paper: ExegeticalPaper;
    /**
     * Called after a successful, high-confidence extraction. Lets the
     * caller close the surrounding dialog. Low-confidence or
     * has-review-notes results stay open so the student can read them
     * before dismissing.
     */
    onExtracted?: () => void;
}

interface ExtractionResultSummary {
    confidence: 'high' | 'medium' | 'low';
    reviewNotes: ReadonlyArray<string>;
}

export function RubricExtractFromTextPanel({ paper, onExtracted }: RubricExtractFromTextPanelProps) {
    const { t } = useTranslation('exegesis');
    const { extractRubricFromText } = useExegesisPapers();
    const [text, setText] = useState('');
    // Output language defaults to the paper's display language so the
    // extracted rubric's justifications match the language the student
    // will read during setup. Override when the student is producing a
    // paper in a different language than the rubric source.
    const [outputLanguage, setOutputLanguage] = useState<'es' | 'en'>(paper.displayLanguage);
    const [lastResult, setLastResult] = useState<ExtractionResultSummary | null>(null);

    const isExtracting = extractRubricFromText.isPending;
    const trimmedLength = text.trim().length;
    const canSubmit = trimmedLength >= 30 && !isExtracting;
    const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);

    const handleExtract = () => {
        if (!canSubmit) return;
        // The rubric being replaced may already carry user edits; the
        // confirm makes that explicit instead of silently nuking work.
        if (paper.rubric && paper.rubric.provenance === 'user-edited') {
            setConfirmReplaceOpen(true);
            return;
        }
        void doExtract();
    };

    const doExtract = async () => {
        setConfirmReplaceOpen(false);
        try {
            const result = await extractRubricFromText.mutateAsync({
                paperId: paper.id,
                rawText: text.trim(),
                language: outputLanguage,
            });
            setLastResult({
                confidence: result.confidence,
                reviewNotes: result.reviewNotes,
            });
            // Keep the text in the textarea so the student can re-extract
            // after editing the source — they often refine and retry.
            toast.success(t('paperSetup.subSteps.rubric.extract.success'));
            // Close the dialog only when the result is high confidence
            // and there are no review notes — otherwise the user wants
            // to read the result card before dismissing.
            if (onExtracted && result.confidence === 'high' && result.reviewNotes.length === 0) {
                onExtracted();
            }
        } catch (err) {
            console.error('[exegesis] extract rubric failed:', err);
            // The infrastructure layer tags Gemini 503/429 errors as
            // OverloadedError (via the `isExegesisOverload` marker on
            // the thrown instance). Surface the transient nature so the
            // student doesn't think their text is the problem.
            const isOverload = (err as { isExegesisOverload?: boolean })?.isExegesisOverload === true;
            toast.error(isOverload
                ? t('paperSetup.subSteps.rubric.extract.overloaded')
                : t('paperSetup.subSteps.rubric.extract.failed'),
            );
        }
    };

    return (
        <div className="space-y-3">
            <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                    {t('paperSetup.subSteps.rubric.extract.textareaLabel')}
                </label>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={t('paperSetup.subSteps.rubric.extract.textareaPlaceholder')}
                    rows={6}
                    disabled={isExtracting}
                    className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y disabled:opacity-50"
                />
                {trimmedLength > 0 && trimmedLength < 30 && (
                    <p className="text-[11px] text-warning-subtle-foreground mt-1 inline-flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {t('paperSetup.subSteps.rubric.extract.tooShort')}
                    </p>
                )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                    <label className="text-[11px] font-medium text-foreground">
                        {t('paperSetup.subSteps.rubric.extract.outputLanguageLabel')}
                    </label>
                    <select
                        value={outputLanguage}
                        onChange={(e) => setOutputLanguage(e.target.value as 'es' | 'en')}
                        disabled={isExtracting}
                        className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50"
                    >
                        <option value="es">{t('paperSetup.subSteps.rubric.extract.languageName.es')}</option>
                        <option value="en">{t('paperSetup.subSteps.rubric.extract.languageName.en')}</option>
                    </select>
                    <span className="text-[10px] text-muted-foreground italic">
                        {t('paperSetup.subSteps.rubric.extract.outputLanguageHint')}
                    </span>
                </div>
                <Button
                    type="button"
                    onClick={handleExtract}
                    disabled={!canSubmit}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                >
                    {isExtracting ? (
                        <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            {t('paperSetup.subSteps.rubric.extract.extracting')}
                        </>
                    ) : (
                        <>
                            <Sparkles className="h-3 w-3 mr-1" />
                            {t('paperSetup.subSteps.rubric.extract.submit')}
                        </>
                    )}
                </Button>
            </div>

            {lastResult && <ExtractionResultCard result={lastResult} />}

            <ConfirmDialog
                open={confirmReplaceOpen}
                onOpenChange={setConfirmReplaceOpen}
                title={t('paperSetup.subSteps.rubric.extract.confirmReplaceTitle')}
                body={t('paperSetup.subSteps.rubric.extract.confirmReplaceBody')}
                confirmLabel={t('paperSetup.subSteps.rubric.extract.confirmReplaceCta')}
                cancelLabel={t('setup.cancel')}
                onConfirm={doExtract}
            />
        </div>
    );
}

/**
 * Two-tab switcher inside the extract dialog: paste-text vs upload
 * document. Local state keeps the chosen tab — no need to bubble up
 * to the parent because the dialog is short-lived and re-opens fresh.
 */
export function ExtractSourceTabs({
    text,
    document,
    initialTab = 'text',
}: {
    text: React.ReactNode;
    document: React.ReactNode;
    initialTab?: 'text' | 'document';
}) {
    const { t } = useTranslation('exegesis');
    // Re-seed when `initialTab` changes (caller flips it from
    // chooser cards). Inside the dialog session the user can still
    // switch tabs freely; the seed only fires when the prop value
    // changes which mirrors a fresh open-from-chooser.
    const [tab, setTab] = useState<'text' | 'document'>(initialTab);
    useEffect(() => { setTab(initialTab); }, [initialTab]);
    return (
        <div className="space-y-3">
            <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-xs">
                <button
                    type="button"
                    onClick={() => setTab('text')}
                    className={`px-3 py-1.5 rounded transition-colors ${tab === 'text' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    {t('paperSetup.subSteps.rubric.extract.tabText')}
                </button>
                <button
                    type="button"
                    onClick={() => setTab('document')}
                    className={`px-3 py-1.5 rounded transition-colors ${tab === 'document' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    {t('paperSetup.subSteps.rubric.extract.tabDocument')}
                </button>
            </div>
            {tab === 'text' ? text : document}
        </div>
    );
}

interface RubricExtractFromDocumentPanelProps {
    paper: ExegeticalPaper;
    onExtracted?: () => void;
}

export function RubricExtractFromDocumentPanel({ paper, onExtracted }: RubricExtractFromDocumentPanelProps) {
    const { t } = useTranslation('exegesis');
    const { extractRubricFromDocument, extractRubricFromImage } = useExegesisPapers();
    const [file, setFile] = useState<File | null>(null);
    const [outputLanguage, setOutputLanguage] = useState<'es' | 'en'>(paper.displayLanguage);
    const [phase, setPhase] = useState<'idle' | 'uploading' | 'extracting' | 'analyzing' | 'encoding'>('idle');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [lastResult, setLastResult] = useState<ExtractionResultSummary | null>(null);
    const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);

    const isImageFile = (f: File | null): boolean => !!f && f.type.startsWith('image/');
    const isBusy =
        phase !== 'idle' ||
        extractRubricFromDocument.isPending ||
        extractRubricFromImage.isPending;
    const canSubmit = !!file && !isBusy;

    // Clipboard paste support: when the panel is mounted and idle, a
    // global paste anywhere on the page that contains an image item
    // gets routed into the file slot. The user can paste a screenshot
    // of their syllabus directly without opening a file picker first.
    useEffect(() => {
        if (isBusy) return;
        const onPaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item?.kind === 'file' && item.type.startsWith('image/')) {
                    const blob = item.getAsFile();
                    if (blob) {
                        const ext = blob.type.split('/')[1] || 'png';
                        const named = new File([blob], `pasted-rubric.${ext}`, { type: blob.type });
                        setFile(named);
                        toast.info(t('paperSetup.subSteps.rubric.extract.pastedToast'));
                        e.preventDefault();
                        return;
                    }
                }
            }
        };
        window.addEventListener('paste', onPaste);
        return () => window.removeEventListener('paste', onPaste);
    }, [isBusy, t]);

    const handleSubmit = () => {
        if (!canSubmit) return;
        if (paper.rubric && paper.rubric.provenance === 'user-edited') {
            setConfirmReplaceOpen(true);
            return;
        }
        void doExtract();
    };

    const doExtract = async () => {
        if (!file) return;
        setConfirmReplaceOpen(false);
        setLastResult(null);
        try {
            // Image path → Gemini Vision multimodal, no library upload.
            // PDF / EPUB path → existing library + LlamaParse pipeline.
            const result = isImageFile(file)
                ? await extractRubricFromImage.mutateAsync({
                    paperId: paper.id,
                    file,
                    language: outputLanguage,
                    onPhase: (p) => setPhase(p),
                })
                : await extractRubricFromDocument.mutateAsync({
                    paperId: paper.id,
                    file,
                    language: outputLanguage,
                    onUploadProgress: setUploadProgress,
                    onPhase: (p) => setPhase(p),
                });
            setLastResult({ confidence: result.confidence, reviewNotes: result.reviewNotes });
            toast.success(t('paperSetup.subSteps.rubric.extract.success'));
            if (onExtracted && result.confidence === 'high' && result.reviewNotes.length === 0) {
                onExtracted();
            }
        } catch (err) {
            console.error('[exegesis] extract rubric from document failed:', err);
            const isOverload = (err as { isExegesisOverload?: boolean })?.isExegesisOverload === true;
            toast.error(isOverload
                ? t('paperSetup.subSteps.rubric.extract.overloaded')
                : t('paperSetup.subSteps.rubric.extract.documentFailed'),
            );
        } finally {
            setPhase('idle');
            setUploadProgress(0);
        }
    };

    return (
        <div className="space-y-3">
            <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                    {t('paperSetup.subSteps.rubric.extract.documentLabel')}
                </label>
                <FileDropzone
                    accept=".pdf,application/pdf,image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                    value={file}
                    onChange={setFile}
                    disabled={isBusy}
                    size="compact"
                    emptyLabel={t('paperSetup.subSteps.rubric.extract.documentDropzone')}
                    hint={t('paperSetup.subSteps.rubric.extract.documentHint')}
                    maxSizeMB={20}
                />
            </div>

            {phase !== 'idle' && (
                <div className="rounded-md border border-info/30 bg-info-subtle px-3 py-2 text-[11px] text-info-subtle-foreground">
                    <p className="inline-flex items-center gap-1.5 font-medium">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {t(`paperSetup.subSteps.rubric.extract.phase.${phase}`)}
                    </p>
                    {phase === 'uploading' && uploadProgress > 0 && (
                        <p className="mt-0.5 opacity-80">{Math.round(uploadProgress)}%</p>
                    )}
                </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                    <label className="text-[11px] font-medium text-foreground">
                        {t('paperSetup.subSteps.rubric.extract.outputLanguageLabel')}
                    </label>
                    <select
                        value={outputLanguage}
                        onChange={(e) => setOutputLanguage(e.target.value as 'es' | 'en')}
                        disabled={isBusy}
                        className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50"
                    >
                        <option value="es">{t('paperSetup.subSteps.rubric.extract.languageName.es')}</option>
                        <option value="en">{t('paperSetup.subSteps.rubric.extract.languageName.en')}</option>
                    </select>
                </div>
                <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                >
                    {isBusy ? (
                        <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            {t('paperSetup.subSteps.rubric.extract.extracting')}
                        </>
                    ) : (
                        <>
                            <Sparkles className="h-3 w-3 mr-1" />
                            {t('paperSetup.subSteps.rubric.extract.submitDocument')}
                        </>
                    )}
                </Button>
            </div>

            {lastResult && <ExtractionResultCard result={lastResult} />}

            <ConfirmDialog
                open={confirmReplaceOpen}
                onOpenChange={setConfirmReplaceOpen}
                title={t('paperSetup.subSteps.rubric.extract.confirmReplaceTitle')}
                body={t('paperSetup.subSteps.rubric.extract.confirmReplaceBody')}
                confirmLabel={t('paperSetup.subSteps.rubric.extract.confirmReplaceCta')}
                cancelLabel={t('setup.cancel')}
                onConfirm={doExtract}
            />
        </div>
    );
}

function ExtractionResultCard({ result }: { result: ExtractionResultSummary }) {
    const { t } = useTranslation('exegesis');
    const confidenceLabel = t(`paperSetup.subSteps.rubric.extract.confidence${capitalize(result.confidence)}` as any);
    const confidenceHint = t(`paperSetup.subSteps.rubric.extract.confidenceHint.${result.confidence}` as any);
    const tone = result.confidence === 'low'
        ? 'bg-warning-subtle border-warning/30 text-warning-subtle-foreground'
        : result.confidence === 'medium'
            ? 'bg-info-subtle border-info/30 text-info-subtle-foreground'
            : 'bg-success-subtle border-success/30 text-success-subtle-foreground';

    return (
        <div className={`rounded-md border ${tone} p-3 space-y-1.5`}>
            <p className="text-xs font-semibold inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {confidenceLabel}
            </p>
            <p className="text-[11px] leading-snug">{confidenceHint}</p>
            {result.reviewNotes.length > 0 && (
                <details className="text-[11px]">
                    <summary className="cursor-pointer font-medium">
                        {t('paperSetup.subSteps.rubric.extract.reviewNotesTitle')} ({result.reviewNotes.length})
                    </summary>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        {result.reviewNotes.map((n, i) => (
                            <li key={i}>{n}</li>
                        ))}
                    </ul>
                </details>
            )}
        </div>
    );
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Setup chooser (single explicit entry point) ────────────────────────
//
// Five-card chooser that replaces the old templates-panel + extract
// header button. Each card maps to one of the discrete ways a
// student can populate `paper.rubric`:
//
//   📷 Photo/PDF        → opens extract dialog on the document tab
//   📄 Paste text       → opens extract dialog on the text tab
//   🎓 TMS default      → resets to the system-default rubric
//   ⭐ Saved template   → expands inline picker, then applies
//   ➖ No formal rubric → applies the strategy-only preset
//
// The card matching the current rubric state shows an "✓ En uso"
// badge so the student can see at a glance what's active. Cards
// that would replace a user-edited rubric show a confirm dialog
// before firing — same behavior the old templates-panel had, kept
// because losing manual tweaks silently is a real footgun.
//
// Photo/paste are wired through callback props because the dialog
// state lives in the parent (so it can also drive the dialog tab
// selection without prop-drilling deep). The other three actions
// fire local mutations because the chooser owns the templates
// inline picker + confirm dialog state already.

interface RubricSetupChooserProps {
    paper: ExegeticalPaper;
    rubric: PaperRubric;
    onPhotoOrPdf: () => void;
    onPasteText: () => void;
}

export function RubricSetupChooser({ paper, rubric, onPhotoOrPdf, onPasteText }: RubricSetupChooserProps) {
    const { t } = useTranslation('exegesis');
    const { rubrics, applyTemplate, applyStrategyOnly } = useUserRubrics();
    const { resetRubric } = useExegesisPapers();

    // Detect the active card so we can render an "✓ En uso" badge.
    // Mirrors the resolution rules the old templates-panel used.
    const activeCard: 'photo' | 'paste' | 'default' | 'preaching' | 'template' | 'none' | null = (() => {
        if (rubric.provenance === 'extracted-from-document') return 'photo';
        if (rubric.provenance === 'extracted-from-text') return 'paste';
        if (rubric.provenance === 'from-template') {
            const tmplId = rubric.sourceTemplateId;
            if (tmplId && rubrics.some(r => r.id === tmplId)) return 'template';
            return null;
        }
        if (rubric.provenance === 'system-default') {
            // Cuál de las del sistema: `rubricPreset` (campo guardado, o la
            // heurística del ancla en documentos viejos).
            const preset = rubricPreset(rubric);
            return preset === 'strategy-only' ? 'none' : preset === 'preaching' ? 'preaching' : 'default';
        }
        // user-edited → don't badge any card; the user has diverged
        // from every preset.
        return null;
    })();

    // Inline picker for the template card. Toggles open when the
    // student clicks the template card; collapses back when they
    // pick + apply or click the card again.
    const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

    // Confirmation routing: when the current rubric is user-edited,
    // any apply action confirms before firing. We stash the pending
    // action in state so a single ConfirmDialog instance can drive
    // them all.
    const [pendingAction, setPendingAction] = useState<
        | { kind: 'default' }
        | { kind: 'preaching' }
        | { kind: 'none' }
        | { kind: 'template'; templateId: string }
        | null
    >(null);

    const applyPending = applyTemplate.isPending || applyStrategyOnly.isPending || resetRubric.isPending;

    const requestApply = (action: NonNullable<typeof pendingAction>) => {
        if (rubric.provenance === 'user-edited') {
            setPendingAction(action);
            return;
        }
        void doApply(action);
    };

    const doApply = async (action: NonNullable<typeof pendingAction>) => {
        setPendingAction(null);
        try {
            if (action.kind === 'default') {
                await resetRubric.mutateAsync({ paperId: paper.id });
            } else if (action.kind === 'preaching') {
                await resetRubric.mutateAsync({ paperId: paper.id, preset: 'preaching' });
            } else if (action.kind === 'none') {
                await applyStrategyOnly.mutateAsync({ paperId: paper.id });
            } else {
                await applyTemplate.mutateAsync({
                    paperId: paper.id,
                    rubricTemplateId: action.templateId,
                });
            }
            toast.success(t('paperSetup.subSteps.rubric.templates.applied'));
            setTemplatePickerOpen(false);
        } catch (err) {
            console.error('[exegesis] apply rubric failed:', err);
            toast.error(t('paperSetup.subSteps.rubric.templates.applyFailed'));
        }
    };

    const cards: ReadonlyArray<{
        kind: 'photo' | 'paste' | 'default' | 'preaching' | 'template' | 'none';
        icon: React.ReactNode;
        label: string;
        hint: string;
        onClick: () => void;
        disabled?: boolean;
    }> = [
        {
            kind: 'photo',
            icon: <Camera className="h-5 w-5" />,
            label: t('paperSetup.subSteps.rubric.chooser.cards.photo.label'),
            hint: t('paperSetup.subSteps.rubric.chooser.cards.photo.hint'),
            onClick: onPhotoOrPdf,
        },
        {
            kind: 'paste',
            icon: <Clipboard className="h-5 w-5" />,
            label: t('paperSetup.subSteps.rubric.chooser.cards.paste.label'),
            hint: t('paperSetup.subSteps.rubric.chooser.cards.paste.hint'),
            onClick: onPasteText,
        },
        {
            kind: 'default',
            icon: <GraduationCap className="h-5 w-5" />,
            label: t('paperSetup.subSteps.rubric.chooser.cards.default.label'),
            hint: t('paperSetup.subSteps.rubric.chooser.cards.default.hint'),
            onClick: () => requestApply({ kind: 'default' }),
        },
        {
            kind: 'preaching',
            icon: <BookOpenCheck className="h-5 w-5" />,
            label: t('paperSetup.subSteps.rubric.chooser.cards.preaching.label'),
            hint: t('paperSetup.subSteps.rubric.chooser.cards.preaching.hint'),
            onClick: () => requestApply({ kind: 'preaching' }),
        },
        {
            kind: 'template',
            icon: <Star className="h-5 w-5" />,
            label: t('paperSetup.subSteps.rubric.chooser.cards.template.label'),
            hint: rubrics.length === 0
                ? t('paperSetup.subSteps.rubric.chooser.cards.template.empty')
                : t('paperSetup.subSteps.rubric.chooser.cards.template.hint', { count: rubrics.length }),
            onClick: () => setTemplatePickerOpen(o => !o),
            disabled: rubrics.length === 0,
        },
        {
            kind: 'none',
            icon: <Minus className="h-5 w-5" />,
            label: t('paperSetup.subSteps.rubric.chooser.cards.none.label'),
            hint: t('paperSetup.subSteps.rubric.chooser.cards.none.hint'),
            onClick: () => requestApply({ kind: 'none' }),
        },
    ];

    return (
        <section className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
            <header>
                <h3 className="text-sm font-semibold text-foreground">
                    {t('paperSetup.subSteps.rubric.chooser.title')}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t('paperSetup.subSteps.rubric.chooser.subtitle')}
                </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {cards.map(card => {
                    const isActive = activeCard === card.kind;
                    const isExpanded = card.kind === 'template' && templatePickerOpen;
                    return (
                        <button
                            key={card.kind}
                            type="button"
                            onClick={card.onClick}
                            disabled={card.disabled || applyPending}
                            className={[
                                'rounded-lg border text-left p-3 space-y-1.5 transition-colors',
                                'focus:outline-none focus:ring-2 focus:ring-primary/40',
                                'disabled:opacity-50 disabled:cursor-not-allowed',
                                isActive
                                    ? 'border-success bg-success-subtle'
                                    : isExpanded
                                        ? 'border-primary bg-card'
                                        : 'border-border bg-card hover:border-primary/60 hover:bg-card',
                            ].join(' ')}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <span className={isActive ? 'text-success' : 'text-muted-foreground'}>
                                    {card.icon}
                                </span>
                                {isActive && (
                                    <span className="text-[10px] uppercase tracking-wide font-semibold text-success">
                                        {t('paperSetup.subSteps.rubric.chooser.activeBadge')}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs font-semibold text-foreground leading-tight">
                                {card.label}
                            </p>
                            <p className="text-[11px] text-muted-foreground leading-snug">
                                {card.hint}
                            </p>
                        </button>
                    );
                })}
            </div>

            {templatePickerOpen && rubrics.length > 0 && (
                <div className="rounded-md border border-primary/30 bg-card p-3 space-y-2">
                    <p className="text-[11px] font-medium text-foreground">
                        {t('paperSetup.subSteps.rubric.chooser.cards.template.pickerLabel')}
                    </p>
                    <ul className="space-y-1">
                        {rubrics.map(template => {
                            const isCurrent = rubric.sourceTemplateId === template.id;
                            return (
                                <li key={template.id}>
                                    <button
                                        type="button"
                                        onClick={() => requestApply({ kind: 'template', templateId: template.id })}
                                        disabled={applyPending || isCurrent}
                                        className="w-full text-left px-2.5 py-1.5 rounded text-xs hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-between gap-2"
                                    >
                                        <span className="font-medium text-foreground truncate">{template.displayName}</span>
                                        {isCurrent && (
                                            <span className="text-[10px] uppercase tracking-wide font-semibold text-success shrink-0">
                                                {t('paperSetup.subSteps.rubric.chooser.activeBadge')}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {applyPending && (
                <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t('paperSetup.subSteps.rubric.templates.applyCta')}…
                </p>
            )}

            <ConfirmDialog
                open={pendingAction !== null}
                onOpenChange={(open) => { if (!open) setPendingAction(null); }}
                title={t('paperSetup.subSteps.rubric.templates.applyConfirmTitle')}
                body={t('paperSetup.subSteps.rubric.templates.applyConfirmBody')}
                confirmLabel={t('paperSetup.subSteps.rubric.templates.applyConfirmCta')}
                cancelLabel={t('setup.cancel')}
                onConfirm={() => { if (pendingAction) void doApply(pendingAction); }}
            />
        </section>
    );
}

