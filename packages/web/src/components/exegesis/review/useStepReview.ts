import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
    claimsQuotingUnreadableOriginal,
    collectAnalysisClaims,
    pendingCitationCounts,
    reviewedCitationCount,
    sourcesWithoutOriginalLanguage,
    isUnreviewedCitationsError,
    mapVerdictsByPath,
    unreviewedBlockingCitations,
    type AnalysisClaim,
    type CitationEdit,
    type CitationStatus,
    type ExegeticalPaper,
    type ExegeticalStep,
    type VerifiedCitation,
} from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { selectionAfterReview } from './nextPendingCitation';

export type ReviewFilter = CitationStatus | 'all';

/**
 * Estado y acciones de la página de revisión de un paso.
 *
 * Todo lo derivado sale de la versión que se está revisando: la aceptada si
 * existe, si no la actual. Los veredictos se indexan por ruta para que la
 * vista del análisis y el panel de evidencia hablen de la misma cita.
 */
export function useStepReview(paper: ExegeticalPaper, step: ExegeticalStep) {
    const { t } = useTranslation('exegesis');
    const { verifyStepCitations, reviewCitation, correctCitation, acceptStep } = useExegesisPapers();
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [filter, setFilter] = useState<ReviewFilter>('all');

    const version = step.accepted ?? step.current;
    const analysis = version?.canonicalAnalysis ?? null;

    const verdicts = useMemo(
        () => (analysis ? mapVerdictsByPath(analysis, version?.citationVerdicts ?? []) : new Map<string, VerifiedCitation>()),
        [analysis, version?.citationVerdicts],
    );
    const claims = useMemo(
        () => new Map<string, AnalysisClaim>(analysis ? collectAnalysisClaims(analysis).map(c => [c.path, c]) : []),
        [analysis],
    );
    const reviews = useMemo(
        () => new Map((version?.citationReviews ?? []).map(r => [r.path, r] as const)),
        [version?.citationReviews],
    );
    const blocking = useMemo(
        () => (analysis ? unreviewedBlockingCitations(analysis, version?.citationVerdicts ?? [], version?.citationReviews ?? []) : []),
        [analysis, version?.citationVerdicts, version?.citationReviews],
    );

    /**
     * Formas en lengua original atribuidas a un libro cuyo texto leído no
     * tiene ninguna.
     *
     * No es una sospecha sobre la calidad de la extracción: es que esa forma
     * no pudo salir de ahí. El verificador de citas no puede atraparlo —sale a
     * buscar la afirmación dentro de un texto sin griego, y no encontrar nada
     * ahí es su comportamiento normal—, así que se reporta aparte.
     */
    const sinLenguaOriginal = useMemo(
        () => sourcesWithoutOriginalLanguage(paper.sources.map(s => ({
            citationKey: s.citationKey,
            text: s.excerpts.map(e => e.text).join('\n'),
        }))),
        [paper.sources],
    );
    const unreadableOriginal = useMemo(
        () => (analysis ? claimsQuotingUnreadableOriginal(analysis, sinLenguaOriginal) : []),
        [analysis, sinLenguaOriginal],
    );

    /**
     * Cuántas citas quedan PENDIENTES en cada veredicto.
     *
     * Una cita revisada a mano ya no es una observación: el autor la miró y
     * dejó su decisión escrita. Los contadores la seguían sumando, así que la
     * misma pantalla podía decir «3 citas no encontradas» y a la vez dejar
     * aceptar el paso — porque el bloqueo de aceptación SÍ descuenta las
     * revisadas (`unreviewedBlockingCitations`). Dos derivaciones del mismo
     * dato que no podían tener razón las dos.
     */
    const counts = useMemo(() => pendingCitationCounts(verdicts, new Set(reviews.keys())), [verdicts, reviews]);
    const reviewedCount = useMemo(() => reviewedCitationCount(verdicts, new Set(reviews.keys())), [verdicts, reviews]);

    /**
     * Citas visibles en la lista lateral, en el orden del análisis.
     *
     * El filtro «pendientes» deja fuera lo verificado y lo ya revisado, que es
     * lo que el rótulo promete. Los filtros por veredicto siguen mostrando
     * TODO lo de ese veredicto, revisado incluido: quien entra por ahí busca
     * un caso concreto y esconderle el que ya resolvió sería perderlo.
     */
    const listed = useMemo(
        () => [...verdicts.entries()].filter(([path, v]) => filter === 'all'
            ? v.status !== 'verified' && !reviews.has(path)
            : v.status === filter),
        [verdicts, filter, reviews],
    );

    const verify = async () => {
        if (!version) return;
        try {
            await verifyStepCitations.mutateAsync({ paperId: paper.id, stepId: step.id, versionId: version.id });
        } catch (err) {
            console.error('[exegesis] verify failed:', err);
            toast.error(t('canonical.verify.toast.failed'));
        }
    };

    const review = async (path: string, note: string) => {
        if (!version) return;
        const nueva = !reviews.has(path);
        try {
            await reviewCitation.mutateAsync({ paperId: paper.id, stepId: step.id, versionId: version.id, path, note });
            toast.success(note.trim() ? t('canonical.review.toast.reviewSaved') : t('canonical.review.toast.reviewRemoved'));
            // Revisada la cita, se pasa a la siguiente pendiente: el panel se
            // quedaba en la misma y parecía que no había pasado nada (TP #6).
            setSelectedPath(selectionAfterReview({
                listed: listed.map(([p]) => p), reviewed: new Set(reviews.keys()), path, wasNew: nueva, note,
            }));
        } catch (err) {
            console.error('[exegesis] review citation failed:', err);
            toast.error(t('canonical.review.toast.reviewFailed'));
        }
    };

    /**
     * Corrige la cita elegida y vuelve a verificar solo esa.
     *
     * Lo que se corrige es el análisis guardado, no una nota: el trabajo
     * que se exporte llevará la página nueva.
     */
    const correct = async (path: string, edit: CitationEdit) => {
        if (!version) return;
        try {
            await correctCitation.mutateAsync({ paperId: paper.id, stepId: step.id, versionId: version.id, path, edit });
            toast.success(t(`canonical.review.toast.corrected.${edit.kind}`));
            if (edit.kind === 'remove') setSelectedPath(null);
        } catch (err) {
            console.error('[exegesis] correct citation failed:', err);
            toast.error(t('canonical.review.toast.correctFailed'));
        }
    };

    const accept = async () => {
        if (!step.current) return;
        try {
            await acceptStep.mutateAsync({ paperId: paper.id, stepId: step.id, versionId: step.current.id });
            toast.success(t('detail.steps.toast.accepted'));
        } catch (err) {
            if (isUnreviewedCitationsError(err)) {
                toast.error(t('canonical.review.toast.acceptBlocked', { count: err.paths.length }));
                setSelectedPath(err.paths[0] ?? null);
                return;
            }
            console.error('[exegesis] accept failed:', err);
            toast.error(t('detail.steps.toast.acceptFailed'));
        }
    };

    return {
        version,
        analysis,
        verdicts,
        claims,
        reviews,
        blocking,
        counts,
        reviewedCount,
        unreadableOriginal,
        listed,
        filter,
        setFilter,
        selectedPath,
        setSelectedPath,
        verify,
        review,
        correct,
        accept,
        isVerifying: verifyStepCitations.isPending,
        isReviewing: reviewCitation.isPending,
        isCorrecting: correctCitation.isPending,
        isAccepting: acceptStep.isPending,
        verifiedAt: version?.verifications?.lastRunAt ?? null,
        canAccept: step.state !== 'accepted' && !!step.current,
    };
}
