import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import { parseFirebaseStorageLocation } from './storageLocation';

/**
 * Lo que el selector de páginas necesita del servidor.
 *
 *   - `getDocumentPageIndex` — qué hay en cada hoja física del documento:
 *     encabezado si lo tiene, arranque del texto, qué fragmentos caen ahí y
 *     cuánto pesan. Es lo que dibuja el panel izquierdo y lo que traduce «las
 *     hojas 68 a 71» a fragmentos concretos.
 *   - `getDocumentPdfUrl` — una URL firmada de vida corta para que el visor
 *     abra el PDF original.
 *
 * Ninguna de las dos interpreta el contenido. El desfase entre la hoja física
 * y el número impreso se deduce del lado del cliente con
 * `detectPrintedPageOffset` de `@dosfilos/domain`, porque este paquete no puede
 * importar domain y duplicar la lógica sería garantizar que las dos copias se
 * separen.
 */

const CHUNK_COLLECTION = 'document_chunks';
const RESOURCE_COLLECTION = 'library_resources';
const DEFAULT_BUCKET = 'dosfilosapp.firebasestorage.app';

/**
 * Cuánto texto del arranque de cada hoja se devuelve.
 *
 * Cumple dos funciones a la vez: es la vista previa del panel y es de donde el
 * cliente lee el folio impreso para deducir el desfase. El encabezado corrido
 * vive en los primeros caracteres de la hoja, así que 180 alcanza de sobra sin
 * inflar una respuesta que puede traer 400 hojas.
 */
const HEAD_CHARS = 180;

/**
 * Cuánta cola de la hoja se devuelve, para el folio de los libros que
 * numeran al pie.
 *
 * Corta a propósito: sólo hace falta el número y lo poco que lo rodea. A
 * 400 hojas son ~24 KB, contra los ~72 KB que ya cuesta el encabezado.
 */
const TAIL_CHARS = 60;

/**
 * Vida de la URL firmada del PDF. Corta a propósito: alcanza para abrir el
 * documento y trabajar un rato, y no deja circulando un enlace de lectura a la
 * biblioteca de alguien.
 */
const PDF_URL_TTL_MS = 30 * 60 * 1000;

interface PageIndexRequest {
    resourceId: string;
}

interface PdfUrlRequest {
    resourceId: string;
}

/** Una hoja física del documento. */
interface PageIndexEntryPayload {
    sheet: number;
    chunkIndices: number[];
    section: string | null;
    firstLine: string;
    /**
     * Final del texto de la hoja, donde vive el folio cuando el libro
     * numera al pie.
     *
     * El desfase entre hoja y página impresa se deducía sólo de
     * `firstLine`, así que sólo se detectaba en libros que numeran arriba.
     * En tipografía académica la mayoría numera abajo: en el comentario de
     * Adamson la hoja 54 lleva impreso el 50 y el detector no veía nada,
     * de modo que el lector abría una página creyendo que era otra.
     */
    lastLine: string;
    charCount: number;
}

function requireResourceId(value: unknown): string {
    const resourceId = typeof value === 'string' ? value.trim() : '';
    if (!resourceId) throw new HttpsError('invalid-argument', 'resourceId is required');
    return resourceId;
}

/**
 * ¿Puede este usuario leer este recurso?
 *
 * Un recurso personal solo lo lee su dueño. Los de la biblioteca CORE son
 * contenido curado y compartido: no tienen dueño individual y se reconocen por
 * pertenecer a uno o más stores.
 */
function canRead(data: FirebaseFirestore.DocumentData, uid: string): boolean {
    if (data.userId === uid) return true;
    const stores = data.coreStores ?? data.stores;
    return Array.isArray(stores) && stores.length > 0;
}

/** Colapsa espacios y recorta, que es como se ve bien en una lista. */
function headOf(text: unknown): string {
    if (typeof text !== 'string') return '';
    return text.replace(/\s+/g, ' ').trim().slice(0, HEAD_CHARS);
}

/** Cola de la hoja: el folio al pie y poco más. */
function tailOf(text: unknown): string {
    if (typeof text !== 'string') return '';
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.slice(Math.max(0, flat.length - TAIL_CHARS));
}

/**
 * Índice de hojas de un documento indexado.
 *
 * Una sola consulta proyectada sobre los fragmentos. Trae el texto porque hace
 * falta para el arranque de cada hoja, pero devuelve solo ese arranque: para el
 * comentario más grande de la biblioteca son 1.185 fragmentos leídos y unas 420
 * entradas devueltas.
 */
