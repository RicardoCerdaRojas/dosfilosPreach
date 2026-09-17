import { useEffect, useMemo, useState } from 'react';
import { isCitableSourceType } from '@dosfilos/domain';
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
export function useCitationSheet(paperId: string, citation: CitationTarget | null, open: boolean) {
    // Ya está en caché: la página del trabajo la pidió al montarse, así
    // que resolverla acá no agrega lecturas.
    const { paper } = useExegesisPaper(paperId);

    const source = useMemo(() => {
        if (!citation || !paper) return null;
        return paper.sources.find(s =>
            isCitableSourceType(s.sourceType)
            && (s.citationKey ?? s.displayLabel) === citation.sourceKey) ?? null;
    }, [paper, citation]);

    const resourceId = source?.sourceLibraryResourceId ?? source?.corpusId ?? null;
    const index = useDocumentPageIndex(open ? resourceId : null);
    const pdf = useDocumentPdfUrl(open ? resourceId : null);
    const numberingState = usePageNumbering(open ? resourceId : null);
    const loading = index.isLoading || pdf.isLoading || numberingState.isLoading;

    const ctx: SheetContext = useMemo(() => ({
        numbering: numberingState.data?.numbering ?? null,
        offset: index.data?.printedPageOffset ?? null,
    }), [numberingState.data?.numbering, index.data?.printedPageOffset]);

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

    // La hoja que se mira se resetea cuando cambia la cita o cuando termina
    // de llegar la calibración: hasta entonces el ancla es provisional.
    const [viewSheet, setViewSheet] = useState(anchorSheet);
    useEffect(() => { setViewSheet(anchorSheet); }, [anchorSheet]);

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
        pdfUrl: pdf.data?.url ?? null,
        loading,
        totalSheets,
        anchorSheet,
        viewSheet,
        printedOfView: printedOfSheet(viewSheet, ctx),
        printedOf: (sheet: number) => printedOfSheet(sheet, ctx),
        goTo,
        goToPageInput,
    };
}
