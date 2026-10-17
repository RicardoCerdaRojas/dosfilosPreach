import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { lotesPasados, ordenarCandidatos, type Candidato, type CandidatoCrudo, type LotePasado } from '@/lib/loteReport';

interface Payload {
    dueno: string;
    candidatos: CandidatoCrudo[];
    duenos: Array<{ uid: string; email: string }>;
}

export interface BatchCandidatesData {
    dueno: string;
    duenos: Payload['duenos'];
    candidatos: Candidato[];
    lotes: LotePasado[];
}

/**
 * Los libros de una biblioteca para el reproceso en lote, vía
 * `getBatchCandidates` (super_admin, sólo lectura), diagnosticados y
 * ordenados por `loteReport`. Sin `ownerUid`, la biblioteca propia.
 */
export function useBatchCandidates(ownerUid: string | null) {
    return useQuery<BatchCandidatesData>({
        queryKey: ['admin', 'batchCandidates', ownerUid],
        queryFn: async () => {
            const callable = httpsCallable<{ ownerUid?: string }, Payload>(getFunctions(), 'getBatchCandidates');
            const { data } = await callable(ownerUid ? { ownerUid } : {});
            return {
                dueno: data.dueno,
                duenos: data.duenos ?? [],
                candidatos: ordenarCandidatos(data.candidatos ?? []),
                lotes: lotesPasados(data.candidatos ?? []),
            };
        },
        staleTime: 60_000,
        // Al cambiar de biblioteca, el selector sigue a la vista mientras carga.
        placeholderData: keepPreviousData,
    });
}
