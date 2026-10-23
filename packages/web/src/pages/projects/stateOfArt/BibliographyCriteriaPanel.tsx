import type { BibliographyWarning, ProjectBibliographyCriteria, ProjectBibliographyEntry, SourceType } from '@dosfilos/domain';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { campo } from './BibliographyEntryEditor';

interface BibliographyCriteriaPanelProps {
    isCourse: boolean;
    criteria: ProjectBibliographyCriteria;
    onChange: (patch: Partial<ProjectBibliographyCriteria>) => void;
    /** Los mínimos por tipo que piden las rúbricas de los tipos de trabajo. */
    requirements: ReadonlyArray<{ sourceType: SourceType; minimum: number; workType?: string }>;
    bibleBooks: ReadonlyArray<string>;
}

/**
 * Paso 1, requisitos. En un curso salen del sílabo y del profesor; en una
 * investigación son la pregunta y el alcance (Turabian, cap. 2; Kibbe,
 * cap. 1). Los criterios de inclusión y exclusión son los que Vyhmeister
 * (cap. 7) pide explicar en una bibliografía selectiva.
 */
export function BibliographyCriteriaPanel({ isCourse, criteria, onChange, requirements, bibleBooks }: BibliographyCriteriaPanelProps) {
    const { t } = useTranslation('projects');
    const { t: tx } = useTranslation('exegesis');
    const texto = (clave: 'requirements' | 'prohibitions' | 'inclusion' | 'exclusion', etiqueta: string, ayuda: string) => (
        <label className="block space-y-1">
            <span className="text-sm font-medium text-foreground">{etiqueta}</span>
            <span className="block text-xs text-muted-foreground">{ayuda}</span>
            <textarea className={campo} rows={3} value={criteria[clave] ?? ''} onChange={e => onChange({ [clave]: e.target.value })} />
        </label>
    );
    // Por tipo de trabajo: lo que pide el TP no es lo que pide la investigación.
    const porTipoDeTrabajo = new Map<string, Array<{ sourceType: SourceType; minimum: number }>>();
    for (const r of requirements) {
        if (r.minimum <= 0) continue;
        const clave = r.workType ?? '';
        porTipoDeTrabajo.set(clave, [...(porTipoDeTrabajo.get(clave) ?? []), r]);
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
                {texto('requirements', t(isCourse ? 'stateOfArt.criteria.requirementsCourse' : 'stateOfArt.criteria.requirementsResearch'), t(isCourse ? 'stateOfArt.criteria.requirementsCourseHint' : 'stateOfArt.criteria.requirementsResearchHint'))}
                {texto('prohibitions', t('stateOfArt.criteria.prohibitions'), t('stateOfArt.criteria.prohibitionsHint'))}
                {texto('inclusion', t('stateOfArt.criteria.inclusion'), t('stateOfArt.criteria.inclusionHint'))}
                {texto('exclusion', t('stateOfArt.criteria.exclusion'), t('stateOfArt.criteria.exclusionHint'))}
            </div>
            <label className="flex items-start gap-2 text-sm text-foreground">
                <input type="checkbox" className="mt-1" checked={criteria.noRepeatSources ?? isCourse} onChange={e => onChange({ noRepeatSources: e.target.checked })} />
                <span>
                    {t('stateOfArt.criteria.noRepeat')}
                    <span className="block text-xs text-muted-foreground">{t('stateOfArt.criteria.noRepeatHint')}</span>
                </span>
            </label>
            <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border p-3 space-y-1">
                    <p className="text-sm font-medium text-foreground">{t('stateOfArt.criteria.minimums')}</p>
                    {porTipoDeTrabajo.size === 0
                        ? <p className="text-xs text-muted-foreground">{t('stateOfArt.criteria.noMinimums')}</p>
                        : [...porTipoDeTrabajo].map(([trabajo, mins]) => (
                            <div key={trabajo} className="space-y-0.5">
                                {trabajo && <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">{trabajo}</p>}
                                <ul className="text-xs text-foreground space-y-0.5">{mins.map(m => <li key={m.sourceType}>{tx(`sourceTypes.${m.sourceType}.label`)} · ≥ {m.minimum}</li>)}</ul>
                            </div>
                        ))}
                    <p className="text-[11px] text-muted-foreground">{t('stateOfArt.criteria.minimumsHint')}</p>
                </div>
                <div className="rounded-lg border border-border p-3 space-y-1">
                    <p className="text-sm font-medium text-foreground">{t('stateOfArt.criteria.books')}</p>
                    <p className="text-xs text-foreground">{bibleBooks.length > 0 ? bibleBooks.join(', ') : t('stateOfArt.criteria.noBooks')}</p>
                    <p className="text-[11px] text-muted-foreground">{t('stateOfArt.criteria.booksHint')}</p>
                </div>
            </div>
        </div>
    );
}

/** Los avisos de la bibliografía aprobada. Informan; no bloquean. */
export function BibliographyWarningsList({ warnings, entries }: { warnings: ReadonlyArray<BibliographyWarning>; entries: ReadonlyArray<ProjectBibliographyEntry> }) {
    const { t } = useTranslation('projects');
    const { t: tx } = useTranslation('exegesis');
    if (warnings.length === 0) return null;
    const titulo = (id: string) => entries.find(e => e.id === id)?.title || t('stateOfArt.untitled');
    const texto = (w: BibliographyWarning) => {
        switch (w.kind) {
            case 'missing-type': return t('stateOfArt.warning.missingType', { type: tx(`sourceTypes.${w.sourceType}.label`), minimum: w.minimum });
            case 'single-tradition': return t('stateOfArt.warning.singleTradition', { tradition: t(`stateOfArt.tradition.${w.tradition}`) });
            case 'required-to-acquire': return t('stateOfArt.warning.requiredToAcquire', { title: titulo(w.entryId) });
            case 'commentary-other-book': return t('stateOfArt.warning.commentaryOtherBook', { title: titulo(w.entryId) });
        }
    };
    return (
        <div className="rounded-lg border border-warning/40 bg-warning-subtle px-3 py-2" role="status">
            <ul className="space-y-1">
                {warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-warning-subtle-foreground">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{texto(w)}
                    </li>
                ))}
            </ul>
        </div>
    );
}
