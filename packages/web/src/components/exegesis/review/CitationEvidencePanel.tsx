import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, Loader2, MapPin, Undo2 } from 'lucide-react';
import { parsePageRange, type AnalysisClaim, type CitationEdit, type CitationReview, type VerifiedCitation } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { CitationCorrectionActions } from './CitationCorrectionActions';
import { CitationStatusBadge } from './CitationStatusBadge';

interface Props {
    path: string | null;
    verdict: VerifiedCitation | null;
    /** La cita tal como vive en el análisis; sin ella no se puede corregir. */
    claim?: AnalysisClaim | null;
    review: CitationReview | null;
    isReviewing: boolean;
    onReview: (path: string, note: string) => void;
    /** Ausente cuando el panel ya vive junto al PDF. */
    onOpenSource?: () => void;
    /**
     * Frase para anotar «está aquí» con la hoja que el lector tiene
     * delante. Se agrega a la nota, no la reemplaza: lo que ya escribió
     * sigue siendo suyo.
     */
    noteFromView?: string | null;
    /** La hoja que se mira, para proponerla como página correcta. */
    viewed?: { sheet: number; printed: string | number | null; isAnchor: boolean } | null;
    isCorrecting?: boolean;
    onCorrect?: (path: string, edit: CitationEdit) => void;
    /** Adónde ir a arreglar la numeración del libro, si se conoce. */
    calibrationPath?: string | null;
}

/**
 * La evidencia de UNA cita: qué dijo el verificador, dónde encontró apoyo,
 * la oración o paráfrasis cotejada, y la decisión humana.
 *
 * La revisión manual pide motivo. Una marca sin motivo no distingue «miré
 * la página y la cita está bien» de «quería que dejara de bloquear», y la
 * diferencia es todo lo que este panel existe para registrar.
 */
export function CitationEvidencePanel({ path, verdict, claim, review, isReviewing, onReview, onOpenSource, noteFromView, viewed, isCorrecting = false, onCorrect, calibrationPath }: Props) {
    const { t } = useTranslation('exegesis');
    const [note, setNote] = useState(review?.note ?? '');
    useEffect(() => { setNote(review?.note ?? ''); }, [path, review?.note]);

    if (!path || !verdict) {
        return (
            <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                {t('canonical.review.panel.empty')}
            </div>
        );
    }

    const canReview = verdict.status !== 'verified';
    // Un desajuste de una página suele ser la numeración del libro, no la
    // cita: en Ortiz las cinco «página no coincide» de la medición eran
    // todas de un folio y todas del mismo tramo mal calibrado.
    const offByOne = isOffByOne(verdict);

    return (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <header className="space-y-1">
                <CitationStatusBadge status={verdict.status} reviewed={!!review} />
                <p className="font-mono text-sm text-foreground">{verdict.raw}</p>
                {verdict.matchedSourceLabel && (
                    <p className="text-xs text-muted-foreground">{verdict.matchedSourceLabel}</p>
                )}
            </header>

            <dl className="grid grid-cols-2 gap-2 text-xs">
                <dt className="text-muted-foreground">{t('canonical.review.panel.cited')}</dt>
                <dd className="text-foreground tabular-nums">{verdict.pages ? `p. ${verdict.pages}` : '—'}</dd>
                <dt className="text-muted-foreground">{t('canonical.review.panel.found')}</dt>
                <dd className="text-foreground tabular-nums">{verdict.matchedPageLabel || (verdict.matchedPage ? `p. ${verdict.matchedPage}` : '—')}</dd>
            </dl>

            <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                    {verdict.evidenceIsQuoted ? t('canonical.review.panel.quote') : t('canonical.review.panel.claim')}
                </p>
                <blockquote className="border-l-2 border-border pl-3 text-sm italic text-foreground/85 leading-relaxed">
                    {verdict.evidence}
                </blockquote>
            </div>

            {verdict.note && (
                <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">{t('canonical.review.panel.verdict')}</p>
                    <p className="text-sm text-foreground/85 leading-relaxed">{verdict.note}</p>
                </div>
            )}

            {verdict.status === 'page-mismatch' && (
                <p className="rounded-md border border-warning/30 bg-warning-subtle/40 px-3 py-2 text-xs text-warning-subtle-foreground">
                    {offByOne ? t('canonical.review.panel.pageHintCalibration') : t('canonical.review.panel.pageHint')}
                    {offByOne && calibrationPath && (
                        <>
                            {' '}
                            <Link to={calibrationPath} className="underline underline-offset-2 font-medium">
                                {t('canonical.review.panel.pageHintCalibrate')}
                            </Link>
                        </>
                    )}
                </p>
            )}

            {onOpenSource && (
                <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={onOpenSource}>
                        <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                        {t('canonical.review.panel.openPdf')}
                    </Button>
                </div>
            )}

            {claim && onCorrect && (
                <CitationCorrectionActions
                    claim={claim}
                    viewed={viewed}
                    isCorrecting={isCorrecting}
                    onCorrect={edit => onCorrect(path, edit)}
                />
            )}

            {canReview && (
                <div className="space-y-2 border-t border-border pt-3">
                    <label htmlFor="citation-review-note" className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                        {review ? t('canonical.review.panel.reviewedLabel') : t('canonical.review.panel.reviewLabel')}
                    </label>
                    <textarea
                        id="citation-review-note"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        rows={3}
                        disabled={isReviewing}
                        placeholder={t('canonical.review.panel.notePlaceholder')}
                        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y"
                    />
                    {review && (
                        <p className="text-[11px] text-muted-foreground">
                            {t('canonical.review.panel.reviewedOn', { date: review.reviewedAt.toLocaleString() })}
                        </p>
                    )}
                    <div className="flex flex-wrap justify-end gap-2">
                        {noteFromView && (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="mr-auto"
                                disabled={isReviewing}
                                onClick={() => setNote(n => (n.trim() ? `${n.trimEnd()}\n${noteFromView}` : noteFromView))}
                            >
                                <MapPin className="h-3.5 w-3.5 mr-1.5" />
                                {t('canonical.review.panel.useThisPage')}
                            </Button>
                        )}
                        {review && (
                            <Button type="button" size="sm" variant="ghost" onClick={() => onReview(path, '')} disabled={isReviewing}>
                                <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                                {t('canonical.review.panel.remove')}
                            </Button>
                        )}
                        <Button type="button" size="sm" onClick={() => onReview(path, note)} disabled={isReviewing || note.trim().length < 5}>
                            {isReviewing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                            {t('canonical.review.panel.save')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

/** Si lo citado y lo hallado se llevan exactamente una página. */
function isOffByOne(verdict: VerifiedCitation): boolean {
    const cited = parsePageRange(verdict.pages);
    const found = parsePageRange(verdict.matchedPageLabel ?? (verdict.matchedPage !== null ? String(verdict.matchedPage) : null));
    if (!cited || !found) return false;
    return Math.abs(cited.start - found.start) === 1;
}
