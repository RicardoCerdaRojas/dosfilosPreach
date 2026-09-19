import { AlertTriangle, BookMarked, CheckCircle2, CircleDashed, Plus } from 'lucide-react';
import {
    courseBibliographyCoverage,
    matchCourseBibliography,
    type CourseBibliographyMatch,
    type ExegeticalPaper,
} from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { useLibrary } from '@/hooks/library';
import { cn } from '@/lib/utils';

interface Props {
    paper: ExegeticalPaper;
    /** Abre el diálogo de agregar fuente, ya apuntado a un recurso. */
    onAddResource: (resourceId: string) => void;
}

/**
 * Las obras que el curso manda leer, y cuáles ya están en el trabajo.
 *
 * Responde el primero de los tres huecos que el fundador nombró: «no
 * saber qué fuentes usar». La rúbrica ya decía CUÁNTAS fuentes de cada
 * tipo hacen falta; esto dice CUÁLES, que es lo que el profesor busca en
 * las notas al pie.
 *
 * El emparejado con la biblioteca es conservador: prefiere decir «no la
 * encuentro» antes que afirmar que tienes un libro que no tienes. Por eso
 * lo que no aparece se muestra como pendiente y no como error.
 */
export function CourseBibliographyCard({ paper, onAddResource }: Props) {
    const { t } = useTranslation('exegesis');
    const { resources } = useLibrary();

    const entries = paper.rubric?.courseBibliography ?? [];
    if (entries.length === 0) return null;

    const corpusIds = new Set(
        paper.sources.map(s => s.sourceLibraryResourceId ?? s.corpusId).filter(Boolean) as string[],
    );
    const matches = matchCourseBibliography(entries, resources, corpusIds);
    const coverage = courseBibliographyCoverage(matches);
    const completo = coverage.requiredInCorpus === coverage.required;

    return (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <header className="flex items-start gap-2">
                <BookMarked className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{t('paperSetup.subSteps.corpus.courseBib.title')}</h3>
                    <p className={cn('text-xs mt-0.5', completo ? 'text-success' : 'text-muted-foreground')}>
                        {t('paperSetup.subSteps.corpus.courseBib.coverage', {
                            inCorpus: coverage.requiredInCorpus,
                            required: coverage.required,
                        })}
                        {coverage.missing > 0 && ` · ${t('paperSetup.subSteps.corpus.courseBib.missingFromLibrary', { count: coverage.missing })}`}
                    </p>
                </div>
            </header>

            <ul className="space-y-1.5">
                {matches.map((m, i) => (
                    <BibliographyRow key={`${m.entry.title}-${i}`} match={m} onAddResource={onAddResource} />
                ))}
            </ul>
        </section>
    );
}

function BibliographyRow({ match, onAddResource }: {
    match: CourseBibliographyMatch<{ id: string; title: string; author?: string | null }>;
    onAddResource: (resourceId: string) => void;
}) {
    const { t } = useTranslation('exegesis');
    const { entry, resource, inCorpus } = match;

    const icon = inCorpus
        ? <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
        : resource
            ? <CircleDashed className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            : <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />;

    return (
        <li className="flex items-start gap-2">
            {icon}
            <span className="flex-1 min-w-0">
                <span className="block text-xs text-foreground">
                    {entry.author ? `${entry.author}, ` : ''}{entry.title}
                    {entry.series && <span className="text-muted-foreground"> · {entry.series}</span>}
                    {entry.requirement === 'recommended' && (
                        <span className="text-muted-foreground"> · {t('paperSetup.subSteps.corpus.courseBib.recommended')}</span>
                    )}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                    {inCorpus
                        ? t('paperSetup.subSteps.corpus.courseBib.inCorpus')
                        : resource
                            ? t('paperSetup.subSteps.corpus.courseBib.inLibrary')
                            : t('paperSetup.subSteps.corpus.courseBib.notFound')}
                </span>
            </span>
            {resource && !inCorpus && (
                <button
                    type="button"
                    onClick={() => onAddResource(resource.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-foreground hover:bg-accent shrink-0"
                >
                    <Plus className="h-3 w-3" />
                    {t('paperSetup.subSteps.corpus.courseBib.add')}
                </button>
            )}
        </li>
    );
}
