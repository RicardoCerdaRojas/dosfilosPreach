import { useCallback } from 'react';
import { fetchDocumentPageIndex } from '@dosfilos/infrastructure';
import { addAndPinSheets, type ExegeticalPaper, type SheetRange } from '@dosfilos/domain';
import { useSelectSourcePages } from './useSelectSourcePages';
import type { ReviewedSource } from './useCorpusQuestionReview';

/**
 * Agrega unas hojas a una fuente del corpus y las fija, desde la revisión por
 * pregunta (TP #8, fase 8a, A4): «La nota de Mayor sobre 4:3 (h. 411) no está
 * en el corpus» → [Agregar y fijar].
 *
 * Fijar es lo que garantiza que la hoja llegue: una hoja agregada sin fijar
 * compite en el ranking de cada paso y puede volver a quedar afuera. Se fija
 * SOLO la hoja, no el tramo con el que se funde (411 dentro de 407–418): lo
 * fijado vive aparte de los tramos (`pinnedRanges`).
 *
 * Pasa por el mismo caso de uso que el selector de páginas, así que la
 * selección queda «elegida a mano» y el medidor y la guardia de consistencia
 * la ven como cualquier otra.
 */
export function useAddAndPinSheets(paper: ExegeticalPaper | null | undefined) {
    const selectPages = useSelectSourcePages();

    const run = useCallback(async (fuente: ReviewedSource, sheets: ReadonlyArray<number>) => {
        if (!paper) throw new Error('Sin trabajo');
        const index = await fetchDocumentPageIndex(fuente.resourceId);
        const actual: ReadonlyArray<SheetRange> = fuente.selected ?? [];
        const { sheetRanges, pinnedRanges } = addAndPinSheets(
            actual,
            fuente.source.excerptRecipe?.pinnedRanges ?? [],
            sheets,
        );
        return selectPages.mutateAsync({
            paperId: paper.id,
            libraryResourceId: fuente.resourceId,
            displayLabel: fuente.source.displayLabel,
            sourceType: fuente.source.sourceType,
            citationKey: fuente.source.citationKey,
            sheetRanges,
            pinnedRanges,
            proposedRanges: fuente.source.excerptRecipe?.proposedRanges ?? [],
            pageIndex: index.pages,
            selectionMode: 'manual',
        });
    }, [paper, selectPages]);

    return { run, isPending: selectPages.isPending };
}
