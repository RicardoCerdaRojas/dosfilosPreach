import type { ExegeticalStep } from '@dosfilos/domain';
import type { ComposeSectionPrecheckMissing } from '@/components/exegesis/ComposeSectionPrecheckDialog';

/**
 * Lo que falta antes de componer la conclusión o la introducción, o `null`
 * si no falta nada.
 *
 * Bloquea lo que el compositor rechazaría: ningún versículo aceptado, o la
 * introducción sin conclusión aceptada. Con alguno aceptado y otros
 * pendientes, avisa y deja seguir (`blocking: false`): se componía sin decir
 * que esos versículos quedaban fuera (B60, TI #2).
 */
export function composePrecheck(
    allSteps: ReadonlyArray<ExegeticalStep>,
    section: 'conclusion' | 'introduction',
): ComposeSectionPrecheckMissing | null {
    const verses = allSteps.filter(s => s.kind === 'verse');
    const acceptedCount = verses.filter(s => s.accepted?.canonicalAnalysis).length;
    const conclusionMissing = section === 'introduction'
        && !(allSteps.find(s => s.kind === 'conclusion')?.accepted?.markdown?.trim());
    // Un versículo aceptado y vuelto a analizar no falta: el compositor lee
    // la versión aceptada. Avisar que «queda fuera» sería falso.
    const awaitingReview = verses.filter(
        s => s.state === 'awaiting-review' && s.current?.canonicalAnalysis && !s.accepted?.canonicalAnalysis,
    );
    const awaitingReviewIds = new Set(awaitingReview.map(s => s.id));
    const noAnalysis = verses.filter(
        s => !s.accepted?.canonicalAnalysis && !awaitingReviewIds.has(s.id),
    );
    const blocking = acceptedCount === 0 || conclusionMissing;
    if (!blocking && awaitingReview.length === 0 && noAnalysis.length === 0) return null;
    return { awaitingReview, noAnalysis, conclusionMissing, blocking };
}
