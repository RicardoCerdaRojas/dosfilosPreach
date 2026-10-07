import { useMemo } from 'react';
import { previousDelivery, proposeExclusions, type ExcludedSource, type ExegeticalPaper } from '@dosfilos/domain';
import { useExegesisPapers } from './useExegesisPapers';

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
export function usePaperExclusions(paper: Pick<ExegeticalPaper, 'id' | 'excludedSources'>): ReadonlyArray<ExcludedSource> {
    const { papers } = useExegesisPapers();
    const confirmadas = paper.excludedSources ?? null;
    return useMemo(
        () => confirmadas ?? proposeExclusions(previousDelivery(papers, paper.id)),
        [confirmadas, papers, paper.id],
    );
}
