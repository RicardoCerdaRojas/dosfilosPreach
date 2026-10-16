import {
    collection,
    doc,
    getDocs,
    query,
    where,
    limit,
    writeBatch
} from 'firebase/firestore';
import {
    IVectorRepository,
    VectorSearchFilter,
    DocumentChunkEntity,
    ChunkSearchResult
} from '@dosfilos/domain';
import { db } from '../config/firebase';
import { duenosLegibles, uidDeLaSesion } from './duenioDeFragmentos';


/**
 * FirestoreVectorRepository
 * Implementation of IVectorRepository using Firestore with vector embeddings
 * 
 * Note: For production with large datasets, you should create a vector index:
 * gcloud firestore indexes composite create \
 *   --collection-group=document_chunks \
 *   --query-scope=COLLECTION \
 *   --field-config field-path=embedding,vector-config='{"dimension":"768","flat":{}}' \
 *   --field-config field-path=userId,order=ASCENDING
 * 
 * For now, this implementation uses in-memory similarity calculation
 * which works for smaller datasets (<10k chunks)
 */
export class FirestoreVectorRepository implements IVectorRepository {
    private static readonly COLLECTION_NAME = 'document_chunks';

    /**
     * Upsert chunks with embeddings into Firestore
     * @param chunks - The chunks to upsert
     * @param onProgress - Optional callback for progress updates (0-100)
     */
    async upsert(
        chunks: DocumentChunkEntity[],
        onProgress?: (progress: number, stage: string) => void
    ): Promise<void> {
        if (chunks.length === 0) return;

        console.log(`📝 Upserting ${chunks.length} chunks to Firestore...`);
        if (chunks[0]) {
            console.log(`   First chunk ID: ${chunks[0].id}, resourceId: ${chunks[0].resourceId}`);
        }

        // Use batched writes for efficiency
        // Reduced batch size to 50 to avoid Firestore payload size limit
        // (embeddings with 768 dimensions take a lot of space)
        const batchSize = 50;
        const totalBatches = Math.ceil(chunks.length / batchSize);

        try {
            for (let i = 0; i < chunks.length; i += batchSize) {
                const batch = writeBatch(db);
                const batchChunks = chunks.slice(i, i + batchSize);
                const batchNum = Math.floor(i / batchSize) + 1;

                for (const chunk of batchChunks) {
                    const chunkRef = doc(db, FirestoreVectorRepository.COLLECTION_NAME, chunk.id);
                    batch.set(chunkRef, this.chunkToFirestore(chunk));
                }

                await batch.commit();
                console.log(`   ✅ Batch ${batchNum} committed (${batchChunks.length} chunks)`);

                // Report progress
                if (onProgress) {
                    const progress = Math.round((batchNum / totalBatches) * 100);
                    onProgress(progress, `Guardando: ${Math.min((i + batchSize), chunks.length)}/${chunks.length}`);
                }

                // Small delay between batches to prevent Firestore rate limiting
                // "Write stream exhausted maximum allowed queued writes" warning
                if (i + batchSize < chunks.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            console.log(`✅ All ${chunks.length} chunks saved to Firestore`);
        } catch (error) {
            console.error(`❌ Error upserting chunks:`, error);
            throw error;
        }
    }

    /**
     * Search for similar vectors using cosine similarity
     */
    async search(
        embedding: number[],
        topK: number,
        filter: VectorSearchFilter
    ): Promise<ChunkSearchResult[]> {
        // If filtering by specific resources
        if (filter.resourceIds && filter.resourceIds.length > 0) {
            // Firestore 'in' operator supports up to 30 items
            const resourceBatches: string[][] = [];
            for (let i = 0; i < filter.resourceIds.length; i += 30) {
                resourceBatches.push(filter.resourceIds.slice(i, i + 30));
            }

            const allResults: ChunkSearchResult[] = [];

            for (const resourceBatch of resourceBatches) {
                const batchQuery = query(
                    collection(db, FirestoreVectorRepository.COLLECTION_NAME),
                    where('userId', '==', uidDeLaSesion()),
                    where('resourceId', 'in', resourceBatch)
                );

                const snapshot = await getDocs(batchQuery);
                const chunks = snapshot.docs.map(d => this.firestoreToChunk(d.id, d.data()));

                const results = this.calculateSimilarity(chunks, embedding);
                allResults.push(...results);
            }

            return allResults
                .sort((a, b) => b.score - a.score)
                .slice(0, topK);
        }

        // No resource filter - query all chunks for user
        const chunksQuery = query(
            collection(db, FirestoreVectorRepository.COLLECTION_NAME),
            where('userId', '==', uidDeLaSesion())
        );

        const snapshot = await getDocs(chunksQuery);
        const chunks = snapshot.docs.map(d => this.firestoreToChunk(d.id, d.data()));

        return this.calculateSimilarity(chunks, embedding).slice(0, topK);
    }

    /**
     * Delete all chunks for a specific resource
     */
    async deleteByResourceId(resourceId: string): Promise<void> {
        const chunksQuery = query(
            collection(db, FirestoreVectorRepository.COLLECTION_NAME),
            where('userId', '==', uidDeLaSesion()),
            where('resourceId', '==', resourceId)
        );

        const snapshot = await getDocs(chunksQuery);
        console.log(`🗑️ Deleting ${snapshot.docs.length} chunks for resource ${resourceId}`);

        // Use smaller batch size to avoid "Transaction too big" error
        // Each chunk has a large embedding array (~768 floats)
        const batchSize = 50;
        for (let i = 0; i < snapshot.docs.length; i += batchSize) {
            const batch = writeBatch(db);
            const batchDocs = snapshot.docs.slice(i, i + batchSize);

            for (const d of batchDocs) {
                batch.delete(d.ref);
            }

            await batch.commit();
            console.log(`🗑️ Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(snapshot.docs.length / batchSize)}`);
        }
    }

    /**
     * Check if a resource has been indexed
     */
    /**
     * Igual que `hasIndex` pero para muchos: una consulta de un documento por
     * recurso, en paralelo. Antes era una consulta `in` por cada 30 que traía
     * TODOS los fragmentos de esos libros —con sus vectores— sólo para ver
     * cuáles tenían alguno; y no filtraba por dueño, que las reglas ahora
     * exigen (lo propio y la biblioteca común, ver `duenioDeFragmentos`).
     *
     * Un recurso que falla NO tumba a los demás: se registra y los otros
     * siguen. Es preferible que una insignia diga "sin indexar" a que la
     * pantalla entera no cargue.
     */
    async hasIndexBatch(resourceIds: readonly string[]): Promise<Set<string>> {
        const indexados = new Set<string>();
        if (resourceIds.length === 0) return indexados;
        const duenos = duenosLegibles();
        await Promise.all(
            [...new Set(resourceIds)].map(async (resourceId) => {
                try {
                    const snapshot = await getDocs(
                        query(
                            collection(db, FirestoreVectorRepository.COLLECTION_NAME),
                            where('userId', 'in', duenos),
                            where('resourceId', '==', resourceId),
                            limit(1),
                        ),
                    );
                    if (!snapshot.empty) indexados.add(resourceId);
                } catch (error) {
                    console.error(`❌ hasIndexBatch error para ${resourceId}:`, error);
                }
            }),
        );
        return indexados;
    }

    async hasIndex(resourceId: string): Promise<boolean> {
        try {
            const chunksQuery = query(
                collection(db, FirestoreVectorRepository.COLLECTION_NAME),
                where('userId', 'in', duenosLegibles()),
                where('resourceId', '==', resourceId),
                limit(1)
            );

            const snapshot = await getDocs(chunksQuery);
            return !snapshot.empty;
        } catch (error) {
            console.error(`❌ hasIndex error for ${resourceId}:`, error);
            return false;
        }
    }

    /**
     * Calculate cosine similarity between query embedding and chunk embeddings
     */
    private calculateSimilarity(
        chunks: DocumentChunkEntity[],
        queryEmbedding: number[]
    ): ChunkSearchResult[] {
        return chunks
            .filter(chunk => chunk.embedding && chunk.embedding.length > 0)
            .map(chunk => ({
                chunk,
                score: DocumentChunkEntity.cosineSimilarity(queryEmbedding, chunk.embedding!)
            }))
            .filter(result => result.score >= 0.5)
            .sort((a, b) => b.score - a.score);
    }

    /**
     * Convert DocumentChunkEntity to Firestore format
     */
    private chunkToFirestore(chunk: DocumentChunkEntity): Record<string, unknown> {
        // Ensure metadata doesn't have undefined values (Firestore doesn't accept undefined)
        const cleanMetadata: Record<string, unknown> = {};
        if (chunk.metadata) {
            if (chunk.metadata.page !== undefined) cleanMetadata.page = chunk.metadata.page;
            if (chunk.metadata.section !== undefined) cleanMetadata.section = chunk.metadata.section;
            if (chunk.metadata.startChar !== undefined) cleanMetadata.startChar = chunk.metadata.startChar;
            if (chunk.metadata.endChar !== undefined) cleanMetadata.endChar = chunk.metadata.endChar;
        }

        return {
            resourceId: chunk.resourceId,
            resourceTitle: chunk.resourceTitle,
            resourceAuthor: chunk.resourceAuthor,
            userId: chunk.userId,
            chunkIndex: chunk.chunkIndex,
            text: chunk.text,
            embedding: chunk.embedding,
            metadata: cleanMetadata,
            createdAt: chunk.createdAt
        };
    }

    /**
     * Convert Firestore document to DocumentChunkEntity
     */
    private firestoreToChunk(id: string, data: Record<string, unknown>): DocumentChunkEntity {
        return DocumentChunkEntity.create({
            id,
            resourceId: data.resourceId as string,
            resourceTitle: data.resourceTitle as string,
            resourceAuthor: data.resourceAuthor as string,
            userId: data.userId as string,
            chunkIndex: data.chunkIndex as number,
            text: data.text as string,
            embedding: data.embedding as number[] | undefined,
            metadata: data.metadata as { page?: number; section?: string }
        });
    }
}

// Singleton instance
export const firestoreVectorRepository = new FirestoreVectorRepository();
