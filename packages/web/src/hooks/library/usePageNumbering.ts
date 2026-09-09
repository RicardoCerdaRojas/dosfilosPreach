import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    calibrationSheets,
    detectNumberingSegments,
    printedPageIn,
    type PageNumbering,
} from '@dosfilos/domain';
import { fetchDocumentPageIndex } from '@dosfilos/infrastructure';
import { libraryService } from '@dosfilos/application';

/**
 * Numeración impresa de un recurso: la propuesta del detector y el guardado.
 *
 * La propuesta se calcula acá y no en el servidor porque la heurística vive en
 * `domain`, que `packages/functions` no puede importar. Se recalcula sólo si
 * el índice de hojas cambia, es decir casi nunca.
 */
const PROPOSAL_KEY = 'library-page-numbering-proposal';

export interface CalibrationPoint {
    /** Hoja física del archivo, contada desde 1. */
    sheet: number;
    /**
     * Número que el detector cree impreso en esa hoja. `null` cuando no lo
     * dedujo, o cuando la hoja cae en un tramo sin numeración arábiga — y esa
     * es una respuesta válida, no un hueco a rellenar.
     */
    proposed: number | null;
}

export interface NumberingProposal {
    numbering: PageNumbering | null;
    points: CalibrationPoint[];
    lastSheet: number;
}

export function usePageNumberingProposal(resourceId: string | null) {
    return useQuery<NumberingProposal>({
        queryKey: [PROPOSAL_KEY, resourceId],
        enabled: !!resourceId,
        staleTime: Infinity,
        gcTime: 30 * 60 * 1000,
        retry: 1,
        queryFn: async () => {
            const index = await fetchDocumentPageIndex(resourceId!);
            const numbering = detectNumberingSegments(
                index.pages.map(p => ({
                    page: p.sheet,
                    // El folio va arriba en unos libros y al pie en otros.
                    text: p.lastLine ? `${p.firstLine} ${p.lastLine}` : p.firstLine,
                })),
            );
            const lastSheet = index.pages.length > 0
                ? Math.max(...index.pages.map(p => p.sheet))
                : 1;
            return {
                numbering,
                lastSheet,
                points: calibrationSheets(numbering, lastSheet).map(sheet => ({
                    sheet,
                    proposed: printedPageIn(numbering, sheet),
                })),
            };
        },
    });
}

/**
 * Guarda la numeración confirmada.
 *
 * Siempre entra como `origin: 'confirmed'`: lo que se guarda acá pasó por los
 * ojos de alguien con el libro delante, y esa diferencia es la que después
 * decide si una cita puede decir «p.» con confianza.
 */
export function useSavePageNumbering() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { resourceId: string; numbering: PageNumbering }) => {
            await libraryService.updateResource(input.resourceId, {
                pageNumbering: { ...input.numbering, origin: 'confirmed' },
            });
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: [PROPOSAL_KEY, variables.resourceId] });
            queryClient.invalidateQueries({ queryKey: ['library'] });
        },
    });
}
