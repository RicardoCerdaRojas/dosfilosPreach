import { AlertTriangle, Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ExportFinding } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import type { ExportReview } from '@/hooks/exegesis/useExportReview';

/**
 * Los avisos del texto antes de exportar (etapa 2 de la fase «Lecciones del
 * TI #2»), leídos como una prueba de imprenta: cada uno es la frase misma,
 * con lo que sale tachado y lo que entra resaltado en su lugar. «Aplicar»
 * corrige el ensamble en la app. Los que decide el estudiante —una sigla de
 * la nomenclatura, una forma de autor— proponen el cambio y se aplican uno
 * por uno; los que no tienen reemplazo (un paréntesis sin cerrar) marcan el
 * tramo.
 *
 * Era una lista de texto chico en un diálogo angosto, con el cambio en una
 * línea aparte y el markdown a la vista («--- ## Salmos 23:4»): el fundador
 * no alcanzaba a ver qué cambiaba (2026-10-30).
 */
export function ExportTextReview({ review }: { review: ExportReview }) {
    const { t } = useTranslation('exegesis');
    if (review.findings.length === 0) {
        // Con todo aplicado, se dice que quedó listo (y si aún se guarda).
        return review.isSaving ? (
            <p role="status" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t('detail.exportReview.saving')}
            </p>
        ) : null;
    }

    const aplicar = async (accion: () => Promise<void>) => {
        try {
            await accion();
        } catch (err) {
            console.error('[exegesis] export review apply failed:', err);
            toast.error(t('detail.exportReview.applyFailed'));
        }
    };

    return (
        <section className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                <h3 className="text-sm font-semibold text-foreground">
                    {t('detail.exportReview.textHeading', { count: review.findings.length })}
                </h3>
                {/* Cada corrección se ve al instante y se guarda por detrás: aquí se dice que se está guardando. */}
                <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    {review.isSaving && <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />{t('detail.exportReview.saving')}</>}
                </span>
                {review.mechanicalCount > 0 && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void aplicar(review.applyMechanical)}
                    >
                        <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                        {t('detail.exportReview.applyMechanical', { count: review.mechanicalCount })}
                    </Button>
                )}
            </div>
            {review.blockedBy && (
                <p className="rounded-md bg-warning-subtle px-3 py-2 text-sm text-warning-subtle-foreground">
                    {t(review.blockedBy === 'difiere' ? 'detail.exportReview.blockedStale' : 'detail.exportReview.blockedNoAssembly')}
                </p>
            )}
            <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {review.findings.map((f, i) => (
                    <li
                        key={`${f.kind}-${f.offset}`}
                        className="grid grid-cols-[auto_1fr_auto] items-start gap-x-3 gap-y-1.5 rounded-lg border border-border bg-card px-3 py-3"
                    >
                        <span className="mt-0.5 text-xs font-medium tabular-nums text-muted-foreground">{i + 1}</span>
                        <div className="min-w-0 space-y-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning-subtle-foreground">
                                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                                {t(`detail.exportReview.kinds.${f.kind}`)}
                            </span>
                            <p className="text-sm leading-relaxed text-foreground break-words">
                                <Frase finding={f} labelRemoved={t('detail.exportReview.removed')} labelAdded={t('detail.exportReview.added')} />
                            </p>
                        </div>
                        {f.replace !== null && !review.blockedBy ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void aplicar(() => review.apply(f))}
                            >
                                {t('detail.exportReview.apply')}
                            </Button>
                        ) : <span />}
                    </li>
                ))}
            </ol>
        </section>
    );
}

/** El contexto sin las marcas del markdown que no se imprimen. */
function sinMarkdown(texto: string): string {
    return texto
        .replace(/(^|\s)-{3,}(?=\s|$)/g, '$1')
        .replace(/(^|\s)#{1,6}\s+/g, '$1')
        .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
        .replace(/\s+/g, ' ');
}

/**
 * La frase con el cambio en su lugar: lo que sale tachado, lo que entra
 * resaltado. Sin reemplazo, el tramo subrayado. El cambio no se dice solo con
 * color: el tachado y las etiquetas para lectores de pantalla lo dicen.
 */
function Frase({ finding, labelRemoved, labelAdded }: { finding: ExportFinding; labelRemoved: string; labelAdded: string }) {
    const i = finding.context.indexOf(finding.find);
    if (i < 0) return <>{sinMarkdown(finding.context)}</>;
    const antes = sinMarkdown(finding.context.slice(0, i));
    const despues = sinMarkdown(finding.context.slice(i + finding.find.length));
    return (
        <>
            {antes}
            {finding.replace === null ? (
                <mark className="rounded-sm bg-warning-subtle px-0.5 text-warning-subtle-foreground underline decoration-wavy underline-offset-2">
                    {finding.find}
                </mark>
            ) : (
                <>
                    <del aria-label={labelRemoved} className="rounded-sm bg-destructive/10 px-0.5 text-destructive decoration-2">
                        {finding.find}
                    </del>
                    {' '}
                    <ins aria-label={labelAdded} className="rounded-sm bg-success-subtle px-0.5 font-semibold text-success-subtle-foreground no-underline">
                        {finding.replace}
                    </ins>
                </>
            )}
            {despues}
        </>
    );
}
