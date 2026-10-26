import { useState } from 'react';
import { BookMarked, Check } from 'lucide-react';
import type { AIProject, CourseDesk, CourseOp, DeskPatternRow, DeskScheduleRow } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { CourseGuideRuleDialog } from './CourseGuideRuleDialog';
import { TOUCH } from './courseDeskFormat';

interface CourseFeedbackSectionProps {
    project: AIProject;
    course: CourseDesk;
    run: (input: { ops?: CourseOp[] }, successKey?: string) => Promise<boolean>;
    onRecordFeedback: (row: DeskScheduleRow) => void;
    saving: boolean;
}

/**
 * Fase 5 · Devolución y aprendizaje (§9.1), la contraparte del registro de
 * la hipótesis: lo que corrige el profesor y cómo cambia el trabajo
 * siguiente. Cada patrón con su conteo y sus entregas, los pendientes
 * primero. Una corrección que se repite se decide: pasa a la guía (el texto
 * lo confirma el estudiante) o se descarta.
 */
export function CourseFeedbackSection({ project, course, run, onRecordFeedback, saving }: CourseFeedbackSectionProps) {
    const { t } = useTranslation('projectDeskCourse');
    const [paraGuia, setParaGuia] = useState<DeskPatternRow | null>(null);
    const f = course.feedback;
    const esperando = course.schedule.rows.filter(r => r.delivery === 'delivered');
    const tipoDeEntrada = new Map(course.schedule.rows.map(r => [r.entryId, r.workTypeId]));
    const tiposDe = (p: DeskPatternRow) => [...new Set(p.entries.map(e => tipoDeEntrada.get(e.entryId)).filter((x): x is string => !!x))];

    const decidir = (p: DeskPatternRow, decision: 'discarded' | 'pending') =>
        void run({ ops: [{ op: 'decidePattern', patternId: p.patternId, decision }] }, decision === 'discarded' ? 'toast.patternDiscarded' : 'toast.patternReopened');

    return (
        <div className="space-y-4">
            <p className="text-sm text-foreground" data-testid="course-feedback-summary">
                {t('feedback.summary', { delivered: f.delivered, returned: f.returned, noFeedback: f.noFeedback })}
            </p>

            {esperando.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">{t('feedback.awaitingTitle')}</h3>
                    <ul className="flex flex-wrap gap-2">
                        {esperando.map(r => (
                            <li key={r.entryId}>
                                <Button size="sm" variant="outline" className={TOUCH} onClick={() => onRecordFeedback(r)}>
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
                            const repite = p.entries.length >= 2;
                            return (
                                <li key={p.patternId} data-testid="course-pattern-row" className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-foreground">
                                            {p.name}
                                            {repite && p.decision === 'pending' && (
                                                <span className="ml-2 rounded-full border border-warning/40 bg-warning-subtle px-2 py-0.5 text-[11px] font-normal text-warning-subtle-foreground">{t('feedback.repeats')}</span>
                                            )}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {t('feedback.count', { count: p.corrections, entries: p.entries.length })}
                                            {p.entries.length > 0 && <> · {p.entries.map(e => e.label).filter(Boolean).join(', ')}</>}
                                        </p>
                                    </div>
                                    {p.decision === 'pending' ? (
                                        <div className="flex flex-wrap gap-2">
                                            <Button size="sm" variant="outline" className={TOUCH} onClick={() => setParaGuia(p)}>
                                                <BookMarked className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                                {t('feedback.toGuide')}
                                            </Button>
                                            <Button size="sm" variant="ghost" className={TOUCH} disabled={saving} onClick={() => decidir(p, 'discarded')} aria-label={t('feedback.discardLabel', { name: p.name })}>
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
                                            <Button size="sm" variant="ghost" className={TOUCH} disabled={saving} onClick={() => decidir(p, 'pending')} aria-label={t('feedback.reopenLabel', { name: p.name })}>
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
            />
        </div>
    );
}
