import { useEffect, useId, useState } from 'react';
import { FEEDBACK_DISCARD_REASON_MAX, type DeskPatternRow } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { DIALOG, DIALOG_BODY, DIALOG_FOOTER, DIALOG_HEADER, FIELD, TOUCH } from './courseDeskFormat';

/** Las sugerencias: rellenan el campo; la razón la confirma o la cambia el estudiante. */
const SUGERENCIAS = ['notForCourse', 'professorChanged'] as const;

interface CourseDiscardDialogProps {
    pattern: DeskPatternRow | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Descarta con la razón; `true` si se guardó. */
    onConfirm: (pattern: DeskPatternRow, reason: string) => Promise<boolean>;
    saving: boolean;
}

/**
 * «Descartar» una corrección pide por qué, en una frase («No aplica a este
 * curso», «El profesor cambió de criterio»). La razón queda en la fila del
 * registro: un descarte mudo escondía lo que corrige el profesor, y al
 * volver al curso semanas después no se sabía si fue a propósito.
 */
export function CourseDiscardDialog({ pattern, open, onOpenChange, onConfirm, saving }: CourseDiscardDialogProps) {
    const { t } = useTranslation('projectDeskCourse');
    const id = useId();
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (open) setReason('');
    }, [open, pattern?.patternId]);

    if (!pattern) return null;
    const limpia = reason.trim();
    const confirmar = async () => {
        if (!limpia) return;
        if (await onConfirm(pattern, limpia)) onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn(DIALOG, 'sm:max-w-md')}>
                <DialogHeader className={DIALOG_HEADER}>
                    <DialogTitle className="font-reading">{t('discard.title', { name: pattern.name })}</DialogTitle>
                    <DialogDescription>{t(pattern.kind === 'strength' ? 'discard.hintStrength' : 'discard.hint')}</DialogDescription>
                </DialogHeader>
                <div className={cn(DIALOG_BODY, 'space-y-3')}>
                    <label htmlFor={`${id}-reason`} className="block text-xs text-muted-foreground">{t('discard.reason')}</label>
                    <input
                        id={`${id}-reason`}
                        className={FIELD}
                        value={reason}
                        maxLength={FEEDBACK_DISCARD_REASON_MAX}
                        onChange={e => setReason(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void confirmar(); } }}
                        aria-describedby={`${id}-sug`}
                    />
                    <div id={`${id}-sug`} className="space-y-1.5">
                        <p className="text-[11px] text-muted-foreground">{t('discard.suggestions')}</p>
                        <ul className="flex flex-wrap gap-2">
                            {SUGERENCIAS.map(s => (
                                <li key={s}>
                                    <Button type="button" size="sm" variant="outline" className={TOUCH} onClick={() => setReason(t(`discard.suggestion.${s}`))}>
                                        {t(`discard.suggestion.${s}`)}
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <DialogFooter className={DIALOG_FOOTER}>
                    <Button variant="ghost" className={TOUCH} onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
                    <Button className={TOUCH} onClick={() => void confirmar()} disabled={saving || !limpia}>{t('discard.confirm')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
