import {
    IEmbeddingService,
    IVectorRepository,
    ICacheService,
    DocumentChunkEntity,
    ChunkSearchResult,
    LibraryResourceEntity,
    describeSanitization,
    sanitizeExtractedText
} from '@dosfilos/domain';

/**
 * Options for text chunking
 */
export interface ChunkingOptions {
    chunkSize?: number;      // Characters per chunk (default: 800)
    chunkOverlap?: number;   // Overlapping characters (default: 100)
    force?: boolean;         // Force re-indexing even if already exists
}

/**
 * RAGService - Retrieval Augmented Generation Service
 * 
 * Orchestrates the entire RAG pipeline:
 * 1. Text chunking
 * 2. Embedding generation
 * 3. Vector storage
 * 4. Semantic search
 * 
 * Uses Dependency Injection for all dependencies, allowing easy swapping
 * of embedding providers, vector stores, and cache implementations.
 */
export class RAGService {
    private embeddingService: IEmbeddingService;
    private vectorRepository: IVectorRepository;
    private cacheService: ICacheService;

    private static readonly CACHE_KEY_PREFIX = 'rag:';
    private static readonly EMBEDDING_CACHE_TTL = 86400; // 24 hours
    private static readonly SEARCH_CACHE_TTL = 300; // 5 minutes

    constructor(
        embeddingService: IEmbeddingService,
        vectorRepository: IVectorRepository,
        cacheService: ICacheService
    ) {
        this.embeddingService = embeddingService;
        this.vectorRepository = vectorRepository;
        this.cacheService = cacheService;
    }

    /**
     * Progress callback type for UI updates
     */
    public static readonly BATCH_SIZE = 50; // Process 50 embeddings at a time

    /**
     * Process a library resource: chunk, embed, and store
     * @param resource - The library resource to index
     * @param options - Chunking options
     * @param onProgress - Optional callback for progress updates (0-100)
     */
    async indexResource(
        resource: LibraryResourceEntity,
        options: ChunkingOptions = {},
        onProgress?: (progress: number, stage: string) => void
    ): Promise<number> {
        const reportProgress = (progress: number, stage: string) => {
            console.log(`📊 ${stage}: ${progress}%`);
            if (onProgress) onProgress(progress, stage);
        };

        reportProgress(0, 'Iniciando...');

        // Check if already indexed (unless forced)
        if (!options.force) {
            const isIndexed = await this.vectorRepository.hasIndex(resource.id);
            if (isIndexed) {
                console.log(`Resource ${resource.id} already indexed, skipping`);
                reportProgress(100, 'Ya indexado');
                return 0;
            }
        } else {
            console.log(`Resource ${resource.id} re-indexing forced`);
            // Optional: Delete existing index first to ensure clean slate
            // await this.deleteIndex(resource.id);
        }

        // Get text content
        const rawText = resource.textContent;
        if (!rawText || rawText.trim().length === 0) {
            console.log(`Resource ${resource.id} has no text content`);
            return 0;
        }

        // Saneamiento. Este camino legacy sólo atiende recursos pre-contrato,
        // pero su salida entra al MISMO índice que lee el modelo, así que el
        // texto tiene que llegar igual de limpio que por la ruta de la nube.
        const { text, report } = sanitizeExtractedText(rawText);
        const sanSummary = describeSanitization(report);
        if (sanSummary) console.log(`🧼 [RAG] ${resource.id}: ${sanSummary}`);

        // Chunk the text
        reportProgress(5, 'Dividiendo texto en fragmentos...');
        const chunks = this.chunkText(text, options);
        console.log(`📦 Created ${chunks.length} chunks for resource ${resource.id}`);

        try {
            // Generate embeddings in batches
            // Progress: 5-35% (embeddings are fast, ~30% of progress)
            reportProgress(5, 'Generando embeddings...');
            const embeddings: number[][] = [];
            const batchSize = RAGService.BATCH_SIZE;
            const totalBatches = Math.ceil(chunks.length / batchSize);

            for (let i = 0; i < chunks.length; i += batchSize) {
                const batchChunks = chunks.slice(i, i + batchSize);
                const batchNum = Math.floor(i / batchSize) + 1;

                // Generate batch embeddings using the service's batch method
                const batchEmbeddings = await this.embeddingService.generateEmbeddings(batchChunks);
                embeddings.push(...batchEmbeddings);

                // Report progress (5% to 35% for embeddings - fast phase)
                const embeddingProgress = 5 + Math.round((batchNum / totalBatches) * 30);
                reportProgress(embeddingProgress, `Embeddings: ${Math.min((i + batchSize), chunks.length)}/${chunks.length}`);
            }

            console.log(`✅ Generated ${embeddings.length} embeddings`);

            // Create DocumentChunkEntity objects
            // Progress: 35-40% (quick preparation)
            reportProgress(38, 'Preparando datos...');
            const chunkEntities = chunks.map((text, index) =>
                DocumentChunkEntity.create({
                    id: `${resource.id}_chunk_${index}`,
                    resourceId: resource.id,
                    resourceTitle: resource.title,
                    resourceAuthor: resource.author || 'Desconocido',
                    userId: resource.userId,
                    chunkIndex: index,
                    text,
                    embedding: embeddings[index],
                    metadata: {
                        page: this.estimatePage(index, chunks.length),
                        section: this.extractSection(text)
                    }
                })
            );

            // Store in vector repository with progress callback
            // Progress: 40-99% (Firestore is slow - 60% of progress)
            await this.vectorRepository.upsert(chunkEntities, (upsertProgress, upsertStage) => {
                const overallProgress = 40 + Math.round(upsertProgress * 0.59); // 40% to 99%
                reportProgress(overallProgress, upsertStage);
            });

            reportProgress(100, 'Indexado completado');
            console.log(`✅ Indexed ${chunkEntities.length} chunks for resource ${resource.id}`);

            return chunkEntities.length;
        } catch (error) {
            console.error(`❌ Error in indexResource:`, error);
            throw error;
        }
    }

