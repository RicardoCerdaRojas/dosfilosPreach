import { useEffect, useState } from 'react';
import { ClipboardList, Loader2 } from 'lucide-react';
import { chargeFromWorkProfile, hasProjectCharge, type AIProject, type ProjectCharge } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useWorkProfiles } from '@/hooks/exegesis/useWorkProfiles';
import { useUserRubrics } from '@/hooks/exegesis/useUserRubrics';
import { useUserAssignmentBriefs } from '@/hooks/exegesis/useUserAssignmentBriefs';
import { useUserStyleGuides } from '@/hooks/exegesis/useUserStyleGuides';

interface ProjectChargeCardProps {
    project: AIProject;
    onSave: (charge: ProjectCharge | null) => Promise<unknown>;
    saving: boolean;
}

/**
 * El encargo del proyecto (ADR-046, etapa 1): con qué rúbrica, encuadre, guía
 * y estrategia nacen sus estudios. Se copia de un perfil de trabajo o se elige
 * a mano; los estudios lo heredan como valores iniciales que se revisan.
 */
export function ProjectChargeCard({ project, onSave, saving }: ProjectChargeCardProps) {
    const { t } = useTranslation('projects');
    const { profiles } = useWorkProfiles();
    const { rubrics } = useUserRubrics();
    const { briefs } = useUserAssignmentBriefs();
    const { guides } = useUserStyleGuides();
    const [draft, setDraft] = useState<ProjectCharge>(project.charge ?? {});
    useEffect(() => setDraft(project.charge ?? {}), [project.charge]);

    const set = (patch: Partial<ProjectCharge>) => setDraft(d => ({ ...d, ...patch }));
    const copiarPerfil = (id: string) => {
        const perfil = profiles.find(p => p.id === id);
        if (perfil) setDraft(chargeFromWorkProfile(perfil));
    };
    const tiene = hasProjectCharge(project);
    const sinCambios = JSON.stringify(draft) === JSON.stringify(project.charge ?? {});
    const campo = 'w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';

    return (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3" aria-labelledby="project-charge-title">
            <header className="flex items-start gap-2">
                <ClipboardList className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                    <h2 id="project-charge-title" className="text-sm font-semibold text-foreground">{t('charge.title')}</h2>
                    <p className="text-xs text-muted-foreground">{t(tiene ? 'charge.inherited' : 'charge.empty')}</p>
                </div>
            </header>

            {profiles.length > 0 && (
                <label className="block space-y-1">
                    <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">{t('charge.fromProfile')}</span>
                    <select className={campo} value={draft.workProfileId ?? ''} onChange={e => copiarPerfil(e.target.value)}>
                        <option value="">{t('charge.pickProfile')}</option>
                        {profiles.map(p => <option key={p.id} value={p.id}>{p.displayName}{p.course ? ` · ${p.course}` : ''}</option>)}
                    </select>
                </label>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">{t('charge.course')}</span>
                    <input className={campo} value={draft.course ?? ''} onChange={e => set({ course: e.target.value })} />
                </label>
                <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">{t('charge.rubric')}</span>
                    {/* Tres estados: sin elegir (la plantilla por defecto del
                        usuario), la del sistema (`null`) o una plantilla. */}
                    <select
                        className={campo}
                        value={draft.rubricTemplateId === null ? '__system' : draft.rubricTemplateId ?? ''}
                        onChange={e => set({ rubricTemplateId: e.target.value === '__system' ? null : e.target.value || undefined })}
                    >
                        <option value="">{t('charge.rubricDefault')}</option>
                        <option value="__system">{t('charge.rubricSystem')}</option>
                        {rubrics.map(r => <option key={r.id} value={r.id}>{r.displayName}</option>)}
                    </select>
                </label>
                <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">{t('charge.brief')}</span>
                    <select className={campo} value={draft.briefTemplateId ?? ''} onChange={e => set({ briefTemplateId: e.target.value || null })}>
                        <option value="">{t('charge.none')}</option>
                        {briefs.map(b => <option key={b.id} value={b.id}>{b.displayName}</option>)}
                    </select>
                </label>
                <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">{t('charge.styleGuide')}</span>
                    <select className={campo} value={draft.styleGuideId ?? ''} onChange={e => set({ styleGuideId: e.target.value || null })}>
                        <option value="">{t('charge.none')}</option>
                        {guides.map(g => <option key={g.id} value={g.id}>{g.displayName}</option>)}
                    </select>
                </label>
                <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">{t('charge.strategy')}</span>
                    {/* Sin preferencia, el estudio conserva la del perfil o la
                        dialéctica: el select no muestra una que no se guarda. */}
                    <select
                        className={campo}
                        value={draft.exegeticalStrategy ?? ''}
                        onChange={e => set({ exegeticalStrategy: e.target.value === 'free' ? 'free' : e.target.value === 'dialectical' ? 'dialectical' : undefined })}
                    >
                        <option value="">{t('charge.noPreference')}</option>
                        <option value="dialectical">{t('charge.dialectical')}</option>
                        <option value="free">{t('charge.free')}</option>
                    </select>
                </label>
            </div>
            {draft.cover && <p className="text-[11px] text-muted-foreground">{t('charge.coverFromProfile')}</p>}

            <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => onSave(draft)} disabled={saving || sinCambios}>
                    {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    {t('charge.save')}
                </Button>
                {tiene && (
                    <Button size="sm" variant="ghost" onClick={() => onSave(null)} disabled={saving}>
                        {t('charge.clear')}
                    </Button>
                )}
            </div>
        </section>
    );
}
