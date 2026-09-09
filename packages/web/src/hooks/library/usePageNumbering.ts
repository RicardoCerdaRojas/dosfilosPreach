import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    calibrationSheets,
    detectNumberingSegments,
    printedPageIn,
    type PageNumbering,
} from '@dosfilos/domain';
import { fetchDocumentPageIndex, FirebaseLibraryRepository } from '@dosfilos/infrastructure';
import { libraryService } from '@dosfilos/application';

const NUMBERING_KEY = 'library-page-numbering';

export interface CalibrationPoint {
    /** Hoja física del archivo, contada desde 1. */
    sheet: number;
    /**
     * Número que ya se cree impreso en esa hoja. `null` cuando no se dedujo,
     * o cuando la hoja cae en un tramo sin numeración arábiga — y ésa es una
     * respuesta válida, no un hueco a rellenar.
     */
    proposed: number | null;
}

export interface NumberingState {
    numbering: PageNumbering | null;
    points: CalibrationPoint[];
    lastSheet: number;
    /** `null` cuando no hay nada guardado y lo que se ve es una deducción del momento. */
    storedOrigin: PageNumbering['origin'] | null;
}

/**
 * Estado de numeración de un recurso: lo guardado si existe, y si no, una
 * deducción al vuelo.
 *
 * El orden importa. La primera versión detectaba siempre e ignoraba lo
 * guardado, con dos consecuencias: quien ya había calibrado volvía a ver la
 * propuesta del detector en lugar de su propia respuesta, y los puntos que
 * mostraba la pantalla no coincidían con los tramos que el backfill había
 * escrito —dos detecciones distintas sobre el mismo libro, cada una con su
 * resultado—. Leer primero lo guardado resuelve las dos.
 */
export function usePageNumbering(resourceId: string | null) {
    return useQuery<NumberingState>({
        queryKey: [NUMBERING_KEY, resourceId],
        enabled: !!resourceId,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retry: 1,
        queryFn: async () => {
            const [index, resource] = await Promise.all([
                fetchDocumentPageIndex(resourceId!),
                new FirebaseLibraryRepository().findById(resourceId!),
            ]);
            const lastSheet = index.pages.length > 0
                ? Math.max(...index.pages.map(p => p.sheet))
                : 1;

            const stored = (resource as { pageNumbering?: PageNumbering | null } | null)?.pageNumbering ?? null;
            const numbering = stored?.segments?.length
                ? stored
                : detectNumberingSegments(index.pages.map(p => ({
                    page: p.sheet,
                    // El folio va arriba en unos libros y al pie en otros.
                    text: p.lastLine ? `${p.firstLine} ${p.lastLine}` : p.firstLine,
                })));

            return {
                numbering,
                lastSheet,
                storedOrigin: stored?.origin ?? null,
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
 * ojos de alguien con el libro delante, y esa diferencia es la que decide si
 * una cita puede decir «p.» con confianza.
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
            queryClient.invalidateQueries({ queryKey: [NUMBERING_KEY, variables.resourceId] });
            queryClient.invalidateQueries({ queryKey: ['library'] });
        },
    });
}