export const getDocumentPageIndex = onCall<PageIndexRequest>(
    { ...appCheckCallableOptions(), region: 'us-central1', memory: '512MiB' },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign-in required');
        const uid = request.auth.uid;
        const resourceId = requireResourceId(request.data?.resourceId);

        const db = getFirestore();
        const snapshot = await db
            .collection(CHUNK_COLLECTION)
            .where('resourceId', '==', resourceId)
            .select('chunkIndex', 'text', 'metadata', 'userId', 'stores')
            .get();

        if (snapshot.empty) return { pages: [], sheetCount: 0 };

        const readable = snapshot.docs.map(d => d.data()).filter(data => canRead(data, uid));
        if (readable.length === 0) {
            throw new HttpsError('permission-denied', 'Resource not readable by this user');
        }

        // Por hoja, y en orden de fragmento: el encabezado y el arranque del
        // texto son los del PRIMER fragmento de la hoja, no los de cualquiera.
        const ordered = readable.sort(
            (a, b) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0),
        );

        const bySheet = new Map<number, PageIndexEntryPayload>();
        for (const data of ordered) {
            const sheet = typeof data.metadata?.page === 'number' ? data.metadata.page : 0;
            if (sheet < 1) continue;
            const chunkIndex = typeof data.chunkIndex === 'number' ? data.chunkIndex : 0;
            const text = typeof data.text === 'string' ? data.text : '';
            const section = typeof data.metadata?.section === 'string' ? data.metadata.section : null;

            let entry = bySheet.get(sheet);
            if (!entry) {
                entry = {
                    sheet,
                    chunkIndices: [],
                    section,
                    firstLine: headOf(text),
                    lastLine: tailOf(text),
                    charCount: 0,
                };
                bySheet.set(sheet, entry);
            }
            entry.chunkIndices.push(chunkIndex);
            entry.charCount += text.length;
            // Una hoja puede arrancar con un fragmento sin encabezado y traerlo
            // en el siguiente; se toma el primero que exista.
            if (!entry.section && section) entry.section = section;
            if (!entry.firstLine) entry.firstLine = headOf(text);
            // La cola se reemplaza con cada fragmento: el folio está al final
            // de la hoja, así que gana el ÚLTIMO que llegue, no el primero.
            const tail = tailOf(text);
            if (tail) entry.lastLine = tail;
        }

        const pages = Array.from(bySheet.values()).sort((a, b) => a.sheet - b.sheet);

        /**
         * El índice de secciones del libro, entero.
         *
         * `pages` guarda UNA sección por hoja, y una hoja puede traer varias:
         * la 209 de Porter arranca en «2.9. διό» y adentro están «2.10. ἐάν» y
         * «2.11. εἰ». Medido sobre ese libro, de sus 465 secciones el índice
         * por hoja sólo deja ver 130 — se pierden 335, y entre ellas la que
         * contesta la pregunta del trabajo sobre las condicionales.
         *
         * Va aparte y no arregla `pages`, porque `pages` responde otra
         * pregunta —«qué encabezado abre esta hoja»— y ésa la contesta bien.
         * Cada sección se registra en la PRIMERA hoja donde aparece, que es
         * donde empieza.
         */
        const sections: Array<{ section: string; sheet: number }> = [];
        const vistas = new Set<string>();
        for (const data of ordered) {
            const sheet = typeof data.metadata?.page === 'number' ? data.metadata.page : 0;
            const section = typeof data.metadata?.section === 'string' ? data.metadata.section.trim() : '';
            if (sheet < 1 || !section || vistas.has(section)) continue;
            vistas.add(section);
            sections.push({ section, sheet });
        }
        sections.sort((a, b) => a.sheet - b.sheet);

        console.log(`[PageIndex] ${resourceId}: ${readable.length} fragmentos → ${pages.length} hojas, ${sections.length} secciones`);
        return { pages, sheetCount: pages.length, sections };
    },
);

/**
 * URL firmada del PDF original, para que el visor lo abra.
 *
 * Se firma en vez de servir el archivo por la función: pdf.js pide rangos de
 * bytes y va bajando solo las hojas que se miran, así que un comentario de
 * 24 MB se abre sin descargarlo entero. Proxearlo por la callable rompería eso
 * y pagaríamos el ancho de banda dos veces.
 */
export const getDocumentPdfUrl = onCall<PdfUrlRequest>(
    { ...appCheckCallableOptions(), region: 'us-central1' },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign-in required');
        const uid = request.auth.uid;
        const resourceId = requireResourceId(request.data?.resourceId);

        const db = getFirestore();
        const snap = await db.collection(RESOURCE_COLLECTION).doc(resourceId).get();
        if (!snap.exists) throw new HttpsError('not-found', 'Resource not found');

        const data = snap.data()!;
        if (!canRead(data, uid)) {
            throw new HttpsError('permission-denied', 'Resource not readable by this user');
        }

        const { bucket, path } = parseFirebaseStorageLocation(data.storageUrl, DEFAULT_BUCKET);
        if (!path) {
            throw new HttpsError('failed-precondition', 'Resource has no original file stored');
        }

        const file = getStorage().bucket(bucket).file(path);
        const [exists] = await file.exists();
        if (!exists) throw new HttpsError('not-found', 'Original file missing from storage');

        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + PDF_URL_TTL_MS,
            version: 'v4',
        });

        const [metadata] = await file.getMetadata();
        return {
            url,
            expiresAt: Date.now() + PDF_URL_TTL_MS,
            sizeBytes: Number(metadata.size ?? 0),
            contentType: metadata.contentType ?? null,
        };
    },
);
