import { useState, type ReactNode } from 'react';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTranslation } from '@/i18n';
import { TOUCH } from './courseDeskFormat';

/**
 * Cerrar un diálogo con cambios sin guardar pregunta antes: una devolución
 * pegada a mano (el texto del profesor, la nota, cada corrección) se perdía
 * con un clic fuera o con Escape. Sin cambios, cierra directo.
 *
 * Devuelve el `onOpenChange` que se le pasa al `Dialog` (Escape, el clic
 * fuera, la «X» y «Cancelar» pasan todos por él) y el aviso para montar.
 */
export function useConfirmDiscard(dirty: boolean, onOpenChange: (open: boolean) => void): {
    requestOpenChange: (open: boolean) => void;
    confirm: ReactNode;
} {
    const { t } = useTranslation('projectDeskCourse');
    const [preguntando, setPreguntando] = useState(false);
    const requestOpenChange = (open: boolean) => {
        if (!open && dirty) { setPreguntando(true); return; }
        onOpenChange(open);
    };
    const confirm = (
        <AlertDialog open={preguntando} onOpenChange={setPreguntando}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('discardChanges.title')}</AlertDialogTitle>
                    <AlertDialogDescription>{t('discardChanges.hint')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className={TOUCH}>{t('discardChanges.keep')}</AlertDialogCancel>
                    <AlertDialogAction className={TOUCH} onClick={() => { setPreguntando(false); onOpenChange(false); }}>
                        {t('discardChanges.discard')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
    return { requestOpenChange, confirm };
}
