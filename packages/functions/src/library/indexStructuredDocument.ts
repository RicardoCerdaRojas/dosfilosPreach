import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import { chunkStructuredMarkdown } from './markdownChunker';
import { isStructuredExtractionVersion } from './extractionVersions';
import { parseFirebaseStorageLocation } from './storageLocation';
import { describeSanitization, sanitizeExtractedText } from './sanitizeExtractedText';
import { assessIndexCoverage, describeIndexCoverage } from './indexCoverage';
import { refsDeFragmento } from './pasajes/refsDeTexto';

interface IndexRequest {
    resourceId: string;
    force?: boolean;  // Reindex even if already indexed with current version
}

const INDEXER_VERSION = '2.0-structured';
const EMBEDDING_MODEL = 'models/gemini-embedding-001';
const CHUNK_COLLECTION = 'document_chunks';
const EMBEDDING_BATCH_SIZE = 20;  // Gemini batch embedding limit

/**
 * Last line of defence before the chunk write.
 *
 * Firestore rejects an ENTIRE document when any nested value is
 * `undefined`, and a chunk write that throws aborts the whole indexing
 * job — the resource ends at `indexingStatus: 'failed'` with zero
 * chunks, so the book silently stops being retrievable. The chunker no
 * longer produces sparse `sectionPath` arrays (see the depth clamp in
 * `markdownChunker.ts`), but the breadcrumb is derived from arbitrary
 * user-uploaded markdown, so we do not let a future regression there
 * take a 400-page book's index down with it.
 */
function safeSectionPath(path: unknown): string[] {
    if (!Array.isArray(path)) return [];
    return path.filter((s): s is string => typeof s === 'string' && s.length > 0);
}

/**
 * Callable Cloud Function: builds the Phase 2 RAG index for a single library_resource.
 *
 * Pipeline:
 *   1. Read structured.md from Cloud Storage (produced by LlamaParse)
 *   2. Chunk it semantically (respecting pages, sections, max size)
 *   3. Generate Gemini embeddings (batched)
 *   4. Delete any previous chunks for this resource
 *   5. Upsert new chunks to Firestore document_chunks collection
 *
 * The resulting chunks have rich metadata: author, title, page, section breadcrumb,
 * stores (for scoping queries to tutors' corpusStores).
 */
