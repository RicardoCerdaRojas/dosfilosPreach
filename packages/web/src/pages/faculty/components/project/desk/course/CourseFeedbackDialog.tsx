import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import {
    COURSE_FEEDBACK_TEXT_MAX,
    COURSE_GRADE_MAX,
    type CourseOp,
    type CourseScheduleEntry,
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
import { FeedbackCorrectionRow } from './FeedbackCorrectionRow';
import { newRow, rowIsValid, rowSnapshot, rowToInput, savedRow, type CorrectionRow } from './feedbackRows';
import { PdfFeedbackImport, type PdfPending } from './PdfFeedbackImport';
import { PdfPendingSaveAlert } from './PdfPendingSaveAlert';

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
 * cada observación con su clase (corrección o fortaleza), su patrón (uno
 * existente o uno nuevo por nombre) y dónde la hizo. El texto lo pega o lo
 * escribe el estudiante, o llega de los comentarios del PDF corregido: aquí
 * no se resume ni se redacta.
 *
 * «Sin devolución» se marca a propósito (la fase 5 no la espera) y no pisa
 * una devolución con contenido. Registrar la devolución NO marca la entrega
 * como entregada: son dos acciones.
 */
export function CourseFeedbackDialog({ entry, patterns, open, onOpenChange, onSubmit, saving }: CourseFeedbackDialogProps) {
    const { t } = useTranslation('projectDeskCourse');
    const previa = entry?.feedback ?? null;
    const [text, setText] = useState('');
    const [grade, setGrade] = useState('');
    const [rows, setRows] = useState<CorrectionRow[]>([]);
    /** Lo que había al abrir: cerrar con cambios pregunta antes (una devolución pegada no se pierde con Escape). */
    const [inicial, setInicial] = useState('');
    const [quitando, setQuitando] = useState(false);
    // Lo leído del PDF y todavía sin agregar también cuenta: la clasificación se perdería.
    const [pdfPendiente, setPdfPendiente] = useState<PdfPending | null>(null);
    /** «Guardar» con comentarios del PDF sin agregar: se pregunta antes (se perderían). */
    const [preguntandoPdf, setPreguntandoPdf] = useState(false);
    const foto = (x: { text: string; grade: string; rows: CorrectionRow[] }) =>
        JSON.stringify([x.text, x.grade, x.rows.map(rowSnapshot)]);

    useEffect(() => {
        if (!open) return;
        const conContenido = previa && !previa.none ? previa : null;
        const filas = (conContenido?.corrections ?? []).map(c => savedRow(c, patterns));
        setText(conContenido?.text ?? '');
        setGrade(conContenido?.grade ?? '');
        setRows(filas);
        setInicial(foto({ text: conContenido?.text ?? '', grade: conContenido?.grade ?? '', rows: filas }));
        setQuitando(false);
        setPdfPendiente(null);
        setPreguntandoPdf(false);
        // Solo al abrir: lo que se escribe no se pisa con cada render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, entry?.id]);

    const { requestOpenChange, confirm } = useConfirmDiscard(open && (!!pdfPendiente || foto({ text, grade, rows }) !== inicial), onOpenChange);
    if (!entry) return null;
    const filaValida = (r: CorrectionRow) => rowIsValid(r, patterns);
    const aGuardar = (filas: CorrectionRow[]) => filas.filter(filaValida).map(rowToInput);
    const corrections = aGuardar(rows);
    const vacia = !text.trim() && !grade.trim() && corrections.length === 0;
    const pdfSinAgregar = pdfPendiente?.count ?? 0;
    const incompletas = rows.some(r => !filaValida(r));
    const tieneContenido = !!previa && !previa.none && (!!previa.text || !!previa.grade || previa.corrections.length > 0);

    /** Con `extra`: las filas del PDF que se agregaron al guardar. */
    const guardar = async (extra: CorrectionRow[] = []) => {
        setPreguntandoPdf(false);
        const ok = await onSubmit([{
            op: 'recordFeedback',
            entryId: entry.id,
            feedback: {
                text: text.trim(),
                grade: grade.trim() || null,
                // Al editar se conserva cuándo llegó.
                ...(previa && !previa.none ? { receivedAt: previa.receivedAt } : {}),
                corrections: aGuardar([...rows, ...extra]),
            },
        }], 'toast.feedbackSaved');
        if (ok) onOpenChange(false);
    };
    const pedirGuardar = () => (pdfSinAgregar > 0 ? setPreguntandoPdf(true) : void guardar());
    const agregarYGuardar = () => {
        const extra = pdfPendiente?.take() ?? [];
        // Quedan en la lista: si el guardado falla, no se pierden.
        setRows(rs => [...rs, ...extra]);
        void guardar(extra);
    };
    const sinDevolucion = async () => {
        if (await onSubmit([{ op: 'markNoFeedback', entryId: entry.id }], 'toast.noFeedbackSaved')) onOpenChange(false);
    };
    const quitar = async () => {
        setQuitando(false);
        if (await onSubmit([{ op: 'clearFeedback', entryId: entry.id }], 'toast.feedbackCleared')) onOpenChange(false);
    };
    // Lo que se borra, por clase: «3 correcciones y 12 fortalezas», no «15 correcciones».
    const guardadasLista = previa && !previa.none ? previa.corrections : [];
    const fortalezasGuardadas = guardadasLista.filter(c => patterns.find(p => p.id === c.patternId)?.kind === 'strength').length;
    const correccionesGuardadas = guardadasLista.length - fortalezasGuardadas;
    const queSeBorra = [
        correccionesGuardadas ? t('feedbackDialog.clearCount.corrections', { count: correccionesGuardadas }) : '',
        fortalezasGuardadas ? t('feedbackDialog.clearCount.strengths', { count: fortalezasGuardadas }) : '',
    ].filter(Boolean).join(t('feedbackDialog.clearAnd'));

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
                        <PdfFeedbackImport patterns={patterns} onAdd={nuevas => setRows(rs => [...rs, ...nuevas])} onPendingChange={setPdfPendiente} />
                        {rows.length > 0 && (
                            <ul className="space-y-2">
                                {rows.map((r, i) => (
                                    <FeedbackCorrectionRow
                                        key={r.key}
                                        row={r}
                                        n={i + 1}
                                        patterns={patterns}
                                        onChange={nr => setRows(rs => rs.map(x => (x.key === r.key ? nr : x)))}
                                        onRemove={() => setRows(rs => rs.filter(x => x.key !== r.key))}
                                    />
                                ))}
                            </ul>
                        )}
                        <Button size="sm" variant="outline" className={TOUCH} onClick={() => setRows(rs => [...rs, newRow(patterns)])}>
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
                        <Button className={TOUCH} onClick={pedirGuardar} disabled={saving || (vacia && !pdfSinAgregar) || incompletas}>{t('feedbackDialog.save')}</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        {confirm}
        <PdfPendingSaveAlert
            open={preguntandoPdf}
            onOpenChange={setPreguntandoPdf}
            count={pdfSinAgregar}
            ready={pdfPendiente?.ready ?? 0}
            incomplete={pdfPendiente?.incomplete ?? 0}
            canSaveWithout={!vacia}
            onAddAndSave={agregarYGuardar}
            onSaveWithout={() => void guardar()}
        />
        <AlertDialog open={quitando} onOpenChange={setQuitando}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t(previa?.none ? 'feedbackDialog.clearNoneTitle' : 'feedbackDialog.clearTitle', { label: entry.label })}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {previa?.none
                            ? t('feedbackDialog.clearNoneHint')
                            : queSeBorra ? t('feedbackDialog.clearHint', { what: queSeBorra }) : t('feedbackDialog.clearHintEmpty')}
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
