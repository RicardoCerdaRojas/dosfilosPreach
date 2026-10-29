import {
    AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { TOUCH } from './courseDeskFormat';

interface PdfPendingSaveAlertProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Los comentarios leídos que irían al registro. */
    count: number;
    /** Los que ya se pueden agregar: «Agregarlos y guardar» agrega esos. */
    ready: number;
    /** Los que no se pueden agregar todavía: se quedan fuera (se dice). */
    incomplete: number;
    /** Sin ellos no queda nada que guardar: «Guardar sin ellos» no se ofrece. */
    canSaveWithout: boolean;
    onAddAndSave: () => void;
    onSaveWithout: () => void;
}

/**
 * «Guardar la devolución» con comentarios del PDF leídos y sin agregar:
 * se perderían sin aviso (lo mismo que al cerrar). Se ofrece agregarlos y
 * guardar (los completos; los incompletos quedan fuera y se dice), guardar
 * sin ellos o volver a clasificarlos.
 */
export function PdfPendingSaveAlert({ open, onOpenChange, count, ready, incomplete, canSaveWithout, onAddAndSave, onSaveWithout }: PdfPendingSaveAlertProps) {
    const { t } = useTranslation('projectDeskCourse');
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('feedbackDialog.pdfPending.title', { count })}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('feedbackDialog.pdfPending.hint')}
                        {incomplete > 0 && <span className="mt-2 block font-medium text-warning-subtle-foreground">{t('feedbackDialog.pdfPending.incomplete', { count: incomplete })}</span>}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className={TOUCH}>{t('feedbackDialog.pdfPending.back')}</AlertDialogCancel>
                    {canSaveWithout && (
                        <Button variant="outline" className={TOUCH} onClick={onSaveWithout}>{t('feedbackDialog.pdfPending.saveWithout')}</Button>
                    )}
                    <Button className={TOUCH} onClick={onAddAndSave} disabled={ready === 0}>{t('feedbackDialog.pdfPending.addAndSave')}</Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
