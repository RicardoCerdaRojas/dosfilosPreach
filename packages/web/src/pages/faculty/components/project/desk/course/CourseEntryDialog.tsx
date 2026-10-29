import { useEffect, useId, useState } from 'react';
import {
    nextLabelFor,
    projectWorkTypes,
    type AIProject,
    type CourseEntryInput,
    type CourseScheduleEntry,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { formatPassageReference, passageToReader } from '@dosfilos/domain';
import { parseReaderRange, primaryBook, rangeText } from '../../ProjectFramingForm';
import { cn } from '@/lib/utils';
import { useConfirmDiscard } from './ConfirmDiscard';
import { DIALOG, DIALOG_BODY, DIALOG_FOOTER, DIALOG_HEADER, FIELD, TOUCH, langOf, type DeskLang } from './courseDeskFormat';

interface CourseEntryDialogProps {
    project: AIProject;
    /** La entrada que se edita; `null` crea una nueva. */
    entry: CourseScheduleEntry | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Guarda; `true` si se guardó (el diálogo se cierra solo entonces). */
    onSave: (entry: CourseEntryInput) => Promise<boolean>;
    saving: boolean;
    /**
     * Los trabajos que pueden cumplirla: los del curso sin entrega (y el que
     * ya la cumple). Así un trabajo creado aparte se vincula con su entrega.
     */
    studies?: ReadonlyArray<{ id: string; label: string }>;
}

/**
 * Una entrega del calendario: tipo de trabajo, rótulo («TP #10», sugerido
 * con el número que sigue), pasaje opcional y fecha. El pasaje se escribe en
 * la numeración de la Biblia del estudiante y se guarda en la del original,
 * como el encuadre.
 */
export function CourseEntryDialog({ project, entry, open, onOpenChange, onSave, saving, studies = [] }: CourseEntryDialogProps) {
    const { t, i18n } = useTranslation('projectDeskCourse');
    const lang = langOf(i18n.language);
    const ids = useId();
    const tipos = projectWorkTypes(project);
    const schedule = project.courseSchedule ?? [];
    const libro = primaryBook(project.bibliographyCriteria?.bibleBooks ?? []);

    const [workTypeId, setWorkTypeId] = useState('');
    const [label, setLabel] = useState('');
    const [labelTouched, setLabelTouched] = useState(false);
    const [passage, setPassage] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [passageError, setPassageError] = useState(false);
    const [paperId, setPaperId] = useState('');
    /** Lo que había al abrir: cerrar con cambios pregunta antes. */
    const [inicial, setInicial] = useState('');
    const actual = JSON.stringify([workTypeId, label, passage, dueDate, paperId]);

    // Al abrir: lo guardado, o una entrada nueva del primer tipo con su rótulo siguiente.
    useEffect(() => {
        if (!open) return;
        const tipo = entry?.workTypeId || tipos[0]?.id || '';
        setWorkTypeId(tipo);
        setLabel(entry?.label ?? (tipo ? nextLabelFor(tipo, schedule) ?? '' : ''));
        setLabelTouched(!!entry);
        setPassage(entry?.passage ? rangeTextFor(entry.passage, libro, lang) : '');
        setDueDate(entry?.dueDate ?? '');
        setPassageError(false);
        setPaperId(entry?.paperId ?? '');
        setInicial(JSON.stringify([
            tipo, entry?.label ?? (tipo ? nextLabelFor(tipo, schedule) ?? '' : ''),
            entry?.passage ? rangeTextFor(entry.passage, libro, lang) : '', entry?.dueDate ?? '', entry?.paperId ?? '',
        ]));
        // Solo al abrir: lo que el estudiante escribe no se pisa con cada render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, entry?.id]);

    const cambiarTipo = (id: string) => {
        setWorkTypeId(id);
        // El rótulo sugerido sigue al tipo mientras el estudiante no lo escriba.
        if (!labelTouched) setLabel(nextLabelFor(id, schedule) ?? '');
    };
    const sugerido = workTypeId ? nextLabelFor(workTypeId, schedule) : null;

    const guardar = async () => {
        const r = parseReaderRange(passage, libro);
        if (!r.ok) { setPassageError(true); return; }
        const ok = await onSave({
            ...(entry ? { id: entry.id } : {}),
            workTypeId,
            label: label.trim(),
            passage: r.passage,
            dueDate: dueDate || null,
            // Solo si se ofrece elegir: si no, no se toca el trabajo que la cumple.
            ...(studies.length > 0 ? { paperId: paperId || null } : {}),
        });
        if (ok) onOpenChange(false);
    };
    const puedeGuardar = !!workTypeId && !!label.trim() && !saving;
    const { requestOpenChange, confirm } = useConfirmDiscard(open && actual !== inicial, onOpenChange);

    return (
        <>
        <Dialog open={open} onOpenChange={requestOpenChange}>
            <DialogContent className={cn(DIALOG, 'sm:max-w-md')}>
                <DialogHeader className={DIALOG_HEADER}>
                    <DialogTitle className="font-reading">{t(entry ? 'calendar.editTitle' : 'calendar.addTitle')}</DialogTitle>
                    <DialogDescription>{t('calendar.formHint')}</DialogDescription>
                </DialogHeader>
                <div className={cn(DIALOG_BODY, 'space-y-3')}>
                    <label className="block space-y-1">
                        <span className="text-xs text-muted-foreground">{t('calendar.workType')}</span>
                        <select className={FIELD} value={workTypeId} onChange={e => cambiarTipo(e.target.value)}>
                            {!workTypeId && <option value="">{t('calendar.pickWorkType')}</option>}
                            {tipos.map(x => <option key={x.id} value={x.id}>{x.label || t('charge.untitled')}</option>)}
                        </select>
                    </label>
                    <label className="block space-y-1">
                        <span className="text-xs text-muted-foreground">{t('calendar.label')}</span>
                        <input
                            className={FIELD}
                            value={label}
                            maxLength={120}
                            onChange={e => { setLabel(e.target.value); setLabelTouched(true); }}
                            aria-describedby={`${ids}-label-hint`}
                        />
                        <span id={`${ids}-label-hint`} className="block text-[11px] text-muted-foreground">
                            {sugerido ? t('calendar.labelSuggested', { label: sugerido }) : t('calendar.labelHint')}
                        </span>
                    </label>
                    <label className="block space-y-1">
                        <span className="text-xs text-muted-foreground">{t('calendar.passage')}</span>
                        <input
                            className={FIELD}
                            value={passage}
                            onChange={e => { setPassage(e.target.value); setPassageError(false); }}
                            placeholder={t('calendar.passagePlaceholder')}
                            aria-invalid={passageError || undefined}
                            aria-describedby={`${ids}-passage-hint`}
                        />
                        <span id={`${ids}-passage-hint`} className={passageError ? 'block text-[11px] font-medium text-warning-subtle-foreground' : 'block text-[11px] text-muted-foreground'}>
                            {t(passageError ? 'calendar.passageInvalid' : 'calendar.passageHint')}
                        </span>
                    </label>
                    <label className="block space-y-1">
                        <span className="text-xs text-muted-foreground">{t('calendar.dueDate')}</span>
                        <input type="date" className={FIELD} value={dueDate} onChange={e => setDueDate(e.target.value)} />
                        <span className="block text-[11px] text-muted-foreground">{t('calendar.dueDateHint')}</span>
                    </label>
                    {studies.length > 0 && (
                        <label className="block space-y-1">
                            <span className="text-xs text-muted-foreground">{t('calendar.paper')}</span>
                            <select className={FIELD} value={paperId} onChange={e => setPaperId(e.target.value)}>
                                <option value="">{t('calendar.noPaper')}</option>
                                {studies.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                            <span className="block text-[11px] text-muted-foreground">{t('calendar.paperHint')}</span>
                        </label>
                    )}
                    {tipos.length === 0 && <p className="text-xs text-warning-subtle-foreground">{t('calendar.noWorkTypes')}</p>}
                </div>
                <DialogFooter className={DIALOG_FOOTER}>
                    <Button variant="ghost" className={TOUCH} onClick={() => requestOpenChange(false)}>{t('common.cancel')}</Button>
                    <Button className={TOUCH} onClick={() => void guardar()} disabled={!puedeGuardar}>{t('common.save')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        {confirm}
        </>
    );
}

/** El pasaje guardado, para editarlo: solo el tramo si es del libro del curso. */
function rangeTextFor(p: NonNullable<CourseScheduleEntry['passage']>, libro: string | null, lang: DeskLang): string {
    const lector = passageToReader(p).passage;
    return p.bookId === libro ? rangeText(lector) : formatPassageReference(lector, lang);
}
