import { useEffect, useState } from 'react';
import { ClipboardList, Loader2, Plus, X } from 'lucide-react';
import { newWorkTypeId, projectCourseInfo, projectWorkTypes, workTypeFromProfile, type AIProject, type ProjectWorkType } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useWorkProfiles } from '@/hooks/exegesis/useWorkProfiles';
import { useUserRubrics } from '@/hooks/exegesis/useUserRubrics';
import { useUserAssignmentBriefs } from '@/hooks/exegesis/useUserAssignmentBriefs';
import { useUserStyleGuides } from '@/hooks/exegesis/useUserStyleGuides';

interface ProjectWorkTypesCardProps {
    project: AIProject;
    onSave: (types: ProjectWorkType[]) => Promise<unknown>;
    saving: boolean;
}

/**
 * Los tipos de trabajo del proyecto (ADR-046, etapa 1b): un curso pide TP
 * semanales, un ensayo y un paper final, y cada uno tiene su rúbrica, su
 * encuadre, su guía y su estrategia. Todos comparten la bibliografía del
 * proyecto. Cada tipo se copia de un perfil de trabajo o se arma a mano.
 */
export function ProjectWorkTypesCard({ project, onSave, saving }: ProjectWorkTypesCardProps) {
    const { t } = useTranslation('projects');
    const { profiles } = useWorkProfiles();
    const { rubrics } = useUserRubrics();
    const { briefs } = useUserAssignmentBriefs();
    const { guides } = useUserStyleGuides();
    const guardados = projectWorkTypes(project);
    const clave = JSON.stringify(guardados);
    const [draft, setDraft] = useState<ProjectWorkType[]>(guardados);
    const [abierto, setAbierto] = useState<string | null>(null);
    useEffect(() => setDraft(JSON.parse(clave) as ProjectWorkType[]), [clave]);

    const cambiar = (id: string, patch: Partial<ProjectWorkType>) =>
        setDraft(ts => ts.map(x => (x.id === id ? { ...x, ...patch } : x)));
    const agregar = (tipo: ProjectWorkType) => { setDraft(ts => [...ts, tipo]); setAbierto(tipo.id); };
    const desdePerfil = (id: string) => {
        const perfil = profiles.find(p => p.id === id);
        if (perfil) agregar(workTypeFromProfile(perfil, newWorkTypeId()));
    };

    const sinNombre = draft.some(x => !x.label.trim());
    const sinCambios = JSON.stringify(draft) === clave;
    const campo = 'w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';
    // Vacía, la guía del tipo es la del curso; si el curso no tiene, ninguna.
    const guiaHeredada = projectCourseInfo(project)?.styleGuideId
        ? t(project.type === 'course' ? 'workTypes.styleGuideCourse' : 'workTypes.styleGuideProject')
        : t('workTypes.none');
    const nombreDe = (id?: string | null, lista: ReadonlyArray<{ id: string; displayName: string }> = []) => lista.find(x => x.id === id)?.displayName;
    const resumen = (x: ProjectWorkType) => [
        x.rubricTemplateId === null ? t('workTypes.rubricSystem') : nombreDe(x.rubricTemplateId, rubrics),
        nombreDe(x.styleGuideId, guides),
    ].filter(Boolean).join(' · ');

    return (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3" aria-labelledby="project-charge-title">
            <header className="flex items-start gap-2">
                <ClipboardList className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                    <h2 id="project-charge-title" className="text-sm font-semibold text-foreground">{t('workTypes.title')}</h2>
                    <p className="text-xs text-muted-foreground">{t(draft.length > 0 ? 'workTypes.hint' : 'workTypes.empty')}</p>
                </div>
            </header>

            {draft.length > 0 && (
                <ul className="space-y-2">
                    {draft.map(x => {
                        const editando = abierto === x.id;
                        return (
                            <li key={x.id} className="rounded-md border border-border">
                                <div className="flex items-center gap-2 px-3 py-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm text-foreground">{x.label.trim() || t('workTypes.untitled')}</p>
                                        {!editando && resumen(x) && <p className="truncate text-[11px] text-muted-foreground">{resumen(x)}</p>}
                                    </div>
                                    <Button size="sm" variant="ghost" onClick={() => setAbierto(editando ? null : x.id)} aria-expanded={editando}>
                                        {t(editando ? 'workTypes.done' : 'workTypes.edit')}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setDraft(ts => ts.filter(y => y.id !== x.id))} aria-label={t('workTypes.remove', { label: x.label })}>
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                                {editando && (
                                    <div className="grid gap-3 border-t border-border px-3 py-3 sm:grid-cols-2">
                                        <label className="block space-y-1 sm:col-span-2">
                                            <span className="text-xs text-muted-foreground">{t('workTypes.label')}</span>
                                            <input className={campo} value={x.label} onChange={e => cambiar(x.id, { label: e.target.value })} />
                                        </label>
                                        <label className="block space-y-1">
                                            <span className="text-xs text-muted-foreground">{t('workTypes.rubric')}</span>
                                            {/* Tres estados: sin elegir (la plantilla por defecto del
                                                usuario), la del sistema (`null`) o una plantilla. */}
                                            <select
                                                className={campo}
                                                value={x.rubricTemplateId === null ? '__system' : x.rubricTemplateId ?? ''}
                                                onChange={e => cambiar(x.id, { rubricTemplateId: e.target.value === '__system' ? null : e.target.value || undefined })}
                                            >
                                                <option value="">{t('workTypes.rubricDefault')}</option>
                                                <option value="__system">{t('workTypes.rubricSystem')}</option>
                                                {rubrics.map(r => <option key={r.id} value={r.id}>{r.displayName}</option>)}
                                            </select>
                                        </label>
                                        <label className="block space-y-1">
                                            <span className="text-xs text-muted-foreground">{t('workTypes.brief')}</span>
                                            <select className={campo} value={x.briefTemplateId ?? ''} onChange={e => cambiar(x.id, { briefTemplateId: e.target.value || null })}>
                                                <option value="">{t('workTypes.none')}</option>
                                                {briefs.map(b => <option key={b.id} value={b.id}>{b.displayName}</option>)}
                                            </select>
                                        </label>
                                        <label className="block space-y-1">
                                            <span className="text-xs text-muted-foreground">{t('workTypes.styleGuide')}</span>
                                            <select className={campo} value={x.styleGuideId ?? ''} onChange={e => cambiar(x.id, { styleGuideId: e.target.value || null })}>
                                                <option value="">{guiaHeredada}</option>
                                                {guides.map(g => <option key={g.id} value={g.id}>{g.displayName}</option>)}
                                            </select>
                                        </label>
                                        <label className="block space-y-1">
                                            <span className="text-xs text-muted-foreground">{t('workTypes.strategy')}</span>
                                            <select
                                                className={campo}
                                                value={x.exegeticalStrategy ?? ''}
                                                onChange={e => cambiar(x.id, { exegeticalStrategy: e.target.value === 'free' ? 'free' : e.target.value === 'dialectical' ? 'dialectical' : undefined })}
                                            >
                                                <option value="">{t('workTypes.noPreference')}</option>
                                                <option value="dialectical">{t('workTypes.dialectical')}</option>
                                                <option value="free">{t('workTypes.free')}</option>
                                            </select>
                                        </label>
                                        {x.cover && <p className="text-[11px] text-muted-foreground sm:col-span-2">{t('workTypes.coverFromProfile')}</p>}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            <div className="flex flex-wrap items-center gap-2">
                {profiles.length > 0 && (
                    <select
                        className={`${campo} sm:w-auto`}
                        value=""
                        onChange={e => desdePerfil(e.target.value)}
                        aria-label={t('workTypes.addFromProfile')}
                    >
                        <option value="">{t('workTypes.addFromProfile')}</option>
                        {profiles.map(p => <option key={p.id} value={p.id}>{p.displayName}{p.course ? ` · ${p.course}` : ''}</option>)}
                    </select>
                )}
                <Button size="sm" variant="outline" onClick={() => agregar({ id: newWorkTypeId(), label: t('workTypes.newLabel') })}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    {t('workTypes.addEmpty')}
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Button size="sm" onClick={() => onSave(draft)} disabled={saving || sinCambios || sinNombre}>
                    {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    {t('workTypes.save')}
                </Button>
                {sinNombre
                    ? <p className="text-[11px] text-warning-subtle-foreground">{t('workTypes.labelRequired')}</p>
                    : !sinCambios && !saving && <p className="text-[11px] text-warning-subtle-foreground">{t('unsaved')}</p>}
            </div>
        </section>
    );
}
