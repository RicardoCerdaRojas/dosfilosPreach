import { useState } from 'react';
import { CheckCircle2, Pencil } from 'lucide-react';
import { projectCourseInfo, projectWorkTypes, type AIProject, type CourseDesk, type DeskWorkType, type ProjectCourseInfo, type ProjectWorkType } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { useUserRubrics } from '@/hooks/exegesis/useUserRubrics';
import { useUserStyleGuides } from '@/hooks/exegesis/useUserStyleGuides';
import { cn } from '@/lib/utils';
import { ProjectCourseCard } from '../../ProjectCourseCard';
import { ProjectWorkTypesCard } from '../../ProjectWorkTypesCard';
import { WRAP_LABEL } from '../primitives';
import { DIALOG, DIALOG_BODY, DIALOG_FOOTER, DIALOG_HEADER, TOUCH } from './courseDeskFormat';
import type { CourseOpsApi } from './useCourseOps';

interface CourseChargeSectionProps {
    project: AIProject;
    course: CourseDesk;
    ops: Pick<CourseOpsApi, 'saveProject' | 'pending'>;
}

/**
 * Sin la rúbrica del profesor (la del sistema o la por defecto), el tipo
 * deja la fase 1 en curso hasta que el estudiante confirme que el curso no
 * da rúbrica. Una plantilla borrada no se confirma: hay que elegir otra.
 */
const confirmable = (w: DeskWorkType) =>
    !w.rubricResolved && !w.rubricConfirmed && !w.rubricLoading && (w.rubric === 'system' || w.rubric === 'default' || w.rubric === 'unset');

/**
 * Fase 1 · Lo que pide el curso (§9.1): un resumen de SOLO LECTURA, con cada
 * tipo de trabajo como chip (rúbrica · método · guía). Editar abre un
 * diálogo con los dos formularios de antes: abiertos en la página competían
 * con el trabajo del curso y se guardaban por separado sin aviso.
 */
export function CourseChargeSection({ project, course, ops }: CourseChargeSectionProps) {
    const { t } = useTranslation('projectDeskCourse');
    const { rubrics } = useUserRubrics();
    const { guides } = useUserStyleGuides();
    const [open, setOpen] = useState(false);
    const info = projectCourseInfo(project);
    const guiaCurso = guides.find(g => g.id === info?.styleGuideId);

    const rubrica = (w: DeskWorkType): { text: string; warn: boolean } => {
        // Mientras carga el catálogo no se sabe si la plantilla existe: ni aviso ni «resuelta».
        if (w.rubricLoading) return { text: t('charge.rubric.loading'), warn: false };
        // Sin la del profesor: la del sistema o la por defecto, confirmada o por confirmar.
        const sinProfesor = (key: string) => ({ text: t(w.rubricConfirmed ? `${key}Confirmed` : key), warn: !w.rubricResolved });
        switch (w.rubric) {
            case 'template': return { text: rubrics.find(r => r.id === projectWorkTypes(project).find(x => x.id === w.id)?.rubricTemplateId)?.displayName ?? t('charge.rubric.template'), warn: false };
            case 'default': return sinProfesor('charge.rubric.default');
            case 'system': return sinProfesor('charge.rubric.system');
            case 'missing': return { text: t('charge.rubric.missing'), warn: true };
            default: return sinProfesor('charge.rubric.unset');
        }
    };
    // «El curso no da rúbrica»: se guarda en el tipo (`rubricConfirmed`), con
    // los tipos tal como están guardados, como guarda el formulario de tipos.
    const confirmar = (w: DeskWorkType) => {
        const tipos = projectWorkTypes(project).map(x => (x.id === w.id ? { ...x, rubricConfirmed: true } : x));
        void ops.saveProject({ workTypes: tipos }, 'toast.rubricConfirmed');
    };
    const porConfirmar = course.workTypes.filter(confirmable);
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
                                {/* Dentro del chip de aviso, todo en su tono: el gris no llega a AA sobre el fondo ámbar. */}
                                <span className={r.warn ? undefined : 'text-muted-foreground'}> · {r.text}</span>
                                {w.method && <span className={r.warn ? undefined : 'text-muted-foreground'}> · {t(`charge.method.${w.method}`)}</span>}
                                {g && <span className={r.warn ? undefined : 'text-muted-foreground'}> · {g}</span>}
                            </li>
                        );
                    })}
                </ul>
            )}

            {porConfirmar.length > 0 && (
                <div className="space-y-2 rounded-lg border border-border p-3" data-testid="course-rubric-confirm">
                    <p className="text-xs text-muted-foreground">{t('charge.confirmHint')}</p>
                    <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        {porConfirmar.map(w => (
                            <li key={w.id}>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className={cn(TOUCH, WRAP_LABEL)}
                                    disabled={ops.pending}
                                    onClick={() => confirmar(w)}
                                    aria-label={t('charge.confirmLabel', { type: w.label || t('charge.untitled') })}
                                >
                                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                                    {t(w.rubric === 'default' ? 'charge.confirmDefault' : 'charge.confirmSystem', { type: w.label || t('charge.untitled') })}
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {course.noRepeat && <p className="text-xs text-muted-foreground">{t('charge.noRepeat')}</p>}

            <Button size="sm" variant="outline" className={TOUCH} onClick={() => setOpen(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {t('charge.edit')}
            </Button>

            <CourseChargeDialog project={project} open={open} onOpenChange={setOpen} ops={ops} />
        </div>
    );
}

/**
 * Los datos del curso y los tipos de trabajo, en un diálogo. Cada tarjeta
 * guarda lo suyo con su botón y muestra su propio «guardando»: un solo
 * «Guardar» en el pie pediría sacar el borrador de las dos tarjetas
 * (`ProjectCourseCard`, `ProjectWorkTypesCard`), que también se usan fuera
 * del escritorio; queda para cuando se rehagan. El pie solo cierra. Las dos
 * escrituras pasan por la espera única del escritorio.
 */
function CourseChargeDialog({ project, open, onOpenChange, ops }: { project: AIProject; open: boolean; onOpenChange: (o: boolean) => void; ops: Pick<CourseOpsApi, 'saveProject'> }) {
    const { t } = useTranslation('projectDeskCourse');
    const [guardando, setGuardando] = useState<'course' | 'workTypes' | null>(null);
    const guardar = async (cual: 'course' | 'workTypes', cambio: { courseInfo?: ProjectCourseInfo | null; workTypes?: ProjectWorkType[] }) => {
        setGuardando(cual);
        try {
            await ops.saveProject(cambio);
        } finally {
            setGuardando(null);
        }
    };
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn(DIALOG, 'sm:max-w-3xl')}>
                <DialogHeader className={DIALOG_HEADER}>
                    <DialogTitle className="font-reading">{t('charge.dialogTitle')}</DialogTitle>
                    <DialogDescription>{t('charge.dialogHint')}</DialogDescription>
                </DialogHeader>
                <div className={cn(DIALOG_BODY, 'space-y-4')}>
                    <ProjectCourseCard project={project} saving={guardando === 'course'} onSave={courseInfo => guardar('course', { courseInfo })} />
                    <ProjectWorkTypesCard project={project} saving={guardando === 'workTypes'} onSave={workTypes => guardar('workTypes', { workTypes })} />
                </div>
                <DialogFooter className={DIALOG_FOOTER}>
                    <Button variant="outline" className={TOUCH} onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
