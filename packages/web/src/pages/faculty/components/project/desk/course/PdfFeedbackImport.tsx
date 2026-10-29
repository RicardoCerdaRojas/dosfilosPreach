import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import type { FeedbackPattern } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { readPdfAnnotations } from '@/lib/pdf/readPdfAnnotations';
import { TOUCH } from './courseDeskFormat';
import type { CorrectionRow } from './feedbackRows';
import { PdfFeedbackImportRow } from './PdfFeedbackImportRow';
import { importRowFromNote, importRowProblem, isBlankMark, splitReady, type PdfImportRow } from './pdfImportRows';

interface PdfFeedbackImportProps {
    patterns: ReadonlyArray<FeedbackPattern>;
    /** Pasa las filas clasificadas a la lista del diálogo (no guarda nada). */
    onAdd: (rows: CorrectionRow[]) => void;
    /**
     * Los comentarios leídos sin agregar (o `null`): cerrar el diálogo o
     * guardar pregunta antes de perder la clasificación.
     */
    onPendingChange?: (pending: PdfPending | null) => void;
}

/** Lo leído del PDF que todavía no pasó a la lista del diálogo. */
export interface PdfPending {
    /** Los que irían al registro (sin los ignorados). */
    count: number;
    /** Los que ya se pueden agregar. */
    ready: number;
    /** Los que no se pueden agregar todavía (marca sin texto, sin nombre…). */
    incomplete: number;
    /** Las filas listas para la lista del diálogo; las incompletas quedan en el panel. */
    take: () => CorrectionRow[];
}

type Estado = { kind: 'idle' } | { kind: 'reading' } | { kind: 'error' } | { kind: 'locked' } | { kind: 'empty'; file: string } | { kind: 'rows'; file: string };

/**
 * «Leer los comentarios del PDF»: el PDF que devolvió el profesor (Canvas
 * lo descarga con sus anotaciones) se lee en el navegador, sin subirlo. Una
 * fila por comentario con su clase propuesta; «Agregar al registro» las
 * pasa a la lista del diálogo, que se guarda con «Guardar la devolución».
 */
export function PdfFeedbackImport({ patterns, onAdd, onPendingChange }: PdfFeedbackImportProps) {
    const { t } = useTranslation('projectDeskCourse');
    const input = useRef<HTMLInputElement>(null);
    const [estado, setEstado] = useState<Estado>({ kind: 'idle' });
    const [rows, setRows] = useState<PdfImportRow[]>([]);

    const leer = async (file: File | undefined) => {
        if (!file) return;
        setEstado({ kind: 'reading' });
        try {
            // La hoja sin número se guarda neutral («h. 5») y se lee en el idioma de cada uno.
            const notas = await readPdfAnnotations(await file.arrayBuffer());
            setRows(notas.map(importRowFromNote));
            setEstado(notas.length ? { kind: 'rows', file: file.name } : { kind: 'empty', file: file.name });
        } catch (e) {
            setRows([]);
            // Un PDF con contraseña no se arregla descargándolo otra vez: se dice aparte.
            setEstado({ kind: (e as { name?: string } | null)?.name === 'PasswordException' ? 'locked' : 'error' });
        } finally {
            // El mismo archivo se puede volver a elegir.
            if (input.current) input.current.value = '';
        }
    };

    const activas = rows.filter(r => r.choice !== 'ignore');
    const conProblema = rows.filter(r => importRowProblem(r, patterns));
    const enBlanco = rows.filter(isBlankMark);
    const listas = activas.length - conProblema.length;
    const soltar = () => { setRows([]); setEstado({ kind: 'idle' }); };
    /** Pasa las completas; las incompletas se quedan en el panel. */
    const tomar = (): CorrectionRow[] => {
        const { ready, rest } = splitReady(rows, patterns);
        if (rest.length) setRows(rest); else soltar();
        return ready;
    };
    const ignorarEnBlanco = () => setRows(rs => rs.map(r => (isBlankMark(r) ? { ...r, choice: 'ignore' as const } : r)));
    useEffect(() => {
        if (!onPendingChange) return;
        if (!rows.length) { onPendingChange(null); return; }
        onPendingChange({ count: activas.length, ready: listas, incomplete: conProblema.length, take: tomar });
        // `tomar` se rehace con `rows` y `patterns`: con esas dependencias basta.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, patterns, onPendingChange]);

    return (
        <div className="space-y-2 rounded-lg border border-dashed border-border p-3" data-testid="pdf-feedback-import">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground sm:max-w-md">{t('feedbackDialog.pdf.hint')}</p>
                <Button type="button" size="sm" variant="outline" className={TOUCH} disabled={estado.kind === 'reading'} onClick={() => input.current?.click()}>
                    {estado.kind === 'reading'
                        ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                        : <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
                    {t(estado.kind === 'reading' ? 'feedbackDialog.pdf.reading' : 'feedbackDialog.pdf.read')}
                </Button>
                <input
                    ref={input}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                    data-testid="pdf-feedback-file"
                    onChange={e => void leer(e.target.files?.[0])}
                />
            </div>
            <div aria-live="polite" className="text-xs">
                {estado.kind === 'error' && <p className="text-warning-subtle-foreground">{t('feedbackDialog.pdf.error')}</p>}
                {estado.kind === 'locked' && <p className="text-warning-subtle-foreground">{t('feedbackDialog.pdf.locked')}</p>}
                {estado.kind === 'empty' && <p className="text-muted-foreground">{t('feedbackDialog.pdf.empty', { file: estado.file })}</p>}
                {estado.kind === 'rows' && <p className="text-foreground">{t('feedbackDialog.pdf.found', { count: rows.length, file: estado.file })}</p>}
            </div>
            {estado.kind === 'rows' && (
                <>
                    <p className="text-[11px] text-muted-foreground">{t('feedbackDialog.pdf.classifyHint')}</p>
                    <ul className="space-y-2">
                        {rows.map((r, i) => (
                            <PdfFeedbackImportRow key={r.key} row={r} n={i + 1} patterns={patterns} onChange={nr => setRows(rs => rs.map(x => (x.key === r.key ? nr : x)))} />
                        ))}
                    </ul>
                    {conProblema.length > 0 && (
                        <p className="text-xs text-warning-subtle-foreground">{t('feedbackDialog.pdf.incomplete', { count: conProblema.length })}</p>
                    )}
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                        <Button type="button" size="sm" variant="ghost" className={TOUCH} onClick={soltar}>{t('feedbackDialog.pdf.dismiss')}</Button>
                        {enBlanco.length > 0 && (
                            <Button type="button" size="sm" variant="outline" className={TOUCH} onClick={ignorarEnBlanco}>
                                {t('feedbackDialog.pdf.ignoreBlank', { count: enBlanco.length })}
                            </Button>
                        )}
                        <Button type="button" size="sm" className={TOUCH} disabled={listas === 0} onClick={() => onAdd(tomar())}>
                            {t('feedbackDialog.pdf.add', { count: listas })}
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}
