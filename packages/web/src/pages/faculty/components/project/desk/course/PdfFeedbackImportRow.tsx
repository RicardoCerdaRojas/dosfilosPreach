import { useId } from 'react';
import { COURSE_NOTE_MAX, FEEDBACK_PATTERN_NAME_MAX, type FeedbackPattern } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { FeedbackKindChoice } from './FeedbackKindChoice';
import { FIELD, TOUCH, anchorLabel } from './courseDeskFormat';
import { importRowProblem, importTarget, withComment, type PdfImportRow } from './pdfImportRows';
import { similarPattern } from './pdfFeedback';

const CHOICES = ['correction', 'strength', 'ignore'] as const;

interface PdfFeedbackImportRowProps {
    row: PdfImportRow;
    n: number;
    patterns: ReadonlyArray<FeedbackPattern>;
    onChange: (row: PdfImportRow) => void;
}

/**
 * Un comentario leído del PDF: dónde lo hizo el profesor, la clase
 * propuesta (cambiable), el nombre del patrón y el comentario como nota.
 * Una marca sin texto pide escribir qué era.
 */
export function PdfFeedbackImportRow({ row, n, patterns, onChange }: PdfFeedbackImportRowProps) {
    const { t } = useTranslation('projectDeskCourse');
    const id = useId();
    const donde = anchorLabel(row.note, t, 140);
    const ignorada = row.choice === 'ignore';
    const destino = importTarget(row, patterns);
    const problema = importRowProblem(row, patterns);
    const parecido = row.choice !== 'ignore' && !destino ? similarPattern(patterns, row.comment, row.choice) : null;
    const sinTexto = row.proposal.reason === 'empty';

    return (
        <li data-testid="pdf-feedback-row" className={cn('space-y-2 rounded-lg border p-2.5', problema ? 'border-warning/50' : 'border-border', ignorada && 'bg-muted/40')}>
            <p id={`${id}-a`} className="break-words text-xs text-muted-foreground" data-testid="pdf-feedback-anchor">{donde}</p>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <FeedbackKindChoice value={row.choice} options={CHOICES} onChange={choice => onChange({ ...row, choice, reuseId: null })} label={t('feedbackDialog.pdf.kindLabel', { n })} />
                <span className="text-[11px] text-muted-foreground">
                    {t(sinTexto ? 'feedbackDialog.pdf.proposalEmpty' : row.proposal.kind === 'strength' ? 'feedbackDialog.pdf.proposalStrength' : 'feedbackDialog.pdf.proposalCorrection')}
                </span>
            </div>
            {!ignorada && (
                <>
                    <label className="block space-y-0.5">
                        <span className={cn('text-[11px]', sinTexto && !row.comment.trim() ? 'font-medium text-warning-subtle-foreground' : 'text-muted-foreground')}>
                            {t(sinTexto ? 'feedbackDialog.pdf.commentEmpty' : 'feedbackDialog.pdf.comment')}
                        </span>
                        <textarea
                            className={`${FIELD} min-h-11 resize-y`}
                            rows={row.comment.length > 90 ? 3 : 2}
                            value={row.comment}
                            maxLength={COURSE_NOTE_MAX}
                            onChange={e => onChange(withComment(row, e.target.value))}
                            // El nombre es el rótulo visible (WCAG 2.5.3); dónde lo hizo, la descripción que distingue las filas.
                            aria-describedby={`${id}-a`}
                            aria-invalid={problema === 'comment' || undefined}
                        />
                    </label>
                    {destino && row.reuseId ? (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-foreground">
                            <span>{t('feedbackDialog.pdf.joins', { name: destino.name })}</span>
                            <Button type="button" size="sm" variant="ghost" className={TOUCH} onClick={() => onChange({ ...row, reuseId: null })}>
                                {t('feedbackDialog.pdf.ownName')}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <label htmlFor={`${id}-n`} className="text-[11px] text-muted-foreground">{t('feedbackDialog.pdf.patternName')}</label>
                            <input
                                id={`${id}-n`}
                                className={FIELD}
                                value={row.name}
                                maxLength={FEEDBACK_PATTERN_NAME_MAX}
                                onChange={e => onChange({ ...row, name: e.target.value, nameTouched: true })}
                                aria-invalid={problema === 'name' || problema === 'clash' || undefined}
                                aria-describedby={`${id}-h`}
                            />
                            <p id={`${id}-h`} className={cn('text-[11px]', problema === 'clash' ? 'font-medium text-warning-subtle-foreground' : 'text-muted-foreground')}>
                                {problema === 'clash'
                                    ? t(row.choice === 'strength' ? 'feedbackDialog.clashCorrection' : 'feedbackDialog.clashStrength', { name: row.name.trim() })
                                    : destino
                                        ? t('feedbackDialog.pdf.sameName', { name: destino.name })
                                        : t('feedbackDialog.pdf.newPatternHint')}
                            </p>
                            {parecido && (
                                <Button type="button" size="sm" variant="outline" className={TOUCH} onClick={() => onChange({ ...row, reuseId: parecido.id })}>
                                    {t('feedbackDialog.pdf.reuse', { name: parecido.name })}
                                </Button>
                            )}
                        </div>
                    )}
                </>
            )}
        </li>
    );
}
