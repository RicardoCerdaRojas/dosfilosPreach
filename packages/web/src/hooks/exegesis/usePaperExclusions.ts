import { useMemo } from 'react';
import {
    noRepeatApplies, previousDeliveries, proposeExclusions, summariesForDeliveryMemory,
    type ExcludedSource, type ExegeticalPaper, type PreviousDelivery, type ProposedExclusion,
} from '@dosfilos/domain';
import { useExegesisPapers } from './useExegesisPapers';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';

/**
 * Los trabajos entre los que se busca la entrega anterior, y si «no repetir»
 * rige para este trabajo (etapa 2): la regla es del curso y la memoria se
 * cuenta dentro del proyecto, más los trabajos sueltos.
 */
export function useDeliveryMemory(paper: Pick<ExegeticalPaper, 'id'> & { projectId?: string | null }) {
    const { papers } = useExegesisPapers();
    const { projects } = useFacultyProjects();
    const proyecto = paper.projectId ? (projects ?? []).find(p => p.id === paper.projectId) ?? null : null;
    const summaries = useMemo(() => summariesForDeliveryMemory(papers ?? [], paper), [papers, paper.projectId]);
    return { summaries, noRepeat: noRepeatApplies(proyecto) };
}

/**
 * La propuesta de exclusiones de un trabajo: lo citado en la entrega
 * anterior, según la regla de su tipo (A7, TP #8), mirando también la
 * entrega de antes para sugerir la otra gramática.
 */
export function useProposedExclusions(paper: Pick<ExegeticalPaper, 'id' | 'displayLanguage'> & { projectId?: string | null }): {
    proposal: ProposedExclusion[];
    previous: PreviousDelivery | null;
} {
    const { summaries, noRepeat } = useDeliveryMemory(paper);
    return useMemo(() => {
        const [previa, anterior] = previousDeliveries(summaries, paper.id, 2);
        return {
            // Sin la regla, no se propone excluir nada; la entrega anterior se sigue mostrando.
            proposal: noRepeat ? proposeExclusions(previa ?? null, paper.displayLanguage, { beforePrevious: anterior ?? null }) : [],
            previous: previa ?? null,
        };
    }, [summaries, noRepeat, paper.id, paper.displayLanguage]);
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
export function usePaperExclusions(paper: Pick<ExegeticalPaper, 'id' | 'excludedSources' | 'displayLanguage'> & { projectId?: string | null }): ReadonlyArray<ExcludedSource> {
    const confirmadas = paper.excludedSources ?? null;
    const { proposal } = useProposedExclusions(paper);
    return confirmadas ?? proposal;
}
