import { useMemo, useState } from 'react';
import type { AIProject, CourseDesk, DeskPatternRow, DeskScheduleRow } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { WRAP_LABEL } from '../primitives';
import { CourseDiscardDialog } from './CourseDiscardDialog';
import { CoursePatternRow, observationsByPattern } from './CoursePatternRow';
import { CourseGuideRuleDialog } from './CourseGuideRuleDialog';
import { TOUCH } from './courseDeskFormat';
import type { CourseOpsApi } from './useCourseOps';

interface CourseFeedbackSectionProps {
    project: AIProject;
    course: CourseDesk;
    ops: Pick<CourseOpsApi, 'run' | 'addRule' | 'pending'>;
    onRecordFeedback: (row: DeskScheduleRow) => void;
}

/**
 * Fase 5 · Devolución y aprendizaje (§9.1), la contraparte del registro de
 * la hipótesis: lo que corrige el profesor y cómo cambia el trabajo
 * siguiente. Cada patrón con su conteo y sus entregas, los pendientes
 * primero. Un patrón que se repite (la regla única del dominio,
 * `isRecurringPattern`: en dos entregas distintas o más) se decide: pasa a
 * tu guía (el texto lo escribe el estudiante) o se descarta con su razón.
 *
 * Las fortalezas (lo que el profesor elogió: 12 de 15 comentarios en el TI
 * #1 del Salmo 23) van aparte, «Lo que hay que mantener»: también pasan a
 * la guía, pero no quedan pendientes.
 */
export function CourseFeedbackSection({ project, course, ops, onRecordFeedback }: CourseFeedbackSectionProps) {
    const { t } = useTranslation('projectDeskCourse');
    const [paraGuia, setParaGuia] = useState<DeskPatternRow | null>(null);
    const [descartando, setDescartando] = useState<DeskPatternRow | null>(null);
    const f = course.feedback;
    const saving = ops.pending;
    const esperando = course.schedule.rows.filter(r => r.delivery === 'delivered');
    const tipoDeEntrada = new Map(course.schedule.rows.map(r => [r.entryId, r.workTypeId]));
    const tiposDe = (p: DeskPatternRow) => [...new Set(p.entries.map(e => tipoDeEntrada.get(e.entryId)).filter((x): x is string => !!x))];

    const observaciones = useMemo(() => observationsByPattern(project), [project]);
    const correcciones = f.patterns.filter(p => p.kind !== 'strength');
    const fortalezas = f.patterns.filter(p => p.kind === 'strength');

    const reabrir = (p: DeskPatternRow) =>
        void ops.run({ ops: [{ op: 'decidePattern', patternId: p.patternId, decision: 'pending' }] }, p.kind === 'strength' ? 'toast.strengthReopened' : 'toast.patternReopened');
    // Descartar exige la razón (sin ella, el dominio no hace nada): un descarte mudo esconde lo que corrige el profesor.
    const descartar = (p: DeskPatternRow, reason: string) =>
        ops.run({ ops: [{ op: 'decidePattern', patternId: p.patternId, decision: 'discarded', reason }] }, p.kind === 'strength' ? 'toast.strengthDiscarded' : 'toast.patternDiscarded');
    const fila = (p: DeskPatternRow) => (
        <CoursePatternRow
            key={p.patternId}
            pattern={p}
            observations={observaciones.get(p.patternId) ?? []}
            saving={saving}
            onToGuide={() => setParaGuia(p)}
            onDiscard={() => setDescartando(p)}
            onReopen={() => reabrir(p)}
        />
    );

    return (
        <div className="space-y-4">
            <p className="text-sm text-foreground" data-testid="course-feedback-summary">
                {t('feedback.summary', { delivered: f.delivered, returned: f.returned, none: f.noFeedback })}
            </p>

            {esperando.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">{t('feedback.awaitingTitle')}</h3>
                    <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        {esperando.map(r => (
                            <li key={r.entryId}>
                                <Button size="sm" variant="outline" className={cn(TOUCH, WRAP_LABEL)} onClick={() => onRecordFeedback(r)}>
                                    {t('feedback.recordFor', { label: r.label })}
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">{t('feedback.patternsTitle')}</h3>
                {correcciones.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('feedback.patternsEmpty')}</p>
                ) : (
                    <ul className="divide-y divide-border/60 rounded-lg border border-border">{correcciones.map(fila)}</ul>
                )}
            </div>

            {fortalezas.length > 0 && (
                <div className="space-y-2" data-testid="course-strengths">
                    <h3 className="text-sm font-semibold text-foreground">{t('feedback.strengthsTitle')}</h3>
                    <p className="text-xs text-muted-foreground">{t('feedback.strengthsHint')}</p>
                    <ul className="divide-y divide-border/60 rounded-lg border border-border">{fortalezas.map(fila)}</ul>
                </div>
            )}
            {f.patterns.some(p => p.decision === 'guide') && <p className="text-xs text-muted-foreground">{t('feedback.reopenGuideHint')}</p>}

            <CourseGuideRuleDialog
                project={project}
                pattern={paraGuia}
                workTypeIds={paraGuia ? tiposDe(paraGuia) : []}
                open={!!paraGuia}
                onOpenChange={o => { if (!o) setParaGuia(null); }}
                onConfirm={ops.addRule}
                saving={saving}
            />
            <CourseDiscardDialog
                pattern={descartando}
                open={!!descartando}
                onOpenChange={o => { if (!o) setDescartando(null); }}
                onConfirm={descartar}
                saving={saving}
            />
        </div>
    );
}
