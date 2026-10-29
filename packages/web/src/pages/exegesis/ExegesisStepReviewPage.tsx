import { useMemo, useState } from 'react';
import { rutaCalibracion } from '@/lib/rutaCalibracion';
import { paginaHallada } from '@/components/exegesis/review/paginaHallada';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { findInlineCitations, formatPassageReference, isProsePath, type CitationStatus, type SupportedLanguage } from '@dosfilos/domain';
import { citaDeLaProsa } from '@/components/exegesis/review/citaDeLaProsa';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useExegesisPaper } from '@/hooks/exegesis/useExegesisPaper';
import { CanonicalAnalysisStudyView } from '@/components/exegesis/canonical/CanonicalAnalysisStudyView';
import { CitationSourceModal, type CitationTarget } from '@/components/exegesis/citation/CitationSourceModal';
import { CitationEvidencePanel } from '@/components/exegesis/review/CitationEvidencePanel';
import { CitationStatusBadge } from '@/components/exegesis/review/CitationStatusBadge';
import { useStepReview } from '@/components/exegesis/review/useStepReview';
import { OrphanCitationKeysNotice } from '@/components/exegesis/review/OrphanCitationKeysNotice';
import { CitationLabel } from '@/components/exegesis/citation/CitationLabel';
import { ProsaConVeredictos } from '@/components/exegesis/review/ProsaConVeredictos';
import { UnreadableOriginalNotice } from '@/components/exegesis/review/UnreadableOriginalNotice';

// «Página no comprobable» bloquea aceptar y no tenía filtro (TP #8, D5).
const FILTERS: ReadonlyArray<CitationStatus> = ['not-found', 'page-unverifiable', 'page-mismatch', 'fuzzy-low', 'manual-pending', 'verified'];

