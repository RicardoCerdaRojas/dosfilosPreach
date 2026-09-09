import {
    LibraryResourceEntity,
    ResourceType,
    STRUCTURED_EXTRACTION_VERSIONS,
    isStructuredExtractionVersion,
    type LibraryResource,
    type ResourceIndexStatus,
    type SourceType as ExegesisSourceType,
} from '@dosfilos/domain';
import {
    FirebaseLibraryRepository,
    FirebaseStorageService,
    GeminiEmbeddingService,
    MemoryCacheService,
    FirestoreVectorRepository
} from '@dosfilos/infrastructure';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { RAGService } from './RAGService';

/**
 * Generic shape returned by `getCoreStoresConfig` — keys + optional descriptions
 * for custom (admin-defined) stores. Decouples consumers from the underlying
 * Firestore document structure and from the strict 3-context typing of
 * `CoreLibraryStoresConfig`.
 */
export interface CoreStoresConfigSummary {
    /** Available store keys (e.g. ['exegesis', 'homiletics', 'generic', 'patristic']). */
    keys: string[];
    /** Optional human-readable description per key — typically used for custom (non-standard) stores. */
    descriptions: Record<string, string>;
}

/**
 * LibraryService
 * Manages user library resources and integrates with RAG for semantic search
 * 
 * Storage Structure: users/{userId}/library/{resourceId}/{filename}
 * Cloud Function automatically extracts text when PDF is uploaded
 */
export class LibraryService {
    private libraryRepository: FirebaseLibraryRepository;
    private storageService: FirebaseStorageService;
    private ragService: RAGService | null = null;

    constructor() {
        this.libraryRepository = new FirebaseLibraryRepository();
        this.storageService = new FirebaseStorageService();
    }

    /**
     * Lazy initialization of RAGService
     * Only created when needed to avoid API key issues on startup
     */
    private getRAGService(): RAGService | null {
        if (!this.ragService) {
            // Antes esto colgaba de la presencia de la clave en el bundle. Los
            // embeddings salieron del navegador en #428 (callable `embedTexts`),
            // así que el servicio se construye siempre. Con el gate viejo,
            // borrar la variable habría devuelto `null` acá y la búsqueda
            // semántica habría desaparecido en silencio: este método ya
            // devuelve `null` como caso normal, así que nadie habría visto un
            // error.
            const embeddingService = new GeminiEmbeddingService();
            const vectorRepository = new FirestoreVectorRepository();
            const cacheService = new MemoryCacheService();
            this.ragService = new RAGService(embeddingService, vectorRepository, cacheService);
        }
        return this.ragService;
    }

    /**
     * Upload a resource to Firebase Storage and create Firestore document
     * Cloud Function will automatically extract text from PDF
     */
    async uploadResource(
        userId: string,
        file: File,
        metadata: {
            title: string;
            author: string;
            type: ResourceType;
            /**
             * Optional user-chosen extraction tier. Persisted on the
             * resource doc so the storage-trigger cloud function can
             * honor the choice instead of running its default
             * premium-first cascade. Omit for the legacy auto behavior.
             */
            requestedExtractionMode?: 'standard' | 'premium';
            /**
             * v1.7 smart-match metadata. Typically autocompleted by
             * `inferBibleBooksFromTitle` from the title before the
             * upload form submits. Persisted so the paper-corpus
             * smart-match dialog can pre-filter the user's library
             * to resources covering the paper's passage.
             *
             * Omit when the inferer returned null/empty so legacy
             * defaults (`[]` + `'book'`) kick in via the repo
             * deserializer — the metadata editor will then nudge
             * the user to fill them in.
             */
            coversBibleBooks?: ReadonlyArray<import('@dosfilos/domain').BibleBookId>;
            scope?: import('@dosfilos/domain').LibraryResourceScope;
        },
        onProgress?: (percentage: number) => void
    ): Promise<LibraryResourceEntity> {
        // 1. Generate resource ID first
        const resourceId = crypto.randomUUID();

        // 2. Upload file to Firebase Storage: users/{userId}/library/{resourceId}/{filename}
        const storagePath = `users/${userId}/library/${resourceId}/${file.name}`;
        console.log(`📤 Uploading to: ${storagePath}`);

        const uploadedFile = await this.storageService.uploadFile(
            file,
            storagePath,
            { contentType: file.type },
            (progress) => {
                console.log(`Upload progress: ${progress.percentage.toFixed(0)}%`);
                onProgress?.(progress.percentage);
            }
        );

        // 3. Create resource entity with the storage URL
        const resource = new LibraryResourceEntity(
            resourceId,
            userId,
            metadata.title,
            metadata.author,
            metadata.type,
            uploadedFile.downloadUrl,
            file.type,
            file.size,
            undefined, // textExtractionStatus
            undefined, // textContent
            new Date(),
            new Date()
        );
        // Set the requested extraction mode if the caller specified one.
        // The cloud function reads this off the doc to skip / prefer
        // LlamaParse accordingly.
        if (metadata.requestedExtractionMode) {
            resource.requestedExtractionMode = metadata.requestedExtractionMode;
        }
        // Carry inferred smart-match metadata onto the entity so the
        // serializer writes it to Firestore. Skipping when caller
        // omits keeps legacy fallback behavior in the repo.
        if (metadata.coversBibleBooks) {
            resource.coversBibleBooks = metadata.coversBibleBooks;
        }
        if (metadata.scope) {
            resource.scope = metadata.scope;
        }

        // 4. Save to Firestore
        await this.libraryRepository.create(resource);

        console.log(`✅ Resource ${resource.id} uploaded. Cloud Function will extract text.`);

        return resource;
    }

