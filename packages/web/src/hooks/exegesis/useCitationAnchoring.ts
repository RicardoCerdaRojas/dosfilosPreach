import { useMemo } from 'react';
import {
    isCitableSourceType,
    summarizeCitationAnchoring,
    type CitationAnchoringSummary,
    type ExegeticalPaper,
    type PageNumbering,
} from '@dosfilos/domain';
import { useLibrary } from '@/hooks/library';

/**
 * Cuánto del trabajo se apoya en fuentes que nadie puede comprobar.
 *
 * No pide nada nuevo al servidor: la biblioteca ya viaja sincronizada y trae la
 * numeración de cada recurso, y los análisis aceptados ya están en el trabajo.
 * Es una lectura de lo que la pantalla tiene delante.
 */
export function useCitationAnchoring(
    paper: ExegeticalPaper | null | undefined,
): CitationAnchoringSummary | null {
    const { resources } = useLibrary();

    return useMemo(() => {
        if (!paper) return null;

        const numberingByResource = new Map<string, PageNumbering | null>(
            resources.map(r => [r.id, (r as { pageNumbering?: PageNumbering | null }).pageNumbering ?? null]),
        );

        const sources = paper.sources
            .filter(s => s.citationKey && isCitableSourceType(s.sourceType))
            .map(s => ({
                citationKey: s.citationKey!,
                displayLabel: s.displayLabel,
                numbering: numberingByResource.get(s.sourceLibraryResourceId ?? s.corpusId) ?? null,
            }));

        // Lo aceptado, que es lo que el compositor va a leer. Un análisis
        // pendiente de revisión no está en el trabajo todavía y contarlo
        // alarmaría por citas que quizá nunca se acepten.
        const analyses = paper.steps
            .filter(s => s.kind === 'verse' && s.accepted?.canonicalAnalysis)
            .map(s => s.accepted!.canonicalAnalysis!);

        if (analyses.length === 0 || sources.length === 0) return null;
        return summarizeCitationAnchoring(analyses, sources);
    }, [paper, resources]);
}
