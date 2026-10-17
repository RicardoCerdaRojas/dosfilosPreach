import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
    SOURCE_TYPE_GROUPS,
    getSourceTypeOrderIndex,
    type SourceRequirement,
    type SourceType,
    type UserRubric,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { useUserRubrics } from '@/hooks/exegesis/useUserRubrics';
import {
    AddRequirementButton,
    RequirementRow,
} from '@/components/exegesis/rubric/RequirementRow';
import { RubricRigorIndicator } from '@/components/exegesis/rubric/RubricRigorIndicator';

/**
 * Modal editor for a `UserRubric` template (rename + content).
 *
 * Reuses the per-row rubric helpers (`RequirementRow`,
 * `AddRequirementButton`) from the paper-setup editor — same data
 * shape, same UX. The fields covered here mirror the editable surface
 * of the paper-level editor:
 *   - displayName (template-only — papers don't have one)
 *   - description, citationStandard (plain text — no guide-pin
 *     lookup since templates aren't bound to a paper context)
 *   - expectedLength (range + unit)
 *   - sourceRequirements (CRUD)
 *
 * Structural expectations are NOT edited here — the paper-setup
 * editor also keeps them read-only, and editing them outside a paper
 * context has no useful preview surface. The template carries them
 * as-is; if the user wants to change them they edit a paper that
 * applied this template and save back.
 *
 * Save calls `updateRubric.mutateAsync({ rubricId, displayName,
 * rubric })` with the full updated rubric body. Editing here does
 * NOT propagate to historical papers — see `UserRubric` doc.
 */
export interface UserRubricEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rubric: UserRubric;
}