export const indexStructuredDocument = onCall<IndexRequest>(
    {
        ...appCheckCallableOptions(),
        region: 'us-central1',
        memory: '2GiB',
        timeoutSeconds: 900,
        secrets: ['GEMINI_API_KEY'],
    },
    async (request) => {
        console.log(`[IndexStructured] Called by ${request.auth?.token?.email ?? 'unauthenticated'}`);

        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Sign-in required');
        }

        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not configured');

        const { resourceId, force = false } = request.data;
        if (!resourceId) throw new HttpsError('invalid-argument', 'resourceId is required');

        const db = getFirestore();
        const storage = getStorage();
        const resourceRef = db.collection('library_resources').doc(resourceId);
        const snap = await resourceRef.get();
        if (!snap.exists) throw new HttpsError('not-found', `Resource ${resourceId} not found`);

        const data = snap.data()!;

        // Authorization: document owner OR admin can index.
        // This is the same document-ownership model we use in other callables and
        // allows the personal library feature to work without escalating to admin.
        const isOwner = data.userId === request.auth.uid;
        const isAdmin = request.auth.token?.email === 'rdocerda@gmail.com';
        if (!isOwner && !isAdmin) {
            throw new HttpsError('permission-denied', 'Only the document owner or admin can index this resource');
        }

        // Preconditions: indexer expects a `structured.md` produced by either
        // extraction path (premium = LlamaParse, standard = Gemini). Both emit
        // the same `<!-- page: N -->` markdown contract.
        if (!isStructuredExtractionVersion(data.extractionVersion)) {
            throw new HttpsError(
                'failed-precondition',
                `Resource ${resourceId} must be processed first (current: ${data.extractionVersion ?? 'unknown'})`,
            );
        }
        if (!data.structuredContentUrl) {
            throw new HttpsError('failed-precondition', `Resource ${resourceId} has no structuredContentUrl`);
        }
        // `needsReindex` pesa tanto como `force`: lo escribe la
        // extracción al producir texto nuevo, y significa que el índice
        // que hay ya no corresponde al contenido. Sin mirarlo, un libro
        // re-extraído se quedaba con el índice viejo — y el disparador,
        // que sí lo mira desde #546, encolaba un trabajo que esta guarda
        // rechazaba. Las dos capas tienen que leer el mismo campo.
        if (!force && data.needsReindex !== true && data.indexerVersion === INDEXER_VERSION) {
            console.log(`[IndexStructured] ${resourceId} already indexed with ${INDEXER_VERSION}. Skipping.`);
            return { success: true, skipped: true, reason: 'already-indexed' };
        }

        const title: string = data.title ?? 'Documento sin título';
        const author: string = data.author ?? 'Autor desconocido';
        const userId: string = data.userId;
        const stores: string[] = data.coreStores ?? [];

        // 1. Download structured.md from Storage
        const { bucket: bucketName, path: mdPath } = parseFirebaseStorageLocation(
            data.structuredContentUrl,
            'dosfilosapp.firebasestorage.app'
        );
        if (!mdPath) throw new HttpsError('failed-precondition', `Bad structuredContentUrl: ${data.structuredContentUrl}`);

        const [mdBuffer] = await storage.bucket(bucketName).file(mdPath).download();
        let markdown = mdBuffer.toString('utf-8');
        console.log(`[IndexStructured] ${title}: downloaded ${markdown.length} chars of structured markdown`);

        // Saneamiento — segunda línea. El extractor ya limpia antes de guardar,
        // pero este `structured.md` puede ser de ANTES de esa regla, o venir de
        // una re-extracción manual. Sanear acá es lo único que garantiza que
        // ningún invisible entre al índice, que es el destino que importa: de
        // ahí sale el contexto que ve el modelo y el texto que se cita.
        const mdSan = sanitizeExtractedText(markdown);
        markdown = mdSan.text;
        let sanitizationReport = mdSan.report;
        const mdSanSummary = describeSanitization(mdSan.report);
        if (mdSanSummary) console.log(`🧼 [IndexStructured] ${title}: ${mdSanSummary}`);

        // 2. Chunk semantically
        let chunks = chunkStructuredMarkdown(markdown, {
            maxChars: 2000,
            minChars: 200,
            overlapChars: 150,
        });
        console.log(`[IndexStructured] ${title}: produced ${chunks.length} chunks from structured.md`);

        // Fallback: if structured.md is too thin (e.g. old upload with empty p.md),
        // use the textContent stored in Firestore, which has [PAGE N] markers.
        if (chunks.length < 3 && data.textContent && data.textContent.length > 1000) {
            assertFallbackIsWholeBook(data, title);
            console.log(`[IndexStructured] ${title}: falling back to textContent (${data.textContent.length} chars)`);
            // Convert [PAGE N] markers to <!-- page: N --> so chunker recognizes them
            const fallbackSan = sanitizeExtractedText(
                (data.textContent as string).replace(/\[PAGE\s+(\d+)\]/gi, '<!-- page: $1 -->')
            );
            markdown = fallbackSan.text;
            sanitizationReport = fallbackSan.report;
            const fallbackSanSummary = describeSanitization(fallbackSan.report);
            if (fallbackSanSummary) console.log(`🧼 [IndexStructured] ${title} (fallback): ${fallbackSanSummary}`);
            chunks = chunkStructuredMarkdown(markdown, {
                maxChars: 2000,
                minChars: 200,
                overlapChars: 150,
            });
            console.log(`[IndexStructured] ${title}: fallback produced ${chunks.length} chunks`);
        }

        // Drop chunks whose text is empty or whitespace-only. Gemini's
        // batchEmbedContents API rejects the WHOLE batch with
        // "EmbedContentRequest.content contains an empty Part." when
        // even one item is empty, killing the entire indexing job.
        // pdf-parse's synthetic page splitting can produce empty pages
        // (purely whitespace pages, or trailing equal-segment splits
        // that land on empty space) — we filter them here rather than
        // upstream so the chunker stays simple.
        chunks = chunks.filter(c => c.text && c.text.trim().length > 0);

        if (chunks.length === 0) {
            return { success: true, chunkCount: 0, skipped: true, reason: 'empty-document' };
        }

        try {
            await resourceRef.update({
                indexingStatus: 'processing',
                updatedAt: new Date(),
            });

            // 3. Generate embeddings — fault-tolerant. Returns parallel
            //    array; entries with `values: null` failed individually
            //    and are dropped before writing.
            console.log(`[IndexStructured] ${title}: embedding ${chunks.length} chunks...`);
            const embedResults = await embedChunksBatched(chunks.map(c => c.text), geminiKey);

            // Pair surviving (chunk, vector) entries.
            const survivors: Array<{ chunk: typeof chunks[number]; vector: number[] }> = [];
            for (let i = 0; i < chunks.length; i++) {
                const r = embedResults[i];
                if (r?.values) survivors.push({ chunk: chunks[i], vector: r.values });
            }
            const failedCount = chunks.length - survivors.length;
            if (failedCount > 0) {
                console.warn(`[IndexStructured] ${title}: ${failedCount}/${chunks.length} chunks failed to embed; indexing the remaining ${survivors.length}`);
            }
            if (survivors.length === 0) {
                throw new Error(`All ${chunks.length} chunks failed to embed`);
            }
            // Refuse to index a resource where >50% of chunks failed —
            // that suggests a systemic issue (key revoked, model down)
            // not a few bad chunks. Better to mark failed than ship a
            // half-indexed resource the user thinks is searchable.
            if (failedCount / chunks.length > 0.5) {
                throw new Error(`${failedCount}/${chunks.length} chunks failed to embed (>50%); refusing partial index`);
            }

            // 4. Delete previous chunks for this resource (safe: keeps index fresh on reprocess)
            await deleteExistingChunks(db, resourceId);

            // 5. Upsert new chunks — individual writes.
            // Firestore batched writes with vector embeddings trigger "Transaction too big"
            // because vector index updates have a high accounting cost per operation.
            // Individual writes are slower but robust. For 500 chunks this takes ~30-60s.
            const now = new Date();
            for (let i = 0; i < survivors.length; i++) {
                const { chunk: c, vector } = survivors[i];
                const id = `${resourceId}_chunk_${i}`;
                await db.collection(CHUNK_COLLECTION).doc(id).set({
                    resourceId,
                    resourceTitle: title,
                    resourceAuthor: author,
                    userId,
                    chunkIndex: i,
                    text: c.text,
                    embedding: FieldValue.vector(vector),
                    metadata: {
                        page: c.page,
                        section: c.section ?? null,
                        sectionPath: safeSectionPath(c.sectionPath),
                        chunkType: c.chunkType,
                        startChar: c.charStart,
                        endChar: c.charEnd,
                    },
                    // Los pasajes bíblicos que nombra, para buscar por pasaje (etapa 3).
                    refs: refsDeFragmento(c.text, c.sectionPath),
                    stores,
                    indexerVersion: INDEXER_VERSION,
                    createdAt: now,
                });
                // Progress log every 25 chunks
                if ((i + 1) % 25 === 0 || i === survivors.length - 1) {
                    console.log(`[IndexStructured] written ${i + 1}/${survivors.length} chunks`);
                }
            }

            // Cobertura: dos números que ya estaban en el documento y
            // que nadie comparaba. Un índice que llega a la página 433
            // de 711 tenía la misma tarjeta verde que uno completo.
            const coverage = assessIndexCoverage(survivors.map(s => s.chunk.page), data.pageCount);
            const coverageWarning = describeIndexCoverage(coverage);
            if (coverageWarning) console.warn(`⚠️ [IndexStructured] ${title}: ${coverageWarning}`);

            // Mark the resource as indexed
            await resourceRef.update({
                indexCoverage: coverage,
                indexingWarning: coverageWarning,
                indexingStatus: 'ready',
                indexerVersion: INDEXER_VERSION,
                indexedChunkCount: survivors.length,
                indexedAt: now,
                needsReindex: false,
                indexingError: null, // clear any prior failure on success
            // Re-arm the daily failure alert. Without this, a resource
            // that fails, gets fixed, then fails again would stay silent
            // forever — the alert stamps once and never un-stamps.
            indexFailureAlertedAt: null,
                // Qué se saneó en ESTA corrida. Se guarda aunque sea cero: un
                // recurso reindexado tras la regla de saneo tiene que poder
                // decir "se revisó y no había nada", que no es lo mismo que
                // "nunca se revisó" (campo ausente).
                sanitization: {
                    removed: sanitizationReport.removed,
                    byCategory: sanitizationReport.byCategory,
                    greekBreathingsComposed: sanitizationReport.greekBreathingsComposed,
                    at: now,
                },
                updatedAt: now,
            });

            console.log(`[IndexStructured] ✅ ${title}: ${survivors.length} chunks indexed${failedCount > 0 ? ` (${failedCount} skipped)` : ''}`);
            return {
                success: true,
                chunkCount: survivors.length,
                pageRange: {
                    min: Math.min(...survivors.map(s => s.chunk.page)),
                    max: Math.max(...survivors.map(s => s.chunk.page)),
                },
            };
        } catch (err: any) {
            const errorMessage = err?.message ?? 'Unknown error';
            console.error(`[IndexStructured] ❌ ${resourceId}: ${errorMessage}`);
            console.error('[IndexStructured] Stack:', err?.stack);
            await discardPartialIndex(db, resourceId);
            await resourceRef.update({
                indexingStatus: 'failed',
                indexingError: errorMessage,
                indexedChunkCount: 0,
                updatedAt: new Date(),
            });
            throw new HttpsError('internal', `Indexing failed: ${errorMessage}`);
        }
    }
);

