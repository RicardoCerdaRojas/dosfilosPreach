import { useEffect, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck, Check, ChevronDown, Loader2, Save, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useUserAssignmentBriefs } from '@/hooks/exegesis/useUserAssignmentBriefs';
import { toast } from 'sonner';
import { estadoDelEncuadre } from './encuadreAplicado';

interface AssignmentBriefPickerProps {
    /** Current textarea value — used for the "Save as template" action. */
    currentBody: string;
    /** Apply the chosen template's body. */
    onApply: (body: string) => void;
}

/**
 * Lightweight picker for the create wizard's Step 5. Mirrors
 * `RubricTemplatePicker` shape without its system-defaults section
 * (briefs are user-only — no system catalog). Renders:
 *
 *   - Trigger button "Cargar plantilla" with default name when one
 *     exists.
 *   - Popover list of the user's saved briefs (default starred first).
 *   - Inline "Save current as template" button under the trigger when
 *     the textarea has substantive content (≥30 chars).
 *
 * The picker doesn't OWN the textarea — `onApply` writes back to the
 * parent's state. Same separation as `RubricTemplatePicker`.
 */
export function AssignmentBriefPicker({ currentBody, onApply }: AssignmentBriefPickerProps) {
    const { t } = useTranslation('exegesis');
    const { briefs, isLoading, createBrief, deleteBrief, setDefault } = useUserAssignmentBriefs();
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [pendingName, setPendingName] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
    const nameInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (saveDialogOpen) {
            // Defer to allow Radix to mount + portal before focusing.
            setTimeout(() => nameInputRef.current?.focus(), 50);
        }
    }, [saveDialogOpen]);

    const sorted = [...briefs].sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (b.isDefault && !a.isDefault) return 1;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    // El rótulo nombra lo que HAY en el cuadro, no la predeterminada: se elegía
    // otra plantilla, el texto cambiaba y el rótulo seguía igual, así que
    // parecía que el clic no hacía nada. Ver `estadoDelEncuadre`.
    const estado = estadoDelEncuadre(briefs, currentBody);
    const aplicadaId = estado.tipo === 'plantilla' ? estado.plantilla.id : null;
    const triggerLabel = estado.tipo === 'plantilla'
        ? t('create.brief.templates.appliedLabel', { name: estado.plantilla.displayName })
        : estado.tipo === 'propio'
            ? t('create.brief.templates.customLabel')
            : t('create.brief.templates.pickLabel');

    const canSave = currentBody.trim().length >= 30;

    const handleSave = () => {
        if (!canSave) return;
        setPendingName('');
        setSaveDialogOpen(true);
    };

    const confirmSave = async () => {
        const name = pendingName.trim();
        if (!name) return;
        setSaving(true);
        try {
            await createBrief.mutateAsync({
                displayName: name,
                body: currentBody,
                markAsDefault: briefs.length === 0,
            });
            toast.success(t('create.brief.templates.savedToast', { name }));
            setSaveDialogOpen(false);
            setPendingName('');
        } catch (err) {
            console.error('[exegesis] save brief failed:', err);
            toast.error(t('create.brief.templates.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    const requestDelete = (briefId: string, name: string) => {
        setDeleteTarget({ id: briefId, name });
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteBrief.mutateAsync(deleteTarget.id);
            toast.success(t('create.brief.templates.deletedToast'));
        } catch (err) {
            console.error('[exegesis] delete brief failed:', err);
            toast.error(t('create.brief.templates.deleteFailed'));
        } finally {
            setDeleteTarget(null);
        }
    };

    const handleApply = (body: string) => {
        onApply(body);
        setOpen(false);
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-accent transition-colors"
                    >
                        <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate max-w-[260px]">{triggerLabel}</span>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[300px] max-h-[360px] overflow-hidden border border-border shadow-xl rounded-lg"
                >
                    <div className="px-3 py-2 border-b border-border">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {t('create.brief.templates.listHeader')}
                        </p>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto py-1">
                        {isLoading && (
                            <p className="px-3 py-4 text-xs text-muted-foreground inline-flex items-center gap-2">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {t('create.brief.templates.loading')}
                            </p>
                        )}
                        {!isLoading && sorted.length === 0 && (
                            <p className="px-3 py-4 text-xs text-muted-foreground italic">
                                {t('create.brief.templates.empty')}
                            </p>
                        )}
                        {sorted.map(b => (
                            <div
                                key={b.id}
                                aria-current={b.id === aplicadaId ? 'true' : undefined}
                                className={cn(
                                    'group flex items-start gap-2 px-3 py-2 hover:bg-accent/50 transition-colors',
                                    b.id === aplicadaId && 'bg-accent/60',
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() => handleApply(b.body)}
                                    className="flex-1 min-w-0 text-left"
                                >
                                    <div className="flex items-center gap-1.5">
                                        {b.isDefault ? (
                                            <BookmarkCheck className="h-3.5 w-3.5 text-success shrink-0" />
                                        ) : (
                                            <Bookmark className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        )}
                                        <span className="text-[13px] font-medium text-foreground truncate">
                                            {b.displayName}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                                        {b.body}
                                    </p>
                                </button>
                                <div className="flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {!b.isDefault && (
                                        <button
                                            type="button"
                                            title={t('create.brief.templates.markDefault')}
                                            onClick={() => setDefault.mutate(b.id)}
                                            className={cn(
                                                'inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-success hover:bg-success-subtle transition-colors',
                                            )}
                                        >
                                            <Check className="h-3 w-3" />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        title={t('create.brief.templates.delete')}
                                        onClick={() => requestDelete(b.id, b.displayName)}
                                        className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>

            <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleSave}
                disabled={!canSave || saving}
                className="inline-flex items-center gap-1.5 text-[12px]"
                title={canSave ? undefined : t('create.brief.templates.saveDisabledTooltip')}
            >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {t('create.brief.templates.saveCta')}
            </Button>

            {/* Save dialog — replaces native window.prompt(). */}
            <Dialog open={saveDialogOpen} onOpenChange={(o) => { if (!saving) setSaveDialogOpen(o); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="inline-flex items-center gap-2">
                            <Save className="h-4 w-4 text-primary" />
                            {t('create.brief.templates.saveDialogTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('create.brief.templates.saveDialogBody')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <label className="text-[11px] font-medium text-muted-foreground">
                            {t('create.brief.templates.nameLabel')}
                        </label>
                        <input
                            ref={nameInputRef}
                            type="text"
                            value={pendingName}
                            onChange={(e) => setPendingName(e.target.value.slice(0, 80))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && pendingName.trim() && !saving) {
                                    e.preventDefault();
                                    void confirmSave();
                                }
                            }}
                            placeholder={t('create.brief.templates.namePlaceholder')}
                            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSaveDialogOpen(false)} disabled={saving}>
                            {t('create.brief.templates.cancel')}
                        </Button>
                        <Button
                            onClick={confirmSave}
                            disabled={!pendingName.trim() || saving}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                            {t('create.brief.templates.saveConfirm')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation — replaces native window.confirm(). */}
            <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="inline-flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                            {t('create.brief.templates.deleteDialogTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('create.brief.templates.confirmDelete', { name: deleteTarget?.name ?? '' })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                            {t('create.brief.templates.cancel')}
                        </Button>
                        <Button
                            onClick={confirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            {t('create.brief.templates.deleteConfirm')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