    /**
     * Index a resource for semantic search. Call after extraction finished.
     *
     * Dispatches between two indexers that are NOT equivalent — see the
     * routing comment in the body. Resources from a structured extractor
     * go to the `indexStructuredDocument` callable (real page numbers,
     * writes `indexingStatus`); only pre-contract legacy resources fall
     * through to the browser-side `RAGService`.
     *
     * @param resource - The resource to index
     * @param options.force - Rebuild even if already indexed
     * @param options.onProgress - Progress callback (0-100, stage name).
     *   Only fires on the legacy browser path; the cloud callable is a
     *   single opaque round-trip.
     */
    async indexResource(
        resource: LibraryResourceEntity,
        options: { force?: boolean; onProgress?: (progress: number, stage: string) => void } = {}
    ): Promise<number> {
        // Refresh resource from Firestore to get latest extraction state.
        const freshResource = await this.libraryRepository.findById(resource.id);
        if (!freshResource) {
            console.warn(`Resource ${resource.id} not found`);
            throw new Error('TEXT_NOT_READY');
        }

        // Check if text extraction is ready
        if (freshResource.textExtractionStatus !== 'ready') {
            console.warn(`Resource ${resource.id} text extraction status: ${freshResource.textExtractionStatus}`);
            throw new Error('TEXT_NOT_READY');
        }

        // ── Route: cloud indexer vs legacy browser indexer ─────────────────
        //
        // These two paths are NOT interchangeable, and picking the wrong one
        // silently corrupts citations rather than failing.
        //
        //   Cloud (`indexStructuredDocument`) reads the extractor's
        //   `structured.md`, so every chunk carries the REAL page number, a
        //   section breadcrumb and character offsets — and the callable
        //   records `indexingStatus` on the resource when it finishes.
        //
        //   Legacy (`RAGService`, in the browser) chunks the flat
        //   `textContent` field and INVENTS the page as
        //   `Math.floor(chunkIndex / 3) + 1`. It also never writes
        //   `indexingStatus`, so the resource stays stuck on whatever it
        //   said before.
        //
        // Everything the structured extractors produced must go to the
        // cloud. The browser path survives only for pre-contract resources
        // ('2.0-gemini', 'fallback-pdfparse'), which the callable refuses
        // outright — for those, an approximate index beats none.
        if (isStructuredExtractionVersion(freshResource.extractionVersion)
            && freshResource.structuredContentUrl) {
            const fn = httpsCallable<
                { resourceId: string; force: boolean },
                { chunkCount?: number; skipped?: boolean }
            >(getFunctions(), 'indexStructuredDocument', { timeout: 900_000 });
            const result = await fn({ resourceId: resource.id, force: options.force ?? false });
            return result.data?.chunkCount ?? 0;
        }

        const rag = this.getRAGService();
        if (!rag) {
            console.warn('RAGService not available, skipping indexing');
            return 0;
        }

        // Get text content from Firestore (Gemini stores it there directly)
        const textContent = freshResource.textContent;
        if (!textContent || textContent.length < 100) {
            console.warn(`Resource ${resource.id} has no text content yet. Cloud Function may still be processing.`);
            throw new Error('TEXT_NOT_READY');
        }

        console.log(`📄 Indexing resource ${resource.id} with ${textContent.length} characters`);

        try {
            const chunksCreated = await rag.indexResource(freshResource, { force: options.force }, options.onProgress);
            console.log(`Indexed resource ${resource.id} with ${chunksCreated} chunks`);
            return chunksCreated;
        } catch (error) {
            console.error(`Error indexing resource ${resource.id}:`, error);
            return 0;
        }
    }

