import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    Timestamp,
    onSnapshot
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { LibraryResourceEntity, SYSTEM_SOURCE_OWNER_ID } from '@dosfilos/domain';

export interface ILibraryRepository {
    create(resource: LibraryResourceEntity): Promise<void>;
    findById(id: string): Promise<LibraryResourceEntity | null>;
    findByUserId(userId: string): Promise<LibraryResourceEntity[]>;
    subscribeToUserResources(userId: string, callback: (resources: LibraryResourceEntity[]) => void): () => void;
    update(id: string, updates: Partial<LibraryResourceEntity>): Promise<void>;
    delete(id: string): Promise<void>;
    findCoreResources(): Promise<LibraryResourceEntity[]>;
    findSystemResources(): Promise<LibraryResourceEntity[]>;
}

export class FirebaseLibraryRepository implements ILibraryRepository {
    private collectionName = 'library_resources';

    async create(resource: LibraryResourceEntity): Promise<void> {
        const ref = doc(db, this.collectionName, resource.id);
        await setDoc(ref, this.resourceToFirestore(resource));
    }

    async findById(id: string): Promise<LibraryResourceEntity | null> {
        const ref = doc(db, this.collectionName, id);
        const snap = await getDoc(ref);

        if (!snap.exists()) return null;

        return this.firestoreToResource(snap.id, snap.data());
    }

    async findByUserId(userId: string): Promise<LibraryResourceEntity[]> {
        const q = query(
            collection(db, this.collectionName),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => this.firestoreToResource(doc.id, doc.data()));
    }

    /**
     * System sources are platform-preloaded resources (e.g. SBL GNT)
     * stored under the sentinel `SYSTEM_SOURCE_OWNER_ID`. Every user
     * sees them in their library alongside their own uploads — the
     * library service unions both sets before returning.
     */
    async findSystemResources(): Promise<LibraryResourceEntity[]> {
        const q = query(
            collection(db, this.collectionName),
            where('userId', '==', SYSTEM_SOURCE_OWNER_ID),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => this.firestoreToResource(doc.id, doc.data()));
    }

    async findCoreResources(): Promise<LibraryResourceEntity[]> {
        // Core resources are those where coreStores includes 'global' OR some specific store
        // For simplicity, we assume any resource with isCore=true or in 'global' store
        // Since isCore is not a top-level field in the entity but coreStores is, we check coreStores
        const q = query(
            collection(db, this.collectionName),
            where('coreStores', 'array-contains', 'global'),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => this.firestoreToResource(doc.id, doc.data()));
    }

    subscribeToUserResources(
        userId: string,
        callback: (resources: LibraryResourceEntity[]) => void,
        onError?: (error: Error) => void
    ): () => void {
        const q = query(
            collection(db, this.collectionName),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const resources = snapshot.docs.map(doc =>
                    this.firestoreToResource(doc.id, doc.data())
                );
                callback(resources);
            },
            (error) => {
                console.error("Error in subscribeToUserResources:", error);
                if (onError) onError(error);
            }
        );

