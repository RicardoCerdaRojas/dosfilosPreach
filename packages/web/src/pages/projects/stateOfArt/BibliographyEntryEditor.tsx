import {
    SOURCE_TYPE_CATALOG,
    type BibliographyApproach,
    type BibliographyEvaluation,
    type BibliographyLevel,
    type BibliographyTradition,
    type ProjectBibliographyEntry,
    type ProjectWorkType,
    type SourceType,
} from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

interface BibliographyEntryEditorProps {
    entry: ProjectBibliographyEntry;
    /** La evaluación con lo que la biblioteca ya sabe, para mostrar como propuesta. */
    suggested: BibliographyEvaluation;
    workTypes: ReadonlyArray<ProjectWorkType>;
    onChange: (patch: Partial<ProjectBibliographyEntry>) => void;
}

const NIVELES: BibliographyLevel[] = ['technical', 'semi-technical', 'expository', 'popular'];
const ENFOQUES: BibliographyApproach[] = ['historical-grammatical', 'historical-critical', 'socio-rhetorical', 'discourse-linguistic', 'literary-narrative', 'canonical-theological', 'other'];
const TRADICIONES: BibliographyTradition[] = ['evangelical', 'evangelical-critical', 'conservative-moderate', 'liberal-critical', 'catholic', 'jewish', 'other'];
const TIPOS = (Object.keys(SOURCE_TYPE_CATALOG) as SourceType[]).filter(t => t !== 'style-template-paper');

export const campo = 'w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';

/**
 * La ficha abierta: clasificación, peso, las preguntas de evaluación
 * (Vyhmeister, cap. 15, más cobertura y páginas impresas) y la anotación
 * (para qué sirve, qué páginas, qué posición). Lo que la biblioteca ya sabe
 * viene propuesto y se puede corregir.
 */
