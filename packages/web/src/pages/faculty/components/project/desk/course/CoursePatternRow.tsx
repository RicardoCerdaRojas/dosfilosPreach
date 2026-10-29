import { BookMarked, Check, ChevronRight } from 'lucide-react';
import { isRecurringPattern, type AIProject, type DeskPatternRow, type FeedbackAnchor } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '../primitives';
import { TOUCH, anchorLabel } from './courseDeskFormat';

/** Una observación del profesor, con la entrega donde la hizo. */
export interface PatternObservation {
    id: string;
    entryLabel: string;
    note: string | null;
    anchor: FeedbackAnchor | null;
}

/** Las observaciones de cada patrón, desde las devoluciones del calendario. */
export function observationsByPattern(project: Pick<AIProject, 'courseSchedule'>): Map<string, PatternObservation[]> {
    const out = new Map<string, PatternObservation[]>();
    for (const e of project.courseSchedule ?? []) {
        if (!e.feedback || e.feedback.none) continue;
        for (const c of e.feedback.corrections ?? []) {
            const lista = out.get(c.patternId) ?? [];
            lista.push({ id: `${e.id}:${c.id}`, entryLabel: e.label?.trim() ?? '', note: c.note?.trim() || null, anchor: c.anchor ?? null });
            out.set(c.patternId, lista);
        }
    }
    return out;
}

interface CoursePatternRowProps {
    pattern: DeskPatternRow;
    observations: ReadonlyArray<PatternObservation>;
    saving: boolean;
    onToGuide: () => void;
    onDiscard: () => void;
    onReopen: () => void;
}

/**
 * Un patrón del registro: su conteo, sus entregas y, al abrirlo, cada
 * observación con dónde la hizo el profesor («TP #1 · p. 6 · «Waltke y
 * O'Connor…»»). Una corrección que se repite lleva el aviso; una fortaleza
 * no (no queda pendiente, se repite a propósito).
 */
export function CoursePatternRow({ pattern: p, observations, saving, onToGuide, onDiscard, onReopen }: CoursePatternRowProps) {
    const { t } = useTranslation('projectDeskCourse');
    const fortaleza = p.kind === 'strength';
    const repite = !fortaleza && isRecurringPattern(p);
    return (
        <li data-testid={fortaleza ? 'course-strength-row' : 'course-pattern-row'} className="space-y-1.5 px-3 py-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium text-foreground">
                        {p.name}
                        {repite && p.decision === 'pending' && (
                            <span className="ml-2 inline-block rounded-full border border-warning/40 bg-warning-subtle px-2 py-0.5 text-[11px] font-normal text-warning-subtle-foreground">{t('feedback.repeats')}</span>
                        )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {t(fortaleza ? 'feedback.countStrength' : 'feedback.count', { count: p.corrections })}
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
                        <Button size="sm" variant="outline" className={TOUCH} disabled={saving} onClick={onToGuide} aria-label={t('feedback.toGuideLabel', { name: p.name })}>
                            <BookMarked className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                            {t('feedback.toGuide')}
                        </Button>
                        <Button size="sm" variant="ghost" className={TOUCH} disabled={saving} onClick={onDiscard} aria-label={t('feedback.discardLabel', { name: p.name })}>
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
                        <Button size="sm" variant="ghost" className={TOUCH} disabled={saving} onClick={onReopen} aria-label={t('feedback.reopenLabel', { name: p.name })}>
                            {t('feedback.reopen')}
                        </Button>
                    </div>
                )}
            </div>
            {observations.length > 0 && (
                <details className="group">
                    <summary className={cn('inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-sm text-xs text-primary-text sm:min-h-0 [&::-webkit-details-marker]:hidden', FOCUS_RING)}>
                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" aria-hidden />
                        {t('feedback.observations', { count: observations.length })}
                    </summary>
                    <ul className="mt-1 space-y-1.5 border-l border-border pl-3" aria-label={t('feedback.observationsLabel', { name: p.name })}>
                        {observations.map(o => {
                            const donde = anchorLabel(o.anchor, t);
                            return (
                                <li key={o.id} data-testid="course-pattern-observation" className="break-words text-xs">
                                    <span className="text-muted-foreground">{[o.entryLabel, donde].filter(Boolean).join(' · ')}</span>
                                    {o.note && <span className="block text-foreground">{o.note}</span>}
                                </li>
                            );
                        })}
                    </ul>
                </details>
            )}
        </li>
    );
}
