import { CheckCircle2, Circle, Tag } from 'lucide-react';
import type { BibliographyCoverage, SourceType } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

export type CoverageFilter = SourceType | 'unclassified' | null;

interface BibliographyCoverageTableProps {
    coverage: BibliographyCoverage;
    filter: CoverageFilter;
    onFilter: (filter: CoverageFilter) => void;
}

/**
 * La cobertura contra las rúbricas de los tipos de trabajo (prueba del
 * fundador en NT785): qué pide cada tipo de fuente, quién lo pide, cuántas
 * obras hay aprobadas y cuántas candidatas lo podrían cubrir. Pulsar una
 * fila muestra esas candidatas. Las obras sin clasificar tienen su fila:
 * no cuentan para ningún tipo hasta que se clasifiquen.
 */
export function BibliographyCoverageTable({ coverage, filter, onFilter }: BibliographyCoverageTableProps) {
    const { t } = useTranslation('projects');
    const { t: tx } = useTranslation('exegesis');
    const sinClasificar = coverage.unclassifiedApproved + coverage.unclassifiedCandidates;
    if (coverage.rows.length === 0 && sinClasificar === 0) return null;
    const fila = 'w-full text-left grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

    return (
        <section className="rounded-xl border border-border bg-card p-3 space-y-1" aria-labelledby="coverage-title">
            <div className="flex items-baseline justify-between gap-2 px-2">
                <h2 id="coverage-title" className="text-sm font-semibold text-foreground">{t('stateOfArt.coverage.title')}</h2>
                {filter && (
                    <button type="button" onClick={() => onFilter(null)} className="text-xs text-primary underline-offset-2 hover:underline">
                        {t('stateOfArt.coverage.clear')}
                    </button>
                )}
            </div>
            <p className="px-2 text-[11px] text-muted-foreground">{t('stateOfArt.coverage.hint')}</p>
            <ul>
                {coverage.rows.map(r => {
                    const cubierto = r.approved >= r.minimum;
                    const activo = filter === r.sourceType;
                    return (
                        <li key={r.sourceType}>
                            <button
                                type="button"
                                aria-pressed={activo}
                                onClick={() => onFilter(activo ? null : r.sourceType)}
                                className={`${fila} ${activo ? 'bg-accent' : 'hover:bg-accent/50'}`}
                            >
                                {cubierto
                                    ? <CheckCircle2 className="h-4 w-4 text-success" aria-label={t('stateOfArt.coverage.covered')} />
                                    : <Circle className="h-4 w-4 text-warning-subtle-foreground" aria-label={t('stateOfArt.coverage.missing')} />}
                                <span className="min-w-0">
                                    <span className="font-medium text-foreground">{tx(`sourceTypes.${r.sourceType}.label`)}</span>
                                    <span className="block truncate text-[11px] text-muted-foreground">
                                        {r.requiredBy.map(w => `${w.workType} ≥ ${w.minimum}`).join(' · ')}
                                    </span>
                                </span>
                                <span className="text-right text-xs tabular-nums text-foreground">
                                    {t('stateOfArt.coverage.approved', { approved: r.approved, minimum: r.minimum })}
                                    <span className="block text-[11px] text-muted-foreground">
                                        {t('stateOfArt.coverage.candidates', { count: r.candidates, inLibrary: r.candidatesInLibrary })}
                                    </span>
                                </span>
                            </button>
                        </li>
                    );
                })}
                {sinClasificar > 0 && (
                    <li>
                        <button
                            type="button"
                            aria-pressed={filter === 'unclassified'}
                            onClick={() => onFilter(filter === 'unclassified' ? null : 'unclassified')}
                            className={`${fila} ${filter === 'unclassified' ? 'bg-accent' : 'hover:bg-accent/50'}`}
                        >
                            <Tag className="h-4 w-4 text-warning-subtle-foreground" aria-hidden />
                            <span className="min-w-0">
                                <span className="font-medium text-foreground">{t('stateOfArt.coverage.unclassified')}</span>
                                <span className="block text-[11px] text-muted-foreground">{t('stateOfArt.coverage.unclassifiedHint')}</span>
                            </span>
                            <span className="text-right text-xs tabular-nums text-foreground">
                                {t('stateOfArt.coverage.unclassifiedCount', { approved: coverage.unclassifiedApproved, candidates: coverage.unclassifiedCandidates })}
                            </span>
                        </button>
                    </li>
                )}
            </ul>
        </section>
    );
}
