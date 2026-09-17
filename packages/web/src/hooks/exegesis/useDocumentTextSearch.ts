import { useQuery } from '@tanstack/react-query';
import { searchDocumentText, type DocumentTextSearchResult } from '@dosfilos/infrastructure';

const SEARCH_KEY = 'exegesis-document-text-search';

/**
 * Dónde aparece una palabra en todo el libro.
 *
 * Se cachea por recurso y término porque el lector vuelve sobre la misma
 * búsqueda al ir y venir entre hojas: recorrer los fragmentos de un libro
 * grande cuesta segundos y no cambia mientras no se re-indexe.
 */
export function useDocumentTextSearch(resourceId: string | null, term: string, enabled: boolean) {
    const trimmed = term.trim();
    return useQuery<DocumentTextSearchResult>({
        queryKey: [SEARCH_KEY, resourceId, trimmed.toLowerCase()],
        queryFn: () => searchDocumentText(resourceId!, trimmed),
        enabled: enabled && !!resourceId && trimmed.length >= 2,
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retry: 1,
    });
}
