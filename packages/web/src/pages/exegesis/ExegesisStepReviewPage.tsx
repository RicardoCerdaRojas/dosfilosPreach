import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { formatPassageReference, type CitationStatus, type SupportedLanguage } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useExegesisPaper } from '@/hooks/exegesis/useExegesisPaper';
import { CanonicalAnalysisStudyView } from '@/components/exegesis/canonical/CanonicalAnalysisStudyView';
import { CitationSourceModal, type CitationTarget } from '@/components/exegesis/citation/CitationSourceModal';
import { CitationEvidencePanel } from '@/components/exegesis/review/CitationEvidencePanel';
import { CitationStatusBadge } from '@/components/exegesis/review/CitationStatusBadge';
import { useStepReview } from '@/components/exegesis/review/useStepReview';

const FILTERS: ReadonlyArray<CitationStatus> = ['not-found', 'page-mismatch', 'fuzzy-low', 'manual-pending', 'verified'];

/**
 * Revisar las citas de un paso antes de aceptarlo.
 *
 * A la izquierda, el análisis con cada cita marcada con su veredicto; a la
 * derecha, la evidencia de la cita elegida y la decisión humana. Es página
 * y no diálogo por lo mismo que el selector de hojas: dieciséis veredictos
 * con sus notas y el libro abierto al lado no entran en un recuadro.
 */
export function ExegesisStepReviewPage() {
    const { paperId, stepId } = useParams<{ paperId: string; stepId: string }>();
    const { t, i18n } = useTranslation('exegesis');
    const lang: SupportedLanguage = i18n.language?.split('-')[0] === 'en' ? 'en' : 'es';
    const { paper, isLoading } = useExegesisPaper(paperId);
    const step = paper?.steps.find(s => s.id === stepId) ?? null;
    const [openCitation, setOpenCitation] = useState<CitationTarget | null>(null);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('paperSetup.loading')}
            </div>
        );
    }
    if (!paper || !step) {
        return (
            <div className="max-w-3xl mx-auto px-6 py-12 text-center text-sm text-muted-foreground">
                {t('paperSetup.notFound.body')}
            </div>
        );
    }
    return <ReviewBody paper={paper} step={step} lang={lang} openCitation={openCitation} setOpenCitation={setOpenCitation} />;
}