    /**
     * Index all resources for a user
     */
    async indexAllResources(userId: string): Promise<number> {
        const resources = await this.getUserResources(userId);
        let totalChunks = 0;

        for (const resource of resources) {
            if (resource.textContent && resource.textContent.length > 100) {
                const chunks = await this.indexResource(resource);
                totalChunks += chunks;
            }
        }

        return totalChunks;
    }

    /**
     * Search for relevant chunks across user's library
     */
    async searchLibrary(
        query: string,
        userId: string,
        resourceIds?: string[],
        topK: number = 10
    ) {
        const rag = this.getRAGService();
        if (!rag) {
            console.warn('RAGService not available');
            return [];
        }

        return rag.search(query, userId, resourceIds, topK);
    }

    /**
     * Check if a resource is indexed
     */
    /**
     * ¿Cuáles de estos recursos están indexados?
     *
     * La alternativa era llamar a `isResourceIndexed` en un bucle, que es como
     * estaba: una consulta por recurso, en fila. Acá va una por cada treinta.
     *
     * Sin RAG configurado devuelve el conjunto vacío, igual que la versión de
     * uno solo devuelve `false`: no se puede afirmar que algo esté indexado
     * cuando no hay con qué comprobarlo.
     */
    async indexedResourcesAmong(resourceIds: readonly string[]): Promise<Set<string>> {
        const rag = this.getRAGService();
        if (!rag) return new Set<string>();
        return rag.indexedAmong(resourceIds);
    }

    async isResourceIndexed(resourceId: string): Promise<boolean> {
        const rag = this.getRAGService();
        if (!rag) {
            return false;
        }
        const result = await rag.isIndexed(resourceId);
        return result;
    }

    /**
     * Get a single resource by ID
     */
    async getResource(resourceId: string): Promise<LibraryResourceEntity | null> {
        return this.libraryRepository.findById(resourceId);
    }

    async getUserResources(userId: string): Promise<LibraryResourceEntity[]> {
        return this.libraryRepository.findByUserId(userId);
    }

    /**
     * Returns the user's own resources alongside platform-preloaded
     * system resources (e.g. SBL GNT). System resources appear at the
     * top of the list — they're freebies the user didn't upload, so
     * surfacing them first reinforces "this came with the platform".
     * The UI badges them and disables edit/delete.
     */
    async getUserResourcesWithSystem(userId: string): Promise<LibraryResourceEntity[]> {
        const [own, system] = await Promise.all([
            this.libraryRepository.findByUserId(userId),
            this.libraryRepository.findSystemResources(),
        ]);
        return [...system, ...own];
    }

    async getCoreResources(): Promise<LibraryResourceEntity[]> {
        return this.libraryRepository.findCoreResources();
    }

    async getSystemResources(): Promise<LibraryResourceEntity[]> {
        return this.libraryRepository.findSystemResources();
    }

