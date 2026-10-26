import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { projectCourseInfo, projectWorkTypes, type AIProject, type CourseDesk, type DeskWorkType, type ProjectCourseInfo, type ProjectWorkType } from '@dosfilos/domain';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';
import { useUserRubrics } from '@/hooks/exegesis/useUserRubrics';
import { useUserStyleGuides } from '@/hooks/exegesis/useUserStyleGuides';
import { cn } from '@/lib/utils';
import { ProjectCourseCard } from '../../ProjectCourseCard';
import { ProjectWorkTypesCard } from '../../ProjectWorkTypesCard';
import { TOUCH } from './courseDeskFormat';

interface CourseChargeSectionProps {
    project: AIProject;
    course: CourseDesk;
}

/**
 * Fase 1 · Lo que pide el curso (§9.1): un resumen de SOLO LECTURA, con cada
 * tipo de trabajo como chip (rúbrica · método · guía). Editar abre un
 * diálogo con los dos formularios de antes: abiertos en la página competían
 * con el trabajo del curso y se guardaban por separado sin aviso.
 */
export function CourseChargeSection({ project, course }: CourseChargeSectionProps) {
    const { t } = useTranslation('projectDeskCourse');
    const { rubrics } = useUserRubrics();
    const { guides } = useUserStyleGuides();
    const [open, setOpen] = useState(false);
    const info = projectCourseInfo(project);
    const guiaCurso = guides.find(g => g.id === info?.styleGuideId);

    const rubrica = (w: DeskWorkType): { text: string; warn: boolean } => {
        switch (w.rubric) {
            case 'template': return { text: rubrics.find(r => r.id === projectWorkTypes(project).find(x => x.id === w.id)?.rubricTemplateId)?.displayName ?? t('charge.rubric.template'), warn: false };
            case 'default': return { text: t('charge.rubric.default'), warn: false };
            case 'system': return { text: t('charge.rubric.system'), warn: false };
            case 'missing': return { text: t('charge.rubric.missing'), warn: true };
            default: return { text: t('charge.rubric.unset'), warn: true };
        }
    };
    const guia = (w: DeskWorkType): string | null => {
        if (!w.guideId) return null;
        const g = guides.find(x => x.id === w.guideId);
        if (!g) return t('charge.guide');
        const reglas = g.manifest?.additionalRules?.length ?? 0;
        return reglas > 0 ? t('charge.guideRules', { name: g.displayName, count: reglas }) : g.displayName;
    };

    return (
        <div className="space-y-3">
            {(info?.course || guiaCurso) && (
                <p className="text-sm text-foreground">
                    {info?.course && <span className="font-medium">{info.course}</span>}
                    {info?.course && guiaCurso && <span className="text-muted-foreground"> · </span>}
                    {guiaCurso && <span className="text-muted-foreground">{t('charge.courseGuide', { name: guiaCurso.displayName })}</span>}
                </p>
            )}

            {course.workTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('charge.empty')}</p>
            ) : (
                <ul className="flex flex-wrap gap-2" aria-label={t('charge.typesLabel')}>
                    {course.workTypes.map(w => {
                        const r = rubrica(w);
                        const g = guia(w);
                        return (
                            <li
                                key={w.id}
                                data-testid="course-work-type-chip"
                                className={cn(
                                    'rounded-lg border px-3 py-2 text-xs leading-relaxed',
                                    r.warn ? 'border-warning/40 bg-warning-subtle text-warning-subtle-foreground' : 'border-border bg-background text-foreground',
                                )}
                            >
                                <span className="font-semibold">{w.label || t('charge.untitled')}</span>
                                <span className={r.warn ? '' : 'text-muted-foreground'}> · {r.text}</span>
                                {w.method && <span className="text-muted-foreground"> · {t(`charge.method.${w.method}`)}</span>}
                                {g && <span className="text-muted-foreground"> · {g}</span>}
                            </li>
                        );
                    })}
                </ul>
            )}

            {course.noRepeat && <p className="text-xs text-muted-foreground">{t('charge.noRepeat')}</p>}

            <Button size="sm" variant="outline" className={TOUCH} onClick={() => setOpen(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {t('charge.edit')}
            </Button>

            <CourseChargeDialog project={project} open={open} onOpenChange={setOpen} />
        </div>
    );
}

/**
 * Los datos del curso y los tipos de trabajo, en un diálogo. Cada tarjeta
 * guarda lo suyo y muestra su propio «guardando» (como antes en la página).
 */
function CourseChargeDialog({ project, open, onOpenChange }: { project: AIProject; open: boolean; onOpenChange: (o: boolean) => void }) {
    const { t } = useTranslation('projectDeskCourse');
    const { updateProject } = useFacultyProjects();
    const [guardando, setGuardando] = useState<'course' | 'workTypes' | null>(null);
    const guardar = async (cual: 'course' | 'workTypes', cambio: { courseInfo?: ProjectCourseInfo | null; workTypes?: ProjectWorkType[] }) => {
        setGuardando(cual);
        try {
            await updateProject.mutateAsync({ projectId: project.id, ...cambio });
            toast.success(t('toast.saved'));
        } catch (err) {
            console.error('[projects] save course data / work types failed:', err);
            toast.error(t('toast.saveFailed'));
        } finally {
            setGuardando(null);
        }
    };
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="font-reading">{t('charge.dialogTitle')}</DialogTitle>
                    <DialogDescription>{t('charge.dialogHint')}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <ProjectCourseCard project={project} saving={guardando === 'course'} onSave={courseInfo => guardar('course', { courseInfo })} />
                    <ProjectWorkTypesCard project={project} saving={guardando === 'workTypes'} onSave={workTypes => guardar('workTypes', { workTypes })} />
                </div>
            </DialogContent>
        </Dialog>
    );
}
