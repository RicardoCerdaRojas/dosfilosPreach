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
/**
 * La consulta, para quien la necesita para varios libros a la vez
 * (`useCorpusQuestionReview`). Misma llave: lo que ya buscó el selector de
 * páginas no se vuelve a buscar.
 *
 * La llave lleva el libro y el capítulo final (revisión de A4): sin ellos,
 * dos trabajos con el mismo capítulo y versículos de libros distintos
 * compartían resultado durante media hora.
 */
export function passagePagesQuery(resourceId: string | null, passage: PassageReference | null) {
    const query = passage ? passageReferenceQuery(passage) : null;
    return {
        queryKey: [KEY, resourceId, query?.bookId, query?.names.length, query?.chapterStart, query?.chapterEnd, query?.verseStart, query?.verseEnd],
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
        enabled: !!resourceId && !!query,
        staleTime: 30 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
        retry: 1,
    };
}

export function usePassagePages(
    resourceId: string | null,
    passage: PassageReference | null,
    enabled: boolean,
) {
    const options = passagePagesQuery(resourceId, passage);
    const result = useQuery({ ...options, enabled: enabled && options.enabled });

    return {
        proposals: result.data ?? [],
        isLoading: result.isLoading,
        isError: result.isError,
    };
}