export function UserRubricEditDialog({ open, onOpenChange, rubric }: UserRubricEditDialogProps) {
    const { t } = useTranslation('exegesis');
    const { updateRubric } = useUserRubrics();
    const saving = updateRubric.isPending;

    const [displayName, setDisplayName] = useState(rubric.displayName);
    const [description, setDescription] = useState(rubric.rubric.description ?? '');
    const [citationStandard, setCitationStandard] = useState(rubric.rubric.citationStandard ?? '');
    const [lengthUnit, setLengthUnit] = useState<'pages' | 'words'>(rubric.rubric.expectedLength?.unit ?? 'pages');
    const [lengthMin, setLengthMin] = useState<string>(rubric.rubric.expectedLength?.min?.toString() ?? '');
    const [lengthMax, setLengthMax] = useState<string>(rubric.rubric.expectedLength?.max?.toString() ?? '');
    const [requirements, setRequirements] = useState<SourceRequirement[]>([...rubric.rubric.sourceRequirements]);

    // Re-seed when the dialog re-opens with a different rubric (or the
    // same one after an external mutation refetched it).
    useEffect(() => {
        if (!open) return;
        setDisplayName(rubric.displayName);
        setDescription(rubric.rubric.description ?? '');
        setCitationStandard(rubric.rubric.citationStandard ?? '');
        setLengthUnit(rubric.rubric.expectedLength?.unit ?? 'pages');
        setLengthMin(rubric.rubric.expectedLength?.min?.toString() ?? '');
        setLengthMax(rubric.rubric.expectedLength?.max?.toString() ?? '');
        setRequirements([...rubric.rubric.sourceRequirements]);
    }, [open, rubric]);

    const usedTypes = useMemo(() => new Set(requirements.map(r => r.sourceType)), [requirements]);
    const allSourceTypes = useMemo(
        () => SOURCE_TYPE_GROUPS.flatMap(g => g.types as ReadonlyArray<SourceType>),
        [],
    );
    const availableTypes = useMemo(
        () => allSourceTypes.filter(typ => !usedTypes.has(typ)),
        [allSourceTypes, usedTypes],
    );
    // Canonical academic-priority order: text → lexical → commentaries
    // → background → methodological. Pure render-time sort; the
    // persisted array stays in insertion order.
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
    // Synthetic rubric reflecting the LIVE form state so the rigor
    // indicator updates as the user edits (rather than reflecting
    // the persisted version). Only the fields the indicator reads
    // are populated; other fields are passed through from the
    // original.
    const liveRubric = useMemo(() => ({
        ...rubric.rubric,
        sourceRequirements: requirements,
    }), [rubric.rubric, requirements]);

    // Patch handlers key on sourceType (unique per requirement) instead
    // of array index, so the sorted render-order doesn't have to match
    // the storage order.
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
            { sourceType: type, minimum: 1, maximum: null, justification: '' },
        ]);
    };

    const trimmedName = displayName.trim();
    const canSubmit = trimmedName.length >= 3 && !saving;

    const handleSave = async () => {
        if (!canSubmit) return;
        const minN = lengthMin === '' ? null : Number(lengthMin);
        const maxN = lengthMax === '' ? null : Number(lengthMax);
        const expectedLength = (minN === null && maxN === null)
            ? null
            : { unit: lengthUnit, min: minN, max: maxN };
        try {
            await updateRubric.mutateAsync({
                rubricId: rubric.id,
                displayName: trimmedName,
                rubric: {
                    ...rubric.rubric,
                    description: description.trim() || null,
                    citationStandard: citationStandard.trim() || null,
                    expectedLength,
                    sourceRequirements: requirements,
                    // Manual edits flip provenance to user-edited so the UI
                    // can show the "you edited this" badge accurately.
                    provenance: 'user-edited',
                },
            });
            toast.success(t('directory.rubrics.toast.updated'));
            onOpenChange(false);
        } catch (err) {
            console.error('[exegesis] update rubric template failed:', err);
            toast.error(t('directory.rubrics.toast.updateFailed'));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('directory.rubrics.edit.title')}</DialogTitle>
                    <DialogDescription>
                        {t('directory.rubrics.edit.subtitle')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    {/* ── Name ── */}
                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1">
                            {t('directory.rubrics.edit.nameLabel')}
                        </label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            disabled={saving}
                            className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50"
                        />
                    </div>

                    {/* ── Metadata ── */}
                    <section className="space-y-3">
                        <h3 className="text-sm font-semibold text-foreground">
                            {t('paperSetup.subSteps.rubric.metadata.title')}
                        </h3>
                        <div>
                            <label className="block text-xs font-medium text-foreground mb-1">
                                {t('paperSetup.subSteps.rubric.metadata.descriptionLabel')}
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t('paperSetup.subSteps.rubric.metadata.descriptionPlaceholder')}
                                rows={3}
                                disabled={saving}
                                className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y disabled:opacity-50"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">
                                    {t('paperSetup.subSteps.rubric.metadata.citationStandardLabel')}
                                </label>
                                <input
                                    type="text"
                                    value={citationStandard}
                                    onChange={(e) => setCitationStandard(e.target.value)}
                                    placeholder={t('paperSetup.subSteps.rubric.metadata.citationStandardPlaceholder')}
                                    disabled={saving}
                                    className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50"
                                />
                            </div>
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
                                        disabled={saving}
                                        className="w-20 rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50"
                                    />
                                    <span className="text-xs text-muted-foreground">—</span>
                                    <input
                                        type="number"
                                        min={0}
                                        value={lengthMax}
                                        onChange={(e) => setLengthMax(e.target.value)}
                                        placeholder={t('paperSetup.subSteps.rubric.metadata.lengthMaxPlaceholder')}
                                        disabled={saving}
                                        className="w-20 rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50"
                                    />
                                    <select
                                        value={lengthUnit}
                                        onChange={(e) => setLengthUnit(e.target.value as 'pages' | 'words')}
                                        disabled={saving}
                                        className="rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50"
                                    >
                                        <option value="pages">{t('paperSetup.subSteps.rubric.metadata.lengthUnitPages')}</option>
                                        <option value="words">{t('paperSetup.subSteps.rubric.metadata.lengthUnitWords')}</option>
                                    </select>
                                </div>
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
                </div>

                <footer className="flex items-center justify-between pt-4 border-t border-border">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                        className="text-xs"
                    >
                        {t('setup.cancel')}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={!canSubmit}
                        className="bg-primary-solid hover:bg-primary-solid-hover text-primary-foreground text-xs"
                    >
                        {saving ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                            <Save className="h-3 w-3 mr-1" />
                        )}
                        {t('directory.rubrics.edit.save')}
                    </Button>
                </footer>
            </DialogContent>
        </Dialog>
    );
}
