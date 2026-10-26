import { useEffect, useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
    COURSE_FEEDBACK_TEXT_MAX,
    COURSE_GRADE_MAX,
    COURSE_NOTE_MAX,
    FEEDBACK_PATTERN_NAME_MAX,
    type CourseOp,
    type CourseScheduleEntry,
    type FeedbackCorrectionInput,
    type FeedbackPattern,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { useConfirmDiscard } from './ConfirmDiscard';
import { DESTRUCTIVE, DIALOG, DIALOG_BODY, DIALOG_FOOTER, DIALOG_HEADER, FIELD, TOUCH } from './courseDeskFormat';

/** El valor del selector que pide escribir el nombre de un patrón nuevo. */
const NUEVO = '__new';

interface CorrectionRow {
    key: string;
    /** Un patrón existente o `NUEVO`. */
    patternId: string;
    patternName: string;
    note: string;
    /** Ya estaba guardada: conserva su id y editar no la duplica. */
    saved: boolean;
}

let seq = 0;
const nuevaFila = (patternId = NUEVO): CorrectionRow => ({ key: `nueva-${++seq}`, patternId, patternName: '', note: '', saved: false });

interface CourseFeedbackDialogProps {
    /** La entrada del calendario (guardada), con su devolución si la tiene. */
    entry: CourseScheduleEntry | null;
    patterns: ReadonlyArray<FeedbackPattern>;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Guarda las operaciones; `true` si se guardó. */
    onSubmit: (ops: CourseOp[], successKey: string) => Promise<boolean>;
    saving: boolean;
}

/**
 * «Registrar la devolución» (§9.1): lo que escribió el profesor, la nota y
 * cada corrección con su patrón (uno existente o uno nuevo por nombre). El
 * texto lo pega o lo escribe el estudiante: aquí no se resume ni se redacta.
 *
 * «Sin devolución» se marca a propósito (la fase 5 no la espera) y no pisa
 * una devolución con contenido. Registrar la devolución NO marca la entrega
 * como entregada: son dos acciones.
 */
export function CourseFeedbackDialog({ entry, patterns, open, onOpenChange, onSubmit, saving }: CourseFeedbackDialogProps) {
    const { t } = useTranslation('projectDeskCourse');
    const ids = useId();
    const previa = entry?.feedback ?? null;
    const [text, setText] = useState('');
    const [grade, setGrade] = useState('');
    const [rows, setRows] = useState<CorrectionRow[]>([]);
    /** Lo que había al abrir: cerrar con cambios pregunta antes (una devolución pegada no se pierde con Escape). */
    const [inicial, setInicial] = useState('');
    const [quitando, setQuitando] = useState(false);
    const foto = (x: { text: string; grade: string; rows: CorrectionRow[] }) =>
        JSON.stringify([x.text, x.grade, x.rows.map(r => [r.key, r.patternId, r.patternName, r.note])]);

    useEffect(() => {
        if (!open) return;
        const conContenido = previa && !previa.none ? previa : null;
        const filas = (conContenido?.corrections ?? []).map(c => ({ key: c.id, patternId: c.patternId, patternName: '', note: c.note ?? '', saved: true }));
        setText(conContenido?.text ?? '');
        setGrade(conContenido?.grade ?? '');
        setRows(filas);
        setInicial(foto({ text: conContenido?.text ?? '', grade: conContenido?.grade ?? '', rows: filas }));
        setQuitando(false);
        // Solo al abrir: lo que se escribe no se pisa con cada render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, entry?.id]);

    const { requestOpenChange, confirm } = useConfirmDiscard(open && foto({ text, grade, rows }) !== inicial, onOpenChange);
    if (!entry) return null;
    const cambiar = (key: string, patch: Partial<CorrectionRow>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));
    const filaValida = (r: CorrectionRow) => (r.patternId === NUEVO ? !!r.patternName.trim() : patterns.some(p => p.id === r.patternId));
    const corrections: FeedbackCorrectionInput[] = rows.filter(filaValida).map(r => ({
        ...(r.saved ? { id: r.key } : {}),
        ...(r.patternId === NUEVO ? { patternName: r.patternName.trim() } : { patternId: r.patternId }),
        ...(r.note.trim() ? { note: r.note.trim() } : {}),
    }));
    const vacia = !text.trim() && !grade.trim() && corrections.length === 0;
    const incompletas = rows.some(r => !filaValida(r));
    const tieneContenido = !!previa && !previa.none && (!!previa.text || !!previa.grade || previa.corrections.length > 0);

    const guardar = async () => {
        const ok = await onSubmit([{
            op: 'recordFeedback',
            entryId: entry.id,
            feedback: {
                text: text.trim(),
                grade: grade.trim() || null,
                // Al editar se conserva cuándo llegó.
                ...(previa && !previa.none ? { receivedAt: previa.receivedAt } : {}),
                corrections,
            },
        }], 'toast.feedbackSaved');
        if (ok) onOpenChange(false);
    };
    const sinDevolucion = async () => {
        if (await onSubmit([{ op: 'markNoFeedback', entryId: entry.id }], 'toast.noFeedbackSaved')) onOpenChange(false);
    };
    const quitar = async () => {
        setQuitando(false);
        if (await onSubmit([{ op: 'clearFeedback', entryId: entry.id }], 'toast.feedbackCleared')) onOpenChange(false);
    };
    const guardadas = previa && !previa.none ? previa.corrections.length : 0;

    return (
        <>
        <Dialog open={open} onOpenChange={requestOpenChange}>
            <DialogContent className={cn(DIALOG, 'sm:max-w-2xl')}>
                <DialogHeader className={DIALOG_HEADER}>
                    <DialogTitle className="font-reading">{t('feedbackDialog.title', { label: entry.label })}</DialogTitle>
                    <DialogDescription>{t('feedbackDialog.hint')}</DialogDescription>
                </DialogHeader>

                <div className={cn(DIALOG_BODY, 'space-y-4')}>
                    <label className="block space-y-1">
                        <span className="text-xs text-muted-foreground">{t('feedbackDialog.text')}</span>
                        <textarea
                            className={`${FIELD} min-h-32 resize-y`}
                            rows={6}
                            value={text}
                            maxLength={COURSE_FEEDBACK_TEXT_MAX}
                            onChange={e => setText(e.target.value)}
                            placeholder={t('feedbackDialog.textPlaceholder')}
                        />
                    </label>
                    <label className="block space-y-1 sm:w-48">
                        <span className="text-xs text-muted-foreground">{t('feedbackDialog.grade')}</span>
                        <input className={FIELD} value={grade} maxLength={COURSE_GRADE_MAX} onChange={e => setGrade(e.target.value)} placeholder={t('feedbackDialog.gradePlaceholder')} />
                    </label>

                    <fieldset className="space-y-2">
                        <legend className="text-sm font-medium text-foreground">{t('feedbackDialog.corrections')}</legend>
                        <p className="text-xs text-muted-foreground">{t('feedbackDialog.correctionsHint')}</p>
                        {rows.length > 0 && (
                            <ul className="space-y-2">
                                {rows.map((r, i) => (
                                    <li key={r.key} data-testid="feedback-correction-row" className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
                                        <div className="space-y-1">
                                            <label htmlFor={`${ids}-p-${r.key}`} className="sr-only">{t('feedbackDialog.pattern', { n: i + 1 })}</label>
                                            <select id={`${ids}-p-${r.key}`} className={FIELD} value={r.patternId} onChange={e => cambiar(r.key, { patternId: e.target.value })}>
                                                {patterns.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                <option value={NUEVO}>{t('feedbackDialog.newPattern')}</option>
                                            </select>
                                            {r.patternId === NUEVO && (
                                                <>
                                                    <label htmlFor={`${ids}-n-${r.key}`} className="sr-only">{t('feedbackDialog.patternName', { n: i + 1 })}</label>
                                                    <input
                                                        id={`${ids}-n-${r.key}`}
                                                        className={FIELD}
                                                        value={r.patternName}
                                                        maxLength={FEEDBACK_PATTERN_NAME_MAX}
                                                        onChange={e => cambiar(r.key, { patternName: e.target.value })}
                                                        placeholder={t('feedbackDialog.patternNamePlaceholder')}
                                                    />
                                                </>
                                            )}
                                        </div>
                                        <div>
                                            <label htmlFor={`${ids}-d-${r.key}`} className="sr-only">{t('feedbackDialog.note', { n: i + 1 })}</label>
                                            <input
                                                id={`${ids}-d-${r.key}`}
                                                className={FIELD}
                                                value={r.note}
                                                maxLength={COURSE_NOTE_MAX}
                                                onChange={e => cambiar(r.key, { note: e.target.value })}
                                                placeholder={t('feedbackDialog.notePlaceholder')}
                                            />
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            // Compacta: un cuadrado de 44 px, a la derecha; no una franja a todo el ancho en el teléfono.
                                            className="h-11 w-11 justify-self-end p-0 sm:h-9 sm:w-9"
                                            onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}
                                            aria-label={t('feedbackDialog.removeCorrection', { n: i + 1 })}
                                        >
                                            <X className="h-3.5 w-3.5" aria-hidden />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <Button size="sm" variant="outline" className={TOUCH} onClick={() => setRows(rs => [...rs, nuevaFila(patterns[0]?.id ?? NUEVO)])}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                            {t('feedbackDialog.addCorrection')}
                        </Button>
                        {incompletas && <p className="text-xs text-warning-subtle-foreground">{t('feedbackDialog.incomplete')}</p>}
                    </fieldset>
                </div>

                <DialogFooter className={cn(DIALOG_FOOTER, 'sm:justify-between')}>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        {previa && (
                            // Borra lo registrado: se confirma diciendo qué se pierde.
                            <Button variant="ghost" className={TOUCH} onClick={() => setQuitando(true)} disabled={saving}>
                                {t(previa.none ? 'feedbackDialog.clearNone' : 'feedbackDialog.clear')}
                            </Button>
                        )}
                        {!tieneContenido && !previa?.none && (
                            <Button variant="outline" className={TOUCH} onClick={() => void sinDevolucion()} disabled={saving}>
                                {t('feedbackDialog.none')}
                            </Button>
                        )}
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                        <Button variant="ghost" className={TOUCH} onClick={() => requestOpenChange(false)}>{t('common.cancel')}</Button>
                        <Button className={TOUCH} onClick={() => void guardar()} disabled={saving || vacia || incompletas}>{t('feedbackDialog.save')}</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        {confirm}
        <AlertDialog open={quitando} onOpenChange={setQuitando}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t(previa?.none ? 'feedbackDialog.clearNoneTitle' : 'feedbackDialog.clearTitle', { label: entry.label })}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {previa?.none
                            ? t('feedbackDialog.clearNoneHint')
                            : t('feedbackDialog.clearHint', { count: guardadas })}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className={TOUCH}>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction className={cn(TOUCH, DESTRUCTIVE)} onClick={() => void quitar()}>
                        {t(previa?.none ? 'feedbackDialog.clearNone' : 'feedbackDialog.clear')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
