import { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Camera,
    CheckCircle2,
    Clipboard,
    FileCheck2,
    GraduationCap,
    Loader2,
    Minus,
    RotateCcw,
    Pencil,
    Save,
    Sparkles,
    Star,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    SOURCE_TYPE_GROUPS,
    getEffectiveStructuralExpectations,
    getSourceTypeOrderIndex,
    type ExegeticalPaper,
    type PaperRubric,
    type LineSpacing,
    type QualityCriterion,
    type SourceRequirement,
    type SourceType,
} from '@dosfilos/domain';
import { QualityCriteriaEditor } from '@/components/exegesis/rubric/QualityCriteriaEditor';
import { RequirementRow, AddRequirementButton } from '@/components/exegesis/rubric/RequirementRow';
import { RubricRigorIndicator } from '@/components/exegesis/rubric/RubricRigorIndicator';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FileDropzone } from '@/components/ui/file-dropzone';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { useUserRubrics } from '@/hooks/exegesis/useUserRubrics';
import { useUserStyleGuides } from '@/hooks/exegesis/useUserStyleGuides';

/**
 * Rubric editor.
 *
 * Sections (top to bottom):
 *   1. Provenance + upload-soon banner.
 *   2. Metadata: title, description, citation standard, expected length.
 *   3. Corpus requirements: full CRUD list. The most-likely customization
 *      surface — students tweak minimums when their seminary is more
 *      lenient or stricter than the academic default.
 *   4. Structural recommendations: read-only summary of what each step
 *      should emphasize. Edits to per-kind emphasis live in the Plan
 *      tab (2G); the rubric defines the source-of-truth recommendation,
 *      the plan stores the student's accepted/customized version.
 *
 * Local-state-then-save pattern: edits stage in component state and
 * only persist on "Save". This keeps the orchestrator's view of the
 * rubric stable mid-edit and lets the student abandon changes by
 * navigating away.
 */
interface RubricSubStepProps {
    paper: ExegeticalPaper;
}

export function RubricSubStep({ paper }: RubricSubStepProps) {
    const { t } = useTranslation('exegesis');
    const rubric = paper.rubric;

    if (!rubric) {
        return (
            <div className="space-y-3">
                <header className="flex items-start gap-3">
                    <FileCheck2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">
                            {t('paperSetup.subSteps.rubric.heading')}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {t('paperSetup.subSteps.rubric.description')}
                        </p>
                    </div>
                </header>
                <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t('paperSetup.subSteps.rubric.loading')}
                </p>
            </div>
        );
    }

    return <RubricEditor paper={paper} rubric={rubric} />;
}

// ── Editor ─────────────────────────────────────────────────────────────

interface RubricEditorProps {
    paper: ExegeticalPaper;
    rubric: PaperRubric;
}

