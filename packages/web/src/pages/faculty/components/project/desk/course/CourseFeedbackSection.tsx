import { useState } from 'react';
import { BookMarked, Check } from 'lucide-react';
import { isRecurringPattern, type AIProject, type CourseDesk, type DeskPatternRow, type DeskScheduleRow } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { WRAP_LABEL } from '../primitives';
import { CourseDiscardDialog } from './CourseDiscardDialog';
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

    const reabrir = (p: DeskPatternRow) =>
        void ops.run({ ops: [{ op: 'decidePattern', patternId: p.patternId, decision: 'pending' }] }, 'toast.patternReopened');
    // Descartar exige la razón (sin ella, el dominio no hace nada): un descarte mudo esconde lo que corrige el profesor.
    const descartar = (p: DeskPatternRow, reason: string) =>
        ops.run({ ops: [{ op: 'decidePattern', patternId: p.patternId, decision: 'discarded', reason }] }, 'toast.patternDiscarded');

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
                {f.patterns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('feedback.patternsEmpty')}</p>
                ) : (
                    <ul className="divide-y divide-border/60 rounded-lg border border-border">
                        {f.patterns.map(p => {
                            const repite = isRecurringPattern(p);
                            return (
                                <li key={p.patternId} data-testid="course-pattern-row" className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                                    <div className="min-w-0 flex-1">
                                        <p className="break-words text-sm font-medium text-foreground">
                                            {p.name}
                                            {repite && p.decision === 'pending' && (
                                                <span className="ml-2 inline-block rounded-full border border-warning/40 bg-warning-subtle px-2 py-0.5 text-[11px] font-normal text-warning-subtle-foreground">{t('feedback.repeats')}</span>
                                            )}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {t('feedback.count', { count: p.corrections })}
                                            {' · '}
                                            {t('feedback.inEntries', { count: p.entries.length })}
                                            {p.entries.length > 0 && <> · {p.entries.map(e => e.label).filter(Boolean).join(', ')}</>}
                                        </p>
                                        {p.decision === 'discarded' && p.discardReason && (
                                            <p className="break-words text-xs text-muted-foreground" data-testid="course-pattern-reason">
                                                {t('feedback.discardedBecause', { reason: p.discardReason })}
                                            </p>
                                        )}
                                    </div>
                                    {p.decision === 'pending' ? (
                                        <div className="flex flex-wrap gap-2">
                                            <Button size="sm" variant="outline" className={TOUCH} disabled={saving} onClick={() => setParaGuia(p)} aria-label={t('feedback.toGuideLabel', { name: p.name })}>
                                                <BookMarked className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                                {t('feedback.toGuide')}
                                            </Button>
                                            <Button size="sm" variant="ghost" className={TOUCH} disabled={saving} onClick={() => setDescartando(p)} aria-label={t('feedback.discardLabel', { name: p.name })}>
                                                {t('feedback.discard')}
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={cn(
                                                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                                                p.decision === 'guide' ? 'border-success/30 bg-success-subtle text-success-subtle-foreground' : 'border-border text-muted-foreground',
                                            )}>
                                                {p.decision === 'guide' && <Check className="h-3 w-3" aria-hidden />}
                                                {t(p.decision === 'guide' ? 'feedback.decided.guide' : 'feedback.decided.discarded')}
                                            </span>
                                            <Button size="sm" variant="ghost" className={TOUCH} disabled={saving} onClick={() => reabrir(p)} aria-label={t('feedback.reopenLabel', { name: p.name })}>
                                                {t('feedback.reopen')}
                                            </Button>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
                {f.patterns.some(p => p.decision === 'guide') && <p className="text-xs text-muted-foreground">{t('feedback.reopenGuideHint')}</p>}
            </div>

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