export function BibliographyEntryEditor({ entry, suggested, workTypes, onChange }: BibliographyEntryEditorProps) {
    const { t } = useTranslation('projects');
    const { t: tx } = useTranslation('exegesis');
    const ev = { ...suggested, ...(entry.evaluation ?? {}) };
    const an = entry.annotation ?? {};
    const evaluar = (patch: Partial<BibliographyEvaluation>) => onChange({ evaluation: { ...(entry.evaluation ?? {}), ...patch } });
    const anotar = (patch: Partial<NonNullable<ProjectBibliographyEntry['annotation']>>) => onChange({ annotation: { ...an, ...patch } });
    const siNo = (v: boolean | null | undefined) => (v === true ? 'yes' : v === false ? 'no' : '');
    const deSiNo = (v: string) => (v === 'yes' ? true : v === 'no' ? false : null);
    const pregunta = (clave: keyof BibliographyEvaluation, etiqueta: string) => (
        <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">{etiqueta}</span>
            <select className={campo} value={siNo(ev[clave] as boolean | null | undefined)} onChange={e => evaluar({ [clave]: deSiNo(e.target.value) })}>
                <option value="">{t('stateOfArt.unknown')}</option>
                <option value="yes">{t('stateOfArt.yes')}</option>
                <option value="no">{t('stateOfArt.no')}</option>
            </select>
        </label>
    );

    return (
        <div className="grid gap-3 border-t border-border px-3 py-3 sm:grid-cols-2 lg:grid-cols-3">
            {!entry.resourceId && (
                <>
                    <label className="block space-y-1 sm:col-span-2">
                        <span className="text-xs text-muted-foreground">{t('stateOfArt.field.title')}</span>
                        <input className={campo} value={entry.title} onChange={e => onChange({ title: e.target.value })} />
                    </label>
                    <label className="block space-y-1">
                        <span className="text-xs text-muted-foreground">{t('stateOfArt.field.author')}</span>
                        <input className={campo} value={entry.author ?? ''} onChange={e => onChange({ author: e.target.value })} />
                    </label>
                </>
            )}
            <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t('stateOfArt.field.sourceType')}</span>
                <select className={campo} value={entry.sourceType ?? ''} onChange={e => onChange({ sourceType: (e.target.value || null) as SourceType | null })}>
                    <option value="">{t('stateOfArt.unclassified')}</option>
                    {TIPOS.map(x => <option key={x} value={x}>{tx(`sourceTypes.${x}.label`)}</option>)}
                </select>
            </label>
            <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t('stateOfArt.field.weight')}</span>
                <select className={campo} value={entry.weight} onChange={e => onChange({ weight: e.target.value as ProjectBibliographyEntry['weight'] })}>
                    <option value="required">{t('stateOfArt.weight.required')}</option>
                    <option value="recommended">{t('stateOfArt.weight.recommended')}</option>
                    <option value="complementary">{t('stateOfArt.weight.complementary')}</option>
                </select>
            </label>
            <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t('stateOfArt.field.editionYear')}</span>
                <input
                    className={campo}
                    inputMode="numeric"
                    value={ev.editionYear ?? ''}
                    onChange={e => evaluar({ editionYear: /^\d{4}$/.test(e.target.value) ? Number(e.target.value) : null })}
                />
            </label>

            <p className="sm:col-span-2 lg:col-span-3 pt-1 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">{t('stateOfArt.evaluation')}</p>
            {pregunta('coversBook', t('stateOfArt.q.coversBook'))}
            {pregunta('printedPages', t('stateOfArt.q.printedPages'))}
            {pregunta('hasNotes', t('stateOfArt.q.hasNotes'))}
            {pregunta('primary', t('stateOfArt.q.primary'))}
            <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t('stateOfArt.q.level')}</span>
                <select className={campo} value={ev.level ?? ''} onChange={e => evaluar({ level: (e.target.value || null) as BibliographyLevel | null })}>
                    <option value="">{t('stateOfArt.unknown')}</option>
                    {NIVELES.map(x => <option key={x} value={x}>{t(`stateOfArt.level.${x}`)}</option>)}
                </select>
            </label>
            <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t('stateOfArt.q.approach')}</span>
                <select className={campo} value={ev.approach ?? ''} onChange={e => evaluar({ approach: (e.target.value || null) as BibliographyApproach | null })}>
                    <option value="">{t('stateOfArt.unknown')}</option>
                    {ENFOQUES.map(x => <option key={x} value={x}>{t(`stateOfArt.approach.${x}`)}</option>)}
                </select>
            </label>
            <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t('stateOfArt.q.tradition')}</span>
                <select className={campo} value={ev.tradition ?? ''} onChange={e => evaluar({ tradition: (e.target.value || null) as BibliographyTradition | null })}>
                    <option value="">{t('stateOfArt.unknown')}</option>
                    {TRADICIONES.map(x => <option key={x} value={x}>{t(`stateOfArt.tradition.${x}`)}</option>)}
                </select>
            </label>
            <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t('stateOfArt.q.language')}</span>
                <input className={campo} value={ev.language ?? ''} onChange={e => evaluar({ language: e.target.value })} />
            </label>

            <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t('stateOfArt.field.pageCount')}</span>
                <input className={campo} inputMode="numeric" value={entry.pageCount ?? ''} onChange={e => onChange({ pageCount: /^\d+$/.test(e.target.value) ? Number(e.target.value) : null })} />
            </label>
            <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">DOI</span>
                <input className={campo} value={entry.identifiers?.doi ?? ''} onChange={e => onChange({ identifiers: { ...(entry.identifiers ?? {}), doi: e.target.value || null } })} />
            </label>
            <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">ISBN</span>
                <input className={campo} value={entry.identifiers?.isbn ?? ''} onChange={e => onChange({ identifiers: { ...(entry.identifiers ?? {}), isbn: e.target.value || null } })} />
            </label>

            <p className="sm:col-span-2 lg:col-span-3 pt-1 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">{t('stateOfArt.annotation')}</p>
            <label className="block space-y-1 sm:col-span-2 lg:col-span-3">
                <span className="text-xs text-muted-foreground">{t('stateOfArt.field.serves')}</span>
                <textarea className={campo} rows={2} value={an.serves ?? ''} onChange={e => anotar({ serves: e.target.value })} />
            </label>
            <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t('stateOfArt.field.pages')}</span>
                <input className={campo} value={an.pages ?? ''} onChange={e => anotar({ pages: e.target.value })} />
            </label>
            <label className="block space-y-1 sm:col-span-1 lg:col-span-2">
                <span className="text-xs text-muted-foreground">{t('stateOfArt.field.position')}</span>
                <input className={campo} value={an.position ?? ''} onChange={e => anotar({ position: e.target.value })} />
            </label>
            {workTypes.length > 0 && (
                <fieldset className="sm:col-span-2 lg:col-span-3 space-y-1">
                    <legend className="text-xs text-muted-foreground">{t('stateOfArt.field.workTypes')}</legend>
                    <div className="flex flex-wrap gap-3">
                        {workTypes.map(w => {
                            const marcado = (an.workTypeIds ?? []).includes(w.id);
                            return (
                                <label key={w.id} className="inline-flex items-center gap-1.5 text-sm text-foreground">
                                    <input
                                        type="checkbox"
                                        checked={marcado}
                                        onChange={() => anotar({ workTypeIds: marcado ? (an.workTypeIds ?? []).filter(x => x !== w.id) : [...(an.workTypeIds ?? []), w.id] })}
                                    />
                                    {w.label}
                                </label>
                            );
                        })}
                    </div>
                </fieldset>
            )}
            {/* La reseña: la ficha de lectura (Eco IV.2.3), con la forma que pide
                el curso. Las páginas de la obra cuentan cuando está leída y reseñada. */}
            <p className="sm:col-span-2 lg:col-span-3 pt-1 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">{t('stateOfArt.review.reading')}</p>
            <label className="block space-y-1 sm:col-span-2 lg:col-span-3">
                <span className="text-xs text-muted-foreground">{t('stateOfArt.field.mainIdea')}</span>
                <textarea className={campo} rows={2} value={an.review?.mainIdea ?? ''} onChange={e => anotar({ review: { ...(an.review ?? {}), mainIdea: e.target.value } })} />
            </label>
            <label className="block space-y-1 sm:col-span-2">
                <span className="text-xs text-muted-foreground">{t('stateOfArt.field.contribution')}</span>
                <textarea className={campo} rows={2} value={an.review?.contribution ?? ''} onChange={e => anotar({ review: { ...(an.review ?? {}), contribution: e.target.value } })} />
            </label>
            <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t('stateOfArt.field.rating')}</span>
                <input
                    className={campo}
                    inputMode="numeric"
                    value={an.review?.rating ?? ''}
                    onChange={e => { const n = Number(e.target.value); anotar({ review: { ...(an.review ?? {}), rating: Number.isInteger(n) && n >= 1 && n <= 10 ? n : null } }); }}
                />
            </label>
            <label className="block space-y-1 sm:col-span-2 lg:col-span-3">
                <span className="text-xs text-muted-foreground">{t('stateOfArt.field.reason')}</span>
                <textarea className={campo} rows={2} value={entry.reason ?? ''} onChange={e => onChange({ reason: e.target.value })} />
            </label>
        </div>
    );
}
