import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    query,
    where,
    writeBatch,
    Timestamp,
    VectorValue,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { DocumentChunkEntity } from '@dosfilos/domain';

/**
 * FirebaseChunkRepository
 * Stores and retrieves document chunks with embeddings from Firestore
 */
export class FirebaseChunkRepository {
    private collectionName = 'document_chunks';

    /**
     * Save a single chunk
     */
    async create(chunk: DocumentChunkEntity): Promise<void> {
        const ref = doc(db, this.collectionName, chunk.id);
        await setDoc(ref, this.chunkToFirestore(chunk));
    }

    /**
     * Save multiple chunks in batch (more efficient)
     */
    async createBatch(chunks: DocumentChunkEntity[]): Promise<void> {
        const batch = writeBatch(db);

        for (const chunk of chunks) {
            const ref = doc(db, this.collectionName, chunk.id);
            batch.set(ref, this.chunkToFirestore(chunk));
        }

        await batch.commit();
    }

    /**
     * Get all chunks for a resource
     */
    async findByResourceId(resourceId: string): Promise<DocumentChunkEntity[]> {
        const q = query(
            collection(db, this.collectionName),
            where('resourceId', '==', resourceId)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(doc => this.firestoreToChunk(doc.id, doc.data()))
            .sort((a, b) => a.chunkIndex - b.chunkIndex);
    }

    /**
     * El ARRANQUE del libro: el texto de sus primeros fragmentos, en orden.
     *
     * Para el lector de portadas cuando el recurso no guarda `textContent`
     * (TP #6: Adamson tenía su índice completo y `textContent` vacío, y la
     * app decía «no tiene texto extraído»). Igualdad + `in` sobre campos
     * distintos se resuelven con los índices simples: no pide índice compuesto.
     */
    async firstChunksText(resourceId: string, count = 8): Promise<string> {
        const q = query(
            collection(db, this.collectionName),
            where('resourceId', '==', resourceId),
            where('chunkIndex', 'in', Array.from({ length: count }, (_, i) => i)),
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(d => this.firestoreToChunk(d.id, d.data()))
            .sort((a, b) => a.chunkIndex - b.chunkIndex)
            .map(c => c.text)
            .join('\n\n');
    }

    /**
     * Get all chunks for a user's library
     */
    async findByUserId(userId: string): Promise<DocumentChunkEntity[]> {
        const q = query(
            collection(db, this.collectionName),
            where('userId', '==', userId)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => this.firestoreToChunk(doc.id, doc.data()));
    }

    /**
     * Get chunks for specific resources (by IDs)
     */
    async findByResourceIds(resourceIds: string[]): Promise<DocumentChunkEntity[]> {
        if (resourceIds.length === 0) return [];

        // Firestore 'in' query limited to 10 items, batch if needed
        const allChunks: DocumentChunkEntity[] = [];
        const batchSize = 10;

        for (let i = 0; i < resourceIds.length; i += batchSize) {
            const batchIds = resourceIds.slice(i, i + batchSize);
            const q = query(
                collection(db, this.collectionName),
                where('resourceId', 'in', batchIds)
            );
            const snapshot = await getDocs(q);
            const chunks = snapshot.docs.map(doc => this.firestoreToChunk(doc.id, doc.data()));
            allChunks.push(...chunks);
        }

        return allChunks;
    }

    /**
     * Delete all chunks for a resource
     */
    async deleteByResourceId(resourceId: string): Promise<void> {
        const chunks = await this.findByResourceId(resourceId);
        const batch = writeBatch(db);

        for (const chunk of chunks) {
            batch.delete(doc(db, this.collectionName, chunk.id));
        }

        await batch.commit();
    }

    /**
     * Check if a resource has been chunked
     */
    async hasChunks(resourceId: string): Promise<boolean> {
        const chunks = await this.findByResourceId(resourceId);
        return chunks.length > 0;
    }

    /**
     * Convert chunk entity to Firestore format
     */
    private chunkToFirestore(chunk: DocumentChunkEntity): Record<string, unknown> {
        return {
            resourceId: chunk.resourceId,
            resourceTitle: chunk.resourceTitle,
            resourceAuthor: chunk.resourceAuthor,
            userId: chunk.userId,
            chunkIndex: chunk.chunkIndex,
            text: chunk.text,
            // Store embedding as array (Firestore supports arrays up to 1MB)
            embedding: chunk.embedding || null,
            metadata: chunk.metadata,
            createdAt: Timestamp.fromDate(chunk.createdAt)
        };
    }

    /**
     * Convert Firestore data to chunk entity
     */
    private firestoreToChunk(id: string, data: Record<string, unknown>): DocumentChunkEntity {
        return new DocumentChunkEntity(
            id,
            data.resourceId as string,
            data.resourceTitle as string,
            data.resourceAuthor as string,
            data.userId as string,
            data.chunkIndex as number,
            data.text as string,
            extractEmbedding(data.embedding),
            data.metadata as { page?: number; section?: string; startChar?: number; endChar?: number },
            (data.createdAt as Timestamp)?.toDate() || new Date()
        );
    }
}

/**
 * Normalize the `embedding` field across the two write paths that
 * populate `document_chunks`:
 *
 *   1. Cloud Functions (`indexStructuredDocument`) writes
 *      `FieldValue.vector(...)` via the admin SDK. The web SDK reads
 *      that back as a `VectorValue` instance whose values live behind
 *      `.toArray()` — NOT as `length`-bearing plain array. The legacy
 *      cast `data.embedding as number[]` left it unchanged, the
 *      downstream filter `chunk.embedding.length > 0` then dropped
 *      every chunk silently, and RAG search returned zero results
 *      from a perfectly-indexed library (user surfaced this 2026-05-21).
 *
 *   2. Older chunks (pre-vector-type migration) and any future web-SDK
 *      writes via `toFirestore` below land as plain `number[]`. Both
 *      shapes must keep working.
 *
 * Anything else collapses to `undefined` so callers can drop the
 * chunk rather than feeding bad data into cosine similarity.
 */
function extractEmbedding(raw: unknown): number[] | undefined {
    if (!raw) return undefined;
    if (Array.isArray(raw)) return raw as number[];
    if (raw instanceof VectorValue) return raw.toArray();
    return undefined;
}
