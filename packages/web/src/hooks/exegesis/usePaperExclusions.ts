import { useMemo } from 'react';
import {
    noRepeatApplies, previousDeliveries, projectWorkTypes, proposeExclusions, repetitionPolicyForWorkType,
    summariesForDeliveryMemory, summariesOfSameWorkType,
    type ExcludedSource, type ExegeticalPaper, type PreviousDelivery, type ProposedExclusion, type WorkTypeRepetitionPolicy,
} from '@dosfilos/domain';
import { useExegesisPapers } from './useExegesisPapers';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';

type PaperRef = Pick<ExegeticalPaper, 'id'> & { projectId?: string | null; projectWorkTypeId?: string | null };

/**
 * Los trabajos entre los que se busca la entrega anterior, si «no repetir»
 * rige para este trabajo (etapa 2), y con qué regla: la regla es del curso,
 * la memoria se cuenta dentro del proyecto (más los trabajos sueltos) y,
 * con tipo de trabajo, entre los del MISMO tipo (TP #9, B4/B11).
 */
export function useDeliveryMemory(paper: PaperRef) {
    const { papers } = useExegesisPapers();
    const { projects } = useFacultyProjects();
    const proyecto = paper.projectId ? (projects ?? []).find(p => p.id === paper.projectId) ?? null : null;
    const tipo = paper.projectWorkTypeId && proyecto ? projectWorkTypes(proyecto).find(t => t.id === paper.projectWorkTypeId) ?? null : null;
    const summaries = useMemo(
        () => summariesOfSameWorkType(summariesForDeliveryMemory(papers ?? [], paper), paper, proyecto),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [papers, paper.id, paper.projectId, paper.projectWorkTypeId, proyecto?.courseSchedule],
    );
    const repetition: WorkTypeRepetitionPolicy & { workTypeLabel: string | null } = useMemo(
        () => ({ ...repetitionPolicyForWorkType(tipo), workTypeLabel: tipo?.label ?? null }),
        [tipo],
    );
    return { summaries, noRepeat: noRepeatApplies(proyecto), repetition };
}

/**
 * La propuesta de exclusiones de un trabajo: lo citado en la entrega
 * anterior, según la regla de su tipo de trabajo (B15) o la general (A7,
 * TP #8), mirando también la entrega de antes para sugerir la otra gramática.
 */
export function useProposedExclusions(paper: PaperRef & Pick<ExegeticalPaper, 'displayLanguage'>): {
    proposal: ProposedExclusion[];
    previous: PreviousDelivery | null;
    repetition: WorkTypeRepetitionPolicy & { workTypeLabel: string | null };
} {
    const { summaries, noRepeat, repetition } = useDeliveryMemory(paper);
    return useMemo(() => {
        const [previa, anterior] = previousDeliveries(summaries, paper.id, 2);
        return {
            // Sin la regla, no se propone excluir nada; la entrega anterior se sigue mostrando.
            proposal: noRepeat ? proposeExclusions(previa ?? null, paper.displayLanguage, { beforePrevious: anterior ?? null, policy: repetition.policy, untyped: repetition.untyped }) : [],
            previous: previa ?? null,
            repetition,
        };
    }, [summaries, noRepeat, paper.id, paper.displayLanguage, repetition]);
}

/**
 * Las exclusiones que deben ver las LISTAS del corpus (orden, marca,
 * preselección, confirmación).
 *
 * Confirmadas, las del trabajo. Sin confirmar, lo citado en la entrega
 * anterior como provisorio: si no, quien va directo a «Extraer de mi
 * biblioteca» sin pasar por la tarjeta recibía preseleccionadas las fuentes
 * de la semana pasada, que es exactamente lo que pasó en el TP #6. Lo que
 * solo se sugiere alternar (una gramática sin regla del curso) no cuenta:
 * se puede repetir.
 *
 * Los pasos que REDACTAN no usan esto: sólo leen lo confirmado.
 */
export function usePaperExclusions(paper: Pick<ExegeticalPaper, 'id' | 'excludedSources' | 'displayLanguage'> & { projectId?: string | null; projectWorkTypeId?: string | null }): ReadonlyArray<ExcludedSource> {
    const confirmadas = paper.excludedSources ?? null;
    const { proposal } = useProposedExclusions(paper);
    return useMemo(() => confirmadas ?? proposal.filter(e => e.rule === 'exclude'), [confirmadas, proposal]);
}