// ── Reusable core ──────────────────────────────────────────────────────────

/**
 * Core indexing routine — called by both the manual callable (indexStructuredDocument)
 * and the automatic Firestore trigger (autoIndexOnExtractionReady). No auth check;
 * callers are responsible for authorization.
 *
 * Returns either the chunk count on success, or a skip reason. Updates the resource's
 * `indexingStatus` in Firestore throughout the process.
 */
export async function indexResourceChunks(
    resourceId: string,
    options: { force?: boolean; geminiKey: string } = { geminiKey: '' }
): Promise<
    | { success: true; chunkCount: number; pageRange?: { min: number; max: number } }
    | { success: true; skipped: true; reason: string; chunkCount?: number }
> {
    const { force = false, geminiKey } = options;
    if (!geminiKey) throw new Error('GEMINI_API_KEY is required');

    const db = getFirestore();
    const storage = getStorage();
    const resourceRef = db.collection('library_resources').doc(resourceId);
    const snap = await resourceRef.get();
    if (!snap.exists) throw new Error(`Resource ${resourceId} not found`);
    const data = snap.data()!;

    if (!isStructuredExtractionVersion(data.extractionVersion)) {
        return { success: true, skipped: true, reason: 'not-extracted' };
    }
    if (!data.structuredContentUrl) {
        return { success: true, skipped: true, reason: 'no-structured-content' };
    }
    // Ver el comentario equivalente en la callable: `needsReindex`
    // manda sobre «ya indexado».
    if (!force && data.needsReindex !== true && data.indexerVersion === INDEXER_VERSION) {
        return { success: true, skipped: true, reason: 'already-indexed' };
    }

    const title: string = data.title ?? 'Documento sin título';
    const author: string = data.author ?? 'Autor desconocido';
    const userId: string = data.userId;
    const stores: string[] = data.coreStores ?? [];

    const { bucket: bucketName, path: mdPath } = parseFirebaseStorageLocation(
        data.structuredContentUrl,
        'dosfilosapp.firebasestorage.app'
    );
    if (!mdPath) throw new Error(`Bad structuredContentUrl: ${data.structuredContentUrl}`);
    const [mdBuffer] = await storage.bucket(bucketName).file(mdPath).download();
    let markdown = mdBuffer.toString('utf-8');

    // Mismo saneamiento que la callable: este es el camino del trigger
    // automático, y es el que corre para casi todos los libros.
    const mdSan = sanitizeExtractedText(markdown);
    markdown = mdSan.text;
    let sanitizationReport = mdSan.report;
    const mdSanSummary = describeSanitization(mdSan.report);
    if (mdSanSummary) console.log(`🧼 [IndexResource] ${title}: ${mdSanSummary}`);

    let chunks = chunkStructuredMarkdown(markdown, { maxChars: 2000, minChars: 200, overlapChars: 150 });
    if (chunks.length < 3 && data.textContent && data.textContent.length > 1000) {
        assertFallbackIsWholeBook(data, title);
        const fallbackSan = sanitizeExtractedText(
            (data.textContent as string).replace(/\[PAGE\s+(\d+)\]/gi, '<!-- page: $1 -->')
        );
        markdown = fallbackSan.text;
        sanitizationReport = fallbackSan.report;
        chunks = chunkStructuredMarkdown(markdown, { maxChars: 2000, minChars: 200, overlapChars: 150 });
    }
    // Drop empty / whitespace-only chunks — Gemini's batchEmbedContents
    // rejects the WHOLE batch when even one Part is empty (see comment
    // at the same filter in the callable handler above).
    chunks = chunks.filter(c => c.text && c.text.trim().length > 0);
    if (chunks.length === 0) {
        return { success: true, skipped: true, reason: 'empty-document', chunkCount: 0 };
    }

    try {
        await resourceRef.update({ indexingStatus: 'processing', updatedAt: new Date() });

        const embedStart = Date.now();
        console.log(`[Index ${resourceId}] Embedding ${chunks.length} chunks...`);
        const embedResults = await embedChunksBatched(chunks.map(c => c.text), geminiKey);

        // Pair surviving (chunk, vector) entries — see the equivalent
        // logic in the callable handler above for the rationale.
        const survivors: Array<{ chunk: typeof chunks[number]; vector: number[] }> = [];
        for (let i = 0; i < chunks.length; i++) {
            const r = embedResults[i];
            if (r?.values) survivors.push({ chunk: chunks[i], vector: r.values });
        }
        const failedCount = chunks.length - survivors.length;
        if (failedCount > 0) {
            console.warn(`[Index ${resourceId}] ${failedCount}/${chunks.length} chunks failed to embed; indexing the remaining ${survivors.length}`);
        }
        if (survivors.length === 0) {
            throw new Error(`All ${chunks.length} chunks failed to embed`);
        }
        if (failedCount / chunks.length > 0.5) {
            throw new Error(`${failedCount}/${chunks.length} chunks failed to embed (>50%); refusing partial index`);
        }
        console.log(`[Index ${resourceId}] Embedded ${survivors.length} chunks in ${Math.round((Date.now() - embedStart) / 1000)}s`);

        await deleteExistingChunks(db, resourceId);

        // Firestore allows up to 500 writes per WriteBatch. For
        // dictionary-class resources (TDNT, BDAG) we hit 5000+ chunks
        // — sequential `.set()` calls would take 500-700s on top of
        // embedding time, blowing past the trigger's 540s timeout.
        // Batched writes finish in ~10s for the same volume.
        const now = new Date();
        const BATCH_WRITE_LIMIT = 500;
        const writeStart = Date.now();
        let writtenChunks = 0;
        for (let i = 0; i < survivors.length; i += BATCH_WRITE_LIMIT) {
            const slice = survivors.slice(i, i + BATCH_WRITE_LIMIT);
            const escrituras: Escritura[] = [];
            for (let j = 0; j < slice.length; j++) {
                const { chunk: c, vector } = slice[j]!;
                const chunkIndex = i + j;
                const id = `${resourceId}_chunk_${chunkIndex}`;
                escrituras.push([db.collection(CHUNK_COLLECTION).doc(id), {
                    resourceId,
                    resourceTitle: title,
                    resourceAuthor: author,
                    userId,
                    chunkIndex,
                    text: c.text,
                    embedding: FieldValue.vector(vector),
                    metadata: {
                        page: c.page,
                        section: c.section ?? null,
                        sectionPath: safeSectionPath(c.sectionPath),
                        chunkType: c.chunkType,
                        startChar: c.charStart,
                        endChar: c.charEnd,
                    },
                    // Los pasajes bíblicos que nombra, para buscar por pasaje (etapa 3).
                    refs: refsDeFragmento(c.text, c.sectionPath),
                    stores,
                    indexerVersion: INDEXER_VERSION,
                    createdAt: now,
                }]);
            }
            await escribirEnTandas(db, escrituras);
            writtenChunks += slice.length;
            // Heartbeat per batch — without this the indexer is
            // completely silent for the duration of the writes,
            // making "is it stuck?" indistinguishable from "still
            // working" when the next thing happens to be a runtime
            // timeout kill.
            console.log(`[Index ${resourceId}] Wrote ${writtenChunks}/${survivors.length} chunks (${Math.round((Date.now() - writeStart) / 1000)}s elapsed)`);
        }

        const coverage = assessIndexCoverage(survivors.map(s => s.chunk.page), data.pageCount);
        const coverageWarning = describeIndexCoverage(coverage);
        if (coverageWarning) console.warn(`⚠️ [Index ${resourceId}] ${coverageWarning}`);

        await resourceRef.update({
            indexCoverage: coverage,
            indexingWarning: coverageWarning,
            indexingStatus: 'ready',
            indexerVersion: INDEXER_VERSION,
            indexedChunkCount: survivors.length,
            indexedAt: now,
            needsReindex: false,
            indexingError: null, // clear any prior failure on success
            // Re-arm the daily failure alert. Without this, a resource
            // that fails, gets fixed, then fails again would stay silent
            // forever — the alert stamps once and never un-stamps.
            indexFailureAlertedAt: null,
            sanitization: {
                removed: sanitizationReport.removed,
                byCategory: sanitizationReport.byCategory,
                greekBreathingsComposed: sanitizationReport.greekBreathingsComposed,
                at: now,
            },
            updatedAt: now,
        });

        return {
            success: true,
            chunkCount: survivors.length,
            pageRange: {
                min: Math.min(...survivors.map(s => s.chunk.page)),
                max: Math.max(...survivors.map(s => s.chunk.page)),
            },
        };
    } catch (err: any) {
        const errorMessage = err?.message ?? 'Unknown error';
        await discardPartialIndex(db, resourceId);
        await resourceRef.update({
            indexingStatus: 'failed',
            indexingError: errorMessage,
            indexedChunkCount: 0,
            updatedAt: new Date(),
        });
        throw err;
    }
}

