import { useState } from 'react';
import { FileCheck2, Gauge, Pencil, Star, Trash2, Loader2, Plus, Sparkles, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useTranslation } from '@/i18n';
import { useUserRubrics } from '@/hooks/exegesis/useUserRubrics';
import { assessRubricRigor, type RubricRigorLevel, type UserRubric } from '@dosfilos/domain';
import { UserRubricEditDialog } from './UserRubricEditDialog';

/**
 * Directory section listing the user's rubric templates.
 *
 * v1 scope:
 *   - Read-only list with displayName + provenance + isDefault
 *     badge + counts of source requirements / structural
 *     expectations.
 *   - Actions per row: set as default, delete (with confirm).
 *   - Templates are CREATED via the paper-setup "save as template"
 *     button. A standalone editor (create rubric without a paper
 *     context) is v1.5 work — keeps this surface focused.
 *   - Empty state nudges the student toward saving from a paper.
 */
export function UserRubricsSection() {
    const { t } = useTranslation('exegesis');
    const { rubrics, isLoading, deleteRubric, setDefault } = useUserRubrics();
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingRubric, setEditingRubric] = useState<UserRubric | null>(null);
    const [deletingRubric, setDeletingRubric] = useState<UserRubric | null>(null);

    const handleSetDefault = async (rubricId: string) => {
        try {
            await setDefault.mutateAsync(rubricId);
            toast.success(t('directory.rubrics.toast.defaultSet'));
        } catch (err) {
            console.error('[exegesis] set default rubric failed:', err);
            toast.error(t('directory.rubrics.toast.defaultFailed'));
        }
    };

    const handleDeleteConfirmed = async () => {
        if (!deletingRubric) return;
        const rubricId = deletingRubric.id;
        setDeletingRubric(null);
        try {
            await deleteRubric.mutateAsync(rubricId);
            toast.success(t('directory.rubrics.toast.deleted'));
        } catch (err) {
            console.error('[exegesis] delete rubric failed:', err);
            toast.error(t('directory.rubrics.toast.deleteFailed'));
        }
    };

    return (
        <section className="rounded-2xl border border-border bg-card p-4">
            <header className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <FileCheck2 className="h-4 w-4 text-success shrink-0" />
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
                        {t('directory.rubrics.title')}
                    </h2>
                </div>
                {!isLoading && rubrics.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setShowCreateForm(true)}
                        className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                        title={t('directory.rubrics.createCta')}
                    >
                        <Plus className="h-3 w-3" />
                    </button>
                )}
            </header>

            {isLoading ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1.5 text-success" />
                    {t('directory.rubrics.loading')}
                </div>
            ) : rubrics.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
                    <h3 className="text-xs font-semibold text-foreground mb-1">
                        {t('directory.rubrics.empty.title')}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mx-auto mb-3 leading-snug">
                        {t('directory.rubrics.empty.body')}
                    </p>
                    <Button
                        type="button"
                        onClick={() => setShowCreateForm(true)}
                        size="sm"
                        className="bg-primary-solid hover:bg-primary-solid-hover text-primary-foreground text-xs h-7"
                    >
                        <Plus className="h-3 w-3 mr-1" />
                        {t('directory.rubrics.createCta')}
                    </Button>
                </div>
            ) : (
                <ul className="space-y-1.5">
                    {rubrics.map(r => {
                        const rigor = assessRubricRigor(r.rubric);
                        const showLevel = rigor.totalMinimum > 0;
                        return (
                        <li
                            key={r.id}
                            className="rounded-lg border border-border bg-background px-2.5 py-2 flex items-center gap-2"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <h3 className="text-xs font-semibold text-foreground truncate">
                                        {r.displayName}
                                    </h3>
                                    {r.isDefault && (
                                        <Star className="h-3 w-3 fill-current text-success shrink-0" aria-label={t('directory.rubrics.defaultBadge')} />
                                    )}
                                </div>
                                <p className="text-[10px] text-muted-foreground truncate inline-flex items-center gap-1">
                                    {showLevel && (
                                        <>
                                            <Gauge className={`h-2.5 w-2.5 shrink-0 ${LEVEL_ICON_TONE[rigor.level]}`} />
                                            <span className={`font-semibold ${LEVEL_TEXT_TONE[rigor.level]}`}>
                                                {t(`rubricRigor.level.${rigor.level}`)}
                                            </span>
                                            <span className="text-muted-foreground">·</span>
                                        </>
                                    )}
                                    <span>
                                        {t('directory.rubrics.requirementsCount', { count: r.rubric.sourceRequirements.length })}
                                    </span>
                                </p>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setEditingRubric(r)}
                                    className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-accent"
                                    title={t('directory.rubrics.edit.openCta')}
                                    aria-label={t('directory.rubrics.edit.openCta')}
                                >
                                    <Pencil className="h-3 w-3" />
                                </button>
                                {!r.isDefault && (
                                    <button
                                        type="button"
                                        onClick={() => handleSetDefault(r.id)}
                                        disabled={setDefault.isPending}
                                        className="p-1 rounded text-muted-foreground hover:text-success hover:bg-accent disabled:opacity-50"
                                        title={t('directory.rubrics.setDefault')}
                                        aria-label={t('directory.rubrics.setDefault')}
                                    >
                                        <Star className="h-3 w-3" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setDeletingRubric(r)}
                                    disabled={deleteRubric.isPending}
                                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-accent disabled:opacity-50"
                                    title={t('directory.rubrics.delete')}
                                    aria-label={t('directory.rubrics.delete')}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        </li>
                        );
                    })}
                </ul>
            )}

            <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{t('directory.rubrics.create.title')}</DialogTitle>
                        <DialogDescription>
                            {t('directory.rubrics.empty.body')}
                        </DialogDescription>
                    </DialogHeader>
                    <CreateRubricForm onDone={() => setShowCreateForm(false)} />
                </DialogContent>
            </Dialog>

            {editingRubric && (
                <UserRubricEditDialog
                    open={!!editingRubric}
                    onOpenChange={(next) => {
                        if (!next) setEditingRubric(null);
                    }}
                    rubric={editingRubric}
                />
            )}

            <ConfirmDialog
                open={!!deletingRubric}
                onOpenChange={(next) => { if (!next) setDeletingRubric(null); }}
                title={t('directory.rubrics.deleteDialog.title', { name: deletingRubric?.displayName ?? '' })}
                body={t('directory.rubrics.deleteDialog.body')}
                confirmLabel={t('directory.rubrics.deleteDialog.confirm')}
                cancelLabel={t('directory.rubrics.deleteDialog.cancel')}
                onConfirm={handleDeleteConfirmed}
            />
        </section>
    );
}

