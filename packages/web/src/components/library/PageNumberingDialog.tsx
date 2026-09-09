import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { numberingFromCalibrationPoints, type PageNumbering } from '@dosfilos/domain';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { PdfPageViewer } from '@/components/exegesis/setup/page-picker/PdfPageViewer';
import { useDocumentPdfUrl } from '@/hooks/exegesis/useDocumentPageIndex';
import { usePageNumberingProposal, useSavePageNumbering } from '@/hooks/library/usePageNumbering';
import { NumberingSegmentsPreview } from './NumberingSegmentsPreview';

interface Props {
    resourceId: string | null;
    resourceTitle: string;
    open: boolean;
    onClose: () => void;
    onSaved?: (numbering: PageNumbering) => void;
}

/** Lo que el usuario respondió para una hoja. */
interface Answer {
    sheet: number;
    /** Texto crudo del campo: se valida al construir, no al teclear. */
    value: string;
    /** La hoja no lleva número arábigo. */
    unnumbered: boolean;
}

/**
 * Calibración de la numeración impresa de un recurso.
 *
 * Muestra tres hojas repartidas por el libro y pregunta qué número lleva cada
 * una impreso. Con eso el sistema puede citar «p. 28» en vez de «hoja 32»,
 * que no es un detalle de rótulo: una cita que dice «p.» sobre la hoja de un
 * PDF manda al lector a una página que habla de otra cosa, y lo hace con la
 * apariencia de un dato verificado.
 *
 * Tres puntos y no uno porque el desfase no siempre es constante: hay libros
 * cuya cuenta se corre a mitad del volumen, y con un solo punto la mitad de
 * las citas saldría mal en silencio.
 */
export function PageNumberingDialog({ resourceId, resourceTitle, open, onClose, onSaved }: Props) {
    const { t } = useTranslation('library');
    const proposal = usePageNumberingProposal(open ? resourceId : null);
    const pdf = useDocumentPdfUrl(open ? resourceId : null);
    const save = useSavePageNumbering();
    const [answers, setAnswers] = useState<Answer[]>([]);

    // La propuesta del detector entra como valor inicial: para los libros que
    // resuelve bien, calibrar es mirar y aceptar, no buscar tres números.
    useEffect(() => {
        if (!proposal.data) return;
        setAnswers(proposal.data.points.map(p => ({
            sheet: p.sheet,
            value: p.proposed === null ? '' : String(p.proposed),
            unnumbered: false,
        })));
    }, [proposal.data]);

    const numbering = useMemo(() => {
        if (answers.length === 0 || !proposal.data) return null;
        const points = answers
            .map(a => ({
                sheet: a.sheet,
                printed: a.unnumbered ? null : Number.parseInt(a.value, 10),
            }))
            .filter(p => p.printed === null || Number.isFinite(p.printed));
        return numberingFromCalibrationPoints(points, proposal.data.lastSheet);
    }, [answers, proposal.data]);

    const incomplete = answers.some(a => !a.unnumbered && !a.value.trim());
    const patch = (sheet: number, next: Partial<Answer>) =>
        setAnswers(prev => prev.map(a => (a.sheet === sheet ? { ...a, ...next } : a)));

    const handleSave = async () => {
        if (!resourceId || !numbering) return;
        await save.mutateAsync({ resourceId, numbering });
        onSaved?.(numbering);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={o => !o && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('numbering.title')}</DialogTitle>
                    <DialogDescription>
                        {t('numbering.description', { title: resourceTitle })}
                    </DialogDescription>
                </DialogHeader>

                {proposal.isLoading && (
                    <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('numbering.loading')}
                    </div>
                )}

                {proposal.isError && (
                    <p className="py-8 text-center text-destructive">{t('numbering.loadFailed')}</p>
                )}

                {proposal.data && (
                    <div className="space-y-6">
                        <div className="grid gap-4 sm:grid-cols-3">
                            {answers.map(answer => (
                                <div key={answer.sheet} className="space-y-2">
                                    <div className="h-56 overflow-hidden rounded border bg-muted">
                                        <PdfPageViewer
                                            url={pdf.data?.url ?? null}
                                            sheet={answer.sheet}
                                            selected={false}
                                            zoom="fit"
                                        />
                                    </div>
                                    <Label htmlFor={`printed-${answer.sheet}`} className="text-xs text-muted-foreground">
                                        {t('numbering.sheetLabel', { sheet: answer.sheet })}
                                    </Label>
                                    <Input
                                        id={`printed-${answer.sheet}`}
                                        inputMode="numeric"
                                        value={answer.value}
                                        disabled={answer.unnumbered}
                                        placeholder={t('numbering.printedPlaceholder')}
                                        onChange={e => patch(answer.sheet, { value: e.target.value.replace(/\D/g, '') })}
                                    />
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id={`unnumbered-${answer.sheet}`}
                                            checked={answer.unnumbered}
                                            onCheckedChange={c => patch(answer.sheet, { unnumbered: c === true })}
                                        />
                                        <Label htmlFor={`unnumbered-${answer.sheet}`} className="text-xs font-normal">
                                            {t('numbering.unnumbered')}
                                        </Label>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <NumberingSegmentsPreview numbering={numbering} />
                    </div>
                )}

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>{t('numbering.cancel')}</Button>
                    <Button
                        onClick={handleSave}
                        disabled={!numbering || incomplete || save.isPending}
                    >
                        {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('numbering.confirm')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