/**
 * El `textContent` de Firestore no es fuente de verdad.
 *
 * Es una COPIA topada a 800.000 bytes para vistas rápidas: cuando el
 * libro no cabe, el corte cae donde caiga. Indexar desde ahí produce
 * chunks con páginas reales y calidad normal —el fallback funciona— y
 * por eso la tarjeta quedaba verde con medio libro adentro.
 *
 * Si el `structured.md` vino vacío y la única alternativa es una copia
 * truncada, corresponde fallar y decirlo, no indexar un pedazo.
 */
function assertFallbackIsWholeBook(data: FirebaseFirestore.DocumentData, title: string): void {
    if (data.wasTruncated !== true) return;
    throw new Error(
        `${title}: el structured.md no trajo texto y la copia de respaldo está truncada `
        + `(${data.pageCount ?? '?'} páginas declaradas). Indexar desde ahí dejaría el libro a medias. `
        + 'Reprocesa el documento con Premium.',
    );
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Embedding API constants. Gemini caps individual chunk input at
// ~2048 tokens (~8000 chars). We truncate at 7800 chars to leave a
// safety margin for non-ASCII tokens (Greek/Hebrew average more
// bytes per token).
const MAX_EMBEDDING_INPUT_CHARS = 7800;

/**
 * Embedding result for ONE chunk. `values` is the dense vector when
 * embedding succeeded; `error` carries a short diagnostic when it
 * failed. The indexer uses this to skip-and-continue instead of
 * killing the whole job for one bad chunk.
 */
interface ChunkEmbedding {
    values: number[] | null;
    error?: string;
}

/**
 * Gemini embedding pipeline — fault tolerant by design.
 *
 * Strategy:
 *   1. Try batch (`batchEmbedContents`, 20 chunks per call) for speed.
 *   2. If batch fails with a NON-retryable error (e.g. one chunk has
 *      an "empty Part" or exceeds the input size cap), drop to
 *      per-chunk single-`embedContent` calls. Slow but bulletproof:
 *      one bad chunk can't kill the rest.
 *   3. Each chunk is independently retried on 429/5xx with backoff.
 *   4. Chunks that genuinely can't be embedded come back with
 *      `values: null` + `error: <reason>` so the caller can skip them
 *      and continue, instead of aborting the whole indexing job.
 *
 * Returns a parallel array — same length as `texts`, same order.
 * Caller filters out `values === null` entries before writing chunks.
 */
async function embedChunksBatched(texts: string[], apiKey: string): Promise<ChunkEmbedding[]> {
    const all: ChunkEmbedding[] = [];
    const PAUSE_BETWEEN_BATCHES_MS = 1200;  // ~50 RPM conservative

    // Pre-truncate any oversized chunks. Embedding API rejects
    // chunks > ~2048 tokens with INVALID_ARGUMENT, killing the batch.
    const safeTexts = texts.map(t => t.length > MAX_EMBEDDING_INPUT_CHARS ? t.substring(0, MAX_EMBEDDING_INPUT_CHARS) : t);

    for (let i = 0; i < safeTexts.length; i += EMBEDDING_BATCH_SIZE) {
        const batch = safeTexts.slice(i, i + EMBEDDING_BATCH_SIZE);
        const batchResult = await embedBatchWithFallback(batch, apiKey);
        all.push(...batchResult);
        if (i + EMBEDDING_BATCH_SIZE < safeTexts.length) {
            await new Promise(resolve => setTimeout(resolve, PAUSE_BETWEEN_BATCHES_MS));
        }
    }
    return all;
}

/**
 * Try a batch embedding; on non-retryable failure fall back to
 * per-chunk individual embedding so one bad input can't kill the
 * other 19 valid chunks.
 */
async function embedBatchWithFallback(texts: string[], apiKey: string): Promise<ChunkEmbedding[]> {
    try {
        const vectors = await embedBatchWithRetry(texts, apiKey);
        return vectors.map(v => ({ values: v }));
    } catch (batchErr: any) {
        const msg = batchErr?.message ?? String(batchErr);
        console.warn(`[IndexStructured] Batch embedding failed; falling back to per-chunk. Reason: ${msg.substring(0, 200)}`);
        // Per-chunk fallback: each chunk gets its own attempt with
        // independent retry. Failures get recorded but don't abort.
        const out: ChunkEmbedding[] = [];
        for (let i = 0; i < texts.length; i++) {
            try {
                const vectors = await embedBatchWithRetry([texts[i]], apiKey);
                out.push({ values: vectors[0] });
            } catch (chunkErr: any) {
                const chunkMsg = chunkErr?.message ?? String(chunkErr);
                console.warn(`[IndexStructured] Chunk ${i} failed individually: ${chunkMsg.substring(0, 200)}`);
                out.push({ values: null, error: chunkMsg.substring(0, 200) });
            }
            // Tighter pacing in single-chunk mode to avoid 429.
            if (i < texts.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        return out;
    }
}

/**
 * Embed a batch with exponential backoff retry on rate-limit (429) errors.
 * Throws on non-retryable errors so the per-chunk fallback can take over.
 */
async function embedBatchWithRetry(texts: string[], apiKey: string, maxRetries = 5): Promise<number[][]> {
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await embedBatch(texts, apiKey);
        } catch (err: any) {
            lastErr = err;
            const msg = err?.message ?? '';
            const is429 = /\(429\)/.test(msg) || /RESOURCE_EXHAUSTED/i.test(msg);
            const is5xx = /\(5\d{2}\)/.test(msg);
            if (!is429 && !is5xx) throw err;   // Non-retryable errors propagate
            if (attempt === maxRetries) break;

            // Exponential backoff: 2s, 4s, 8s, 16s, 32s
            const waitMs = Math.min(32_000, 2_000 * Math.pow(2, attempt));
            console.log(`[IndexStructured] Rate limited (attempt ${attempt + 1}/${maxRetries + 1}). Waiting ${waitMs / 1000}s…`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
        }
    }
    throw lastErr ?? new Error('Embedding failed after retries');
}

async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`;
    const body = {
        requests: texts.map(text => ({
            model: EMBEDDING_MODEL,
            content: { parts: [{ text }] },
            taskType: 'RETRIEVAL_DOCUMENT',
            // gemini-embedding-001 defaults to 3072 dims (exceeds Firestore's 2048 cap).
            // We request 768 dims to match our Firestore vector index configuration.
            outputDimensionality: 768,
        })),
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini embedding failed (${res.status}): ${errText.substring(0, 500)}`);
    }

    const json = await res.json() as { embeddings?: Array<{ values: number[] }> };
    if (!json.embeddings) throw new Error('Gemini embedding response missing embeddings field');
    return json.embeddings.map(e => e.values);
}