function ReviewBody({ paper, step, lang, openCitation, setOpenCitation }: {
    paper: NonNullable<ReturnType<typeof useExegesisPaper>['paper']>;
    step: NonNullable<ReturnType<typeof useExegesisPaper>['paper']>['steps'][number];
    lang: SupportedLanguage;
    openCitation: CitationTarget | null;
    setOpenCitation: (c: CitationTarget | null) => void;
}) {
    const { t } = useTranslation('exegesis');
    const r = useStepReview(paper, step);
    const title = step.verseRef ? formatPassageReference(step.verseRef, lang) : t(`detail.steps.kind.${step.kind}`);
    const selectedVerdict = r.selectedPath ? r.verdicts.get(r.selectedPath) ?? null : null;
    const selectedReview = r.selectedPath ? r.reviews.get(r.selectedPath) ?? null : null;
    const selectedClaim = r.selectedPath ? r.claims.get(r.selectedPath) ?? null : null;
    // La numeración se arregla en la biblioteca, sobre el recurso de la
    // fuente citada: sin el enlace, «puede ser la calibración» es un
    // diagnóstico sin puerta.
    const calibrationPath = (() => {
        if (!selectedClaim) return null;
        const source = paper.sources.find(s => (s.citationKey ?? s.displayLabel) === selectedClaim.sourceKey);
        const resourceId = source?.sourceLibraryResourceId ?? source?.corpusId;
        return resourceId ? `/library/${resourceId}/numeracion` : null;
    })();

    const select = (path: string) => {
        r.setSelectedPath(path);
        document.getElementById(`cita-${path}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    // Se abre la página que la cita DECLARA, con su tipo (impresa u hoja):
    // es la que el lector va a cotejar. Lo que el verificador halló ya está
    // escrito en el panel.
    const openSource = () => {
        const claim = r.selectedPath ? r.claims.get(r.selectedPath) : null;
        if (!claim) return;
        setOpenCitation({ sourceKey: claim.sourceKey, page: claim.page, pageKind: claim.pageKind, verbatimQuote: claim.verbatimQuote });
    };

    return (
        <div className="flex flex-col h-full bg-background font-sans overflow-y-auto">
            <header className="border-b border-border bg-card px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center gap-3">
                    <Link
                        to={`/dashboard/exegesis/${paper.id}`}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        aria-label={t('paperSetup.backToPaper')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-semibold text-foreground font-serif truncate">
                            {t('canonical.review.title', { step: title })}
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            {r.verifiedAt
                                ? t('canonical.review.verifiedAt', { date: r.verifiedAt.toLocaleString() })
                                : t('canonical.review.notVerified')}
                        </p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={r.verify} disabled={r.isVerifying || !r.version}>
                        {r.isVerifying ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
                        {r.verifiedAt ? t('canonical.verify.dialog.rerun') : t('canonical.verify.button.label')}
                    </Button>
                    {r.canAccept && (
                        <Button type="button" size="sm" onClick={r.accept} disabled={r.isAccepting || r.blocking.length > 0}
                            title={r.blocking.length > 0 ? t('canonical.review.acceptBlockedTooltip', { count: r.blocking.length }) : undefined}>
                            {r.isAccepting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                            {t('canonical.review.accept')}
                        </Button>
                    )}
                </div>
            </header>

            <div className="max-w-7xl w-full mx-auto px-6 py-6 space-y-4">
                {r.verifiedAt && (
                    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('canonical.review.filters')}>
                        <FilterChip active={r.filter === 'all'} onClick={() => r.setFilter('all')} label={t('canonical.review.filterAll')} />
                        {FILTERS.map(status => (
                            <button key={status} type="button" onClick={() => r.setFilter(status)} aria-pressed={r.filter === status}
                                className={r.filter === status ? 'ring-2 ring-ring rounded-full' : 'opacity-80 hover:opacity-100'}>
                                <CitationStatusBadge status={status} count={r.counts[status]} />
                            </button>
                        ))}
                        {r.blocking.length > 0 && (
                            <span className="ml-auto text-xs text-destructive">{t('canonical.review.blocking', { count: r.blocking.length })}</span>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
                    <main className="rounded-2xl border border-border bg-card p-6">
                        {r.analysis ? (
                            <CanonicalAnalysisStudyView
                                analysis={r.analysis}
                                marks={{ verdicts: r.verdicts, reviewed: new Set(r.reviews.keys()), selectedPath: r.selectedPath, onSelect: select }}
                            />
                        ) : (
                            <p className="text-sm text-muted-foreground">{t('canonical.review.noAnalysis')}</p>
                        )}
                    </main>

                    <aside className="space-y-4 lg:sticky lg:top-6">
                        <CitationEvidencePanel
                            path={r.selectedPath}
                            verdict={selectedVerdict}
                            review={selectedReview}
                            isReviewing={r.isReviewing}
                            onReview={r.review}
                            onOpenSource={openSource}
                        />
                        {r.listed.length > 0 && (
                            <nav className="rounded-xl border border-border bg-card p-3 space-y-1" aria-label={t('canonical.review.listTitle')}>
                                <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground px-1">{t('canonical.review.listTitle')}</p>
                                {r.listed.map(([path, v]) => (
                                    <button key={path} type="button" onClick={() => select(path)}
                                        className={`w-full text-left rounded-md px-2 py-1.5 text-xs hover:bg-accent ${r.selectedPath === path ? 'bg-accent' : ''}`}>
                                        <span className="font-mono text-foreground">{v.raw}</span>
                                        <span className="block text-[11px] text-muted-foreground truncate">{v.note}</span>
                                    </button>
                                ))}
                            </nav>
                        )}
                    </aside>
                </div>
            </div>

            <CitationSourceModal
                open={!!openCitation}
                onOpenChange={o => { if (!o) setOpenCitation(null); }}
                paperId={paper.id}
                citation={openCitation}
                aside={viewed => (
                    <CitationEvidencePanel
                        path={r.selectedPath}
                        verdict={selectedVerdict}
                        review={selectedReview}
                        claim={selectedClaim}
                        calibrationPath={calibrationPath}
                        isReviewing={r.isReviewing}
                        onReview={r.review}
                        isCorrecting={r.isCorrecting}
                        onCorrect={r.correct}
                        viewed={viewed}
                        noteFromView={viewed.isAnchor ? null : t('canonical.review.panel.noteFromView', {
                            page: viewed.printed ?? viewed.sheet,
                            sheet: viewed.sheet,
                        })}
                    />
                )}
            />
        </div>
    );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button type="button" onClick={onClick} aria-pressed={active}
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${active ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border hover:bg-accent'}`}>
            {label}
        </button>
    );
}