    /**
     * Combined readiness probe used by the v1.5 exegesis "extract from
     * library" UI. Mirrors the gating logic of the auto-index trigger
     * (`packages/functions/src/library/autoIndexOnExtractionReady.ts`)
     * so the badge the user sees matches what the trigger will (or
     * will not) do for each resource.
     *
     * Resolution order — first matching condition wins:
     *   1. extraction failed → 'failed'
     *   2. extraction in flight (pending/processing) → 'extracting'
     *   3. indexing failed → 'failed'
     *   4. indexing in flight → 'indexing'
     *   5. indexed at the current schema → 'indexed'
     *   6. extraction ready but extractor version not eligible for
     *      auto-index (e.g. legacy '2.0-gemini') → 'needs-indexing'
     *   7. anything else (typically resources without
     *      `textExtractionStatus` set yet) → 'needs-extraction'
     *
     * Note: the user CANNOT trigger reindexing themselves — the
     * `processWithGemini`/`reprocessWithLlamaParse` callables are
     * admin-only by design. Resources stuck on 'needs-indexing' /
     * 'failed' can still be used in `'full-document'` mode (the
     * orchestrator falls back to `textContent`); they just can't be
     * source of curated excerpts. The corpus picker disables the
     * "extract excerpts" toggle for those.
     */
    getResourceIndexStatus(resource: LibraryResource): ResourceIndexStatus {
        const AUTO_INDEX_EXTRACTORS: ReadonlyArray<string> = STRUCTURED_EXTRACTION_VERSIONS;

        // Status decision mirrors `useLibraryResources.checkAllIndexStatus`
        // exactly so the corpus picker and the library card never disagree
        // about the same resource. A user who sees "Listo" on the library
        // card was previously confused when the corpus picker showed
        // "Sin indexar" for the same item — driven by an `indexerVersion`
        // strict check that's no longer necessary now that we're on a
        // single indexer schema.

        // Hard failure of the extractor.
        if (resource.textExtractionStatus === 'failed') return 'failed';
        // Extractor is still working.
        if (resource.textExtractionStatus === 'pending'
            || resource.textExtractionStatus === 'processing') return 'extracting';
        // Indexer recorded a state.
        if (resource.indexingStatus === 'failed') return 'failed';
        if (resource.indexingStatus === 'processing') return 'indexing';
        if (resource.indexingStatus === 'ready') return 'indexed';
        // No indexer state yet but extraction succeeded with an
        // auto-indexable version — the trigger fires in <1s, so report
        // "indexing" optimistically rather than the misleading
        // "needs-extraction" the user sees as "Sin procesar".
        if (resource.textExtractionStatus === 'ready'
            && resource.extractionVersion
            && AUTO_INDEX_EXTRACTORS.includes(resource.extractionVersion)) {
            return 'indexing';
        }
        // Extraction succeeded with a legacy version the auto-indexer
        // doesn't pick up — needs a manual "Procesar" action.
        if (resource.textExtractionStatus === 'ready'
            && resource.extractionVersion
            && !AUTO_INDEX_EXTRACTORS.includes(resource.extractionVersion)) return 'needs-indexing';
        // Default: never extracted.
        return 'needs-extraction';
    }

    subscribeToUserResources(
        userId: string,
        callback: (resources: LibraryResourceEntity[]) => void,
        onError?: (error: Error) => void
    ): () => void {
        return this.libraryRepository.subscribeToUserResources(userId, callback, onError);
    }

    /**
     * Re-runs LlamaParse extraction on a resource the user owns. Used by
     * the "Reintentar Premium" action in the card when the original
     * extraction degraded from the user's requested tier (e.g. Premium →
     * Standard because all LlamaParse accounts failed at upload time).
     *
     * The callable verifies ownership and pre-checks the user's premium
     * page balance before starting, so callers don't need to do either —
     * just await the promise and toast on the typed errors:
     *   - 'resource-exhausted' → not enough premium pages
     *   - 'permission-denied'  → not the owner (also catches admin gate)
     *   - 'failed-precondition' → no LlamaParse account configured
     *   - 'internal'           → LlamaParse cascade failed; message has details
     *
     * Returns the new pageCount so the caller can update local cache,
     * but most consumers just rely on the Firestore listener to push
     * the fresh state.
     */
    async retryWithPremium(resourceId: string): Promise<{ success: boolean; pageCount?: number; skipped?: boolean }> {
        const fn = httpsCallable<
            { resourceId: string; force: boolean },
            { success: boolean; pageCount?: number; skipped?: boolean }
        >(getFunctions(), 'reprocessWithLlamaParse', { timeout: 900_000 });
        const result = await fn({ resourceId, force: true });
        return result.data ?? { success: false };
    }

    /**
     * Cancels an in-progress extraction by deleting the resource +
     * its chunks + storage objects. Used by the "Cancelar" button on
     * the card during the pending/processing/indexing window — gives
     * the user a way out before the cascade finishes (and burns LLM
     * credits) on the wrong file.
     *
     * The server-side callable enforces ownership; client just fires
     * the request and lets the Firestore listener pull the deletion.
     * No refund needed (debit only happens AFTER extraction completes).
     *
     * Throws on:
     *   - 'failed-precondition' → resource is already 'ready' (use
     *     Delete instead)
     *   - 'permission-denied'  → not the owner
     *   - 'unauthenticated'    → not signed in
     */
    async cancelExtraction(resourceId: string): Promise<void> {
        const fn = httpsCallable<
            { resourceId: string },
            { success: boolean; alreadyGone?: boolean }
        >(getFunctions(), 'cancelExtraction', { timeout: 60_000 });
        await fn({ resourceId });
    }

    async deleteResource(id: string): Promise<void> {
        console.log(`🗑️ Starting delete for resource: ${id}`);

        // Delete from vector store first
        const rag = this.getRAGService();
        if (rag) {
            try {
                console.log(`🗑️ Deleting vector index...`);
                await rag.deleteIndex(id);
                console.log(`✅ Vector index deleted`);
            } catch (error) {
                console.error(`❌ Vector index delete failed:`, error);
                // Continue with resource delete even if vector fails
            }
        }

        console.log(`🗑️ Deleting from Firestore...`);
        await this.libraryRepository.delete(id);
        console.log(`✅ Resource deleted from Firestore`);
    }

