import { useEffect, useMemo, useState } from 'react';
import { citationAnchorFor, isCitableSourceType } from '@dosfilos/domain';
import { useDocumentPageIndex, useDocumentPdfUrl } from '@/hooks/exegesis/useDocumentPageIndex';
import { usePageNumbering } from '@/hooks/library/usePageNumbering';
import { useExegesisPaper } from '@/hooks/exegesis/useExegesisPaper';
import type { CitationTarget } from './CitationSourceModal';
import { clampSheet, printedOfSheet, resolveCitationSheet, sheetForPageInput, type SheetContext } from './citationSheet';

/**
 * El libro detrás de una cita y la hoja que se está mirando.
 *
 * Dos hojas distintas: la de la cita (`anchorSheet`), donde el visor abre,
 * y la que el lector tiene delante (`viewSheet`), que se mueve al hojear.
 * Al cambiar de cita, la vista vuelve al ancla; hojear no la toca.
 */
export function useCitationSheet(paperId: string | null, citation: CitationTarget | null, open: boolean) {
    // Ya está en caché: la página del trabajo la pidió al montarse, así
    // que resolverla acá no agrega lecturas. Sin trabajo (la Biblioteca), no
    // se pide nada.
    const { paper } = useExegesisPaper(paperId ?? undefined);

    const source = useMemo(() => {
        if (!citation || !paper) return null;
        return paper.sources.find(s =>
            isCitableSourceType(s.sourceType)
            && (s.citationKey ?? s.displayLabel) === citation.sourceKey) ?? null;
    }, [paper, citation]);

    // Abierto por recurso (la Biblioteca, la tarjeta de una fuente) no hace
    // falta buscar la clave en el trabajo: el destino ya dice qué libro es.
    const resourceId = citation?.resourceId ?? source?.sourceLibraryResourceId ?? source?.corpusId ?? null;
    const index = useDocumentPageIndex(open ? resourceId : null);
    const pdf = useDocumentPdfUrl(open ? resourceId : null);
    const numberingState = usePageNumbering(open ? resourceId : null);
    const loading = index.isLoading || pdf.isLoading || numberingState.isLoading;

    const ctx: SheetContext = useMemo(() => ({
        numbering: numberingState.data?.numbering ?? null,
        offset: index.data?.printedPageOffset ?? null,
        sections: index.data?.sections ?? [],
    }), [numberingState.data?.numbering, index.data?.printedPageOffset, index.data?.sections]);

    const totalSheets = useMemo(() => {
        const fromNumbering = numberingState.data?.lastSheet ?? 0;
        const fromIndex = index.data?.pages.reduce((m, p) => Math.max(m, p.sheet), 0) ?? 0;
        const n = Math.max(fromNumbering, fromIndex);
        return n > 0 ? n : null;
    }, [numberingState.data?.lastSheet, index.data?.pages]);

    const anchorSheet = useMemo(
        () => (citation ? clampSheet(resolveCitationSheet(citation, ctx), totalSheets) : 1),
        [citation, ctx, totalSheets],
    );

    // Dónde se ABRE puede no ser la citada: la revisión abre la página donde
    // el verificador halló el apoyo, y la citada sigue siendo el ancla —con
    // la que se compara «está aquí» y se ofrece corregir— (fase F, F4).
    const openAtPage = citation?.openAt?.page;
    const openAtKind = citation?.openAt?.pageKind;
    const startSheet = useMemo(
        () => (openAtPage ? clampSheet(resolveCitationSheet({ page: openAtPage, pageKind: openAtKind }, ctx), totalSheets) : anchorSheet),
        [openAtPage, openAtKind, ctx, totalSheets, anchorSheet],
    );

    // La hoja que se mira se resetea cuando cambia la cita o cuando termina
    // de llegar la calibración: hasta entonces el ancla es provisional.
    const [viewSheet, setViewSheet] = useState(startSheet);
    useEffect(() => { setViewSheet(startSheet); }, [startSheet]);

    const goTo = (sheet: number) => setViewSheet(clampSheet(sheet, totalSheets));
    const goToPageInput = (input: number): boolean => {
        const sheet = sheetForPageInput(input, ctx);
        if (sheet === null) return false;
        goTo(sheet);
        return true;
    };

    return {
        source,
        resourceId,
        /** Cómo se llama el libro arriba del visor. */
        label: source?.displayLabel ?? citation?.label ?? citation?.sourceKey ?? '',
        /** La clave con que se cita: la del trabajo, o la que trajo el destino. */
        citationKey: source?.citationKey ?? citation?.sourceKey ?? null,
        pdfUrl: pdf.data?.url ?? null,
        loading,
        totalSheets,
        anchorSheet,
        viewSheet,
        printedOfView: printedOfSheet(viewSheet, ctx),
        printedOf: (sheet: number) => printedOfSheet(sheet, ctx),
        /** Las hojas del libro con su sección y primer renglón, para el índice. */
        pages: index.data?.pages ?? [],
        /**
         * Cómo se cita una hoja: «p. N» con la numeración confirmada del
         * libro, «hoja N» sin ella. La MISMA regla que usa el análisis
         * (`citationAnchorFor`): el desfase deducido sirve para navegar, no
         * para escribir una página en el trabajo.
         */
        anchorFor: (sheet: number) => citationAnchorFor(
            { sheet, section: index.data?.pages.find(p => p.sheet === sheet)?.section ?? null },
            numberingState.data?.numbering ?? null,
        ),
        goTo,
        goToPageInput,
    };
}
