import { useState } from 'react';
import { AlertCircle, CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import {
    newBibliographyEntryId,
    requirementTemplate,
    SOURCE_TYPE_CATALOG,
    type ProjectRequirement,
    type RequirementAssumption,
    type RequirementKind,
    type RequirementLevel,
    type RequirementMeasure,
    type SourceType,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { campo } from './BibliographyEntryEditor';

interface RequirementsEditorProps {
    measures: ReadonlyArray<{ requirement: ProjectRequirement; measure: RequirementMeasure }>;
    onChange: (items: ProjectRequirement[]) => void;
    /** Muestra las fichas que no se pudieron medir (sin año, sin páginas…). */
    onShowUnmeasurable: (ids: string[], label: string) => void;
}

const KINDS: RequirementKind[] = ['minimum-type', 'quantity', 'date-range', 'perspectives', 'variety', 'rule', 'other'];
const TIPOS = (Object.keys(SOURCE_TYPE_CATALOG) as SourceType[]).filter(t => t !== 'style-template-paper' && t !== 'other');
/** Qué cifras hacen medible cada clase. */
const CIFRAS: Partial<Record<RequirementKind, Array<'minimum' | 'before' | 'after' | 'recentMinimum'>>> = {
    'minimum-type': ['minimum'],
    quantity: ['minimum'],
    perspectives: ['minimum'],
    'date-range': ['before', 'after', 'recentMinimum'],
};
const numero = (v: string) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : null; };

interface Nuevo {
    kind: RequirementKind;
    text: string;
    sourceType: SourceType | '';
    unit: 'works' | 'pages';
    minimum: string;
    before: string;
    after: string;
    recentMinimum: string;
    types: SourceType[];
}
const vacio = (): Nuevo => ({ kind: 'other', text: '', sourceType: '', unit: 'works', minimum: '', before: '1950', after: String(new Date().getFullYear() - 15), recentMinimum: '1', types: [] });

/**
 * Los requisitos medibles del estado del arte (etapa 2b): del sílabo, del
 * nivel (un punto de partida declarado, sin sílabo) o escritos a mano. Cada
 * uno dice si la bibliografía aprobada lo cumple y qué no se pudo medir. Sus
 * cifras se corrigen aquí; lo que se supuso porque la fuente no lo decía se
 * declara, y deja de ser supuesto al corregirlo.
 */
export function RequirementsEditor({ measures, onChange, onShowUnmeasurable }: RequirementsEditorProps) {
    const { t } = useTranslation('projects');
    const { t: tx } = useTranslation('exegesis');
    const [nivel, setNivel] = useState<RequirementLevel>('research');
    const [nuevo, setNuevo] = useState<Nuevo>(vacio);
    const items = measures.map(m => m.requirement);
    const cambiar = (id: string, patch: Partial<ProjectRequirement>) => onChange(items.map(r => (r.id === id ? { ...r, ...patch } : r)));
    /** Corregir una cifra la saca de lo supuesto. */
    const fijar = (r: ProjectRequirement, campoCifra: RequirementAssumption, valor: number | null) => {
        const assumed = (r.assumed ?? []).filter(a => a !== campoCifra);
        cambiar(r.id, { [campoCifra]: valor, assumed: assumed.length ? assumed : null });
    };

    // Lo que le falta al formulario para que el requisito se pueda medir.
    const faltaDato = (() => {
        if (!nuevo.text.trim()) return true;
        if (nuevo.kind === 'minimum-type') return !nuevo.sourceType || !numero(nuevo.minimum);
        if (nuevo.kind === 'quantity') return !numero(nuevo.minimum);
        if (nuevo.kind === 'date-range') return !numero(nuevo.before) && !numero(nuevo.after);
        if (nuevo.kind === 'variety') return nuevo.types.length < 2;
        return false;
    })();
    const agregar = () => {
        if (faltaDato) return;
        const k = nuevo.kind;
        onChange([...items, {
            id: newBibliographyEntryId(), kind: k, text: nuevo.text.trim(), origin: 'manual',
            ...((k === 'minimum-type' || k === 'quantity') && nuevo.sourceType ? { sourceType: nuevo.sourceType } : {}),
            ...(k === 'minimum-type' || k === 'quantity' ? { minimum: numero(nuevo.minimum) } : {}),
            ...(k === 'perspectives' ? { minimum: numero(nuevo.minimum) ?? 2 } : {}),
            ...(k === 'quantity' ? { unit: nuevo.unit } : {}),
            ...(k === 'date-range' ? { before: numero(nuevo.before), after: numero(nuevo.after), recentMinimum: numero(nuevo.recentMinimum) ?? 1 } : {}),
            ...(k === 'variety' ? { types: nuevo.types } : {}),
        }]);
        setNuevo(vacio());
    };
    const proponerNivel = () => {
        const propios = requirementTemplate(nivel, newBibliographyEntryId, new Date(), (k, v) => t(`stateOfArt.requirement.template.${k}`, v));
        // Lo que ya está (misma clase y tipo) no se repite.
        const nuevos = propios.filter(p => !items.some(r => r.kind === p.kind && (r.sourceType ?? null) === (p.sourceType ?? null)));
        onChange([...items, ...nuevos]);
    };
    const supuestoDe = (r: ProjectRequirement) => (r.assumed ?? [])
        .map(a => t(`stateOfArt.requirement.assumedPart.${a}`, { value: r[a] ?? '' }))
        .join(', ');

    return (
        <section className="space-y-3" aria-labelledby="requirements-title">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h3 id="requirements-title" className="text-sm font-medium text-foreground">{t('stateOfArt.requirement.title')}</h3>
                    <p className="text-xs text-muted-foreground">{t('stateOfArt.requirement.hint')}</p>
                </div>
                <div className="flex items-end gap-2">
                    <label className="block space-y-1">
                        <span className="text-[11px] text-muted-foreground">{t('stateOfArt.requirement.level')}</span>
                        <select className={campo} value={nivel} onChange={e => setNivel(e.target.value as RequirementLevel)}>
                            {(['seminary', 'research', 'publishable'] as const).map(n => <option key={n} value={n}>{t(`stateOfArt.requirement.levels.${n}`)}</option>)}
                        </select>
                    </label>
                    <Button size="sm" variant="outline" onClick={proponerNivel}>{t('stateOfArt.requirement.propose')}</Button>
                </div>
            </div>

            {measures.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">{t('stateOfArt.requirement.empty')}</p>
            ) : (
                <ul className="space-y-2">
                    {measures.map(({ requirement: r, measure: m }) => (
                        <li key={r.id} className="rounded-lg border border-border p-2.5 space-y-1.5">
                            <div className="flex items-start gap-2">
                                <EstadoIcono status={m.status} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-foreground">{r.text}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {[t(`stateOfArt.requirement.kind.${r.kind}`), r.sourceType ? tx(`sourceTypes.${r.sourceType}.label`) : null, t(`stateOfArt.requirement.origin.${r.origin}`)].filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                                {m.status === 'incomplete'
                                    ? <span className="text-xs text-warning-subtle-foreground">{t('stateOfArt.requirement.incomplete')}</span>
                                    : m.status !== 'manual' && <span className="text-xs tabular-nums text-foreground">{t('stateOfArt.requirement.measure', { value: m.value, target: m.target })}</span>}
                                {(r.kind === 'other' || r.kind === 'rule') && (
                                    <label className="inline-flex items-center gap-1 text-xs text-foreground">
                                        <input type="checkbox" checked={!!r.done} onChange={e => cambiar(r.id, { done: e.target.checked })} />{t('stateOfArt.requirement.done')}
                                    </label>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => onChange(items.filter(x => x.id !== r.id))} aria-label={t('stateOfArt.requirement.remove', { text: r.text })}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                            {(CIFRAS[r.kind] ?? []).length > 0 && (
                                <div className="flex flex-wrap items-end gap-2">
                                    {CIFRAS[r.kind]!.map(c => (
                                        <label key={c} className="block w-24 space-y-0.5">
                                            <span className="text-[11px] text-muted-foreground">{t(`stateOfArt.requirement.field.${c}`)}</span>
                                            <input
                                                className={campo}
                                                inputMode="numeric"
                                                aria-label={`${t(`stateOfArt.requirement.field.${c}`)} · ${r.text}`}
                                                value={r[c] ?? ''}
                                                onChange={e => fijar(r, c, numero(e.target.value))}
                                            />
                                        </label>
                                    ))}
                                </div>
                            )}
                            {r.kind === 'variety' && (
                                <TiposElegidos value={r.types ?? []} onChange={types => cambiar(r.id, { types })} label={r.text} />
                            )}
                            {(r.assumed?.length ?? 0) > 0 && (
                                <p className="text-[11px] text-warning-subtle-foreground">{t('stateOfArt.requirement.assumedNote', { what: supuestoDe(r) })}</p>
                            )}
                            {m.unmeasurable.length > 0 && (
                                <button type="button" className="text-[11px] text-foreground underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded" onClick={() => onShowUnmeasurable(m.unmeasurable, r.text)}>
                                    {t(`stateOfArt.requirement.unmeasurable.${r.kind}`, { count: m.unmeasurable.length })}
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            <div className="space-y-2 rounded-lg border border-border p-2.5">
                <div className="flex flex-wrap items-end gap-2">
                    <label className="block space-y-1">
                        <span className="text-[11px] text-muted-foreground">{t('stateOfArt.requirement.kindLabel')}</span>
                        <select className={campo} value={nuevo.kind} onChange={e => setNuevo(n => ({ ...n, kind: e.target.value as RequirementKind }))}>
                            {KINDS.map(k => <option key={k} value={k}>{t(`stateOfArt.requirement.kind.${k}`)}</option>)}
                        </select>
                    </label>
                    <label className="block min-w-[14rem] flex-1 space-y-1">
                        <span className="text-[11px] text-muted-foreground">{t('stateOfArt.requirement.textLabel')}</span>
                        <input className={campo} value={nuevo.text} onChange={e => setNuevo(n => ({ ...n, text: e.target.value }))} />
                    </label>
                    {(nuevo.kind === 'minimum-type' || nuevo.kind === 'quantity') && (
                        <label className="block space-y-1">
                            <span className="text-[11px] text-muted-foreground">{t('stateOfArt.field.sourceType')}</span>
                            <select className={campo} value={nuevo.sourceType} onChange={e => setNuevo(n => ({ ...n, sourceType: e.target.value as SourceType | '' }))}>
                                <option value="">{nuevo.kind === 'quantity' ? t('stateOfArt.requirement.anyType') : '—'}</option>
                                {TIPOS.map(x => <option key={x} value={x}>{tx(`sourceTypes.${x}.label`)}</option>)}
                            </select>
                        </label>
                    )}
                    {nuevo.kind === 'quantity' && (
                        <label className="block space-y-1">
                            <span className="text-[11px] text-muted-foreground">{t('stateOfArt.requirement.unit')}</span>
                            <select className={campo} value={nuevo.unit} onChange={e => setNuevo(n => ({ ...n, unit: e.target.value as Nuevo['unit'] }))}>
                                <option value="works">{t('stateOfArt.requirement.units.works')}</option>
                                <option value="pages">{t('stateOfArt.requirement.units.pages')}</option>
                            </select>
                        </label>
                    )}
                    {(CIFRAS[nuevo.kind] ?? []).map(c => (
                        <label key={c} className="block w-24 space-y-1">
                            <span className="text-[11px] text-muted-foreground">{t(`stateOfArt.requirement.field.${c}`)}</span>
                            <input
                                className={campo}
                                inputMode="numeric"
                                value={nuevo[c]}
                                placeholder={nuevo.kind === 'perspectives' ? '2' : undefined}
                                onChange={e => setNuevo(n => ({ ...n, [c]: e.target.value }))}
                            />
                        </label>
                    ))}
                    <Button size="sm" variant="outline" onClick={agregar} disabled={faltaDato}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />{t('stateOfArt.requirement.add')}
                    </Button>
                </div>
                {nuevo.kind === 'variety' && (
                    <TiposElegidos value={nuevo.types} onChange={types => setNuevo(n => ({ ...n, types }))} label={t('stateOfArt.requirement.kind.variety')} />
                )}
                {nuevo.text.trim() && faltaDato && (
                    <p className="text-[11px] text-warning-subtle-foreground">{t(`stateOfArt.requirement.needs.${nuevo.kind}`)}</p>
                )}
            </div>
        </section>
    );
}

function EstadoIcono({ status }: { status: RequirementMeasure['status'] }) {
    const { t } = useTranslation('projects');
    if (status === 'met') return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label={t('stateOfArt.coverage.covered')} />;
    if (status === 'incomplete') return <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning-subtle-foreground" aria-label={t('stateOfArt.requirement.incomplete')} />;
    return <Circle className="mt-0.5 h-4 w-4 shrink-0 text-warning-subtle-foreground" aria-label={t('stateOfArt.coverage.missing')} />;
}

/** Los tipos que pide un requisito de variedad. */
function TiposElegidos({ value, onChange, label }: { value: ReadonlyArray<SourceType>; onChange: (types: SourceType[]) => void; label: string }) {
    const { t } = useTranslation('projects');
    const { t: tx } = useTranslation('exegesis');
    return (
        <fieldset className="space-y-1">
            <legend className="text-[11px] text-muted-foreground">{t('stateOfArt.requirement.field.types')} · {label}</legend>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
                {TIPOS.map(x => {
                    const marcado = value.includes(x);
                    return (
                        <label key={x} className="inline-flex items-center gap-1 text-xs text-foreground">
                            <input type="checkbox" checked={marcado} onChange={() => onChange(marcado ? value.filter(y => y !== x) : [...value, x])} />
                            {tx(`sourceTypes.${x}.label`)}
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
}