    /**
     * Update resource metadata (title, author, type)
     */
    /**
     * Update resource metadata (title, author, type, core library status)
     */
    async updateResource(
        id: string,
        updates: {
            title?: string;
            author?: string;
            type?: ResourceType;
            metadata?: any;
            isCore?: boolean;
            coreContext?: 'exegesis' | 'homiletics' | 'generic';
            /**
             * v1.5 commit 6: cache the exegesis-grade classification
             * the user picked the first time they extracted from this
             * resource. Pass `null` to explicitly clear (rare —
             * usually only when the user changes their mind in the
             * extraction dialog).
             */
            exegeticalType?: ExegesisSourceType | null;
            /**
             * v1.7 smart-match metadata. Pass through to the repo,
             * which writes the array + scope to Firestore. The
             * paper-corpus dialog reads these to filter the user's
             * library to resources covering the paper's passage.
             */
            coversBibleBooks?: ReadonlyArray<import('@dosfilos/domain').BibleBookId>;
            scope?: import('@dosfilos/domain').LibraryResourceScope;
            /**
             * Cómo traduce este recurso la hoja del archivo al número que el
             * libro imprime. Lo escribe la calibración cuando una persona lo
             * confirma contra el ejemplar; sin él, las citas dicen «hoja N».
             */
            pageNumbering?: import('@dosfilos/domain').PageNumbering | null;
        }
    ): Promise<void> {
        console.log(`📝 Updating resource ${id}:`, updates);
        await this.libraryRepository.update(id, {
            ...updates,
            updatedAt: new Date()
        });
        console.log(`✅ Resource ${id} updated`);
    }

    /**
     * @deprecated Legacy Gemini File Search URI refresh — now a no-op.
     * Phase 2 RAG uses Firestore vector search + Storage-triggered extraction,
     * so there are no expiring URIs to refresh. Kept as a stub so residual
     * callers (e.g. the legacy library-context sync routine) don't crash.
     */
    async refreshGeminiLinks(_resourceIds: string[]): Promise<void> {
        // Intentionally empty. Remove all callers in a follow-up cleanup.
    }

    /**
     * Read the Core Library stores configuration. Returns the available store
     * keys + optional descriptions per key (used for custom admin-defined stores).
     *
     * Falls back to the standard 3 keys (`exegesis`, `homiletics`, `generic`) if
     * the config document doesn't exist or fails to load.
     *
     * Used by UI components that need to render the list of stores a resource
     * can be assigned to (e.g. `ConfigureCoreStoresModal`). Keeps consumers
     * decoupled from Firestore internals.
     */
    async getCoreStoresConfig(): Promise<CoreStoresConfigSummary> {
        const FALLBACK_KEYS = ['exegesis', 'homiletics', 'generic'];
        try {
            const db = getFirestore();
            const snap = await getDoc(doc(db, 'config/coreLibraryStores'));
            if (!snap.exists()) {
                return { keys: FALLBACK_KEYS, descriptions: {} };
            }
            const data = snap.data();
            const stores = (data?.stores ?? {}) as Record<string, string | null>;
            const descriptions = (data?.descriptions ?? {}) as Record<string, string>;
            const keys = Object.keys(stores);
            return {
                keys: keys.length > 0 ? keys : FALLBACK_KEYS,
                descriptions,
            };
        } catch (error) {
            console.error('[LibraryService] Failed to load Core stores config:', error);
            return { keys: FALLBACK_KEYS, descriptions: {} };
        }
    }

    /**
     * Resolves a store key (e.g. `'exegesis'`, `'patristic'`) to its underlying
     * provider store ID. Returns `null` when the key is not configured or the
     * config document doesn't exist. Abstracts Firestore from UI consumers.
     */
    async resolveStoreId(storeKey: string): Promise<string | null> {
        try {
            const db = getFirestore();
            const snap = await getDoc(doc(db, 'config/coreLibraryStores'));
            if (!snap.exists()) return null;
            const stores = (snap.data()?.stores ?? {}) as Record<string, string | null>;
            return stores[storeKey] ?? null;
        } catch (error) {
            console.error('[LibraryService] Failed to resolve store id:', error);
            return null;
        }
    }
}

export const libraryService = new LibraryService();
