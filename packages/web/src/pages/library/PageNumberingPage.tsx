import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { numberingFromCalibrationPoints } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PdfPageViewer } from '@/components/exegesis/setup/page-picker/PdfPageViewer';
import { NumberingSegmentsPreview } from '@/components/library/NumberingSegmentsPreview';
import { useDocumentPdfUrl } from '@/hooks/exegesis/useDocumentPageIndex';
import { usePageNumbering, useSavePageNumbering } from '@/hooks/library/usePageNumbering';

/** Lo respondido para una hoja. Se guarda por índice de paso, no por hoja: la hoja puede cambiar. */
interface Answer {
    sheet: number;
    value: string;
    unnumbered: boolean;
}

const ZOOM_STEPS = [1, 1.5, 2, 3] as const;

/**
 * Decirle al sistema qué número lleva impreso cada hoja de un libro.
 *
 * Es una página y no un diálogo por lo que la tarea es: **leer tipografía
 * chica al pie de un escaneo**. Todo lo demás es secundario frente a eso, y un
 * recuadro centrado obliga a miniaturas donde el folio no se lee. La primera
 * versión fue un modal con tres miniaturas de 130 píxeles y no servía para lo
 * único que había que hacer.
 *
 * De ahí las tres cosas que el modal no podía dar:
 *
 *   - Una hoja grande a la vez, con zoom, porque el folio suele ser diminuto
 *     y estar sobre papel manchado.
 *   - Navegación de hoja. Si la propuesta cae en una apertura de capítulo
 *     —que casi nunca lleva folio— hay que poder mirar la siguiente en vez de
 *     marcar «no tiene número», que sería falso para el libro entero y
 *     fabricaría un tramo sin numeración que no existe.
 *   - Una URL, para volver después de ir a buscar el ejemplar.
 */
