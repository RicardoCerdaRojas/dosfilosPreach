import { getFunctions, httpsCallable } from 'firebase/functions';
import {
    detectPrintedPageOffset,
    type PageIndexEntry,
} from '@dosfilos/domain';

/**
 * Cliente del índice de hojas y del PDF original.
 *
 * Es lo que alimenta al selector de páginas: el índice dibuja el panel de
 * navegación y traduce la elección a fragmentos; la URL firmada abre el visor.
 *
 * El índice de un documento no cambia salvo re-indexación, así que se cachea
 * por recurso mientras dure la sesión. Sin eso, cada apertura del selector
 * volvería a leer 1.185 fragmentos del lado del servidor para redibujar lo
 * mismo.
 */

export interface DocumentPageIndex {
    pages: ReadonlyArray<PageIndexEntry>;
    /**
     * `impresa = hoja + offset`, o `null` cuando no hubo evidencia suficiente.
     * Se deduce acá y no en el servidor porque la tabla del canon y la
     * heurística viven en domain, que `packages/functions` no puede importar.
     */
    printedPageOffset: number | null;
}

export interface DocumentPdfHandle {
    url: string;
    expiresAt: number;
    sizeBytes: number;
    contentType: string | null;
}

interface PageIndexResponse {
    pages: PageIndexEntry[];
    sheetCount: number;
}

const INDEX_TIMEOUT_MS = 60_000;

/**
 * Margen con el que se considera vencida una URL firmada. Renovarla un minuto
 * antes evita que el visor pida una hoja justo cuando la firma expira y falle
 * a mitad de lectura.
 */
const URL_RENEW_MARGIN_MS = 60_000;

const indexCache = new Map<string, Promise<DocumentPageIndex>>();
const pdfCache = new Map<string, DocumentPdfHandle>();

export async function fetchDocumentPageIndex(resourceId: string): Promise<DocumentPageIndex> {
    const cached = indexCache.get(resourceId);
    if (cached) return cached;

    const pending = (async () => {
        const callable = httpsCallable<{ resourceId: string }, PageIndexResponse>(
            getFunctions(),
            'getDocumentPageIndex',
            { timeout: INDEX_TIMEOUT_MS },
        );
        const response = await callable({ resourceId });
        const pages = response.data?.pages ?? [];

        // El folio vive arriba en unos libros y al pie en otros, así que se
        // le da al detector el arranque Y el final de cada hoja. Pasarle
        // sólo el arranque —como se hacía— dejaba sin desfase a todo libro
        // que numere abajo, y el lector abría una página creyendo que era
        // otra: en el comentario de Adamson la hoja 54 lleva impreso el 50.
        const detection = detectPrintedPageOffset(
            pages.map(p => ({
                page: p.sheet,
                text: p.lastLine ? `${p.firstLine} ${p.lastLine}` : p.firstLine,
            })),
        );

        console.log('[DocumentPageIndex] índice cargado', {
            resourceId,
            sheets: pages.length,
            printedPageOffset: detection.offset,
            offsetAgreement: `${detection.agreement}/${detection.samples}`,
        });

        return { pages, printedPageOffset: detection.offset };
    })();

    // Se cachea la promesa, no el resultado: dos paneles que abran el mismo
    // documento a la vez comparten una sola lectura en vez de duplicarla.
    indexCache.set(resourceId, pending);
    try {
        return await pending;
    } catch (err) {
        // Un fallo no se cachea: el próximo intento tiene que volver a probar.
        indexCache.delete(resourceId);
        throw err;
    }
}

export async function fetchDocumentPdfUrl(resourceId: string): Promise<DocumentPdfHandle> {
    const cached = pdfCache.get(resourceId);
    if (cached && cached.expiresAt - URL_RENEW_MARGIN_MS > Date.now()) return cached;

    const callable = httpsCallable<{ resourceId: string }, DocumentPdfHandle>(
        getFunctions(),
        'getDocumentPdfUrl',
        { timeout: INDEX_TIMEOUT_MS },
    );
    const response = await callable({ resourceId });
    const handle = response.data;
    pdfCache.set(resourceId, handle);
    return handle;
}

/** Una hoja del libro donde aparece el término buscado. */
export interface DocumentSheetHit {
    sheet: number;
    /** Apariciones en esa hoja, sumando todos sus fragmentos. */
    count: number;
    /** Renglón donde cae la primera, para reconocer la hoja sin abrirla. */
    snippet: string;
    section: string | null;
    /** Sólo en modo `'referencia'`: qué versículos del pasaje nombra la hoja. */
    verses?: number[];
}

export interface DocumentTextSearchResult {
    hits: DocumentSheetHit[];
    /** Hubo más hojas de las que caben en la respuesta. */
    truncated: boolean;
    scannedChunks: number;
}

/**
 * Busca una palabra en TODO el libro, no en la hoja abierta.
 *
 * No se cachea: el término cambia en cada búsqueda y react-query ya
 * guarda por término del lado del llamador. El tope de tiempo es el mismo
 * del índice — recorrer los fragmentos de un libro grande tarda segundos,
 * no milisegundos.
 */
export async function searchDocumentText(
    resourceId: string,
    term: string,
    /** `'lema'` exige palabra entera y compara sólo consonantes. */
    mode: 'texto' | 'lema' = 'texto',
): Promise<DocumentTextSearchResult> {
    const callable = httpsCallable<{ resourceId: string; term: string; mode: string }, DocumentTextSearchResult>(
        getFunctions(),
        'searchDocumentText',
        { timeout: INDEX_TIMEOUT_MS },
    );
    const response = await callable({ resourceId, term, mode });
    return response.data;
}

/**
 * Dónde nombra el libro al pasaje del trabajo.
 *
 * Una sola llamada por libro: la pregunta viaja desagregada —las grafías del
 * canon, el capítulo y el rango de versículos— y la función arma la forma de
 * búsqueda de su lado. Ir por grafía sería multiplicar por seis las llamadas y
 * dejar que el cliente ordene cuánto texto recorre el servidor.
 */
export async function searchDocumentByReference(
    resourceId: string,
    reference: {
        names: string[];
        chapterStart: number;
        chapterEnd: number;
        verseStart: number | null;
        verseEnd: number | null;
    },
): Promise<DocumentTextSearchResult> {
    const callable = httpsCallable<
        { resourceId: string; term: string; mode: string; reference: typeof reference },
        DocumentTextSearchResult
    >(getFunctions(), 'searchDocumentText', { timeout: INDEX_TIMEOUT_MS });
    const response = await callable({ resourceId, term: '', mode: 'referencia', reference });
    return response.data;
}

/**
 * Olvida lo cacheado de un recurso. Lo llama el flujo de re-indexación: después
 * de re-extraer un documento, su índice de hojas cambió y el viejo describe un
 * archivo que ya no existe.
 */
export function invalidateDocumentCaches(resourceId: string): void {
    indexCache.delete(resourceId);
    pdfCache.delete(resourceId);
}