function RubricEditor({ paper, rubric }: RubricEditorProps) {
    const { t } = useTranslation('exegesis');
    // The mutation lives in this component because the click handlers
    // (handleSave / handleReset) trigger it from here. Reading the
    // pending state from the SAME hook instance keeps the spinner in
    // sync with the actual in-flight call — earlier the parent passed
    // pending state from a separate useExegesisPapers() instance and
    // the spinner never flipped.
    const { updateRubric, resetRubric } = useExegesisPapers();
    const updatePending = updateRubric.isPending;
    const resetPending = resetRubric.isPending;

    // View mode for the rubric body.
    //   'summary'  → compact read-only digest (default landing).
    //   'editing'  → the full form with inputs / requirement CRUD.
    // Picking a template or extracting from text always lands the
    // user back in 'summary' so they can SEE the result before
    // committing to a manual tweak. The "Editar rúbrica" button
    // flips to 'editing'; saving or cancelling flips back.
    const [mode, setMode] = useState<'summary' | 'editing'>('summary');

    // Extract dialog state. The 5-card chooser routes the user here:
    // photo/PDF card → opens with `document` tab, paste card → opens
    // with `text` tab. `extractInitialTab` seeds the dialog tab on
    // open and resets back to null on close so a fresh open from a
    // different card lands on the right tab.
    const [extractOpen, setExtractOpen] = useState(false);
    const [extractInitialTab, setExtractInitialTab] = useState<'text' | 'document'>('text');

    // Form state seeded from the persisted rubric. Re-syncs whenever
    // the persisted rubric reference changes (e.g. another tab saved
    // or reset). In-flight edits are lost on those events — that's
    // acceptable for v1 since concurrent multi-tab editing is rare.
    const [description, setDescription] = useState<string>(rubric.description ?? '');
    const [citationStandard, setCitationStandard] = useState<string>(rubric.citationStandard ?? '');
    const [lengthUnit, setLengthUnit] = useState<'pages' | 'words'>(rubric.expectedLength?.unit ?? 'pages');
    const [lengthMin, setLengthMin] = useState<string>(rubric.expectedLength?.min?.toString() ?? '');
    const [lengthMax, setLengthMax] = useState<string>(rubric.expectedLength?.max?.toString() ?? '');
    const [requirements, setRequirements] = useState<SourceRequirement[]>([...rubric.sourceRequirements]);
    const [qualityCriteria, setQualityCriteria] = useState<ReadonlyArray<QualityCriterion>>(rubric.qualityCriteria);
    // «Como la casa» es un valor distinto de «doble espacio»: el primero sigue
    // a la guía si algún día cambia, el segundo la fija en esta entrega.
    const [lineSpacing, setLineSpacing] = useState<LineSpacing | 'default'>(
        rubric.formatting?.lineSpacing ?? 'default');
    const [blankLine, setBlankLine] = useState<boolean>(
        rubric.formatting?.blankLineBetweenParagraphs ?? false);
    // Tab inside the editor: 'prescriptive' (the existing form for
    // metadata + requirements + structural) vs 'qualitative' (the
    // levels-grid criteria). Editing is shared across tabs — Save
    // commits both at once.
    const [editTab, setEditTab] = useState<'prescriptive' | 'qualitative'>('prescriptive');

    useEffect(() => {
        setDescription(rubric.description ?? '');
        setCitationStandard(rubric.citationStandard ?? '');
        setLengthUnit(rubric.expectedLength?.unit ?? 'pages');
        setLengthMin(rubric.expectedLength?.min?.toString() ?? '');
        setLengthMax(rubric.expectedLength?.max?.toString() ?? '');
        setRequirements([...rubric.sourceRequirements]);
        setQualityCriteria(rubric.qualityCriteria);
        setLineSpacing(rubric.formatting?.lineSpacing ?? 'default');
        setBlankLine(rubric.formatting?.blankLineBetweenParagraphs ?? false);
        // When the rubric reference changes (template applied / extracted /
        // reset), drop edit mode so the user sees the new content first.
        setMode('summary');
        setEditTab('prescriptive');
    }, [rubric]);

    const usedTypes = useMemo(() => new Set(requirements.map(r => r.sourceType)), [requirements]);
    const allSourceTypes = useMemo(
        () => SOURCE_TYPE_GROUPS.flatMap(g => g.types as ReadonlyArray<SourceType>),
        [],
    );
    const availableTypes = useMemo(
        () => allSourceTypes.filter(typ => !usedTypes.has(typ)),
        [allSourceTypes, usedTypes],
    );
    const sortedRequirements = useMemo(
        () => [...requirements].sort(
            (a, b) => getSourceTypeOrderIndex(a.sourceType) - getSourceTypeOrderIndex(b.sourceType),
        ),
        [requirements],
    );
    const presentTypes = useMemo(
        () => sortedRequirements.map(r => r.sourceType),
        [sortedRequirements],
    );
    // Live form snapshot for the rigor indicator — updates as the
    // user adds/removes requirements without waiting for save.
    const liveRubric = useMemo(() => ({
        ...rubric,
        sourceRequirements: requirements,
    }), [rubric, requirements]);

    const handleSave = async () => {
        const minN = lengthMin === '' ? null : Number(lengthMin);
        const maxN = lengthMax === '' ? null : Number(lengthMax);
        const expectedLength = (minN === null && maxN === null)
            ? null
            : { unit: lengthUnit, min: minN, max: maxN };
        try {
            await updateRubric.mutateAsync({
                paperId: paper.id,
                description: description.trim() || null,
                citationStandard: citationStandard.trim() || null,
                expectedLength,
                sourceRequirements: requirements,
                qualityCriteria,
                formatting: lineSpacing === 'default'
                    ? null
                    : { lineSpacing, blankLineBetweenParagraphs: blankLine },
            });
            toast.success(t('paperSetup.subSteps.rubric.actions.saved'));
            // The useEffect on [rubric] will flip mode back to
            // summary when the refetched rubric arrives, but we set
            // it here too so the transition is immediate (no flicker
            // of stale form values).
            setMode('summary');
        } catch (err) {
            console.error('[exegesis] save rubric failed:', err);
            toast.error(t('paperSetup.subSteps.rubric.actions.saveFailed'));
        }
    };

    const [confirmResetOpen, setConfirmResetOpen] = useState(false);

    const handleReset = () => setConfirmResetOpen(true);

    const doReset = async () => {
        setConfirmResetOpen(false);
        try {
            await resetRubric.mutateAsync({ paperId: paper.id });
            toast.success(t('paperSetup.subSteps.rubric.actions.resetDone'));
        } catch (err) {
            console.error('[exegesis] reset rubric failed:', err);
            toast.error(t('paperSetup.subSteps.rubric.actions.resetFailed'));
        }
    };

    // Patch handlers key on sourceType (unique) instead of array
    // index, so the sorted render-order doesn't have to match the
    // storage order.
    const updateRequirement = (sourceType: SourceType, patch: Partial<SourceRequirement>) => {
        setRequirements(reqs => reqs.map(r => (r.sourceType === sourceType ? { ...r, ...patch } : r)));
    };

    const removeRequirement = (sourceType: SourceType) => {
        setRequirements(reqs => reqs.filter(r => r.sourceType !== sourceType));
    };

    const addRequirement = (type: SourceType) => {
        if (usedTypes.has(type)) {
            toast.error(t('paperSetup.subSteps.rubric.requirements.duplicateError'));
            return;
        }
        setRequirements(reqs => [
            ...reqs,
            {
                sourceType: type,
                minimum: 1,
                maximum: null,
                justification: '',
            },
        ]);
    };

    return (
        <div className="space-y-6">
            <header className="flex items-start gap-3">
                <FileCheck2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
                        {t('paperSetup.subSteps.rubric.heading')}
                        <span className="text-[10px] uppercase tracking-wide font-semibold rounded-full bg-muted text-muted-foreground px-2 py-0.5">
                            {t(`paperSetup.subSteps.rubric.provenance.${rubric.provenance}`)}
                        </span>
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {t('paperSetup.subSteps.rubric.description')}
                    </p>
                </div>
            </header>

            {/* Single explicit entry point. The 5 cards collapse what
                used to be a templates panel + a separate "Extract"
                header button into one obvious chooser. The active
                option is badged so the student always knows what's in
                effect. */}
            <RubricSetupChooser
                paper={paper}
                rubric={rubric}
                onPhotoOrPdf={() => {
                    setExtractInitialTab('document');
                    setExtractOpen(true);
                }}
                onPasteText={() => {
                    setExtractInitialTab('text');
                    setExtractOpen(true);
                }}
            />

            <Dialog open={extractOpen} onOpenChange={setExtractOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="inline-flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-success" />
                            {t('paperSetup.subSteps.rubric.extract.title')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('paperSetup.subSteps.rubric.extract.subtitle')}
                        </DialogDescription>
                    </DialogHeader>
                    <ExtractSourceTabs
                        initialTab={extractInitialTab}
                        text={<RubricExtractFromTextPanel paper={paper} onExtracted={() => setExtractOpen(false)} />}
                        document={<RubricExtractFromDocumentPanel paper={paper} onExtracted={() => setExtractOpen(false)} />}
                    />
                </DialogContent>
            </Dialog>

            {mode === 'summary' && (
                <RubricSummaryView
                    paper={paper}
                    rubric={rubric}
                    onEdit={() => setMode('editing')}
                    onReset={handleReset}
                    resetPending={resetPending}
                />
            )}

            {mode === 'editing' && (
                <>

            {/* ── Tab bar (Prescriptiva | Cualitativa) ── */}
            <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-xs">
                <button
                    type="button"
                    onClick={() => setEditTab('prescriptive')}
                    className={`px-3 py-1.5 rounded transition-colors ${editTab === 'prescriptive' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    {t('paperSetup.subSteps.rubric.editor.tabPrescriptive')}
                </button>
                <button
                    type="button"
                    onClick={() => setEditTab('qualitative')}
                    className={`px-3 py-1.5 rounded transition-colors ${editTab === 'qualitative' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    {t('paperSetup.subSteps.rubric.editor.tabQualitative')}
                </button>
            </div>
            <p className="text-[11px] text-muted-foreground italic -mt-2">
                {editTab === 'prescriptive'
                    ? t('paperSetup.subSteps.rubric.editor.tabPrescriptiveHint')
                    : t('paperSetup.subSteps.rubric.editor.tabQualitativeHint')}
            </p>

            {editTab === 'qualitative' && (
                <QualityCriteriaEditor
                    paperId={paper.id}
                    language={paper.displayLanguage}
                    criteria={qualityCriteria}
                    onChange={setQualityCriteria}
                    disabled={updatePending}
                />
            )}

            {editTab === 'prescriptive' && (
                <>

            {/* ── Metadata ── */}
            <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                    {t('paperSetup.subSteps.rubric.metadata.title')}
                </h3>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1">
                            {t('paperSetup.subSteps.rubric.metadata.descriptionLabel')}
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={t('paperSetup.subSteps.rubric.metadata.descriptionPlaceholder')}
                            rows={3}
                            className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1 italic">
                            {t('paperSetup.subSteps.rubric.metadata.descriptionHint')}
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                        <CitationStandardField
                            paper={paper}
                            value={citationStandard}
                            onChange={setCitationStandard}
                        />
                        <div>
                            <label className="block text-xs font-medium text-foreground mb-1">
                                {t('paperSetup.subSteps.rubric.metadata.lengthLabel')}
                            </label>
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="number"
                                    min={0}
                                    value={lengthMin}
                                    onChange={(e) => setLengthMin(e.target.value)}
                                    placeholder={t('paperSetup.subSteps.rubric.metadata.lengthMinPlaceholder')}
                                    className="w-20 rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                                />
                                <span className="text-xs text-muted-foreground">—</span>
                                <input
                                    type="number"
                                    min={0}
                                    value={lengthMax}
                                    onChange={(e) => setLengthMax(e.target.value)}
                                    placeholder={t('paperSetup.subSteps.rubric.metadata.lengthMaxPlaceholder')}
                                    className="w-20 rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                                />
                                <select
                                    value={lengthUnit}
                                    onChange={(e) => setLengthUnit(e.target.value as 'pages' | 'words')}
                                    className="rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                                >
                                    <option value="pages">{t('paperSetup.subSteps.rubric.metadata.lengthUnitPages')}</option>
                                    <option value="words">{t('paperSetup.subSteps.rubric.metadata.lengthUnitWords')}</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1">
                            {t('paperSetup.subSteps.rubric.metadata.formattingLabel')}
                        </label>
                        <div className="flex flex-wrap items-center gap-3">
                            <select
                                value={lineSpacing}
                                onChange={(e) => setLineSpacing(e.target.value as LineSpacing | 'default')}
                                className="rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                            >
                                <option value="default">{t('paperSetup.subSteps.rubric.metadata.spacingDefault')}</option>
                                <option value="single">{t('paperSetup.subSteps.rubric.metadata.spacingSingle')}</option>
                                <option value="one-and-a-half">{t('paperSetup.subSteps.rubric.metadata.spacingOneAndAHalf')}</option>
                                <option value="double">{t('paperSetup.subSteps.rubric.metadata.spacingDouble')}</option>
                            </select>
                            <label className="inline-flex items-center gap-1.5 text-xs text-foreground">
                                <input
                                    type="checkbox"
                                    checked={blankLine}
                                    disabled={lineSpacing === 'default'}
                                    onChange={(e) => setBlankLine(e.target.checked)}
                                    className="rounded border-border"
                                />
                                {t('paperSetup.subSteps.rubric.metadata.blankLineLabel')}
                            </label>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 italic">
                            {t('paperSetup.subSteps.rubric.metadata.formattingHint')}
                        </p>
                    </div>
                </div>
            </section>

            {/* ── Source requirements ── */}
            <section className="space-y-3">
                <header>
                    <h3 className="text-sm font-semibold text-foreground">
                        {t('paperSetup.subSteps.rubric.requirements.title')}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {t('paperSetup.subSteps.rubric.requirements.subtitle')}
                    </p>
                </header>
                <RubricRigorIndicator rubric={liveRubric} />
                {sortedRequirements.length === 0 ? (
                    <p className="text-xs text-warning-subtle-foreground italic">
                        {t('paperSetup.subSteps.rubric.requirements.empty')}
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {sortedRequirements.map((req) => (
                            <RequirementRow
                                key={req.sourceType}
                                requirement={req}
                                onChange={(patch) => updateRequirement(req.sourceType, patch)}
                                onRemove={() => removeRequirement(req.sourceType)}
                                presentTypes={presentTypes}
                            />
                        ))}
                    </ul>
                )}
                <AddRequirementButton availableTypes={availableTypes} onAdd={addRequirement} />
            </section>

            {/* ── Structural read-only ── */}
            <section className="space-y-3">
                <header>
                    <h3 className="text-sm font-semibold text-foreground">
                        {t('paperSetup.subSteps.rubric.structural.title')}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {t('paperSetup.subSteps.rubric.structural.subtitle')}
                    </p>
                </header>
                <ul className="space-y-2">
                    {(['introduction', 'verse', 'conclusion'] as const).map(section => {
                        const exp = getEffectiveStructuralExpectations(paper).find(e => e.section === section);
                        return (
                            <li
                                key={section}
                                className="rounded-lg border border-border bg-muted/40 p-3 text-xs space-y-1.5"
                            >
                                <p className="font-medium text-foreground">
                                    {t(`paperSetup.subSteps.rubric.structural.section.${section}`)}
                                </p>
                                {exp ? (
                                    <>
                                        <p className="text-muted-foreground">
                                            <span className="font-medium">{t('paperSetup.subSteps.rubric.structural.emphasizedTypesLabel')}:</span>{' '}
                                            {exp.emphasizedTypes.length === 0
                                                ? '—'
                                                : exp.emphasizedTypes.map(typ => t(`sourceTypes.${typ}.label`)).join(', ')}
                                        </p>
                                        <p className="text-muted-foreground italic">
                                            {(() => {
                                                if (exp.justificationKey) return t(exp.justificationKey);
                                                // Same migration-friendly fallback as StepKindEmphasisCard:
                                                // pre-key system-default rubrics persisted English literals.
                                                if (rubric.provenance === 'system-default') {
                                                    return t(`paperSetup.subSteps.plan.rubricJustification.${section}`);
                                                }
                                                return exp.justification;
                                            })()}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-muted-foreground italic">
                                        {t('paperSetup.subSteps.rubric.structural.noExpectation')}
                                    </p>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </section>

                </>
            )}

            {/* ── Actions ── */}
            <footer className="flex items-center justify-between pt-4 border-t border-border">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setMode('summary')}
                    disabled={updatePending}
                    className="text-xs"
                >
                    {t('setup.cancel')}
                </Button>
                <Button
                    type="button"
                    onClick={handleSave}
                    disabled={updatePending}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                >
                    {updatePending ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                        <Save className="h-3 w-3 mr-1" />
                    )}
                    {t('paperSetup.subSteps.rubric.actions.save')}
                </Button>
            </footer>

                </>
            )}

            <ConfirmDialog
                open={confirmResetOpen}
                onOpenChange={setConfirmResetOpen}
                title={t('paperSetup.subSteps.rubric.actions.resetConfirmTitle')}
                body={t('paperSetup.subSteps.rubric.actions.resetConfirmBody')}
                confirmLabel={t('paperSetup.subSteps.rubric.actions.resetConfirmCta')}
                cancelLabel={t('setup.cancel')}
                onConfirm={doReset}
            />
        </div>
    );
}

// ── Summary view (default) ─────────────────────────────────────────────
//
// Compact read-only digest of the paper's current rubric. Lands as
// the default mode of the editor — most students just want to see
// what's there, NOT immediately fill out a 13-field form. Edit kicks
// in only when the student clicks "Editar rúbrica".
//
// Sections rendered:
//   - Provenance + last-updated badge
//   - Title + description (when present)
//   - Citation standard + expected length
//   - Requirements as compact list (type · count · justification)
//   - Structural recommendations summary
//   - Footer actions: Editar rúbrica + Resetear al default

function RubricSummaryView({
    paper,
    rubric,
    onEdit,
    onReset,
    resetPending,
}: {
    paper: ExegeticalPaper;
    rubric: PaperRubric;
    onEdit: () => void;
    onReset: () => void;
    resetPending: boolean;
}) {
    const { t } = useTranslation('exegesis');
    // Render in canonical academic-priority order regardless of how
    // they were inserted into the rubric.
    const sortedRequirements = [...rubric.sourceRequirements].sort(
        (a, b) => getSourceTypeOrderIndex(a.sourceType) - getSourceTypeOrderIndex(b.sourceType),
    );
    const visibleRequirements = sortedRequirements.filter(r => r.minimum > 0);
    const optionalRequirements = sortedRequirements.filter(r => r.minimum === 0);

    return (
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
            <header className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-foreground">
                        {t('paperSetup.subSteps.rubric.heading')}
                    </h3>
                    {rubric.description && (
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                            {rubric.description}
                        </p>
                    )}
                </div>
                <Button
                    type="button"
                    onClick={onEdit}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs shrink-0"
                >
                    <Pencil className="h-3 w-3 mr-1" />
                    {t('paperSetup.subSteps.rubric.summary.editCta')}
                </Button>
            </header>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <SummaryField
                    label={t('paperSetup.subSteps.rubric.metadata.citationStandardLabel')}
                    value={summarizeCitationStandard(rubric, paper)}
                />
                <SummaryField
                    label={t('paperSetup.subSteps.rubric.metadata.lengthLabel')}
                    value={summarizeLength(rubric, t)}
                />
            </dl>

            <RubricRigorIndicator rubric={rubric} />

            <div className="space-y-1.5">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('paperSetup.subSteps.rubric.summary.requirementsTitle')}
                </h4>
                {visibleRequirements.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                        {t('paperSetup.subSteps.rubric.requirements.empty')}
                    </p>
                ) : (
                    <ul className="space-y-1.5">
                        {visibleRequirements.map(r => (
                            <SummaryRequirementRow key={r.sourceType} requirement={r} />
                        ))}
                    </ul>
                )}
                {optionalRequirements.length > 0 && (
                    <p className="text-[11px] text-muted-foreground italic mt-2">
                        {t('paperSetup.subSteps.rubric.summary.optionalCount', {
                            count: optionalRequirements.length,
                        })}
                    </p>
                )}
            </div>

            <div className="space-y-1.5">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('paperSetup.subSteps.rubric.summary.structuralTitle')}
                </h4>
                <ul className="space-y-1.5">
                    {(['introduction', 'verse', 'conclusion'] as const).map(section => {
                        const exp = getEffectiveStructuralExpectations(paper).find(e => e.section === section);
                        return (
                            <li key={section} className="text-xs text-foreground">
                                <span className="font-medium">
                                    {t(`paperSetup.subSteps.rubric.structural.section.${section}`)}:
                                </span>{' '}
                                <span className="text-muted-foreground">
                                    {exp && exp.emphasizedTypes.length > 0
                                        ? exp.emphasizedTypes.map(typ => t(`sourceTypes.${typ}.label`)).join(', ')
                                        : t('paperSetup.subSteps.rubric.structural.noExpectation')}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </div>

            {rubric.qualityCriteria.length > 0 && (
                <RubricQualityCriteriaPanel criteria={rubric.qualityCriteria} t={t} />
            )}

            <footer className="flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-border">
                <SaveAsTemplateAction paper={paper} />
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onReset}
                    disabled={resetPending}
                    className="text-xs"
                >
                    {resetPending ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                        <RotateCcw className="h-3 w-3 mr-1" />
                    )}
                    {t('paperSetup.subSteps.rubric.actions.reset')}
                </Button>
            </footer>
        </section>
    );
}

/**
 * v1.7 qualitative-rubric panel. Surfaces the level-based grading
 * criteria (Estilo / Coherencia / etc.) when the rubric carries
 * them. Read-only for v1.7 ship — re-extracting the rubric from a
 * fresh document refreshes the criteria. A v1.8 follow-up adds
 * inline editing of criterion labels, descriptions, and per-level
 * descriptors.
 */
function RubricQualityCriteriaPanel({
    criteria,
    t,
}: {
    criteria: ReadonlyArray<import('@dosfilos/domain').QualityCriterion>;
    t: (key: string, opts?: Record<string, unknown>) => string;
}) {
    return (
        <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('paperSetup.subSteps.rubric.summary.qualityTitle')}
            </h4>
            <p className="text-[11px] text-muted-foreground italic">
                {t('paperSetup.subSteps.rubric.summary.qualityHint')}
            </p>
            <div className="space-y-2">
                {criteria.map(crit => (
                    <div key={crit.id} className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-1.5">
                        <div className="flex items-baseline justify-between gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-foreground">{crit.name}</span>
                            {typeof crit.maxPoints === 'number' && (
                                <span className="text-[11px] text-muted-foreground font-mono">{crit.maxPoints} pts</span>
                            )}
                        </div>
                        {crit.description && (
                            <p className="text-[12px] text-muted-foreground leading-snug">{crit.description}</p>
                        )}
                        <ul className="space-y-1 mt-1">
                            {crit.levels.map(level => (
                                <li key={level.label} className="text-[11.5px] leading-snug">
                                    <span className="font-medium text-foreground">{level.label}</span>
                                    {typeof level.points === 'number' && (
                                        <span className="text-muted-foreground font-mono"> · {level.points} pts</span>
                                    )}
                                    <span className="text-muted-foreground"> — {level.description}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SummaryField({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">{label}</dt>
            <dd className="text-foreground">{value}</dd>
        </div>
    );
}

function SummaryRequirementRow({ requirement }: { requirement: SourceRequirement }) {
    const { t } = useTranslation('exegesis');
    return (
        <li className="text-xs">
            <div className="flex items-baseline gap-2">
                <span className="font-medium text-foreground">
                    {t(`sourceTypes.${requirement.sourceType}.label`)}
                </span>
                <span className="text-muted-foreground text-[11px]">
                    {requirement.maximum
                        ? `${requirement.minimum}–${requirement.maximum}`
                        : `≥ ${requirement.minimum}`}
                </span>
            </div>
            {requirement.justification && (
                <p className="text-[11px] text-muted-foreground italic leading-snug mt-0.5">
                    {requirement.justification}
                </p>
            )}
        </li>
    );
}

function summarizeCitationStandard(rubric: PaperRubric, _paper: ExegeticalPaper): string {
    if (rubric.citationStandard?.trim()) return rubric.citationStandard.trim();
    return '—';
}

function summarizeLength(rubric: PaperRubric, t: (key: string) => string): string {
    if (!rubric.expectedLength) return '—';
    const { unit, min, max } = rubric.expectedLength;
    const unitLabel = unit === 'words'
        ? t('paperSetup.subSteps.rubric.metadata.lengthUnitWords')
        : t('paperSetup.subSteps.rubric.metadata.lengthUnitPages');
    if (min !== null && max !== null) return `${min}–${max} ${unitLabel.toLowerCase()}`;
    if (min !== null) return `≥ ${min} ${unitLabel.toLowerCase()}`;
    if (max !== null) return `≤ ${max} ${unitLabel.toLowerCase()}`;
    return '—';
}

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

function RubricExtractFromTextPanel({ paper, onExtracted }: RubricExtractFromTextPanelProps) {
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
                        <option value="es">Español</option>
                        <option value="en">English</option>
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
function ExtractSourceTabs({
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

function RubricExtractFromDocumentPanel({ paper, onExtracted }: RubricExtractFromDocumentPanelProps) {
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
                if (item.kind === 'file' && item.type.startsWith('image/')) {
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
                        <option value="es">Español</option>
                        <option value="en">English</option>
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

function RubricSetupChooser({ paper, rubric, onPhotoOrPdf, onPasteText }: RubricSetupChooserProps) {
    const { t } = useTranslation('exegesis');
    const { rubrics, applyTemplate, applyStrategyOnly } = useUserRubrics();
    const { resetRubric } = useExegesisPapers();

    // Detect the active card so we can render an "✓ En uso" badge.
    // Mirrors the resolution rules the old templates-panel used.
    const activeCard: 'photo' | 'paste' | 'default' | 'template' | 'none' | null = (() => {
        if (rubric.provenance === 'extracted-from-document') return 'photo';
        if (rubric.provenance === 'extracted-from-text') return 'paste';
        if (rubric.provenance === 'from-template') {
            const tmplId = rubric.sourceTemplateId;
            if (tmplId && rubrics.some(r => r.id === tmplId)) return 'template';
            return null;
        }
        if (rubric.provenance === 'system-default') {
            return rubric.sourceRequirements.length === 0 ? 'none' : 'default';
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
        kind: 'photo' | 'paste' | 'default' | 'template' | 'none';
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

// ── Save-as-template (summary footer) ──────────────────────────────────
//
// Snapshots the current paper rubric into a new UserRubric row.
// Lives in the summary view footer because it operates on what's
// already in the paper — applying a different rubric belongs to
// the chooser at the top of the step.

function SaveAsTemplateAction({ paper }: { paper: ExegeticalPaper }) {
    const { t } = useTranslation('exegesis');
    const { saveAsTemplate } = useUserRubrics();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');

    const handleSave = async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            toast.error(t('paperSetup.subSteps.rubric.templates.nameRequired'));
            return;
        }
        try {
            await saveAsTemplate.mutateAsync({ paperId: paper.id, displayName: trimmed });
            toast.success(t('paperSetup.subSteps.rubric.templates.saved'));
            setOpen(false);
            setName('');
        } catch (err) {
            console.error('[exegesis] save as template failed:', err);
            toast.error(t('paperSetup.subSteps.rubric.templates.saveFailed'));
        }
    };

    if (!open) {
        return (
            <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(true)}
                className="text-xs"
            >
                <Save className="h-3 w-3 mr-1" />
                {t('paperSetup.subSteps.rubric.templates.saveCta')}
            </Button>
        );
    }

    return (
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('paperSetup.subSteps.rubric.templates.namePromptPlaceholder')}
                disabled={saveAsTemplate.isPending}
                className="flex-1 sm:w-56 rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50"
            />
            <Button
                type="button"
                variant="ghost"
                onClick={() => { setOpen(false); setName(''); }}
                disabled={saveAsTemplate.isPending}
                className="text-xs"
            >
                {t('setup.cancel')}
            </Button>
            <Button
                type="button"
                onClick={handleSave}
                disabled={saveAsTemplate.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
            >
                {saveAsTemplate.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {t('paperSetup.subSteps.rubric.templates.saveConfirm')}
            </Button>
        </div>
    );
}

// ── CitationStandardField ──────────────────────────────────────────────
//
// The citation standard for the paper has TWO sources of truth:
//   1. The active style guide's manifest (what the user actually
//      uploaded) — `manifest.citationStyleLabel`. This is the
//      DEFAULT for any paper that pins this guide.
//   2. The rubric's `citationStandard` field — only set when the
//      seminary's rubric explicitly requires a different standard
//      than the user's guide (rare but real, e.g. one paper
//      requires SBL while the rest of the user's seminary work is
//      Turabian).
//
// The field renders the guide's value as a read-only badge, plus a
// presets dropdown ("Match guide" / Turabian 9 / SBL Handbook /
// Chicago 17 / MLA 9 / APA 7 / Other...) for the override case.
// "Match guide" stores `null` so generation uses the guide's
// standard — no value duplication.

const CITATION_PRESETS = [
    'TMS / Turabian',
    'Turabian 9',
    'SBL Handbook',
    'Chicago 17',
    'MLA 9',
    'APA 7',
] as const;

function CitationStandardField({
    paper,
    value,
    onChange,
}: {
    paper: ExegeticalPaper;
    value: string;
    onChange: (next: string) => void;
}) {
    const { t } = useTranslation('exegesis');
    const { guides, activeGuide } = useUserStyleGuides();

    // Resolve the same guide the manifest viewer would show.
    const guide = paper.styleGuideId
        ? guides.find(g => g.id === paper.styleGuideId) ?? null
        : activeGuide;
    const guideStandard = guide?.manifest?.citationStyleLabel ?? null;

    const isMatchingGuide = value.trim() === '' || (guideStandard !== null && value.trim() === guideStandard.trim());
    const showMismatch = !isMatchingGuide && guideStandard !== null;

    // Mode: 'guide' = no override (value === ''), 'preset' = picked
    // from the preset list, 'custom' = typing free text.
    const inPresets = CITATION_PRESETS.includes(value as typeof CITATION_PRESETS[number]);
    const initialMode: 'guide' | 'preset' | 'custom' = value === ''
        ? 'guide'
        : inPresets ? 'preset' : 'custom';
    const [mode, setMode] = useState<'guide' | 'preset' | 'custom'>(initialMode);

    return (
        <div>
            <label className="block text-xs font-medium text-foreground mb-1">
                {t('paperSetup.subSteps.rubric.metadata.citationStandardLabel')}
            </label>

            {guideStandard && (
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">
                        {t('paperSetup.subSteps.rubric.metadata.fromGuide')}:
                    </span>
                    <span>{guideStandard}</span>
                </div>
            )}

            <select
                value={mode}
                onChange={(e) => {
                    const next = e.target.value as 'guide' | 'preset' | 'custom';
                    setMode(next);
                    if (next === 'guide') onChange('');
                    else if (next === 'preset') onChange(CITATION_PRESETS[0]);
                    // 'custom' keeps existing value so the user can edit
                }}
                className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            >
                <option value="guide">
                    {guideStandard
                        ? t('paperSetup.subSteps.rubric.metadata.matchGuide', { standard: guideStandard })
                        : t('paperSetup.subSteps.rubric.metadata.matchGuideNoGuide')}
                </option>
                <option value="preset">{t('paperSetup.subSteps.rubric.metadata.pickPreset')}</option>
                <option value="custom">{t('paperSetup.subSteps.rubric.metadata.custom')}</option>
            </select>

            {mode === 'preset' && (
                <select
                    value={inPresets ? value : CITATION_PRESETS[0]}
                    onChange={(e) => onChange(e.target.value)}
                    className="mt-2 w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                >
                    {CITATION_PRESETS.map(preset => (
                        <option key={preset} value={preset}>{preset}</option>
                    ))}
                </select>
            )}

            {mode === 'custom' && (
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={t('paperSetup.subSteps.rubric.metadata.citationStandardPlaceholder')}
                    className="mt-2 w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
            )}

            {showMismatch && mode !== 'guide' && (
                <p className="mt-2 text-[11px] text-warning-subtle-foreground bg-warning-subtle border border-warning/30 rounded px-2 py-1">
                    ⚠ {t('paperSetup.subSteps.rubric.metadata.mismatchWarning', { rubric: value, guide: guideStandard })}
                </p>
            )}
        </div>
    );
}

