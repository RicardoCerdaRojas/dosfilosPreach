import { bibliographyEntryType, evaluationFromLibrary, type BibleBookId, type ProjectBibliographyEntry, type ProjectWorkType, type SourceType } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { BibliographyEntryCard } from './BibliographyEntryCard';
import type { CoverageFilter } from './BibliographyCoverageTable';
import type { useProjectBibliography } from './useProjectBibliography';

interface BibliographyEntryListProps {
    entries: ReadonlyArray<ProjectBibliographyEntry>;
    filter: CoverageFilter;
    /** Agrupar por clasificación: en la lista larga de candidatas, para ver qué cubre qué. */
    grouped: boolean;
    emptyText: string;
    bib: Pick<ReturnType<typeof useProjectBibliography>, 'resourceOf' | 'bibleBooks' | 'workTypes' | 'library' | 'update' | 'remove' | 'errors' | 'historyOf'>;
}

/**
 * Las fichas de un paso, filtradas por el tipo elegido en la cobertura y,
 * sin filtro, agrupadas por clasificación. Las sin clasificar van al final
 * con la clasificación que se les dio en trabajos anteriores, si la hay.
 */
export function BibliographyEntryList({ entries, filter, grouped, emptyText, bib }: BibliographyEntryListProps) {
    const { t } = useTranslation('projects');
    const { t: tx } = useTranslation('exegesis');
    const tipo = (e: ProjectBibliographyEntry) => bibliographyEntryType(e, bib.resourceOf);
    const visibles = !filter ? entries : entries.filter(e => {
        switch (filter.kind) {
            case 'type': return tipo(e) === filter.type;
            case 'unclassified': return !tipo(e);
            case 'ids': return filter.ids.includes(e.id);
        }
    });
    if (visibles.length === 0) {
        return <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{filter ? t(filter.kind === 'ids' ? 'stateOfArt.coverage.emptyFilteredIds' : 'stateOfArt.coverage.emptyFiltered') : emptyText}</p>;
    }
    const grupos = new Map<SourceType | 'unclassified', ProjectBibliographyEntry[]>();
    for (const e of visibles) {
        const clave = grouped ? tipo(e) ?? 'unclassified' : 'unclassified';
        grupos.set(clave, [...(grupos.get(clave) ?? []), e]);
    }
    // Sin clasificar, al final.
    const orden = [...grupos.keys()].sort((a, b) => Number(a === 'unclassified') - Number(b === 'unclassified'));
    const tarjeta = (e: ProjectBibliographyEntry) => (
        <BibliographyEntryCard
            key={e.id}
            entry={e}
            suggested={evaluationFromLibrary({ ...e, sourceType: tipo(e) }, e.resourceId ? bib.resourceOf(e.resourceId) as never : null, bib.bibleBooks as BibleBookId[])}
            effectiveType={tipo(e)}
            history={!tipo(e) && e.resourceId ? bib.historyOf(e.resourceId) : []}
            workTypes={bib.workTypes as ProjectWorkType[]}
            library={bib.library}
            onChange={patch => bib.update(e.id, patch)}
            onRemove={() => bib.remove(e.id)}
            error={bib.errors.get(e.id) ?? null}
        />
    );
    if (!grouped) return <ul className="space-y-2">{visibles.map(tarjeta)}</ul>;
    return (
        <div className="space-y-4">
            {orden.map(clave => (
                <section key={clave} aria-label={clave === 'unclassified' ? t('stateOfArt.coverage.unclassified') : tx(`sourceTypes.${clave}.label`)}>
                    <h3 className="mb-1.5 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                        {clave === 'unclassified' ? t('stateOfArt.coverage.unclassified') : tx(`sourceTypes.${clave}.label`)} · {grupos.get(clave)!.length}
                    </h3>
                    <ul className="space-y-2">{grupos.get(clave)!.map(tarjeta)}</ul>
                </section>
            ))}
        </div>
    );
}
