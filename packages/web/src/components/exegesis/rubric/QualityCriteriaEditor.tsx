import { useEffect, useState } from 'react';
import { Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { QualityCriterion, QualityCriterionLevel } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { useTranslation } from '@/i18n';

/**
 * Inline editor for the qualitative section of `PaperRubric`.
 *
 * The qualitative rubric is a list of grading criteria (e.g.
 * Estilo / Coherencia / Profundidad teológica), each with N
 * proficiency levels (Ejemplar / Competente / Aceptable / Deficiente).
 * Extracted automatically from an uploaded image/PDF rubric, but the
 * student may also build one from scratch or tweak the extraction —
 * this editor owns both flows.
 *
 * Data model rules enforced visually:
 *   - Every criterion needs a non-empty name; UpdateRubricUseCase
 *     drops criteria with blank names on save.
 *   - Every criterion needs ≥1 level; levels with blank labels are
 *     dropped on save.
 *   - Points (criterion `maxPoints` + level `points`) are optional;
 *     when present they're clamped to non-negative integers by the
 *     use case.
 *
 * The editor is fully controlled — the parent owns the array and
 * receives changes via `onChange`. We never touch the parent's
 * persisted `paper.rubric`; that flips over only when the parent's
 * "Save" button fires the mutation.
 */
interface QualityCriteriaEditorProps {
    /** Paper id for the image-extract preview hook. */
    paperId: string;
    /** Paper display language — used as default for the extractor. */
    language: 'es' | 'en';
    criteria: ReadonlyArray<QualityCriterion>;
    onChange: (next: ReadonlyArray<QualityCriterion>) => void;
    disabled?: boolean;
}

export function QualityCriteriaEditor({
    paperId,
    language,
    criteria,
    onChange,
    disabled = false,
}: QualityCriteriaEditorProps) {
    const { t } = useTranslation('exegesis');
    const [extractOpen, setExtractOpen] = useState(false);

    const updateCriterion = (idx: number, patch: Partial<QualityCriterion>) => {
        onChange(criteria.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
    };

    const removeCriterion = (idx: number) => {
        onChange(criteria.filter((_, i) => i !== idx));
    };

    const addCriterion = () => {
        // Seed a fresh criterion with the most common 4-level grid
        // (Ejemplar/Competente/Aceptable/Deficiente) so the student
        // doesn't start from a blank shell. Points descend by 1 — a
        // reasonable default; the student can adjust to match their
        // seminary's actual scale.
        const fresh: QualityCriterion = {
            id: `qc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: '',
            description: undefined,
            maxPoints: undefined,
            levels: [
                { label: t('paperSetup.subSteps.rubric.qualityEditor.defaultLevel.exemplary'), description: '', points: 4 },
                { label: t('paperSetup.subSteps.rubric.qualityEditor.defaultLevel.competent'), description: '', points: 3 },
                { label: t('paperSetup.subSteps.rubric.qualityEditor.defaultLevel.acceptable'), description: '', points: 2 },
                { label: t('paperSetup.subSteps.rubric.qualityEditor.defaultLevel.deficient'), description: '', points: 1 },
            ],
        };
        onChange([...criteria, fresh]);
    };

    return (
        <section className="space-y-3">
            <header>
                <h3 className="text-sm font-semibold text-foreground">
                    {t('paperSetup.subSteps.rubric.qualityEditor.title')}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                    {t('paperSetup.subSteps.rubric.qualityEditor.subtitle')}
                </p>
            </header>

            {criteria.length === 0 ? (
                <p className="text-xs text-muted-foreground italic rounded-md border border-dashed border-border px-3 py-4 text-center">
                    {t('paperSetup.subSteps.rubric.qualityEditor.empty')}
                </p>
            ) : (
                <ul className="space-y-3">
                    {criteria.map((crit, idx) => (
                        <li key={crit.id || idx}>
                            <CriterionCard
                                criterion={crit}
                                onChange={(patch) => updateCriterion(idx, patch)}
                                onRemove={() => removeCriterion(idx)}
                                disabled={disabled}
                            />
                        </li>
                    ))}
                </ul>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={addCriterion}
                    disabled={disabled}
                    className="text-xs"
                >
                    <Plus className="h-3 w-3 mr-1" />
                    {t('paperSetup.subSteps.rubric.qualityEditor.addCriterion')}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setExtractOpen(true)}
                    disabled={disabled}
                    className="text-xs"
                >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {t('paperSetup.subSteps.rubric.qualityEditor.extractFromImageCta')}
                </Button>
            </div>

            <ExtractFromImageDialog
                open={extractOpen}
                onOpenChange={setExtractOpen}
                paperId={paperId}
                language={language}
                existing={criteria}
                onAppend={(merged) => {
                    onChange(merged);
                    setExtractOpen(false);
                }}
            />
        </section>
    );
}

// ── Extract-from-image dialog ──────────────────────────────────────────
//
// Calls the preview-only mutation `extractRubricPreviewFromImage` —
// runs the same Gemini Vision call as the chooser's "Foto/PDF" path
// but the result stays in memory. We pull `qualityCriteria` from the
// response, dedup against what's already in the editor (case-insensitive
// trimmed name), append the new ones, and hand the merged array back
// to the editor so the student can review/edit before pressing Save.

interface ExtractFromImageDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    paperId: string;
    language: 'es' | 'en';
    existing: ReadonlyArray<QualityCriterion>;
    onAppend: (merged: ReadonlyArray<QualityCriterion>) => void;
}

function ExtractFromImageDialog({
    open,
    onOpenChange,
    paperId,
    language,
    existing,
    onAppend,
}: ExtractFromImageDialogProps) {
    const { t } = useTranslation('exegesis');
    const { extractRubricPreviewFromImage } = useExegesisPapers();
    const [file, setFile] = useState<File | null>(null);
    const [phase, setPhase] = useState<'idle' | 'encoding' | 'analyzing'>('idle');
    const isBusy = phase !== 'idle' || extractRubricPreviewFromImage.isPending;

    // Reset file state whenever the dialog closes so the next open
    // starts fresh — otherwise a previous extraction stays primed.
    useEffect(() => {
        if (!open) {
            setFile(null);
            setPhase('idle');
        }
    }, [open]);

    // Clipboard paste support — only active while dialog is open and
    // idle. Same shape as the rubric chooser's image extraction path.
    useEffect(() => {
        if (!open || isBusy) return;
        const onPaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    const blob = item.getAsFile();
                    if (blob) {
                        const ext = blob.type.split('/')[1] || 'png';
                        const named = new File([blob], `pasted-quality.${ext}`, { type: blob.type });
                        setFile(named);
                        e.preventDefault();
                        return;
                    }
                }
            }
        };
        window.addEventListener('paste', onPaste);
        return () => window.removeEventListener('paste', onPaste);
    }, [open, isBusy]);

    const handleSubmit = async () => {
        if (!file || isBusy) return;
        try {
            const result = await extractRubricPreviewFromImage.mutateAsync({
                paperId,
                file,
                language,
                onPhase: setPhase,
            });
            const incoming = result.rubric.qualityCriteria ?? [];
            if (incoming.length === 0) {
                toast.warning(t('paperSetup.subSteps.rubric.qualityEditor.extractFromImageNoCriteria'));
                setPhase('idle');
                return;
            }

            // Dedup by case-insensitive trimmed name — same intent as
            // the extractor's own normalization. Skip duplicates so an
            // accidental re-extract of the same image doesn't double
            // the criteria list.
            const existingNames = new Set(
                existing.map(c => c.name.trim().toLowerCase()).filter(n => n.length > 0),
            );
            const fresh: QualityCriterion[] = [];
            let skipped = 0;
            for (const crit of incoming) {
                const key = (crit.name ?? '').trim().toLowerCase();
                if (key.length === 0) {
                    skipped += 1;
                    continue;
                }
                if (existingNames.has(key)) {
                    skipped += 1;
                    continue;
                }
                existingNames.add(key);
                // Re-id so two criteria from different extractions never
                // collide. The extractor stamps deterministic ids per
                // call (`qc-1`, `qc-2`...) which would clash on a
                // second run.
                fresh.push({
                    ...crit,
                    id: `qc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                });
            }

            const merged = [...existing, ...fresh];
            onAppend(merged);

            // Toast variant depends on dupes — surface the skipped
            // count when non-zero so the student understands why the
            // visible delta is smaller than the model's response.
            if (skipped > 0 && fresh.length > 0) {
                toast.success(t('paperSetup.subSteps.rubric.qualityEditor.extractFromImageAddedWithDupes', {
                    added: fresh.length,
                    skipped,
                }));
            } else if (fresh.length === 1) {
                toast.success(t('paperSetup.subSteps.rubric.qualityEditor.extractFromImageAddedOne'));
            } else if (fresh.length > 1) {
                toast.success(t('paperSetup.subSteps.rubric.qualityEditor.extractFromImageAddedMany', {
                    count: fresh.length,
                }));
            } else {
                // Every incoming criterion was a duplicate — surface the
                // no-op explicitly so the user doesn't think nothing
                // happened.
                toast.warning(t('paperSetup.subSteps.rubric.qualityEditor.extractFromImageNoCriteria'));
            }
        } catch (err: any) {
            console.error('[exegesis] extract quality preview failed:', err);
            const isOverload = (err as { isExegesisOverload?: boolean })?.isExegesisOverload === true;
            toast.error(isOverload
                ? t('paperSetup.subSteps.rubric.qualityEditor.extractFromImageOverloaded')
                : t('paperSetup.subSteps.rubric.qualityEditor.extractFromImageFailed'),
            );
        } finally {
            setPhase('idle');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="inline-flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-success" />
                        {t('paperSetup.subSteps.rubric.qualityEditor.extractFromImageTitle')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('paperSetup.subSteps.rubric.qualityEditor.extractFromImageSubtitle')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <FileDropzone
                        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                        value={file}
                        onChange={setFile}
                        disabled={isBusy}
                        size="compact"
                        emptyLabel={t('paperSetup.subSteps.rubric.qualityEditor.extractFromImageDropzone')}
                        hint={t('paperSetup.subSteps.rubric.qualityEditor.extractFromImageHint')}
                        maxSizeMB={10}
                    />

                    {phase !== 'idle' && (
                        <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {phase === 'encoding'
                                ? t('paperSetup.subSteps.rubric.qualityEditor.extractFromImageEncoding')
                                : t('paperSetup.subSteps.rubric.qualityEditor.extractFromImageExtracting')}
                        </p>
                    )}

                    <div className="flex justify-end">
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!file || isBusy}
                            className="bg-primary-solid hover:bg-primary-solid-hover text-primary-foreground text-xs"
                        >
                            {isBusy ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                                <Sparkles className="h-3 w-3 mr-1" />
                            )}
                            {t('paperSetup.subSteps.rubric.qualityEditor.extractFromImageSubmit')}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

interface CriterionCardProps {
    criterion: QualityCriterion;
    onChange: (patch: Partial<QualityCriterion>) => void;
    onRemove: () => void;
    disabled: boolean;
}

function CriterionCard({ criterion, onChange, onRemove, disabled }: CriterionCardProps) {
    const { t } = useTranslation('exegesis');

    const updateLevel = (idx: number, patch: Partial<QualityCriterionLevel>) => {
        onChange({
            levels: criterion.levels.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
        });
    };

    const removeLevel = (idx: number) => {
        onChange({ levels: criterion.levels.filter((_, i) => i !== idx) });
    };

    const addLevel = () => {
        // Fresh level inherits empty fields — the student is making
        // an intentional addition (e.g. "Sobresaliente" above the
        // current top tier) so we don't presume a label.
        onChange({
            levels: [...criterion.levels, { label: '', description: '', points: undefined }],
        });
    };

    return (
        <div className="rounded-lg border border-border bg-card p-3 space-y-3">
            <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                        <div>
                            <label className="block text-[11px] font-medium text-foreground mb-1">
                                {t('paperSetup.subSteps.rubric.qualityEditor.criterionNameLabel')}
                            </label>
                            <input
                                type="text"
                                value={criterion.name}
                                onChange={(e) => onChange({ name: e.target.value })}
                                placeholder={t('paperSetup.subSteps.rubric.qualityEditor.criterionNamePlaceholder')}
                                disabled={disabled}
                                className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-medium text-foreground mb-1">
                                {t('paperSetup.subSteps.rubric.qualityEditor.maxPointsLabel')}
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={criterion.maxPoints ?? ''}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    onChange({ maxPoints: v === '' ? undefined : Number(v) });
                                }}
                                placeholder={t('paperSetup.subSteps.rubric.qualityEditor.maxPointsPlaceholder')}
                                disabled={disabled}
                                className="w-24 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[11px] font-medium text-foreground mb-1">
                            {t('paperSetup.subSteps.rubric.qualityEditor.criterionDescriptionLabel')}
                        </label>
                        <textarea
                            value={criterion.description ?? ''}
                            onChange={(e) => onChange({ description: e.target.value || undefined })}
                            placeholder={t('paperSetup.subSteps.rubric.qualityEditor.criterionDescriptionPlaceholder')}
                            rows={2}
                            disabled={disabled}
                            className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y disabled:opacity-50"
                        />
                    </div>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onRemove}
                    disabled={disabled}
                    className="text-xs text-destructive shrink-0"
                    aria-label={t('paperSetup.subSteps.rubric.qualityEditor.removeCriterion')}
                >
                    <Trash2 className="h-3 w-3" />
                </Button>
            </div>

            <div className="pt-2 border-t border-border space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('paperSetup.subSteps.rubric.qualityEditor.levelsTitle')}
                </p>
                <ul className="space-y-2">
                    {criterion.levels.map((level, idx) => (
                        <li key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_2fr_auto] gap-2 items-start">
                            <input
                                type="text"
                                value={level.label}
                                onChange={(e) => updateLevel(idx, { label: e.target.value })}
                                placeholder={t('paperSetup.subSteps.rubric.qualityEditor.levelLabelPlaceholder')}
                                disabled={disabled}
                                className="rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50"
                            />
                            <input
                                type="number"
                                min={0}
                                value={level.points ?? ''}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    updateLevel(idx, { points: v === '' ? undefined : Number(v) });
                                }}
                                placeholder={t('paperSetup.subSteps.rubric.qualityEditor.levelPointsPlaceholder')}
                                disabled={disabled}
                                className="w-16 rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50"
                            />
                            <textarea
                                value={level.description}
                                onChange={(e) => updateLevel(idx, { description: e.target.value })}
                                placeholder={t('paperSetup.subSteps.rubric.qualityEditor.levelDescriptionPlaceholder')}
                                rows={2}
                                disabled={disabled}
                                className="rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y disabled:opacity-50"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => removeLevel(idx)}
                                disabled={disabled || criterion.levels.length <= 1}
                                className="text-xs text-destructive shrink-0"
                                aria-label={t('paperSetup.subSteps.rubric.qualityEditor.removeLevel')}
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </li>
                    ))}
                </ul>
                <Button
                    type="button"
                    variant="outline"
                    onClick={addLevel}
                    disabled={disabled}
                    className="text-xs"
                >
                    <Plus className="h-3 w-3 mr-1" />
                    {t('paperSetup.subSteps.rubric.qualityEditor.addLevel')}
                </Button>
            </div>
        </div>
    );
}