    /**
     * Index multiple resources
     */
    async indexResources(resources: LibraryResourceEntity[]): Promise<number> {
        let totalChunks = 0;
        for (const resource of resources) {
            try {
                const count = await this.indexResource(resource);
                totalChunks += count;
            } catch (error) {
                console.error(`Error indexing resource ${resource.id}:`, error);
            }
        }
        return totalChunks;
    }

    /**
     * Search for relevant chunks across user's library
     */
    async search(
        query: string,
        userId: string,
        resourceIds?: string[],
        topK: number = 10
    ): Promise<ChunkSearchResult[]> {
        // Check cache first
        const cacheKey = this.getSearchCacheKey(query, userId, resourceIds, topK);
        const cached = await this.cacheService.get<ChunkSearchResult[]>(cacheKey);
        if (cached) {
            console.log('Search results from cache');
            return cached;
        }

        // Generate query embedding
        const queryEmbedding = await this.embeddingService.generateEmbedding(query);

        // Search vector repository
        const results = await this.vectorRepository.search(
            queryEmbedding,
            topK,
            { userId, resourceIds }
        );

        // Cache results
        await this.cacheService.set(cacheKey, results, RAGService.SEARCH_CACHE_TTL);

        return results;
    }

    /**
     * Delete index for a resource
     */
    async deleteIndex(resourceId: string): Promise<void> {
        await this.vectorRepository.deleteByResourceId(resourceId);
        await this.cacheService.deleteByPrefix(`${RAGService.CACHE_KEY_PREFIX}embed:${resourceId}`);
    }

    /**
     * Check if a resource is indexed
     */
    async isIndexed(resourceId: string): Promise<boolean> {
        return this.vectorRepository.hasIndex(resourceId);
    }

    /** ¿Cuáles de estos recursos están indexados? Una consulta de un documento por recurso, en paralelo. */
    async indexedAmong(resourceIds: readonly string[]): Promise<Set<string>> {
        return this.vectorRepository.hasIndexBatch(resourceIds);
    }

    // ==================== Private Methods ====================

    /**
     * Chunk text into overlapping segments
     */
    private chunkText(text: string, options: ChunkingOptions = {}): string[] {
        const chunkSize = options.chunkSize || 800;
        const overlap = options.chunkOverlap || 100;

        const chunks: string[] = [];
        let start = 0;

        while (start < text.length) {
            let end = start + chunkSize;

            // Try to break at sentence boundary
            if (end < text.length) {
                const sentenceEnd = text.lastIndexOf('.', end);
                if (sentenceEnd > start + chunkSize * 0.5) {
                    end = sentenceEnd + 1;
                }
            }

            const chunk = text.slice(start, end).trim();
            if (chunk.length > 50) { // Only add substantial chunks
                chunks.push(chunk);
            }

            start = end - overlap;
        }

        return chunks;
    }

    /**
     * Generate embeddings with caching
     */
    private async generateEmbeddingsWithCache(
        chunks: string[],
        resourceId: string
    ): Promise<number[][]> {
        const embeddings: number[][] = [];
        const total = chunks.length;

        for (let i = 0; i < chunks.length; i++) {
            const cacheKey = `${RAGService.CACHE_KEY_PREFIX}embed:${resourceId}:${i}`;

            // Log progress every 50 embeddings
            if (i % 50 === 0) {
                console.log(`   📊 Embedding progress: ${i}/${total} (${Math.round(i / total * 100)}%)`);
            }

            // Check cache
            const cached = await this.cacheService.get<number[]>(cacheKey);
            if (cached) {
                embeddings.push(cached);
                continue;
            }

            // Generate new embedding
            const chunkText = chunks[i];
            if (!chunkText) continue;
            const embedding = await this.embeddingService.generateEmbedding(chunkText);
            embeddings.push(embedding);

            // Cache it
            await this.cacheService.set(cacheKey, embedding, RAGService.EMBEDDING_CACHE_TTL);
        }

        console.log(`   📊 Embedding progress: ${total}/${total} (100%)`);
        return embeddings;

        return embeddings;
    }

    /**
     * Estimate page number based on chunk position
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private estimatePage(chunkIndex: number, _totalChunks: number): number {
        // Assume roughly 3 chunks per page
        return Math.floor(chunkIndex / 3) + 1;
    }

    /**
     * Extract section title if present in chunk
     */
    private extractSection(text: string): string | undefined {
        // Look for common heading patterns
        const patterns = [
            /^#+\s+(.+)$/m,           // Markdown headings
            /^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+)$/m,  // ALL CAPS lines
            /^(?:Capítulo|Chapter)\s+\d+[:\s]+(.+)$/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim().slice(0, 100);
            }
        }

        return undefined;
    }

    /**
     * Generate cache key for search
     */
    private getSearchCacheKey(
        query: string,
        userId: string,
        resourceIds?: string[],
        topK?: number
    ): string {
        const resourceKey = resourceIds?.sort().join(',') || 'all';
        const hash = this.simpleHash(`${query}:${userId}:${resourceKey}:${topK}`);
        return `${RAGService.CACHE_KEY_PREFIX}search:${hash}`;
    }

    /**
     * Simple hash function for cache keys
     */
    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
}
