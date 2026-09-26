import { useQuery } from '@tanstack/react-query';
import { searchDocumentByReference } from '@dosfilos/infrastructure';
import {
    passageReferenceQuery,
    rankPassageSheets,
    type PassagePageHit,
    type PassageReference,
} from '@dosfilos/domain';

const KEY = 'exegesis-passage-pages';

/**
 * Las páginas del libro que nombran el pasaje del trabajo.
 *
 * Una sola consulta por libro —el pasaje entero viaja desagregado y la
 * búsqueda se hace del lado del servidor, donde están los fragmentos—, y se
 * cachea media hora: el pasaje no cambia mientras dura el armado del corpus y
 * recorrer un libro de 800 hojas cuesta segundos.
 */
export function usePassagePages(
    resourceId: string | null,
    passage: PassageReference | null,
    enabled: boolean,
) {
    const query = passage ? passageReferenceQuery(passage) : null;

    const result = useQuery({
        queryKey: [KEY, resourceId, query?.names.length, query?.chapterStart, query?.verseStart, query?.verseEnd],
        queryFn: async (): Promise<PassagePageHit[]> => {
            const { hits } = await searchDocumentByReference(resourceId!, query!);
            return rankPassageSheets(hits.map(h => ({
                sheet: h.sheet,
                count: h.count,
                verses: h.verses ?? [],
                snippet: h.snippet,
                section: h.section,
            })));
        },
        enabled: enabled && !!resourceId && !!query,
        staleTime: 30 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
        retry: 1,
    });

    return {
        proposals: result.data ?? [],
        isLoading: result.isLoading,
        isError: result.isError,
    };
}
