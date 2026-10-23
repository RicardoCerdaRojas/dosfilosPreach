import { useMemo } from 'react';
import { History } from 'lucide-react';
import type { AIProject, SourceType } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { BibliographyCriteriaPanel } from './BibliographyCriteriaPanel';
import { BibliographyImportPanel } from './BibliographyImportPanel';
import { RequirementsEditor } from './RequirementsEditor';
import type { CoverageFilter } from './BibliographyCoverageTable';
import type { useProjectBibliography } from './useProjectBibliography';

interface RequirementsTabProps {
    project: AIProject;
    bib: ReturnType<typeof useProjectBibliography>;
    bibleBookNames: string[];
    library: ReadonlyArray<{ id: string; title: string; author?: string | null; exegeticalType?: SourceType | null }>;
    /** Muestra fichas en su paso: lo recién importado, o lo que no se pudo medir. */
    onShow: (filter: CoverageFilter, step: 'candidates' | 'approved' | 'discarded') => void;
}

/**
 * Paso 1 del estado del arte: los requisitos (etapa 2b). Se importan de un
 * sílabo o cualquier bibliografía, se proponen por nivel cuando no hay
 * sílabo, se miden, y cada búsqueda queda en el registro.
 */
export function RequirementsTab({ project, bib, bibleBookNames, library, onShow }: RequirementsTabProps) {
    const { t, i18n } = useTranslation('projects');
    // Lo que algún requisito pide y todavía no se cumple: orienta qué conseguir primero.
    const unmetTypes = useMemo(() => {
        const s = new Set<SourceType>();
        for (const r of bib.coverage.rows) if (r.approved < r.minimum) s.add(r.sourceType);
        for (const { requirement: r, measure: m } of bib.requirementMeasures) {
            if (m.status !== 'unmet' && m.status !== 'incomplete') continue;
            if (r.sourceType) s.add(r.sourceType);
            for (const x of r.types ?? []) s.add(x);
        }
        return s;
    }, [bib.coverage.rows, bib.requirementMeasures]);

    return (
        <div className="space-y-5">
            <BibliographyImportPanel
                context={{ library, existing: bib.entries, mentions: bib.mentions, unmetTypes }}
                pending={bib.pendingImport}
                onPending={bib.setPendingImport}
                onConfirm={bib.applyImport}
                onDone={o => onShow(o.ids.length ? { kind: 'ids', ids: o.ids, label: t('stateOfArt.import.justImported') } : null, o.step)}
            />
            <RequirementsEditor
                measures={bib.requirementMeasures}
                onChange={bib.setRequirementItems}
                onShowUnmeasurable={(ids, label) => onShow({ kind: 'ids', ids, label }, 'approved')}
            />
            <BibliographyCriteriaPanel
                isCourse={project.type === 'course'}
                criteria={bib.criteria}
                onChange={patch => bib.setCriteria(c => ({ ...c, ...patch }))}
                requirements={bib.requirements}
                bibleBooks={bibleBookNames}
            />
            {bib.searchLog.length > 0 && (
                <section className="space-y-1" aria-labelledby="search-log-title">
                    <h3 id="search-log-title" className="text-sm font-medium text-foreground inline-flex items-center gap-1.5">
                        <History className="h-4 w-4 text-muted-foreground" />{t('stateOfArt.log.title')}
                    </h3>
                    <p className="text-xs text-muted-foreground">{t('stateOfArt.log.hint')}</p>
                    <ul className="divide-y divide-border rounded-lg border border-border">
                        {[...bib.searchLog].reverse().map(l => (
                            <li key={l.id} className="flex flex-wrap items-baseline gap-x-3 px-3 py-1.5 text-xs">
                                <span className="tabular-nums text-muted-foreground">{new Date(l.at).toLocaleDateString(i18n.language)}</span>
                                <span className="text-foreground">{t(`stateOfArt.log.kind.${l.kind}`)}: {l.label}</span>
                                <span className="text-muted-foreground">{t('stateOfArt.log.result', { found: l.found, added: l.added })}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
