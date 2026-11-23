import { useQuery } from '@tanstack/react-query';
import {
    fetchDocumentOutline,
    fetchDocumentPageIndex,
    fetchDocumentPdfUrl,
    type DocumentPageIndex,
    type DocumentPdfHandle,
} from '@dosfilos/infrastructure';
import type { DocumentOutlineEntry } from '@dosfilos/domain';

/**
 * Índice de hojas de un documento y llave de su PDF, para el selector de
 * páginas.
 *
 * Son dos consultas separadas a propósito. El índice llega en cientos de
 * milisegundos y ya deja operable el panel de navegación y el carrito; el PDF
 * puede tardar más —un comentario pesa decenas de megas— y el usuario no tiene
 * por qué esperarlo para empezar a elegir.
 */

const PAGE_INDEX_KEY = 'exegesis-document-page-index';
const OUTLINE_KEY = 'exegesis-document-outline';
const PDF_URL_KEY = 'exegesis-document-pdf-url';

/**
 * El índice no cambia salvo re-indexación del documento, así que no se
 * revalida: el cliente de infraestructura ya lo cachea por sesión y volver a
 * pedirlo solo agregaría lecturas.
 */
export function useDocumentPageIndex(resourceId: string | null) {
    return useQuery<DocumentPageIndex>(documentPageIndexQuery(resourceId));
}

/** Las opciones del índice de hojas, para usarlas también dentro de `useQueries`. */
export function documentPageIndexQuery(resourceId: string | null) {
    return {
        queryKey: [PAGE_INDEX_KEY, resourceId],
        queryFn: () => fetchDocumentPageIndex(resourceId!),
        enabled: !!resourceId,
        staleTime: Infinity,
        gcTime: 30 * 60 * 1000,
        retry: 1,
    };
}

/** El esquema de secciones de un documento (cambia solo al re-indexar, como el índice). */
export function documentOutlineQuery(resourceId: string | null) {
    return {
        queryKey: [OUTLINE_KEY, resourceId],
        queryFn: (): Promise<DocumentOutlineEntry[]> => fetchDocumentOutline(resourceId!),
        enabled: !!resourceId,
        staleTime: Infinity,
        gcTime: 30 * 60 * 1000,
        retry: 1,
    };
}

/**
 * La URL viene firmada con vencimiento, así que sí se revalida: si el usuario
 * deja el selector abierto media hora, la próxima hoja que pida tiene que
 * traer una firma vigente.
 */
export function useDocumentPdfUrl(resourceId: string | null, enabled = true) {
    return useQuery<DocumentPdfHandle>({
        queryKey: [PDF_URL_KEY, resourceId],
        queryFn: () => fetchDocumentPdfUrl(resourceId!),
        enabled: !!resourceId && enabled,
        staleTime: 20 * 60 * 1000,
        gcTime: 25 * 60 * 1000,
        retry: 1,
    });
}
