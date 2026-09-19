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
    runTransaction,
    type DocumentData,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
    IUserRubricRepository,
    UserRubric,
    UserRubricDraft,
} from '@dosfilos/domain';

/**
 * Firestore implementation of `IUserRubricRepository`.
 *
 * Mirrors `FirestoreUserStyleGuideRepository` patterns:
 *   - Top-level `userRubrics/{rubricId}` collection with
 *     `ownerId` field.
 *   - Listing queries by `ownerId`.
 *   - Default invariant maintained via `setDefault` transaction
 *     that demotes the prior default and promotes the target
 *     atomically.
 */
export class FirestoreUserRubricRepository implements IUserRubricRepository {
    private collectionRef() {
        return collection(db, 'userRubrics');
    }

    private docRef(rubricId: string) {
        return doc(db, 'userRubrics', rubricId);
    }

    async listRubrics(ownerId: string): Promise<UserRubric[]> {
        const q = query(this.collectionRef(), where('ownerId', '==', ownerId));
        const snap = await getDocs(q);
        return snap.docs
            .map(d => deserialize(d.id, d.data()))
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    async getDefaultRubric(ownerId: string): Promise<UserRubric | null> {
        const q = query(
            this.collectionRef(),
            where('ownerId', '==', ownerId),
            where('isDefault', '==', true),
        );
        const snap = await getDocs(q);
        if (snap.empty) return null;
        // Defensive: if invariant ever broke and we have multiple,
        // return the most recently updated and let the next setDefault
        // call re-establish the invariant.
        const rubrics = snap.docs.map(d => deserialize(d.id, d.data()));
        rubrics.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        return rubrics[0];
    }

    async getRubric(ownerId: string, rubricId: string): Promise<UserRubric | null> {
        const snap = await getDoc(this.docRef(rubricId));
        if (!snap.exists()) return null;
        const rubric = deserialize(snap.id, snap.data());
        if (rubric.ownerId !== ownerId) return null;
        return rubric;
    }

    async createRubric(draft: UserRubricDraft): Promise<UserRubric> {
        const ref = doc(this.collectionRef());
        const now = new Date();
        const created: UserRubric = {
            id: ref.id,
            ownerId: draft.ownerId,
            displayName: draft.displayName,
            isDefault: draft.isDefault,
            rubric: draft.rubric,
            createdAt: now,
            updatedAt: now,
        };
        await setDoc(ref, serialize(created));
        if (created.isDefault) {
            await this.demoteOthers(created.ownerId, created.id);
        }
        return created;
    }

    async updateRubric(
        ownerId: string,
        rubricId: string,
        patch: Partial<Pick<UserRubric, 'displayName' | 'rubric'>>,
    ): Promise<UserRubric> {
        await this.requireOwned(ownerId, rubricId);
        const clean: DocumentData = {};
        if (patch.displayName !== undefined) clean.displayName = patch.displayName;
        if (patch.rubric !== undefined) clean.rubric = patch.rubric;
        clean.updatedAt = new Date();
        await updateDoc(this.docRef(rubricId), clean);
        const fresh = await this.getRubric(ownerId, rubricId);
        if (!fresh) throw new Error(`Rubric ${rubricId} not found after update`);
        return fresh;
    }

    async setDefault(ownerId: string, rubricId: string): Promise<UserRubric> {
        const targetRef = this.docRef(rubricId);

        // Read siblings outside the transaction (Firestore tx can
        // only get specific docs, not run queries). Same accepted
        // race as setActiveStyleGuide — next setDefault heals.
        const siblingsQuery = query(
            this.collectionRef(),
            where('ownerId', '==', ownerId),
            where('isDefault', '==', true),
        );
        const siblingsSnap = await getDocs(siblingsQuery);
        const siblingIds = siblingsSnap.docs.map(d => d.id).filter(id => id !== rubricId);

        await runTransaction(db, async (tx) => {
            const targetSnap = await tx.get(targetRef);
            if (!targetSnap.exists()) throw new Error(`Rubric ${rubricId} not found`);
            if (targetSnap.data().ownerId !== ownerId) {
                throw new Error(`Rubric ${rubricId} not owned by ${ownerId}`);
            }
            const now = new Date();
            tx.update(targetRef, { isDefault: true, updatedAt: now });
            for (const sid of siblingIds) {
                tx.update(this.docRef(sid), { isDefault: false, updatedAt: now });
            }
        });

        const fresh = await this.getRubric(ownerId, rubricId);
        if (!fresh) throw new Error(`Rubric ${rubricId} not found after setDefault`);
        return fresh;
    }

    async deleteRubric(ownerId: string, rubricId: string): Promise<void> {
        await this.requireOwned(ownerId, rubricId);
        await deleteDoc(this.docRef(rubricId));
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private async requireOwned(ownerId: string, rubricId: string): Promise<void> {
        const found = await this.getRubric(ownerId, rubricId);
        if (!found) {
            throw new Error(`Rubric ${rubricId} not found or not owned by ${ownerId}`);
        }
    }

    private async demoteOthers(ownerId: string, exceptId: string): Promise<void> {
        const q = query(
            this.collectionRef(),
            where('ownerId', '==', ownerId),
            where('isDefault', '==', true),
        );
        const snap = await getDocs(q);
        const now = new Date();
        await Promise.all(
            snap.docs
                .filter(d => d.id !== exceptId)
                .map(d => updateDoc(d.ref, { isDefault: false, updatedAt: now })),
        );
    }
}

// ── Serialization ───────────────────────────────────────────────────────

function serialize(rubric: UserRubric): DocumentData {
    return {
        ownerId: rubric.ownerId,
        displayName: rubric.displayName,
        isDefault: rubric.isDefault,
        rubric: rubric.rubric,
        createdAt: rubric.createdAt,
        updatedAt: rubric.updatedAt,
    };
}

function deserialize(id: string, data: DocumentData): UserRubric {
    const inner = data.rubric ?? {};
    return {
        id,
        ownerId: data.ownerId,
        displayName: data.displayName ?? '',
        isDefault: !!data.isDefault,
        rubric: {
            provenance: inner.provenance ?? 'system-default',
            description: inner.description ?? null,
            expectedLength: inner.expectedLength ?? null,
            citationStandard: inner.citationStandard ?? null,
            sourceRequirements: Array.isArray(inner.sourceRequirements) ? inner.sourceRequirements : [],
            courseBibliography: Array.isArray(inner.courseBibliography) ? inner.courseBibliography : [],
            structuralExpectations: Array.isArray(inner.structuralExpectations) ? inner.structuralExpectations : [],
            qualityCriteria: Array.isArray(inner.qualityCriteria) ? inner.qualityCriteria : [],
            sourceCorpusId: inner.sourceCorpusId ?? null,
            sourcePastedText: inner.sourcePastedText ?? null,
            sourceTemplateId: inner.sourceTemplateId ?? null,
            createdAt: inner.createdAt?.toDate?.() ?? inner.createdAt ?? new Date(),
            updatedAt: inner.updatedAt?.toDate?.() ?? inner.updatedAt ?? new Date(),
        },
        createdAt: data.createdAt?.toDate?.() ?? data.createdAt ?? new Date(),
        updatedAt: data.updatedAt?.toDate?.() ?? data.updatedAt ?? new Date(),
    };
}
