import { useId } from 'react';
import { X } from 'lucide-react';
import { COURSE_NOTE_MAX, FEEDBACK_ANCHOR_PAGE_MAX, FEEDBACK_ANCHOR_QUOTE_MAX, FEEDBACK_PATTERN_NAME_MAX, type FeedbackPattern } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { FeedbackKindChoice } from './FeedbackKindChoice';
import { FIELD } from './courseDeskFormat';
import { NUEVO, nameClash, patternsOfKind, withKind, type CorrectionRow } from './feedbackRows';

const KINDS = ['correction', 'strength'] as const;

interface FeedbackCorrectionRowProps {
    row: CorrectionRow;
    /** 1, 2, 3…: el número de la fila en los rótulos del lector de pantalla. */
    n: number;
    patterns: ReadonlyArray<FeedbackPattern>;
    onChange: (row: CorrectionRow) => void;
    onRemove: () => void;
}

/**
 * Una observación del registro: su clase (corrección o fortaleza), su
 * patrón (uno de esa clase o uno nuevo por nombre), el detalle y, si se
 * sabe, dónde (página impresa y frase). Las que llegan del PDF entran aquí
 * ya llenas y se editan igual.
 */
export function FeedbackCorrectionRow({ row, n, patterns, onChange, onRemove }: FeedbackCorrectionRowProps) {
    const { t } = useTranslation('projectDeskCourse');
    const id = useId();
    const cambiar = (patch: Partial<CorrectionRow>) => onChange({ ...row, ...patch });
    const choque = nameClash(row, patterns);
    const deLaClase = patternsOfKind(patterns, row.kind);

    return (
        <li data-testid="feedback-correction-row" className="space-y-2 rounded-lg border border-border p-2">
            <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <FeedbackKindChoice
                        value={row.kind}
                        options={KINDS}
                        onChange={k => onChange(withKind(row, k, patterns))}
                        label={t('feedbackDialog.kindLabel', { n })}
                    />
                </div>
                <Button
                    size="sm"
                    variant="ghost"
                    // Compacta: un cuadrado de 44 px, a la derecha; no una franja a todo el ancho en el teléfono.
                    className="h-11 w-11 shrink-0 p-0 sm:h-9 sm:w-9"
                    onClick={onRemove}
                    aria-label={t('feedbackDialog.removeCorrection', { n })}
                >
                    <X className="h-3.5 w-3.5" aria-hidden />
                </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <div className="space-y-1">
                    <label htmlFor={`${id}-p`} className="sr-only">{t('feedbackDialog.pattern', { n })}</label>
                    <select id={`${id}-p`} className={FIELD} value={row.patternId} onChange={e => cambiar({ patternId: e.target.value })}>
                        {deLaClase.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        <option value={NUEVO}>{t('feedbackDialog.newPattern')}</option>
                    </select>
                    {row.patternId === NUEVO && (
                        <>
                            <label htmlFor={`${id}-n`} className="sr-only">{t('feedbackDialog.patternName', { n })}</label>
                            <input
                                id={`${id}-n`}
                                className={FIELD}
                                value={row.patternName}
                                maxLength={FEEDBACK_PATTERN_NAME_MAX}
                                onChange={e => cambiar({ patternName: e.target.value })}
                                placeholder={t('feedbackDialog.patternNamePlaceholder')}
                                aria-invalid={!!choque || undefined}
                                aria-describedby={choque ? `${id}-c` : undefined}
                            />
                            {choque && (
                                <p id={`${id}-c`} className="text-[11px] font-medium text-warning-subtle-foreground">
                                    {t(row.kind === 'strength' ? 'feedbackDialog.clashCorrection' : 'feedbackDialog.clashStrength', { name: choque.name })}
                                </p>
                            )}
                        </>
                    )}
                </div>
                <div>
                    <label htmlFor={`${id}-d`} className="sr-only">{t('feedbackDialog.note', { n })}</label>
                    <textarea
                        id={`${id}-d`}
                        className={`${FIELD} min-h-11 resize-y`}
                        rows={row.note.length > 80 ? 3 : 1}
                        value={row.note}
                        maxLength={COURSE_NOTE_MAX}
                        onChange={e => cambiar({ note: e.target.value })}
                        placeholder={t('feedbackDialog.notePlaceholder')}
                    />
                </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-[7rem_minmax(0,1fr)]">
                <label className="block space-y-0.5">
                    <span className="text-[11px] text-muted-foreground">{t('feedbackDialog.anchorPage')}</span>
                    <input className={FIELD} value={row.page} maxLength={FEEDBACK_ANCHOR_PAGE_MAX} onChange={e => cambiar({ page: e.target.value })} placeholder={t('feedbackDialog.anchorPagePlaceholder')} aria-label={t('feedbackDialog.anchorPageLabel', { n })} />
                </label>
                <label className="block space-y-0.5">
                    <span className="text-[11px] text-muted-foreground">{t('feedbackDialog.anchorQuote')}</span>
                    <input className={FIELD} value={row.quote} maxLength={FEEDBACK_ANCHOR_QUOTE_MAX} onChange={e => cambiar({ quote: e.target.value })} placeholder={t('feedbackDialog.anchorQuotePlaceholder')} aria-label={t('feedbackDialog.anchorQuoteLabel', { n })} />
                </label>
            </div>
        </li>
    );
}
