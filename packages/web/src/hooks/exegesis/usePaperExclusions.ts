import { useMemo } from 'react';
import { previousDeliveries, proposeExclusions, type ExcludedSource, type ExegeticalPaper, type PreviousDelivery, type ProposedExclusion } from '@dosfilos/domain';
import { useExegesisPapers } from './useExegesisPapers';

/**
 * La propuesta de exclusiones de un trabajo: lo citado en la entrega
 * anterior, según la regla de su tipo (A7, TP #8), mirando también la
 * entrega de antes para sugerir la otra gramática.
 */
export function useProposedExclusions(paper: Pick<ExegeticalPaper, 'id' | 'displayLanguage'>): {
    proposal: ProposedExclusion[];
    previous: PreviousDelivery | null;
} {
    const { papers } = useExegesisPapers();
    return useMemo(() => {
        const [previa, anterior] = previousDeliveries(papers, paper.id, 2);
        return {
            proposal: proposeExclusions(previa ?? null, paper.displayLanguage, { beforePrevious: anterior ?? null }),
            previous: previa ?? null,
        };
    }, [papers, paper.id, paper.displayLanguage]);
}

/**
 * Las exclusiones que deben ver las LISTAS del corpus (orden, marca,
 * preselección, confirmación).
 *
 * Confirmadas, las del trabajo. Sin confirmar, lo citado en la entrega
 * anterior como provisorio: si no, quien va directo a «Extraer de mi
 * biblioteca» sin pasar por la tarjeta recibía preseleccionadas las fuentes
 * de la semana pasada, que es exactamente lo que pasó en el TP #6.
 *
 * Los pasos que REDACTAN no usan esto: sólo leen lo confirmado.
 */
export function usePaperExclusions(paper: Pick<ExegeticalPaper, 'id' | 'excludedSources' | 'displayLanguage'>): ReadonlyArray<ExcludedSource> {
    const confirmadas = paper.excludedSources ?? null;
    const { proposal } = useProposedExclusions(paper);
    return confirmadas ?? proposal;
}
