import { useEffect, useState } from 'react';
import { GraduationCap, Loader2 } from 'lucide-react';
import { projectCourseInfo, type AIProject, type ProjectCourseInfo } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useUserStyleGuides } from '@/hooks/exegesis/useUserStyleGuides';
import { canonico } from '@/utils/canonico';

interface ProjectCourseCardProps {
    project: AIProject;
    onSave: (info: ProjectCourseInfo | null) => Promise<unknown>;
    saving: boolean;
}

/**
 * Los datos del curso (ADR-046, etapa 1b): lo común a todos sus trabajos.
 * La guía es opcional: hay cursos con guía propia, y un tipo de trabajo que
 * trae la suya gana sobre esta. En un proyecto que no es curso, solo la guía.
 */
export function ProjectCourseCard({ project, onSave, saving }: ProjectCourseCardProps) {
    const { t } = useTranslation('projects');
    const { guides } = useUserStyleGuides();
    const esCurso = project.type === 'course';
    const guardado = projectCourseInfo(project) ?? {};
    const [draft, setDraft] = useState<ProjectCourseInfo>(guardado);
    const clave = JSON.stringify(guardado);
    useEffect(() => setDraft(JSON.parse(clave) as ProjectCourseInfo), [clave]);

    // Canónico: elegir una guía y volver a «Ninguna» deja `null` donde lo
    // guardado no tenía la clave, y eso no es un cambio.
    const sinCambios = canonico(draft) === canonico(guardado);
    const campo = 'w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-focus';

    return (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3" aria-labelledby="project-course-title">
            <header className="flex items-start gap-2">
                <GraduationCap className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                    <h2 id="project-course-title" className="text-sm font-semibold text-foreground">{t(esCurso ? 'course.titleCourse' : 'course.titleProject')}</h2>
                    <p className="text-xs text-muted-foreground">{t(esCurso ? 'course.hintCourse' : 'course.hintProject')}</p>
                </div>
            </header>

            <div className="grid gap-3 sm:grid-cols-2">
                {esCurso && (
                    <label className="block space-y-1">
                        <span className="text-xs text-muted-foreground">{t('course.course')}</span>
                        <input className={campo} value={draft.course ?? ''} onChange={e => setDraft(d => ({ ...d, course: e.target.value }))} />
                    </label>
                )}
                <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">{t('course.styleGuide')}</span>
                    <select className={campo} value={draft.styleGuideId ?? ''} onChange={e => setDraft(d => ({ ...d, styleGuideId: e.target.value || null }))}>
                        <option value="">{t('course.none')}</option>
                        {guides.map(g => <option key={g.id} value={g.id}>{g.displayName}</option>)}
                    </select>
                </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {/* De contorno: estas tarjetas van junto a «Ahora» (General) y son dos;
                    dos «Guardar» llenos competirían con el único botón lleno de la página. */}
                <Button size="sm" variant="outline" className="min-h-11 sm:min-h-0" onClick={() => onSave(draft)} disabled={saving || sinCambios}>
                    {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    {t('course.save')}
                </Button>
                {/* Son dos tarjetas con su propio botón: sin este aviso, se
                    guardaba una y la otra quedaba escrita sin guardar. */}
                {!sinCambios && !saving && <p className="text-[11px] text-warning-subtle-foreground">{t('unsaved')}</p>}
            </div>
        </section>
    );
}
