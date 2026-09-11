import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { extractWithGemini } from './geminiExtraction';
import { consumePagesAdmin } from './processingBalance';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

interface ProcessRequest {
    resourceId: string;
    /** Re-extract even if the resource is already on the Gemini-standard path. */
    force?: boolean;
}

const EXTRACTION_VERSION = '4.0-gemini-standard';
const GEMINI_FILE_SIZE_LIMIT_BYTES = 50 * 1024 * 1024;
const FIRESTORE_TEXT_LIMIT_BYTES = 900_000;

/**
 * Callable: vuelve a extraer un recurso LEYENDO SUS PÁGINAS COMO IMAGEN, a
 * partir del PDF que ya está en Storage.
 *
 * Existía admin-only, y eso dejaba un hueco caro: un libro extraído por la ruta
 * equivocada —leyendo una capa de texto que perdió su griego o su hebreo— sólo
 * se podía arreglar borrándolo y subiéndolo de nuevo. El botón de «reprocesar»
 * de la tarjeta NO sirve para eso: re-indexa el `structured.md` ya extraído, o
 * sea el mismo texto malo.
 *
 * Medido sobre una biblioteca real, cinco obras hebreas entraron así. A mano
 * son cinco borrados y cinco subidas, con el PDF ya guardado del otro lado.
 *
 * Cobra páginas estándar, que es la bolsa de esta ruta.
 *
 * Output contract is **identical** to `reprocessWithLlamaParse`:
 *   - `structured.md` in Cloud Storage at `users/{uid}/library/{rid}/structured.md`
 *     using `<!-- page: N -->` markers (consumed by `markdownChunker.ts`).
 *   - `textContent` Firestore field with `[PAGE N]` markers (truncated to 900 KB).
 *   - Firestore updates: `textExtractionStatus`, `pageCount`, `characterCount`,
 *     `extractionVersion`, `structuredContentUrl`, `extractedWithGemini: true`,
 *     `extractedWithLlamaParse: false`, `needsReindex: true`.
 *
 * The downstream pipeline (chunker, embeddings, RAG retrieval) does not need
 * to change.
 */
