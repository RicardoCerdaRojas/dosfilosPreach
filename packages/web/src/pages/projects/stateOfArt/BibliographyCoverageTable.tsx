import { AlertCircle, CheckCircle2, Circle, Tag } from 'lucide-react';
import type { BibliographyCoverage, ProjectRequirement, RequirementMeasure, SourceType } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

/** Qué fichas mostrar: un tipo, las sin clasificar, o unas fichas sueltas (lo recién importado, lo que no se pudo medir). */
export type CoverageFilter =
    | { kind: 'type'; type: SourceType }
    | { kind: 'unclassified' }
    | { kind: 'ids'; ids: string[]; label: string }
    | null;

interface BibliographyCoverageTableProps {
    coverage: BibliographyCoverage;
    /** Los requisitos medibles, con su medida (etapa 2b). */
    requirements?: ReadonlyArray<{ requirement: ProjectRequirement; measure: RequirementMeasure }>;
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
export function BibliographyCoverageTable({ coverage, requirements = [], filter, onFilter }: BibliographyCoverageTableProps) {
    const { t } = useTranslation('projects');
    const { t: tx } = useTranslation('exegesis');
    const sinClasificar = coverage.unclassifiedApproved + coverage.unclassifiedCandidates;
    if (coverage.rows.length === 0 && sinClasificar === 0 && requirements.length === 0) return null;
    const fila = 'w-full text-left grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

    return (
        <section className="rounded-xl border border-border bg-card p-3 space-y-1" aria-labelledby="coverage-title">
            <div className="flex items-baseline justify-between gap-2 px-2">
                <h2 id="coverage-title" className="text-sm font-semibold text-foreground">{t('stateOfArt.coverage.title')}</h2>
                {filter?.kind === 'ids' && (
                    <span className="text-xs text-foreground">{t('stateOfArt.coverage.showing', { label: filter.label })}</span>
                )}
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
                    const activo = filter?.kind === 'type' && filter.type === r.sourceType;
                    return (
                        <li key={r.sourceType}>
                            <button
                                type="button"
                                aria-pressed={activo}
                                onClick={() => onFilter(activo ? null : { kind: 'type', type: r.sourceType })}
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
                            aria-pressed={filter?.kind === 'unclassified'}
                            onClick={() => onFilter(filter?.kind === 'unclassified' ? null : { kind: 'unclassified' })}
                            className={`${fila} ${filter?.kind === 'unclassified' ? 'bg-accent' : 'hover:bg-accent/50'}`}
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
                {/* Los requisitos medibles que no son un mínimo por tipo: épocas,
                    perspectivas, cantidades, variedad, reglas. */}
                {requirements.filter(x => x.requirement.kind !== 'minimum-type').map(({ requirement: r, measure: m }) => {
                    // Pulsar lleva a sus fichas: las de su tipo, o las que no se pudieron medir.
                    const ir: CoverageFilter = r.sourceType ? { kind: 'type', type: r.sourceType } : m.unmeasurable.length ? { kind: 'ids', ids: m.unmeasurable, label: r.text } : null;
                    const contenido = (
                        <>
                            {m.status === 'met'
                                ? <CheckCircle2 className="h-4 w-4 text-success" aria-label={t('stateOfArt.coverage.covered')} />
                                : m.status === 'incomplete'
                                    ? <AlertCircle className="h-4 w-4 text-warning-subtle-foreground" aria-label={t('stateOfArt.requirement.incomplete')} />
                                    : <Circle className="h-4 w-4 text-warning-subtle-foreground" aria-label={t('stateOfArt.coverage.missing')} />}
                            <span className="min-w-0">
                                <span className="font-medium text-foreground">{r.text}</span>
                                <span className="block truncate text-[11px] text-muted-foreground">{t(`stateOfArt.requirement.kind.${r.kind}`)}</span>
                            </span>
                            <span className="text-right text-xs tabular-nums text-foreground">
                                {m.status === 'manual' ? t('stateOfArt.requirement.manual') : m.status === 'incomplete' ? t('stateOfArt.requirement.incomplete') : t('stateOfArt.requirement.measure', { value: m.value, target: m.target })}
                                {m.unmeasurable.length > 0 && <span className="block text-[11px] text-muted-foreground">{t(`stateOfArt.requirement.unmeasurable.${r.kind}`, { count: m.unmeasurable.length })}</span>}
                            </span>
                        </>
                    );
                    return (
                        <li key={r.id}>
                            {ir
                                ? <button type="button" onClick={() => onFilter(ir)} className={`${fila} hover:bg-accent/50`}>{contenido}</button>
                                : <div className={fila.replace('w-full text-left ', 'w-full ')}>{contenido}</div>}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
