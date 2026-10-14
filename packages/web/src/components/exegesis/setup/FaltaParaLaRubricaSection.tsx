import type { ReactNode } from 'react';
import { ClipboardList } from 'lucide-react';
import type { LibraryResource } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import type { FaltaParaLaRubrica } from './faltaParaLaRubrica';

/**
 * En el diálogo de extracción, los libros que cubren un requisito de la
 * rúbrica sin cumplir, aunque no hablen del pasaje (TP #7: Robertson no salía
 * recomendado con la rúbrica pidiendo «Gramática ≥1»).
 */
export function FaltaParaLaRubricaSection({
    faltas,
    renderRow,
}: {
    faltas: ReadonlyArray<FaltaParaLaRubrica>;
    renderRow: (resource: LibraryResource) => ReactNode;
}) {
    const { t } = useTranslation('exegesis');
    if (faltas.length === 0) return null;
    return (
        <section
            aria-label={t('paperSetup.subSteps.corpus.extract.rubricGap.title')}
            className="rounded-lg border border-warning/30 bg-warning-subtle/15 px-2 py-2 space-y-2"
        >
            <h3 className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-warning-subtle-foreground uppercase tracking-wide">
                <ClipboardList className="h-3 w-3" />
                {t('paperSetup.subSteps.corpus.extract.rubricGap.title')}
            </h3>
            {faltas.map(f => (
                <div key={f.sourceType} className="space-y-1.5">
                    <p className="text-[11px] text-muted-foreground leading-snug">
                        <span className="font-medium text-foreground">
                            {t('paperSetup.subSteps.corpus.extract.rubricGap.requirement', {
                                type: t(`sourceTypes.${f.sourceType}.label`),
                                count: f.missing,
                            })}
                        </span>
                        {f.porPaginas && <> {t('paperSetup.subSteps.corpus.extract.rubricGap.porPaginas')}</>}
                    </p>
                    <ul className="space-y-1.5">
                        {f.resources.map(r => <li key={r.id}>{renderRow(r)}</li>)}
                    </ul>
                </div>
            ))}
        </section>
    );
}