export const processWithGemini = onCall<ProcessRequest>(
    {
        ...appCheckCallableOptions(),
        region: 'us-central1',
        memory: '2GiB',
        timeoutSeconds: 900,
        secrets: ['GEMINI_API_KEY'],
    },
    async (request) => {
        console.log(`[ProcessGemini] Called by ${request.auth?.token?.email ?? 'unauthenticated'}`);

        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Hay que iniciar sesión.');
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not configured');
        }

        const { resourceId, force = false } = request.data;
        if (!resourceId) throw new HttpsError('invalid-argument', 'resourceId is required');

        const db = getFirestore();
        const storage = getStorage();
        const resourceRef = db.collection('library_resources').doc(resourceId);
        const snap = await resourceRef.get();
        if (!snap.exists) throw new HttpsError('not-found', `Resource ${resourceId} not found`);

        const data = snap.data()!;

        // El dueño, o el admin. Antes esto estaba cerrado con un correo a mano,
        // así que la única forma de re-extraer un libro por la ruta de imágenes
        // era borrarlo y volver a subirlo —y eso hace falta seguido: un libro
        // extraído leyendo una capa de texto envenenada sólo se arregla
        // leyéndolo de nuevo como imagen, y el PDF ya está en Storage—.
        const esAdmin = request.auth.token?.email === 'rdocerda@gmail.com';
        if (!esAdmin && data.userId !== request.auth.uid) {
            throw new HttpsError('permission-denied', 'Este recurso no es tuyo.');
        }

        if (!force && data.extractionVersion === EXTRACTION_VERSION) {
            return { success: true, skipped: true, reason: 'already-gemini-standard' };
        }

        const { bucket: bucketName, path: storagePath } = parseFirebaseStorageLocation(
            data.storageUrl,
            'dosfilosapp.firebasestorage.app',
        );
        if (!storagePath) {
            throw new HttpsError(
                'failed-precondition',
                `Resource ${resourceId}: could not parse storageUrl "${data.storageUrl}"`,
            );
        }

        const bucket = storage.bucket(bucketName);
        const file = bucket.file(storagePath);

        const tempFilePath = path.join(os.tmpdir(), `${resourceId}.pdf`);
        await file.download({ destination: tempFilePath });
        const stats = fs.statSync(tempFilePath);
        const sizeMB = stats.size / 1024 / 1024;
        console.log(`[ProcessGemini] ${data.title ?? resourceId}: ${sizeMB.toFixed(2)} MB`);

        if (stats.size > GEMINI_FILE_SIZE_LIMIT_BYTES) {
            try { fs.unlinkSync(tempFilePath); } catch { /* ignore */ }
            throw new HttpsError(
                'failed-precondition',
                `File exceeds Gemini 50MB limit (${sizeMB.toFixed(1)} MB). Use the LlamaParse premium path for files this large.`,
            );
        }

        try {
            await resourceRef.update({
                textExtractionStatus: 'processing',
                processingStartedAt: FieldValue.serverTimestamp(),
                updatedAt: new Date(),
            });

            // Pre-read page count via pdf-parse so the shared extractor
            // can route between single-pass and batched. Without this hint,
            // long PDFs would silently truncate at Gemini's 65K-token cap
            // (e.g. a 378-page commentary returning only the first 40
            // pages with finishReason=STOP). pdf-parse is fast and local;
            // we tolerate it failing and fall through with `undefined`,
            // which keeps the legacy single-pass path.
            let expectedPageCount: number | undefined;
            try {
                const buf = fs.readFileSync(tempFilePath);
                const meta = await pdfParse(buf, { max: 1 });
                if (typeof meta.numpages === 'number' && meta.numpages > 0) {
                    expectedPageCount = meta.numpages;
                    console.log(`[ProcessGemini] PDF has ${expectedPageCount} page(s) per pdf-parse`);
                }
            } catch (preReadErr: any) {
                console.warn(`[ProcessGemini] pdf-parse pre-read failed: ${preReadErr.message}`);
            }

            const { text: extractedText, markdown: structuredMarkdown, pageCount, paginasPorTanda } = await extractWithGemini(
                tempFilePath,
                resourceId,
                apiKey,
                expectedPageCount,
                {
                    // Atribuye el gasto de extracción al dueño del recurso.
                    userId: data.userId,
                    // Si este archivo ya se extrajo antes, se reusa el tamaño de
                    // tanda que se midió entonces: la primera tanda deja de ser
                    // una apuesta conservadora y el libro arranca a su ritmo.
                    paginasPorTanda: typeof data.paginasPorTanda === 'number' ? data.paginasPorTanda : undefined,
                },
            );

            const textBytes = Buffer.byteLength(extractedText, 'utf8');
            let finalText = extractedText;
            let wasTruncated = false;
            if (textBytes > FIRESTORE_TEXT_LIMIT_BYTES) {
                finalText = extractedText.substring(0, FIRESTORE_TEXT_LIMIT_BYTES);
                wasTruncated = true;
            }

            const userId: string = data.userId;
            const mdPath = `users/${userId}/library/${resourceId}/structured.md`;
            const mdFile = bucket.file(mdPath);
            await mdFile.save(structuredMarkdown, {
                contentType: 'text/markdown; charset=utf-8',
                metadata: { resourceId, extractionVersion: EXTRACTION_VERSION },
            });
            const structuredContentUrl = `gs://${bucketName}/${mdPath}`;

            await resourceRef.update({
                textContent: finalText,
                textExtractionStatus: 'ready',
                extractedAt: new Date(),
                pageCount,
                characterCount: extractedText.length,
                extractedWithLlamaParse: false,
                extractedWithGemini: true,
                extractionVersion: EXTRACTION_VERSION,
                structuredContentUrl,
                needsReindex: true,
                wasTruncated,
                // Sólo lo escribe la ruta batcheada; un PDF corto se lee de una
                // pasada y no tiene tamaño de tanda que recordar.
                ...(paginasPorTanda ? { paginasPorTanda } : {}),
                updatedAt: new Date(),
            });

            // Debit the standard processing balance for the actual pages consumed.
            // Admin uploads run on rdocerda's account; we still log the spend so
            // dashboards reflect it. Errors here are non-fatal — extraction
            // already succeeded; we don't want to roll back a successful parse.
            try {
                await consumePagesAdmin(data.userId, 'standard', pageCount);
            } catch (balanceErr: any) {
                console.warn(
                    `[ProcessGemini] Balance update skipped for ${data.userId}: ${balanceErr.message}`,
                );
            }

            console.log(`[ProcessGemini] ✅ ${resourceId}: ${pageCount} pages`);

            return {
                success: true,
                resourceId,
                pageCount,
                characterCount: extractedText.length,
                wasTruncated,
            };
        } catch (err: any) {
            const errorMessage = err?.message ?? 'Unknown error';
            console.error(`[ProcessGemini] ❌ ${resourceId}: ${errorMessage}`);
            await resourceRef.update({
                textExtractionStatus: 'failed',
                extractionError: errorMessage,
                updatedAt: new Date(),
            });
            throw new HttpsError('internal', `Gemini standard extraction failed: ${errorMessage}`);
        } finally {
            try { fs.unlinkSync(tempFilePath); } catch { /* ignore */ }
        }
    },
);


/**
 * Same parser used by `reprocessWithLlamaParse`. Duplicated here intentionally
 * to keep the two callables independent (we may evolve their resilience
 * separately as we move from premium-only to hybrid).
 */
function parseFirebaseStorageLocation(
    url: string,
    defaultBucket: string,
): { bucket: string; path: string } {
    if (!url) return { bucket: defaultBucket, path: '' };

    const gsMatch = url.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (gsMatch) {
        return { bucket: gsMatch[1], path: decodeURIComponent(gsMatch[2]) };
    }

    const fbMatch = url.match(/\/v0\/b\/([^/]+)\/o\/([^?]+)/);
    if (fbMatch) {
        return { bucket: fbMatch[1], path: decodeURIComponent(fbMatch[2]) };
    }

    const gcsMatch = url.match(/^https?:\/\/storage\.googleapis\.com\/([^/]+)\/(.+?)(\?|$)/);
    if (gcsMatch) {
        return { bucket: gcsMatch[1], path: decodeURIComponent(gcsMatch[2]) };
    }

    return { bucket: defaultBucket, path: '' };
}