/**
 * Best-effort rollback for an indexing run that died mid-write.
 *
 * The write loop is not transactional: it deletes the previous chunks
 * up front, then writes the new ones batch by batch. If it throws at
 * batch N, batches 0..N-1 are already committed and the resource is
 * about to be marked `'failed'` — leaving a book that reports itself
 * broken while a partial, silently truncated slice of it stays live in
 * `findNearest`. Retrieval would quote page 40 of a 425-page commentary
 * and never reveal that the other 385 pages are missing.
 *
 * Deleting the partial index is the safer end state: the resource is
 * plainly absent from retrieval until a retry succeeds. Failures here
 * are swallowed on purpose — this runs inside a `catch`, and masking
 * the original indexing error with a cleanup error would hide the
 * reason the user actually needs to see.
 */
async function discardPartialIndex(
    db: FirebaseFirestore.Firestore,
    resourceId: string
): Promise<void> {
    try {
        await deleteExistingChunks(db, resourceId);
    } catch (cleanupErr: any) {
        console.error(
            `[IndexStructured] ${resourceId}: could not discard partial index — `
            + `chunks may be orphaned: ${cleanupErr?.message ?? cleanupErr}`,
        );
    }
}

type Escritura = [FirebaseFirestore.DocumentReference, FirebaseFirestore.DocumentData];

