import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, UserCheck, UserX, X } from 'lucide-react';
import { useTranslation } from '@/i18n';

interface BulkActionsToolbarProps {
    selectedCount: number;
    onClear: () => void;
    onDisable: () => Promise<void>;
    onEnable: () => Promise<void>;
    isRunning: boolean;
}

/**
 * Sticky toolbar shown when one or more users are selected via the row
 * checkboxes. Both actions go through a confirmation dialog so the admin
 * can't accidentally disable 50 users with a single click.
 */
export function BulkActionsToolbar({
    selectedCount,
    onClear,
    onDisable,
    onEnable,
    isRunning,
}: BulkActionsToolbarProps) {
    const { t } = useTranslation('admin');
    const [confirming, setConfirming] = useState<'disable' | 'enable' | null>(null);

    if (selectedCount === 0) return null;

    const runConfirmed = async () => {
        if (confirming === 'disable') await onDisable();
        else if (confirming === 'enable') await onEnable();
        setConfirming(null);
    };

    return (
        <>
            <div className="sticky top-2 z-10 mb-4 bg-primary-solid text-primary-foreground rounded-lg px-4 py-2.5 flex items-center gap-3 shadow-md">
                <span className="text-sm font-semibold">
                    {t('users.bulkActions.selectedCount', { count: selectedCount })}
                </span>
                <div className="ml-auto flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setConfirming('enable')}
                        disabled={isRunning}
                    >
                        <UserCheck className="h-4 w-4 mr-1" />
                        {t('users.bulkActions.enable')}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setConfirming('disable')}
                        disabled={isRunning}
                    >
                        <UserX className="h-4 w-4 mr-1" />
                        {t('users.bulkActions.disable')}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClear}
                        disabled={isRunning}
                        className="text-primary-foreground hover:bg-primary-foreground/10"
                        title={t('users.bulkActions.clearSelection')}
                    >
                        {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirming === 'disable'
                                ? t('users.bulkActions.confirmDisableTitle', { count: selectedCount })
                                : t('users.bulkActions.confirmEnableTitle', { count: selectedCount })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirming === 'disable'
                                ? t('users.bulkActions.confirmDisableDescription')
                                : t('users.bulkActions.confirmEnableDescription')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('users.disableDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={runConfirmed}>
                            {confirming === 'disable'
                                ? t('users.bulkActions.disable')
                                : t('users.bulkActions.enable')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
