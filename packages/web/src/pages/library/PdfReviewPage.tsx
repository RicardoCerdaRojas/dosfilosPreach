import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { numberingFromCalibrationPoints, type PageNumbering } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { PdfPageViewer } from '@/components/exegesis/setup/page-picker/PdfPageViewer';
import { CopySection, EditionSection, IdentitySection, PaginationSection } from '@/components/library/review/ReviewSections';
import { citedEditionFor, usePdfReview } from '@/hooks/library/usePdfReview';
import { useSavePageNumbering } from '@/hooks/library/usePageNumbering';
import { useSaveBibliography } from '@/hooks/exegesis/usePaperBibliography';
import { rutaCalibracion } from '@/lib/rutaCalibracion';

/**
 * La bandeja de revisión de un libro recién subido (fase «Asistente del
 * corpus», A7): ¿es la obra que crees, de qué edición, cómo se citan sus
 * páginas, es una copia oficial? Lee solo muestras, en el navegador, y
 * muestra la línea que lo prueba. Lo que se guarda lo decide la persona.
 */
export function PdfReviewPage() {
    const { resourceId } = useParams<{ resourceId: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation('library');
    const { resource, review, ebook, read, pdfUrl, isLoading, error, notFound } = usePdfReview(resourceId ?? null);
    const guardarNumeracion = useSavePageNumbering();
    const guardarFicha = useSaveBibliography();
    const [hoja, setHoja] = useState<number | null>(null);
    const cited = useMemo(() => (resource ? citedEditionFor(resource) : null), [resource]);

    // La primera hoja con número impreso, para verlo junto al resultado.
    useEffect(() => {
        if (hoja === null && review?.pagination.points.length) {
            setHoja(review.pagination.points.find(p => p.folio)?.sheet ?? review.pagination.points[0]!.sheet);
        }
    }, [review, hoja]);

    if (notFound) return <p className="py-24 text-center text-muted-foreground">{t('review.notFound')}</p>;
    if (error) return <p className="py-24 text-center text-destructive">{t('review.loadFailed')}</p>;
    if (isLoading || !resource || !review) {
        return (
            <div role="status" className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t('review.reading')}
            </div>
        );
    }

    const ultimaHoja = read?.numPages ?? Math.max(1, resource.pageCount ?? 1);
    const guardar = async (numbering: PageNumbering | null) => {
        if (!numbering) return;
        try {
            await guardarNumeracion.mutateAsync({ resourceId: resource.id, numbering });
            toast.success(t('review.pagination.saved'));
        } catch (err) {
            console.error('[revision] no se pudo guardar la numeración', err);
            toast.error(t('review.saveFailed'));
        }
    };
    const propuesta = review.pagination.proposal;

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
            <div className="flex items-start gap-3">
                <Button variant="ghost" size="icon" aria-label={t('review.back')} onClick={() => navigate('/dashboard/library')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-tight">{t('review.title')}</h1>
                    <p className="font-serif text-base italic text-foreground">{resource.title}{resource.author ? ` · ${resource.author}` : ''}</p>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('review.intro')}</p>
                    <p role="status" className={review.needsAttention ? 'mt-2 text-sm font-medium text-warning-subtle-foreground' : 'mt-2 text-sm font-medium text-success'}>
                        {t(review.needsAttention ? 'review.attention' : 'review.allGood')}
                    </p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
                <div className="space-y-4">
                    <IdentitySection review={review} resource={resource} />
                    <EditionSection
                        review={review}
                        resource={resource}
                        cited={cited}
                        saving={guardarFicha.isPending}
                        onSave={async data => {
                            try {
                                await guardarFicha.mutateAsync({ resourceId: resource.id, data: { ...(resource.bibliography ?? {}), ...data } });
                                toast.success(t('review.edition.saved'));
                            } catch (err) {
                                console.error('[revision] no se pudo guardar la ficha', err);
                                toast.error(t('review.saveFailed'));
                            }
                        }}
                    />
                    <PaginationSection
                        review={review}
                        ebook={ebook}
                        storedConfirmed={resource.pageNumbering?.origin === 'confirmed'}
                        saving={guardarNumeracion.isPending}
                        canSave={!!propuesta}
                        onSave={() => void guardar(propuesta)}
                        onSaveNone={() => void guardar(numberingFromCalibrationPoints([{ sheet: 1, printed: null }], ultimaHoja))}
                        onCalibrate={() => navigate(rutaCalibracion(resource.id))}
                        onShowSheet={setHoja}
                    />
                    <CopySection review={review} />
                </div>
                {!ebook && hoja !== null && (
                    <aside className="space-y-2" aria-label={t('review.viewerTitle', { sheet: hoja })}>
                        <p className="text-sm font-medium text-foreground">{t('review.viewerTitle', { sheet: hoja })}</p>
                        <div className="h-[60vh] overflow-auto rounded border border-border bg-muted">
                            <PdfPageViewer url={pdfUrl} sheet={hoja} selected={false} zoom="fit" />
                        </div>
                        <p className="text-xs text-muted-foreground">{t('review.viewerHint')}</p>
                    </aside>
                )}
            </div>
        </div>
    );
}