/**
 * Revisar las citas de un paso antes de aceptarlo.
 *
 * A la izquierda, la prosa (lo que va al Word) y debajo el análisis, cada
 * cita marcada con su veredicto; a la derecha, la evidencia de la cita
 * elegida y la decisión humana. Es página
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
    // Las claves del corpus, para reconocer la segunda mano al diagnosticar (D4).
    const claves = useMemo(() => paper.sources.map(s => s.citationKey?.trim()).filter((k): k is string => !!k), [paper.sources]);
    const { t } = useTranslation('exegesis');
    const r = useStepReview(paper, step);
    const title = step.verseRef ? formatPassageReference(step.verseRef, lang) : t(`detail.steps.kind.${step.kind}`);
    const selectedVerdict = r.selectedPath ? r.verdicts.get(r.selectedPath) ?? null : null;
    const selectedReview = r.selectedPath ? r.reviews.get(r.selectedPath) ?? null : null;
    const selectedClaim = r.selectedPath ? r.claims.get(r.selectedPath) ?? null : null;
    const prosa = r.version?.markdown?.trim() ? r.version.markdown : null;
    const reviewedPaths = useMemo(() => new Set(r.reviews.keys()), [r.reviews]);
    // «Editar contenido aceptado» hereda la fecha de verificación y borra los
    // veredictos de la prosa: con fecha y sin veredictos, la prosa cambió y
    // hay que volver a verificar (revisión de B41).
    const avisoDeLaProsa = useMemo(() => {
        if (!prosa || findInlineCitations(prosa, claves).length === 0) return null;
        if (!r.verifiedAt) return 'canonical.review.prose.notVerified';
        return [...r.verdicts.keys()].some(isProsePath) ? 'canonical.review.prose.subtitle' : 'canonical.review.prose.needsVerify';
    }, [prosa, claves, r.verifiedAt, r.verdicts]);
    // La numeración se arregla en la biblioteca, sobre el recurso de la
    // fuente citada: sin el enlace, «puede ser la calibración» es un
    // diagnóstico sin puerta.
    const calibrationPath = (() => {
        if (!selectedClaim) return null;
        const source = paper.sources.find(s => (s.citationKey ?? s.displayLabel) === selectedClaim.sourceKey);
        const resourceId = source?.sourceLibraryResourceId ?? source?.corpusId;
        return resourceId ? rutaCalibracion(resourceId) : null;
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
        // Se resalta la oración citada, o, en una paráfrasis, el tramo de la
        // fuente que el verificador halló (D3/D6).
        const resaltar = claim?.verbatimQuote ?? selectedVerdict?.supportingSpan?.text ?? null;
        if (claim) {
            setOpenCitation({ sourceKey: claim.sourceKey, page: claim.page, pageKind: claim.pageKind, locator: claim.locator, verbatimQuote: resaltar });
            return;
        }
        // Una cita de la prosa no tiene afirmación en el análisis: se abre por
        // su veredicto (D5).
        const desdeVeredicto = selectedVerdict ? citaDeLaProsa(selectedVerdict) : null;
        if (desdeVeredicto) setOpenCitation({ ...desdeVeredicto, verbatimQuote: resaltar });
    };
    // La página donde el verificador halló el apoyo, con la misma frase
    // resaltada: si está ahí, se ve (fase F).
    const openFound = () => {
        const claim = r.selectedPath ? r.claims.get(r.selectedPath) : null;
        const hallada = selectedVerdict ? paginaHallada(selectedVerdict) : null;
        const base = claim
            ? { sourceKey: claim.sourceKey, page: claim.page, pageKind: claim.pageKind, locator: claim.locator }
            : selectedVerdict ? citaDeLaProsa(selectedVerdict) : null;
        if (!base || !hallada) return;
        setOpenCitation({
            ...base,
            verbatimQuote: claim?.verbatimQuote ?? selectedVerdict?.supportingSpan?.text ?? null,
            openAt: { page: hallada.page, pageKind: hallada.pageKind },
        });
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
                        {/* Lo revisado a mano se cuenta aparte: quedarse sin
                            observaciones porque se revisaron todas y quedarse
                            sin ellas porque nunca hubo son dos estados
                            distintos, y el contador solo no los separa. */}
                        {r.reviewedCount > 0 && (
                            <span className="text-[11px] text-muted-foreground">
                                {t('canonical.review.reviewedCount', { count: r.reviewedCount })}
                            </span>
                        )}
                        {r.proseAlarmCount > 0 && <span className="text-[11px] text-muted-foreground">{t('canonical.review.proseNotBlocking', { count: r.proseAlarmCount })}</span>}
                        {r.blocking.length > 0 ? (
                            <span className="ml-auto text-xs text-destructive">{t('canonical.review.blocking', { count: r.blocking.length })}</span>
                        ) : r.reviewedCount > 0 && r.listed.length === 0 ? (
                            <span className="ml-auto inline-flex items-center gap-1 text-xs text-success">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {t('canonical.review.allReviewed')}
                            </span>
                        ) : null}
                    </div>
                )}

                <OrphanCitationKeysNotice paper={paper} analysis={r.analysis} />

                <UnreadableOriginalNotice claims={r.unreadableOriginal} onSelect={select} />

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
                    <main className="space-y-6 min-w-0">
                        {/* La prosa primero: es lo que va al Word, y sus citas
                            también se verifican (TP #9, B41). */}
                        {prosa && (
                            <section className="rounded-2xl border border-border bg-card p-6" aria-labelledby="revision-prosa">
                                <h2 id="revision-prosa" className="mb-1 text-sm font-semibold text-foreground">{t('canonical.review.prose.title')}</h2>
                                {avisoDeLaProsa && (
                                    <p className={avisoDeLaProsa === 'canonical.review.prose.needsVerify' ? 'mb-4 text-[11px] text-warning-subtle-foreground' : 'mb-4 text-[11px] text-muted-foreground'}>{t(avisoDeLaProsa)}</p>
                                )}
                                <ProsaConVeredictos markdown={prosa} verdicts={r.verdicts} reviewed={reviewedPaths} selectedPath={r.selectedPath} onSelect={select} />
                            </section>
                        )}
                        {(r.analysis || !prosa) && (
                            <section className="rounded-2xl border border-border bg-card p-6" aria-labelledby={r.analysis && prosa ? 'revision-analisis' : undefined}>
                                {r.analysis ? (
                                    <>
                                        {prosa && <h2 id="revision-analisis" className="mb-4 text-sm font-semibold text-foreground">{t('canonical.review.analysisTitle')}</h2>}
                                        <CanonicalAnalysisStudyView
                                            analysis={r.analysis}
                                            marks={{ verdicts: r.verdicts, reviewed: reviewedPaths, selectedPath: r.selectedPath, onSelect: select }}
                                        />
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground">{t('canonical.review.noAnalysis')}</p>
                                )}
                            </section>
                        )}
                    </main>

                    <aside className="space-y-4 lg:sticky lg:top-6">
                        <CitationEvidencePanel
                            path={r.selectedPath}
                            knownAuthors={claves}
                            verdict={selectedVerdict}
                            review={selectedReview}
                            isReviewing={r.isReviewing}
                            onReview={r.review}
                            onOpenSource={openSource}
                            onOpenFound={openFound}
                        />
                        {r.listed.length > 0 && (
                            <nav className="rounded-xl border border-border bg-card p-3 space-y-1" aria-label={t('canonical.review.listTitle')}>
                                <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground px-1">{t('canonical.review.listTitle')}</p>
                                {r.listed.map(([path, v]) => (
                                    <button key={path} type="button" onClick={() => select(path)}
                                        className={`w-full text-left rounded-md px-2 py-1.5 text-xs hover:bg-accent ${r.selectedPath === path ? 'bg-accent' : ''}`}>
                                        <CitationLabel citation={v} />
                                        {isProsePath(path) && <span className="ml-1 rounded-full border border-border px-1.5 text-[10px] text-muted-foreground">{t('canonical.review.inProse')}</span>}
                                        {r.claims.get(path)?.unverifiedQuote && <span className="ml-1 rounded-full border border-warning/40 px-1.5 text-[10px] text-warning-subtle-foreground">{t('canonical.review.unverifiedQuoteBadge')}</span>}
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
                        knownAuthors={claves}
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
