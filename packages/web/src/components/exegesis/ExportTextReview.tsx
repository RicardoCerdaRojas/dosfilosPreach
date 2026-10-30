import { AlertTriangle, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ExportFinding } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import type { ExportReview } from '@/hooks/exegesis/useExportReview';

/**
 * Los avisos del texto antes de exportar (etapa 2 de la fase «Lecciones del
 * TI #2»): cada uno con el tramo marcado y, si la corrección es mecánica,
 * «Aplicar», que corrige el ensamble en la app. Los que decide el
 * estudiante —una sigla de la nomenclatura, una forma de autor— proponen el
 * cambio y se aplican uno por uno.
 */
export function ExportTextReview({ review }: { review: ExportReview }) {
    const { t } = useTranslation('exegesis');
    if (review.findings.length === 0) return null;

    const aplicar = async (accion: () => Promise<void>) => {
        try {
            await accion();
        } catch (err) {
            console.error('[exegesis] export review apply failed:', err);
            toast.error(t('detail.exportReview.applyFailed'));
        }
    };

    return (
        <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-foreground">
                    {t('detail.exportReview.textHeading', { count: review.findings.length })}
                </h3>
                {review.mechanicalCount > 0 && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={review.isApplying}
                        onClick={() => void aplicar(review.applyMechanical)}
                    >
                        <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                        {t('detail.exportReview.applyMechanical', { count: review.mechanicalCount })}
                    </Button>
                )}
            </div>
            {review.blockedBy && (
                <p className="text-xs text-muted-foreground">
                    {t(review.blockedBy === 'difiere' ? 'detail.exportReview.blockedStale' : 'detail.exportReview.blockedNoAssembly')}
                </p>
            )}
            <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {review.findings.map(f => (
                    <li key={`${f.kind}-${f.offset}`} className="flex items-start gap-2 rounded-lg border border-border px-3 py-2">
                        <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                        <span className="flex-1 min-w-0 text-xs">
                            <span className="block font-medium text-foreground">{t(`detail.exportReview.kinds.${f.kind}`)}</span>
                            <span className="block text-muted-foreground break-words">
                                <Tramo finding={f} />
                            </span>
                            {f.replace !== null && (
                                <span className="block text-foreground">
                                    {t('detail.exportReview.proposal', { find: f.find, replace: f.replace })}
                                </span>
                            )}
                        </span>
                        {f.replace !== null && !review.blockedBy && (
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={review.isApplying}
                                onClick={() => void aplicar(() => review.apply(f))}
                            >
                                {t('detail.exportReview.apply')}
                            </Button>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
}

/** El contexto con el tramo marcado en negrita. */
function Tramo({ finding }: { finding: ExportFinding }) {
    const i = finding.context.indexOf(finding.find);
    if (i < 0) return <>{finding.context}</>;
    return (
        <>
            {finding.context.slice(0, i)}
            <strong className="font-semibold text-foreground">{finding.find}</strong>
            {finding.context.slice(i + finding.find.length)}
        </>
    );
}