// ── Inline Create-from-text form ───────────────────────────────────────

function CreateRubricForm({ onDone }: { onDone: () => void }) {
    const { t, i18n } = useTranslation('exegesis');
    const { createFromText } = useUserRubrics();
    const [name, setName] = useState('');
    const [mode, setMode] = useState<'blank' | 'paste'>('blank');
    const [rawText, setRawText] = useState('');
    const language: 'es' | 'en' = i18n.language?.split('-')[0] === 'en' ? 'en' : 'es';

    const trimmedText = rawText.trim();
    const submitting = createFromText.isPending;
    const canSubmit = name.trim().length >= 3
        && (mode === 'blank' || trimmedText.length >= 30)
        && !submitting;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        try {
            await createFromText.mutateAsync({
                displayName: name.trim(),
                rawText: mode === 'paste' ? trimmedText : undefined,
                language,
            });
            toast.success(t('directory.rubrics.toast.created'));
            setName('');
            setRawText('');
            setMode('blank');
            onDone();
        } catch (err: any) {
            console.error('[exegesis] create rubric from text failed:', err);
            const isOverload = err?.isExegesisOverload === true;
            toast.error(isOverload
                ? t('directory.rubrics.toast.overloaded')
                : t('directory.rubrics.toast.createFailed'));
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                    {t('directory.rubrics.create.nameLabel')}
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={submitting}
                    placeholder={t('directory.rubrics.create.namePlaceholder')}
                    className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
            </div>

            <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                    {t('directory.rubrics.create.modeLabel')}
                </label>
                <div className="flex gap-2">
                    <ModeOption
                        active={mode === 'blank'}
                        onClick={() => setMode('blank')}
                        label={t('directory.rubrics.create.modeBlank')}
                    />
                    <ModeOption
                        active={mode === 'paste'}
                        onClick={() => setMode('paste')}
                        label={t('directory.rubrics.create.modePaste')}
                    />
                </div>
            </div>

            {mode === 'paste' && (
                <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                        {t('directory.rubrics.create.textLabel')}
                    </label>
                    <textarea
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        rows={6}
                        disabled={submitting}
                        placeholder={t('directory.rubrics.create.textPlaceholder')}
                        className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y"
                    />
                    {trimmedText.length > 0 && trimmedText.length < 30 && (
                        <p className="text-[11px] text-warning-subtle-foreground mt-1 inline-flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {t('directory.rubrics.create.tooShort')}
                        </p>
                    )}
                </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
                <p className="text-[11px] text-muted-foreground italic">
                    {mode === 'blank'
                        ? t('directory.rubrics.create.blankHint')
                        : t('directory.rubrics.create.pasteHint')}
                </p>
                <div className="flex gap-1.5">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onDone}
                        disabled={submitting}
                        className="text-xs"
                    >
                        {t('setup.cancel')}
                    </Button>
                    <Button
                        type="submit"
                        disabled={!canSubmit}
                        className="bg-primary-solid hover:bg-primary-solid-hover text-primary-foreground text-xs"
                    >
                        {submitting ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                            <Sparkles className="h-3 w-3 mr-1" />
                        )}
                        {t('directory.rubrics.create.submit')}
                    </Button>
                </div>
            </div>
        </form>
    );
}

function ModeOption({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                active
                    ? 'border-success bg-success-subtle text-success-subtle-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-accent',
            ].join(' ')}
            aria-pressed={active}
        >
            {label}
        </button>
    );
}

// Tones for the inline level chip in each row. Mirrors the tone
// scheme used inside `RubricRigorIndicator` so the level visual is
// consistent across surfaces.
const LEVEL_ICON_TONE: Record<RubricRigorLevel, string> = {
    pastoral: 'text-muted-foreground',
    seminary: 'text-info',
    research: 'text-success',
    publishable: 'text-success',
};

const LEVEL_TEXT_TONE: Record<RubricRigorLevel, string> = {
    pastoral: 'text-muted-foreground',
    seminary: 'text-info-subtle-foreground',
    research: 'text-success-subtle-foreground',
    publishable: 'text-success-subtle-foreground',
};
