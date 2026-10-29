import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import type { CourseScheduleEntry, FeedbackCorrection, FeedbackPattern } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { DIALOG, DIALOG_BODY, DIALOG_FOOTER, DIALOG_HEADER, TOUCH, anchorLabel, langOf, studyUrl } from './courseDeskFormat';

interface CourseFeedbackSummaryProps {
    entry: CourseScheduleEntry | null;
    patterns: ReadonlyArray<FeedbackPattern>;
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Abre el editor de la devolución. */
    onEdit: () => void;
}

/** El orden de lectura: por página impresa (los números primero, en orden), y sin página al final. */
export function byPage(a: FeedbackCorrection, b: FeedbackCorrection): number {
    const n = (c: FeedbackCorrection) => {
        const p = c.anchor?.page?.trim() ?? '';
        const m = /^(?:h\.\s?)?(\d{1,4})$/.exec(p);
        return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
    };
    return n(a) - n(b);
}

/**
 * La devolución de una entrega, para leerla (fundador, 2026-10-29: «existe
 * el editor, pero no una vista que resuma la entrega»). Lo que dice el
 * profesor, la nota y cada observación con dónde la hizo, separadas en lo
 * que corrige y lo que hay que mantener. Para cambiar algo, el editor.
 */
export function CourseFeedbackSummary({ entry, patterns, projectId, open, onOpenChange, onEdit }: CourseFeedbackSummaryProps) {
    const { t, i18n } = useTranslation('projectDeskCourse');
    const lang = langOf(i18n?.language);
    const feedback = entry?.feedback;
    if (!entry || !feedback) return null;

    const porId = new Map(patterns.map(p => [p.id, p]));
    const esFortaleza = (c: FeedbackCorrection) => porId.get(c.patternId)?.kind === 'strength';
    const correcciones = feedback.corrections.filter(c => !esFortaleza(c)).sort(byPage);
    const fortalezas = feedback.corrections.filter(esFortaleza).sort(byPage);
    const fecha = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' }) : null);
    const entregado = fecha(entry.deliveredAt);
    const devuelto = fecha(feedback.receivedAt);

    const lista = (titulo: string, items: FeedbackCorrection[], testId: string) => (
        <section aria-labelledby={`${testId}-title`} className="space-y-2" data-testid={testId}>
            <h3 id={`${testId}-title`} className="text-sm font-medium text-foreground">
                {titulo} <span className="font-normal text-muted-foreground">· {items.length}</span>
            </h3>
            {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('feedbackSummary.none')}</p>
            ) : (
                <ol className="space-y-2">
                    {items.map(c => {
                        const donde = anchorLabel(c.anchor, t, 140);
                        return (
                            <li key={c.id} className="rounded-lg border border-border bg-card p-3">
                                <p className="text-sm text-foreground">{c.note?.trim() || porId.get(c.patternId)?.name}</p>
                                {donde && <p className="mt-1 text-xs text-muted-foreground">{donde}</p>}
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                    {t('feedbackSummary.pattern', { name: porId.get(c.patternId)?.name ?? '—' })}
                                </p>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn(DIALOG, 'sm:max-w-2xl')}>
                <DialogHeader className={DIALOG_HEADER}>
                    <DialogTitle>{t('feedbackSummary.title', { label: entry.label })}</DialogTitle>
                    <DialogDescription>
                        {[
                            entregado ? t('feedbackSummary.delivered', { date: entregado }) : null,
                            devuelto ? t('feedbackSummary.returned', { date: devuelto }) : null,
                            feedback.grade ? t('feedbackSummary.grade', { grade: feedback.grade }) : null,
                        ].filter(Boolean).join(' · ')}
                    </DialogDescription>
                </DialogHeader>
                <div className={cn(DIALOG_BODY, 'space-y-5')} data-testid="feedback-summary-dialog">
                    {feedback.text.trim() && (
                        <section aria-labelledby="feedback-summary-text" className="space-y-1">
                            <h3 id="feedback-summary-text" className="text-sm font-medium text-foreground">{t('feedbackSummary.professorText')}</h3>
                            <p className="whitespace-pre-line text-sm text-muted-foreground">{feedback.text}</p>
                        </section>
                    )}
                    {lista(t('feedbackSummary.corrections'), correcciones, 'feedback-summary-corrections')}
                    {lista(t('feedbackSummary.strengths'), fortalezas, 'feedback-summary-strengths')}
                </div>
                <DialogFooter className={DIALOG_FOOTER}>
                    {entry.paperId && (
                        <Button asChild variant="ghost" className={TOUCH}>
                            <Link to={studyUrl(entry.paperId, projectId)}>{t('feedbackSummary.openWork')}</Link>
                        </Button>
                    )}
                    <Button variant="outline" className={TOUCH} onClick={onEdit}>
                        <Pencil className="mr-1.5 h-4 w-4" aria-hidden />{t('feedbackSummary.edit')}
                    </Button>
                    <Button className={TOUCH} onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
