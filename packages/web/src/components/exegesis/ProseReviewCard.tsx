import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ClipboardCheck, Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    proseReviewGuidance,
    reviewProseFixed,
    type CanonicalVerseAnalysis,
    type CitationReview,
    type ProseFinding,
    type VerifiedCitation,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useReviewVerseProse } from '@/hooks/exegesis/useReviewVerseProse';

interface ProseReviewCardProps {
    paperId: string;
    stepId: string;
    /** La prosa como se entrega (`applyPageLabelStyle`). */
    prose: string;
    analysis: CanonicalVerseAnalysis | null;
    verdicts: ReadonlyArray<VerifiedCitation>;
    reviews: ReadonlyArray<Pick<CitationReview, 'path'>>;
    sources: ReadonlyArray<{ citationKey?: string | null; displayLabel: string; sourceType: string }>;
    language: 'es' | 'en';
    onRecompose: (guidance: string) => void;
    recomposing: boolean;
    disabled: boolean;
    /** Sin saldo: abre el diálogo de créditos. Devuelve `true` si lo manejó. */
    onQuotaError: (err: unknown) => boolean;
}

/**
 * «Revisión antes de entregar» (TP #8, fase 8b, E3), por versículo.
 *
 * Los controles fijos corren solos, sobre la prosa a la vista. El revisor
 * con los criterios del curso se pide con un botón (es una llamada cobrada).
 * Nada de esto bloquea el Word: avisa, y ofrece recomponer con lo hallado.
 */
export function ProseReviewCard(props: ProseReviewCardProps) {
    const { t } = useTranslation('exegesis');
    const review = useReviewVerseProse();
    const [abierta, setAbierta] = useState(false);

    const claves = useMemo(() => props.sources.map(s => s.citationKey ?? s.displayLabel), [props.sources]);
    const gramaticas = useMemo(
        () => props.sources.filter(s => s.sourceType === 'grammar-syntax' && s.citationKey?.trim()).map(s => s.citationKey!.trim()),
        [props.sources],
    );
    const fijos = useMemo(() => reviewProseFixed({
        prose: props.prose,
        analysis: props.analysis,
        verdicts: props.verdicts,
        reviews: props.reviews,
        citationKeys: claves,
        grammarKeys: gramaticas,
    }), [props.prose, props.analysis, props.verdicts, props.reviews, claves, gramaticas]);

    const resultado = review.data ?? null;
    // Los hallazgos señalan la prosa que se revisó: si cambió, ya no aplican.
    const vigente = resultado !== null && resultado.reviewedMarkdown === props.prose;
    const delRevisor = vigente ? resultado.findings : [];
    const indicacion = proseReviewGuidance(fijos, delRevisor, props.language);
    const total = fijos.length + delRevisor.length;

    const revisar = async () => {
        try {
            await review.mutateAsync({ paperId: props.paperId, stepId: props.stepId });
        } catch (err) {
            if (props.onQuotaError(err)) return;
            console.error('[exegesis] review verse prose failed:', err);
            toast.error(t('canonical.proseReview.toast.failed'));
        }
    };

    return (
        <section className="mt-4 rounded-xl border border-border bg-card" aria-label={t('canonical.proseReview.title')}>
            <button
                type="button"
                onClick={() => setAbierta(a => !a)}
                aria-expanded={abierta}
                className="flex w-full items-center gap-2 px-4 py-3 text-left"
            >
                <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">{t('canonical.proseReview.title')}</span>
                {total > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-warning-subtle-foreground">
                        <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                        {t('canonical.proseReview.count', { count: total })}
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t('canonical.proseReview.clean')}
                    </span>
                )}
                <ChevronDown className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${abierta ? 'rotate-180' : ''}`} />
            </button>

            {abierta && (
                <div className="space-y-3 border-t border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground">{t('canonical.proseReview.subtitle')}</p>

                    {fijos.length > 0 && (
                        <ul className="space-y-1.5">
                            {fijos.map((f, i) => <FixedFinding key={`${f.kind}-${i}`} finding={f} />)}
                        </ul>
                    )}

                    {vigente && (delRevisor.length === 0 ? (
                        <p className="inline-flex items-center gap-1.5 text-xs text-success">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {t('canonical.proseReview.reviewer.clean')}
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {delRevisor.map((f, i) => (
                                <li key={i} className="text-xs">
                                    <span className="font-medium text-foreground">
                                        {t('canonical.proseReview.reviewer.criterion', { number: f.criterion })}
                                    </span>
                                    <span className="text-muted-foreground"> · {resultado!.criteria[f.criterion - 1]}</span>
                                    {f.quote && <span className="block italic text-muted-foreground">«{f.quote}»</span>}
                                    <span className="block text-foreground">{f.problem}</span>
                                    {f.fix && <span className="block text-muted-foreground">→ {f.fix}</span>}
                                </li>
                            ))}
                        </ul>
                    ))}
                    {resultado !== null && !vigente && (
                        <p className="text-[11px] text-muted-foreground">{t('canonical.proseReview.reviewer.stale')}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="outline" onClick={revisar} disabled={props.disabled || review.isPending}>
                            {review.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />}
                            {t(vigente ? 'canonical.proseReview.action.reviewAgain' : 'canonical.proseReview.action.review')}
                        </Button>
                        {indicacion && (
                            <Button size="sm" onClick={() => props.onRecompose(indicacion)} disabled={props.disabled || props.recomposing}>
                                {props.recomposing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1.5 h-3.5 w-3.5" />}
                                {t('canonical.proseReview.action.recompose')}
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}

function FixedFinding({ finding: f }: { finding: ProseFinding }) {
    const { t } = useTranslation('exegesis');
    return (
        <li className="text-xs">
            <span className="text-foreground">
                {t(`canonical.proseReview.fixed.${f.kind}`, { ...(f.data ?? {}), excerpt: f.excerpt })}
            </span>
            {f.excerpt && f.kind !== 'unverified-citation' && f.kind !== 'repeated-alert' && f.kind !== 'repetition' && (
                <span className="block italic text-muted-foreground line-clamp-2">«{f.excerpt}»</span>
            )}
            {f.replacement && <span className="block text-muted-foreground">→ {f.replacement}</span>}
        </li>
    );
}