export function PageNumberingPage() {
    const { resourceId } = useParams<{ resourceId: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation('library');
    const state = usePageNumbering(resourceId ?? null);
    const pdf = useDocumentPdfUrl(resourceId ?? null);
    const save = useSavePageNumbering();

    const [answers, setAnswers] = useState<Answer[]>([]);
    const [step, setStep] = useState(0);
    const [zoom, setZoom] = useState(1);

    useEffect(() => {
        if (!state.data) return;
        setAnswers(state.data.points.map(p => ({
            sheet: p.sheet,
            value: p.proposed === null ? '' : String(p.proposed),
            unnumbered: false,
        })));
    }, [state.data]);

    const current = answers[step];
    const lastSheet = state.data?.lastSheet ?? 1;

    const numbering = useMemo(() => {
        if (answers.length === 0 || !state.data) return null;
        const points = answers
            .map(a => ({
                sheet: a.sheet,
                printed: a.unnumbered ? null : Number.parseInt(a.value, 10),
            }))
            .filter(p => p.printed === null || Number.isFinite(p.printed));
        return numberingFromCalibrationPoints(points, state.data.lastSheet);
    }, [answers, state.data]);

    const patch = (next: Partial<Answer>) =>
        setAnswers(prev => prev.map((a, i) => (i === step ? { ...a, ...next } : a)));

    // Cambiar de hoja borra el número tecleado: pertenecía a la hoja anterior.
    const moveSheet = (delta: number) => {
        const sheet = Math.min(lastSheet, Math.max(1, (current?.sheet ?? 1) + delta));
        patch({ sheet, value: '', unnumbered: false });
    };

    // Qué pasos faltan, no sólo si falta alguno: un botón gris que no dice
    // cuál está incompleto deja al usuario mirando un contador que ya marca
    // «4 de 4» y creyendo que terminó.
    const pendingSteps = answers
        .map((a, i) => (!a.unnumbered && !a.value.trim() ? i : -1))
        .filter(i => i >= 0);
    const pending = pendingSteps.length > 0;

    const handleSave = async () => {
        if (!resourceId) return;
        if (!numbering) {
            // Antes era un `return` mudo. Un guardado que no guarda y no dice
            // nada es indistinguible de uno que funcionó.
            toast.error(t('numbering.nothingToSave'));
            return;
        }
        try {
            await save.mutateAsync({ resourceId, numbering });
            toast.success(t('numbering.saved'));
            navigate('/dashboard/library');
        } catch {
            toast.error(t('numbering.saveFailed'));
        }
    };

    if (state.isLoading) {
        return (
            <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('numbering.loading')}
            </div>
        );
    }
    if (state.isError || !state.data) {
        return <p className="py-24 text-center text-destructive">{t('numbering.loadFailed')}</p>;
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
            <div className="flex items-start gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('numbering.back')}
                    onClick={() => navigate('/dashboard/library')}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">{t('numbering.title')}</h1>
                    <p className="text-sm text-muted-foreground max-w-2xl">{t('numbering.pageIntro')}</p>
                    {state.data.storedOrigin === 'confirmed' && (
                        <p className="mt-1 text-sm text-muted-foreground">{t('numbering.alreadyConfirmed')}</p>
                    )}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline" size="icon"
                                aria-label={t('numbering.prevSheet')}
                                onClick={() => moveSheet(-1)}
                                disabled={(current?.sheet ?? 1) <= 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="px-2 text-sm tabular-nums text-muted-foreground">
                                {t('numbering.sheetLabel', { sheet: current?.sheet ?? 1 })}
                            </span>
                            <Button
                                variant="outline" size="icon"
                                aria-label={t('numbering.nextSheet')}
                                onClick={() => moveSheet(1)}
                                disabled={(current?.sheet ?? 1) >= lastSheet}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline" size="icon"
                                aria-label={t('numbering.zoomOut')}
                                onClick={() => setZoom(z => ZOOM_STEPS[Math.max(0, ZOOM_STEPS.indexOf(z as never) - 1)]!)}
                                disabled={zoom === ZOOM_STEPS[0]}
                            >
                                <ZoomOut className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline" size="icon"
                                aria-label={t('numbering.zoomIn')}
                                onClick={() => setZoom(z => ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, ZOOM_STEPS.indexOf(z as never) + 1)]!)}
                                disabled={zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                            >
                                <ZoomIn className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="h-[62vh] overflow-auto rounded border bg-muted">
                        <PdfPageViewer
                            url={pdf.data?.url ?? null}
                            sheet={current?.sheet ?? 1}
                            selected={false}
                            zoom={zoom === 1 ? 'fit' : zoom}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">{t('numbering.lookForFolio')}</p>
                </div>

                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="printed">{t('numbering.printedQuestion', { sheet: current?.sheet ?? 1 })}</Label>
                        <Input
                            id="printed"
                            inputMode="numeric"
                            autoFocus
                            className="text-lg tabular-nums"
                            value={current?.value ?? ''}
                            disabled={current?.unnumbered}
                            placeholder={t('numbering.printedPlaceholder')}
                            onChange={e => patch({ value: e.target.value.replace(/\D/g, '') })}
                        />
                        <div className="flex items-start gap-2">
                            <Checkbox
                                id="unnumbered"
                                checked={current?.unnumbered ?? false}
                                onCheckedChange={c => patch({ unnumbered: c === true })}
                            />
                            <Label htmlFor="unnumbered" className="text-sm font-normal leading-snug">
                                {t('numbering.unnumbered')}
                                <span className="block text-xs text-muted-foreground">{t('numbering.unnumberedHint')}</span>
                            </Label>
                        </div>
                    </div>

                    <div className="space-y-3 border-t pt-4">
                        <div className="flex items-center gap-2">
                            {answers.map((a, i) => {
                                const done = a.unnumbered || !!a.value.trim();
                                return (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => setStep(i)}
                                        aria-label={t('numbering.goToStep', { step: i + 1, sheet: a.sheet })}
                                        aria-current={i === step ? 'step' : undefined}
                                        className={[
                                            'flex h-8 w-8 items-center justify-center rounded-full border text-xs tabular-nums transition-colors',
                                            i === step ? 'ring-2 ring-ring ring-offset-1' : '',
                                            done ? 'border-primary bg-primary/10 text-foreground' : 'border-dashed text-muted-foreground',
                                        ].join(' ')}
                                    >
                                        {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                                    </button>
                                );
                            })}
                        </div>

                        {pending && (
                            <p className="text-sm text-muted-foreground">
                                {t('numbering.missingSteps', {
                                    count: pendingSteps.length,
                                    sheets: pendingSteps.map(i => answers[i]!.sheet).join(', '),
                                })}
                            </p>
                        )}

                        <div className="flex items-center justify-between gap-2">
                            <Button variant="ghost" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
                                {t('numbering.prevStep')}
                            </Button>
                            {step < answers.length - 1 && (
                                <Button variant="outline" onClick={() => setStep(s => s + 1)}>
                                    {t('numbering.nextStep')}
                                </Button>
                            )}
                            <Button onClick={handleSave} disabled={pending || save.isPending}>
                                {save.isPending
                                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    : <Check className="mr-2 h-4 w-4" />}
                                {t('numbering.confirm')}
                            </Button>
                        </div>
                    </div>

                    <NumberingSegmentsPreview numbering={numbering} />
                </div>
            </div>
        </div>
    );
}
