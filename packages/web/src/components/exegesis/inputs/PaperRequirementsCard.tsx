import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Plus, X } from 'lucide-react';
import type { ManualRequirement, PaperRequirement, PaperUnit, RequirementMark, RequirementWarning, SourceType } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

type Patch = { requirementMarks?: Record<string, RequirementMark>; manualRequirements?: ManualRequirement[] };

/**
 * Los requisitos y dónde se cumple cada uno. Regla del procedimiento: todo
 * requisito se cumple en el cuerpo; un apéndice solo amplía. Marcar «solo en
 * un apéndice» no se impide: se avisa, porque a veces es lo que hay.
 */
export function PaperRequirementsCard({ requirements, warnings, units, marks, manual, saving, onSave }: {
    requirements: ReadonlyArray<PaperRequirement>;
    warnings: ReadonlyArray<RequirementWarning>;
    units: ReadonlyArray<PaperUnit>;
    marks: Readonly<Record<string, RequirementMark>>;
    manual: ReadonlyArray<ManualRequirement>;
    saving: boolean;
    onSave: (patch: Patch) => Promise<unknown>;
}) {
    const { t } = useTranslation('exegesis');
    const [nuevo, setNuevo] = useState('');
    const guardar = async (patch: Patch) => {
        try {
            await onSave(patch);
        } catch (err) {
            console.error('[inputs] no se pudo guardar el requisito', err);
            toast.error(t('inputs.saveFailed'));
        }
    };
    const cambiar = (r: PaperRequirement, cambio: RequirementMark) => {
        if (r.origin === 'manual') {
            const id = r.id.slice('manual:'.length);
            return guardar({ manualRequirements: manual.map(m => (m.id === id ? { ...m, ...cambio, unitId: cambio.unitId === undefined ? m.unitId : cambio.unitId } : m)) });
        }
        return guardar({ requirementMarks: { ...marks, [r.id]: { ...marks[r.id], ...cambio } } });
    };
    const quitar = (r: PaperRequirement) => guardar({ manualRequirements: manual.filter(m => `manual:${m.id}` !== r.id) });
    const agregar = async () => {
        const texto = nuevo.trim();
        if (!texto) return;
        await guardar({ manualRequirements: [...manual, { id: `r${Date.now().toString(36)}`, text: texto, unitId: null, inBody: true, done: false }] });
        setNuevo('');
    };
    const avisoDe = (id: string) => warnings.filter(w => w.requirementId === id);

    return (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4" aria-labelledby="requisitos-titulo">
            <div>
                <h3 id="requisitos-titulo" className="font-serif text-base font-semibold text-foreground">{t('inputs.requirements.title')}</h3>
                <p className="text-xs text-muted-foreground">{t('inputs.requirements.subtitle')}</p>
            </div>
            <ul className="divide-y divide-border" data-testid="requisitos">
                {requirements.map(r => (
                    <li key={r.id} className="space-y-1.5 py-2.5" data-testid={`requisito-${r.id}`}>
                        <div className="flex items-start gap-2">
                            <input
                                type="checkbox"
                                id={`hecho-${r.id}`}
                                checked={r.done}
                                disabled={saving}
                                onChange={e => cambiar(r, { done: e.target.checked })}
                                className="mt-1 h-4 w-4 accent-primary"
                            />
                            <label htmlFor={`hecho-${r.id}`} className="min-w-0 flex-1 text-sm text-foreground">
                                {'literal' in r.text ? r.text.literal : t(`inputs.requirements.text.${r.text.key}`, textValues(t, r.text.values))}
                                <span className="ml-2 text-xs text-muted-foreground">{t(`inputs.requirements.origin.${r.origin}`)}</span>
                            </label>
                            {r.origin === 'manual' && (
                                <button type="button" onClick={() => quitar(r)} disabled={saving} aria-label={t('inputs.requirements.remove')} className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 pl-6 text-xs text-muted-foreground">
                            <label className="inline-flex items-center gap-1.5">
                                {t('inputs.requirements.where')}
                                <select
                                    value={r.unitId ?? ''}
                                    disabled={saving}
                                    onChange={e => cambiar(r, { unitId: e.target.value || null })}
                                    className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                >
                                    <option value="">{t('inputs.requirements.wholePaper')}</option>
                                    {units.map(u => <option key={u.id} value={u.id}>{unitLabel(t, u)}</option>)}
                                </select>
                            </label>
                            <label className="inline-flex items-center gap-1.5">
                                <input type="checkbox" checked={!r.inBody} disabled={saving} onChange={e => cambiar(r, { inBody: !e.target.checked })} className="h-4 w-4 accent-primary" />
                                {t('inputs.requirements.appendixOnly')}
                            </label>
                        </div>
                        {avisoDe(r.id).map(w => (
                            <p key={w.kind} role="note" className="ml-6 inline-flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning-subtle/40 px-2 py-1 text-xs text-warning-subtle-foreground">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                                {t(`inputs.requirements.warning.${w.kind}`)}
                            </p>
                        ))}
                    </li>
                ))}
            </ul>
            <div className="flex gap-2">
                <label htmlFor="requisito-nuevo" className="sr-only">{t('inputs.requirements.addLabel')}</label>
                <input
                    id="requisito-nuevo"
                    value={nuevo}
                    maxLength={400}
                    onChange={e => setNuevo(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void agregar(); }}
                    placeholder={t('inputs.requirements.addPlaceholder')}
                    className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button type="button" onClick={() => void agregar()} disabled={saving || !nuevo.trim()} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    {t('inputs.requirements.add')}
                </button>
            </div>
        </section>
    );
}

type T = ReturnType<typeof useTranslation>['t'];

function textValues(t: T, values: Record<string, string | number> | undefined): Record<string, string | number> {
    if (!values?.sourceType) return values ?? {};
    return { ...values, count: Number(values.minimum ?? 1), sourceType: t(`sourceTypes.${values.sourceType as SourceType}.label`) };
}

export function unitLabel(t: T, u: PaperUnit): string {
    const versos = u.verses.map(v => `${v.chapter}:${v.verse}`).join(', ');
    if (u.kind === 'parte') return t(`inputs.unit.part.${u.part}`);
    if (u.kind === 'pregunta') return t('inputs.unit.question', { number: u.number, verses: versos });
    return u.text ? `${versos} · ${u.text}` : t('inputs.unit.verse', { verses: versos });
}
