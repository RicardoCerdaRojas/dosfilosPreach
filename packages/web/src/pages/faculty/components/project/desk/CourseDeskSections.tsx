import { useState } from 'react';
import { MessageSquareText, Table2 } from 'lucide-react';
import type { AIProject, BibliographyCoverage, CourseDeskPhaseId, DeskPhase, DeskScheduleRow, ProjectDeskModel } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { DeskSection, EmptyState, deskSectionId, useDeskText } from './primitives';
import { SourcesSection } from './SourcesSection';
import { CourseChargeSection } from './course/CourseChargeSection';
import { CourseCalendarSection } from './course/CourseCalendarSection';
import { CourseWorksTable } from './course/CourseWorksTable';
import { CourseFeedbackSection } from './course/CourseFeedbackSection';
import { CourseFeedbackDialog } from './course/CourseFeedbackDialog';
import { CourseImportDialog } from './course/CourseImportDialog';
import { useCourseOps } from './course/useCourseOps';

interface CourseDeskSectionsProps {
    project: AIProject;
    desk: ProjectDeskModel;
    /**
     * Opcional: la entrega cuya devolución se está registrando, controlada
     * desde afuera (el «Ahora» `recordFeedback` del recorrido abre el mismo
     * diálogo). Sin estas dos props, la sección lo maneja sola.
     */
    feedbackEntryId?: string | null;
    onFeedbackEntryChange?: (entryId: string | null) => void;
}

/**
 * Las secciones del escritorio del Curso, en el orden del recorrido
 * (`docs/FASE_ESCRITORIO_PROYECTO_2026-10.md` §9.1): lo que pide el curso →
 * fuentes → calendario → la mesa de trabajos → devolución y aprendizaje.
 * Cada una lleva `id="fase-<id>"` para que el recorrido salte a ella.
 *
 * En un curso, lo que forma no es una idea central: es lo que corrige el
 * profesor y cómo cambia el trabajo siguiente.
 */
export function CourseDeskSections({ project, desk, feedbackEntryId, onFeedbackEntryChange }: CourseDeskSectionsProps) {
    const { t } = useTranslation('projectDeskCourse');
    const deskText = useDeskText();
    const { run, pending } = useCourseOps(project.id);
    const [propio, setPropio] = useState<string | null>(null);
    const controlado = feedbackEntryId !== undefined;
    const feedbackFor = controlado ? feedbackEntryId : propio;
    const setFeedbackFor = (id: string | null) => { if (!controlado) setPropio(id); onFeedbackEntryChange?.(id); };
    const [importOpen, setImportOpen] = useState(false);
    const course = desk.course;
    if (desk.type !== 'course' || !course) return null;

    const fase = (id: CourseDeskPhaseId): { phase: DeskPhase | undefined; number: number } => {
        const i = desk.phases.findIndex(p => p.id === id);
        return { phase: desk.phases[i], number: i >= 0 ? i + 1 : 0 };
    };
    const encabezado = (id: CourseDeskPhaseId) => {
        const { phase, number } = fase(id);
        return {
            id: deskSectionId(id),
            phase: number || undefined,
            title: t(`phase.${id}.title`),
            description: t(`phase.${id}.description`),
            status: phase?.status,
            evidence: phase ? deskText(phase.evidence) : undefined,
            'data-testid': `desk-section-${id}`,
        };
    };

    const marcarEntregado = (r: DeskScheduleRow, entregado: boolean) =>
        void run(
            { ops: [entregado ? { op: 'markDelivered', entryId: r.entryId } : { op: 'unmarkDelivered', entryId: r.entryId }] },
            entregado ? 'toast.delivered' : 'toast.undelivered',
        );
    const abrirDevolucion = (r: DeskScheduleRow) => setFeedbackFor(r.entryId);
    const entradaDevolucion = feedbackFor ? (project.courseSchedule ?? []).find(e => e.id === feedbackFor) ?? null : null;
    const fuentes = fase('sources');

    return (
        <>
            <DeskSection {...encabezado('charge')}>
                <CourseChargeSection project={project} course={course} />
            </DeskSection>

            <SourcesSection projectId={project.id} sources={course.sources} phase={fuentes.phase} phaseNumber={fuentes.number || 2} title={t('phase.sources.title')}>
                {course.sources.requiredToAcquire.length > 0 && (
                    // Las obligatorias primero: la fase 2 del curso las espera conseguidas.
                    <div className="space-y-1" data-testid="course-required-to-acquire">
                        <p className="text-xs font-medium text-foreground">{t('sources.requiredTitle')}</p>
                        <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                            {course.sources.requiredToAcquire.map(r => <li key={r.entryId}>{r.title}</li>)}
                        </ul>
                    </div>
                )}
                {course.sources.coverage && course.sources.coverage.rows.length > 0 && (
                    <CoverageByWorkType coverage={course.sources.coverage} />
                )}
            </SourcesSection>

            <DeskSection {...encabezado('calendar')}>
                <CourseCalendarSection project={project} course={course} desk={desk} run={run} saving={pending} />
            </DeskSection>

            <DeskSection
                {...encabezado('works')}
                isEmpty={course.workTypes.length === 0}
                empty={<EmptyState icon={Table2} title={t('works.emptyTitle')}>{t('works.noWorkTypes')}</EmptyState>}
            >
                <CourseWorksTable
                    project={project}
                    course={course}
                    onMarkDelivered={marcarEntregado}
                    onRecordFeedback={abrirDevolucion}
                    onImport={() => setImportOpen(true)}
                    saving={pending}
                />
            </DeskSection>

            <DeskSection
                {...encabezado('feedback')}
                isEmpty={course.schedule.rows.length === 0 && course.feedback.patterns.length === 0}
                empty={<EmptyState icon={MessageSquareText} title={t('feedback.emptyTitle')}>{t('feedback.empty')}</EmptyState>}
            >
                <CourseFeedbackSection project={project} course={course} run={run} onRecordFeedback={abrirDevolucion} saving={pending} />
            </DeskSection>

            <CourseFeedbackDialog
                entry={entradaDevolucion}
                patterns={project.feedbackPatterns ?? []}
                open={!!entradaDevolucion}
                onOpenChange={o => { if (!o) setFeedbackFor(null); }}
                onSubmit={(ops, key) => run({ ops }, key)}
                saving={pending}
            />
            <CourseImportDialog project={project} open={importOpen} onOpenChange={setImportOpen} />
        </>
    );
}

/**
 * La cobertura de las fuentes por tipo de trabajo (§9.1: «la cobertura se
 * muestra por tipo de trabajo»), con lo que piden sus rúbricas.
 */
function CoverageByWorkType({ coverage }: { coverage: BibliographyCoverage }) {
    const { t } = useTranslation('projectDeskCourse');
    const { t: tx } = useTranslation('exegesis');
    return (
        <div className="space-y-1" data-testid="course-sources-coverage">
            <p className="text-xs font-medium text-foreground">{t('sources.coverageTitle')}</p>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
                {coverage.rows.map(r => (
                    <li key={r.sourceType}>
                        <span className="text-foreground">{tx(`sourceTypes.${r.sourceType}.label`)}</span>
                        {' · '}
                        {t(r.approved >= r.minimum ? 'sources.coverageMet' : 'sources.coverageMissing', { approved: r.approved, minimum: r.minimum })}
                        {r.requiredBy.length > 0 && <> · {r.requiredBy.map(w => `${w.workType || t('sources.coverageProject')} ≥ ${w.minimum}`).join(', ')}</>}
                    </li>
                ))}
            </ul>
        </div>
    );
}