/**
 * Escribe en una tanda y, si Firestore la rechaza por grande, la parte en dos
 * y reintenta. Las entradas de índice cuentan para ese límite, y desde la
 * etapa 3 cada fragmento suma las de `refs` (hasta 120 en un diccionario):
 * una tanda de 500 que antes pasaba podría dejar de pasar.
 */
export async function escribirEnTandas(db: FirebaseFirestore.Firestore, escrituras: ReadonlyArray<Escritura>): Promise<void> {
    if (escrituras.length === 0) return;
    const batch = db.batch();
    for (const [ref, data] of escrituras) batch.set(ref, data);
    try {
        await batch.commit();
    } catch (err) {
        const grande = err instanceof Error && /too big|too large|exceeds the maximum|INVALID_ARGUMENT/i.test(err.message);
        if (!grande || escrituras.length <= 1) throw err;
        const mitad = Math.ceil(escrituras.length / 2);
        console.warn(`[IndexStructured] tanda de ${escrituras.length} demasiado grande; la parto en dos`);
        await escribirEnTandas(db, escrituras.slice(0, mitad));
        await escribirEnTandas(db, escrituras.slice(mitad));
    }
}

async function deleteExistingChunks(
    db: FirebaseFirestore.Firestore,
    resourceId: string
): Promise<void> {
    const snap = await db
        .collection(CHUNK_COLLECTION)
        .where('resourceId', '==', resourceId)
        .get();

    if (snap.empty) return;
    console.log(`[IndexStructured] Deleting ${snap.size} previous chunks for ${resourceId}`);

    // Individual deletes to avoid "Transaction too big" when vector index updates
    // are expensive. Batching 500 deletes with vector index reindexing overflows.
    for (let i = 0; i < snap.docs.length; i++) {
        await snap.docs[i].ref.delete();
        if ((i + 1) % 50 === 0 || i === snap.docs.length - 1) {
            console.log(`[IndexStructured] deleted ${i + 1}/${snap.docs.length} old chunks`);
        }
    }
}

