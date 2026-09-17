import { useEffect, useState } from 'react';
import { Loader2, MapPin, Quote, Trash2 } from 'lucide-react';
import type { AnalysisClaim, CitationEdit } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';

interface Props {
    claim: AnalysisClaim;
    /** La hoja que el lector tiene delante, cuando el visor está al lado. */
    viewed?: { sheet: number; printed: string | number | null; isAnchor: boolean } | null;
    isCorrecting: boolean;
    onCorrect: (edit: CitationEdit) => void;
}

/** Sitios cuyo esquema guarda la oración textual de la fuente. */
const QUOTABLE = new Set(['commentator', 'crux']);

/**
 * Arreglar la cita, no solo anotarla.
 *
 * Una nota de revisión deja constancia y descarga el bloqueo, pero el
 * trabajo sigue llevando el número equivocado. Estas tres acciones tocan
 * el análisis guardado: la página, la oración textual, o quitar la cita
 * cuando la fuente no sostiene la afirmación.
 *
 * Quitar pide confirmación porque borra una atribución del trabajo; las
 * otras dos son reversibles repitiéndolas.
 */
export function CitationCorrectionActions({ claim, viewed, isCorrecting, onCorrect }: Props) {
    const { t } = useTranslation('exegesis');
    const [quote, setQuote] = useState(claim.verbatimQuote ?? '');
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [showQuote, setShowQuote] = useState(false);
    useEffect(() => {
        setQuote(claim.verbatimQuote ?? '');
        setConfirmRemove(false);
        setShowQuote(false);
    }, [claim.path, claim.verbatimQuote]);

    // La página que propone el botón es la que se está mirando: el folio
    // impreso si el libro está calibrado, y si no la hoja, que es la
    // unidad en que ese libro puede citarse.
    const proposed = viewed && !viewed.isAnchor
        ? (typeof viewed.printed === 'string' ? Number(viewed.printed) : viewed.printed) ?? viewed.sheet
        : null;
    const proposedKind = viewed && viewed.printed !== null ? 'printed' as const : 'sheet' as const;
    const canPropose = proposed !== null && Number.isInteger(proposed) && proposed >= 1;

    return (
        <div className="space-y-2 border-t border-border pt-3">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                {t('canonical.review.correct.title')}
            </p>

            {canPropose && (
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    disabled={isCorrecting}
                    onClick={() => onCorrect({ kind: 'page', page: proposed!, pageKind: proposedKind })}
                >
                    {isCorrecting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5 mr-1.5" />}
                    {t('canonical.review.correct.toThisPage', { page: proposed })}
                </Button>
            )}

            {QUOTABLE.has(claim.site) && (
                showQuote ? (
                    <div className="space-y-2">
                        <label htmlFor="citation-quote" className="text-[11px] text-muted-foreground">
                            {t('canonical.review.correct.quoteLabel')}
                        </label>
                        <textarea
                            id="citation-quote"
                            value={quote}
                            onChange={e => setQuote(e.target.value)}
                            rows={3}
                            disabled={isCorrecting}
                            placeholder={t('canonical.review.correct.quotePlaceholder')}
                            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y"
                        />
                        <div className="flex justify-end gap-2">
                            <Button type="button" size="sm" variant="ghost" onClick={() => setShowQuote(false)} disabled={isCorrecting}>
                                {t('canonical.review.correct.cancel')}
                            </Button>
                            <Button type="button" size="sm" onClick={() => onCorrect({ kind: 'quote', quote })} disabled={isCorrecting}>
                                {t('canonical.review.correct.saveQuote')}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Button type="button" size="sm" variant="outline" className="w-full justify-start" onClick={() => setShowQuote(true)} disabled={isCorrecting}>
                        <Quote className="h-3.5 w-3.5 mr-1.5" />
                        {claim.verbatimQuote ? t('canonical.review.correct.editQuote') : t('canonical.review.correct.addQuote')}
                    </Button>
                )
            )}

            {confirmRemove ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 space-y-2">
                    <p className="text-[11px] text-foreground/85">{t('canonical.review.correct.removeConfirm')}</p>
                    <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmRemove(false)} disabled={isCorrecting}>
                            {t('canonical.review.correct.cancel')}
                        </Button>
                        <Button type="button" size="sm" variant="destructive" onClick={() => onCorrect({ kind: 'remove' })} disabled={isCorrecting}>
                            {t('canonical.review.correct.removeConfirmAction')}
                        </Button>
                    </div>
                </div>
            ) : (
                <Button type="button" size="sm" variant="ghost" className="w-full justify-start text-destructive hover:text-destructive" onClick={() => setConfirmRemove(true)} disabled={isCorrecting}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    {t('canonical.review.correct.remove')}
                </Button>
            )}
        </div>
    );
}
