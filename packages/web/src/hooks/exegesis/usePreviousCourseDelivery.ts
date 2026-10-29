import { useMemo } from 'react';
import {
    deliveriesBefore, noRepeatApplies, projectWorkTypes, proposeExclusions, repetitionPolicyForWorkType,
    sourceIdentitiesFromStudies, summariesForDeliveryMemory, summariesOfSameWorkType,
    type AIProject,
    type PassageReference,
} from '@dosfilos/domain';
import { useExegesisPapers } from './useExegesisPapers';

export interface PreviousCourseDelivery {
    /**
     * `off`: «no repetir» no rige en este proyecto (o no hay proyecto);
     * `none`: rige, pero no hay una entrega anterior de este tipo;
     * `found`: la hay. Son avisos distintos (revisión de B4).
     */
    status: 'off' | 'none' | 'found';
    /** El trabajo anterior del mismo tipo, como se llama («TP #8», o su pasaje). */
    title: string | null;
    /** Su pasaje: el encargo que lo trae fijo es el del TP anterior (revisión de B5). */
    passage: PassageReference | null;
    /**
     * Lo que ese trabajo citó y la regla del tipo no deja repetir. `null`: no
     * hay entrega anterior (o «no repetir» no rige en este proyecto).
     */
    restrictedKeys: string[] | null;
}

/**
 * La entrega anterior del mismo tipo de trabajo en el curso, para un trabajo
 * que se está CREANDO: llena el hueco [FUENTES DE LA SEMANA ANTERIOR] del
 * encargo con lo que no se puede repetir (TP #9, B4).
 */
export function usePreviousCourseDelivery(project: AIProject | null, workTypeId: string | null): PreviousCourseDelivery {
    const { papers } = useExegesisPapers();
    return useMemo(() => {
        const sin = { title: null, passage: null, restrictedKeys: null };
        if (!project || !noRepeatApplies(project)) return { status: 'off' as const, ...sin };
        // Sin archivados; y con tipo, sin caer a la lista entera: la primera
        // entrega de un tipo no tiene anterior (revisión de B4).
        const vivos = summariesForDeliveryMemory(papers ?? [], { projectId: project.id }).filter(s => !s.archivedAt);
        const delCurso = workTypeId
            ? summariesOfSameWorkType(vivos, { projectWorkTypeId: workTypeId }, project, { fallbackToAll: false })
            : vivos;
        const previa = deliveriesBefore(delCurso, new Date(), 1)[0] ?? null;
        if (!previa) return { status: 'none' as const, ...sin };
        const tipo = workTypeId ? projectWorkTypes(project).find(t => t.id === workTypeId) ?? null : null;
        const { policy, untyped } = repetitionPolicyForWorkType(tipo);
        // Solo lo prohibido: lo que conviene alternar (la gramática sin regla) se puede repetir.
        const restrictedKeys = proposeExclusions(previa, 'es', { policy, untyped }).filter(e => e.rule === 'exclude').map(e => e.key);
        return { status: 'found' as const, title: previa.title, passage: previa.passage ?? null, restrictedKeys };
    }, [papers, project, workTypeId]);
}

/**
 * Cómo clasificaron y citaron cada libro los trabajos del curso: las fuentes
 * heredadas del estado del arte llegan con tipo y clave (TP #9, B13/B14).
 */
export function useCourseSourceIdentities(projectId: string | null) {
    const { papers } = useExegesisPapers();
    return useMemo(
        () => (projectId ? sourceIdentitiesFromStudies(summariesForDeliveryMemory(papers ?? [], { projectId })) : new Map()),
        [papers, projectId],
    );
}