        return unsubscribe;
    }

    async delete(id: string): Promise<void> {
        await deleteDoc(doc(db, this.collectionName, id));
    }

    async update(id: string, updates: Partial<LibraryResourceEntity>): Promise<void> {
        const ref = doc(db, this.collectionName, id);
        await updateDoc(ref, this.buildFirestoreUpdates(updates));
    }

    /**
     * Qué campos de una actualización llegan a Firestore.
     *
     * Es una lista blanca, y ésa es la trampa: lo que no está enumerado se
     * descarta SIN AVISAR. La numeración impresa estuvo así — la pantalla de
     * calibración guardaba, la escritura llegaba con `updatedAt` y nada más, y
     * el recurso seguía diciendo `origin: 'detected'`. Desde afuera es
     * indistinguible de un guardado que funcionó.
     *
     * Al agregar un campo persistible a `LibraryResource`, agregarlo TAMBIÉN
     * acá. Está separado del `updateDoc` para poder probarlo sin Firestore
     * vivo, que es la única forma de que un olvido se note antes de producción.
     */
    buildFirestoreUpdates(updates: Partial<LibraryResourceEntity>): Record<string, any> {
        const firestoreUpdates: any = {};

        if (updates.title !== undefined) firestoreUpdates.title = updates.title;
        if (updates.author !== undefined) firestoreUpdates.author = updates.author;
        if (updates.type !== undefined) firestoreUpdates.type = updates.type;
        if (updates.preferredForPhases !== undefined) firestoreUpdates.preferredForPhases = updates.preferredForPhases;
        // v1.5 commit 6: exegetical classification cache. Allow
        // setting (string) and unsetting (null/undefined → null in
        // Firestore so the field is explicitly cleared rather than
        // left stale).
        if (updates.exegeticalType !== undefined) {
            firestoreUpdates.exegeticalType = updates.exegeticalType ?? null;
        }
        // v1.7 smart-match metadata. Both fields are user-editable from
        // the metadata dialog; persist whatever the caller passed.
        if (updates.coversBibleBooks !== undefined) {
            firestoreUpdates.coversBibleBooks = [...updates.coversBibleBooks];
        }
        if (updates.scope !== undefined) {
            firestoreUpdates.scope = updates.scope;
        }
        if (updates.updatedAt !== undefined) firestoreUpdates.updatedAt = Timestamp.fromDate(updates.updatedAt);

        // 🎯 Core Library stores
        if (updates.coreStores !== undefined) firestoreUpdates.coreStores = updates.coreStores;

        // Numeración impresa: es lo que decide si una cita puede decir «p. N»
        // o tiene que decir «hoja N».
        if (updates.pageNumbering !== undefined) {
            firestoreUpdates.pageNumbering = updates.pageNumbering ?? null;
        }

        return firestoreUpdates;
    }

    private resourceToFirestore(resource: LibraryResourceEntity): any {
        const doc: any = {
            userId: resource.userId,
            title: resource.title,
            author: resource.author,
            type: resource.type,
            storageUrl: resource.storageUrl,
            mimeType: resource.mimeType,
            sizeBytes: resource.sizeBytes,
            textExtractionStatus: resource.textExtractionStatus || 'pending',
            textContent: resource.textContent || null,
            textContentUrl: (resource as any).textContentUrl || null,
            characterCount: (resource as any).characterCount || null,
            pageCount: resource.pageCount || null,
            preferredForPhases: resource.preferredForPhases || [],
            metadata: resource.metadata || {},
            // 🎯 Core Library stores
            coreStores: resource.coreStores || [],
            createdAt: Timestamp.fromDate(resource.createdAt),
            updatedAt: Timestamp.fromDate(resource.updatedAt)
        };
        // User-chosen tier — only persist when explicitly set so the
        // cloud function's "field absent → default cascade" branch
        // still works for resources uploaded before this field existed.
        if (resource.requestedExtractionMode) {
            doc.requestedExtractionMode = resource.requestedExtractionMode;
        }
        // v1.7 smart-match metadata. Persist when set so the upload
        // form's autocompleted suggestion travels to Firestore; legacy
        // resources (where neither was set) read back as `[]` + 'book'
        // via the deserializer defaults.
        if (resource.coversBibleBooks !== undefined) {
            doc.coversBibleBooks = [...resource.coversBibleBooks];
        }
        if (resource.scope !== undefined) {
            doc.scope = resource.scope;
        }
        if (resource.isSystemSource !== undefined) {
            doc.isSystemSource = resource.isSystemSource;
        }
        // ADR-006 / PR 0.3 — rights-aware citation metadata. Persist
        // only when explicitly set so the conservative defaults in
        // `firestoreToResource` continue to govern legacy docs.
        if (resource.license !== undefined) doc.license = resource.license;
        if (resource.licenseUrl !== undefined) doc.licenseUrl = resource.licenseUrl;
        if (resource.copyrightNotice !== undefined) doc.copyrightNotice = resource.copyrightNotice;
        if (resource.ingestionStatus !== undefined) doc.ingestionStatus = resource.ingestionStatus;
        if (resource.riskLevel !== undefined) doc.riskLevel = resource.riskLevel;
        if (resource.requiredAttribution !== undefined) doc.requiredAttribution = resource.requiredAttribution;
        if (resource.specialHandling !== undefined) doc.specialHandling = resource.specialHandling;
        if (resource.citation !== undefined) doc.citation = resource.citation;
        return doc;
    }

    private firestoreToResource(id: string, data: any): LibraryResourceEntity {
        const resource = new LibraryResourceEntity(
            id,
            data.userId,
            // El tipo declara `title` y `author` como string no nulable, pero
            // hay recursos en producción con `author: null` — subidos antes de
            // que el formulario lo exigiera. Sin esta coerción el null viaja
            // hasta cualquier consumidor que confíe en el tipo, y el primero
            // que le haga `.toLowerCase()` revienta.
            data.title ?? '',
            data.author ?? '',
            data.type,
            data.storageUrl,
            data.mimeType,
            data.sizeBytes,
            data.textExtractionStatus || 'pending',
            data.textContent || undefined,
            data.createdAt?.toDate() || new Date(),
            data.updatedAt?.toDate() || new Date(),
            data.preferredForPhases || undefined,
            data.metadata || undefined,
            data.pageCount || undefined,
            data.coreStores || undefined,
            data.isSystemSource === true,
        );
        // Add new fields directly
        (resource as any).textContentUrl = data.textContentUrl || undefined;
        (resource as any).characterCount = data.characterCount || undefined;
        // 🎯 Core Library stores
        (resource as any).coreStores = data.coreStores || [];
        // v1.5 exegesis readiness probe — extraction + indexing metadata
        // written by the cloud functions (extraction pipeline + auto-index
        // trigger). The web client reads these to decide whether a resource
        // can serve as a source of curated excerpts.
        (resource as any).extractionVersion = data.extractionVersion || undefined;
        (resource as any).structuredContentUrl = data.structuredContentUrl || undefined;
        (resource as any).extractedWithLlamaParse = data.extractedWithLlamaParse ?? undefined;
        (resource as any).indexingStatus = data.indexingStatus || undefined;
        (resource as any).indexerVersion = data.indexerVersion || undefined;
        (resource as any).exegeticalType = data.exegeticalType || undefined;
        (resource as any).requestedExtractionMode = data.requestedExtractionMode || undefined;
        (resource as any).extractionWarning = data.extractionWarning ?? undefined;
        (resource as any).extractionError = data.extractionError || undefined;
        (resource as any).indexingError = data.indexingError ?? undefined;
        (resource as any).processingStartedAt = data.processingStartedAt?.toDate?.() ?? undefined;
        // Numeración impresa por tramos. Ausente en todo recurso subido antes
        // de la calibración: `undefined` significa «no se sabe», y quien cite
        // debe rotular el número como hoja en vez de fingir una página.
        (resource as any).pageNumbering = data.pageNumbering ?? undefined;
        (resource as any).scriptCensus = data.scriptCensus ?? undefined;
        // v1.7 smart-match metadata. Legacy docs (uploaded before v1.7)
        // have neither field set in Firestore — default coversBibleBooks
        // to [] and scope to 'book' so the smart-match dialog treats
        // them as "unclassified, please nudge user to fill in".
        (resource as any).coversBibleBooks = Array.isArray(data.coversBibleBooks)
            ? [...data.coversBibleBooks]
            : [];
        (resource as any).scope = data.scope ?? 'book';
        (resource as any).isSystemSource = data.isSystemSource === true ? true : undefined;
        // ADR-006 / PR 0.3 — rights-aware citation metadata.
        // Legacy docs lack these fields entirely; default to conservative
        // values (`unknown` license + `requires_manual_review`) so the
        // citation engine treats unclassified user uploads as restricted
        // until the admin tags them via CoreLibraryAdmin.
        (resource as any).license = data.license ?? 'unknown';
        (resource as any).licenseUrl = data.licenseUrl ?? undefined;
        (resource as any).copyrightNotice = data.copyrightNotice ?? undefined;
        (resource as any).ingestionStatus = data.ingestionStatus ?? 'requires_manual_review';
        (resource as any).riskLevel = data.riskLevel ?? undefined;
        (resource as any).requiredAttribution = Array.isArray(data.requiredAttribution)
            ? data.requiredAttribution
            : undefined;
        (resource as any).specialHandling = Array.isArray(data.specialHandling)
            ? data.specialHandling
            : undefined;
        (resource as any).citation = data.citation ?? undefined;
        return resource;
    }
}
