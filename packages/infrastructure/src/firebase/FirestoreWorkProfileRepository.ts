import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    runTransaction,
    setDoc,
    updateDoc,
    where,
    type DocumentData,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
    IWorkProfileRepository,
    WorkProfile,
    WorkProfileDraft,
} from '@dosfilos/domain';

/**
 * Perfiles de trabajo en Firestore.
 *
 * Espejo de `FirestoreUserRubricRepository`: colección de primer nivel
 * `workProfiles/{id}` con `ownerId`, y la invariante de «uno por defecto»
 * mantenida por transacción. Se copia el patrón a propósito —los tres
 * repositorios de plantillas se leen igual, y una cuarta forma de hacer
 * lo mismo sería una trampa para el próximo que toque cualquiera.
 */
export class FirestoreWorkProfileRepository implements IWorkProfileRepository {
    private collectionRef() {
        return collection(db, 'workProfiles');
    }

    private docRef(profileId: string) {
        return doc(db, 'workProfiles', profileId);
    }

    async listProfiles(ownerId: string): Promise<WorkProfile[]> {
        const snap = await getDocs(query(this.collectionRef(), where('ownerId', '==', ownerId)));
        return snap.docs
            .map(d => deserialize(d.id, d.data()))
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    async getDefaultProfile(ownerId: string): Promise<WorkProfile | null> {
        const snap = await getDocs(query(
            this.collectionRef(),
            where('ownerId', '==', ownerId),
            where('isDefault', '==', true),
        ));
        if (snap.empty) return null;
        // Si la invariante se rompiera, gana el más reciente y el próximo
        // `setDefault` la restablece.
        const perfiles = snap.docs.map(d => deserialize(d.id, d.data()));
        perfiles.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        return perfiles[0]!;
    }

    async getProfile(ownerId: string, profileId: string): Promise<WorkProfile | null> {
        const snap = await getDoc(this.docRef(profileId));
        if (!snap.exists()) return null;
        const perfil = deserialize(snap.id, snap.data());
        return perfil.ownerId === ownerId ? perfil : null;
    }

    async createProfile(draft: WorkProfileDraft): Promise<WorkProfile> {
        const ref = doc(this.collectionRef());
        const now = new Date();
        const created: WorkProfile = { ...draft, id: ref.id, createdAt: now, updatedAt: now };
        await setDoc(ref, serialize(created));
        if (created.isDefault) await this.setDefault(created.ownerId, created.id);
        return created;
    }

    async updateProfile(
        ownerId: string,
        profileId: string,
        patch: Partial<Omit<WorkProfile, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>>,
    ): Promise<WorkProfile> {
        await this.requireOwned(ownerId, profileId);
        const clean: DocumentData = { updatedAt: new Date() };
        // Firestore rechaza `undefined`: sólo viaja lo que el llamador puso.
        for (const [key, value] of Object.entries(patch)) {
            if (value !== undefined) clean[key] = value;
        }
        await updateDoc(this.docRef(profileId), clean);
        const fresh = await this.getProfile(ownerId, profileId);
        if (!fresh) throw new Error(`Work profile ${profileId} not found after update`);
        return fresh;
    }

    async deleteProfile(ownerId: string, profileId: string): Promise<void> {
        await this.requireOwned(ownerId, profileId);
        await deleteDoc(this.docRef(profileId));
    }

    async setDefault(ownerId: string, profileId: string): Promise<void> {
        // Los hermanos se leen fuera de la transacción: Firestore no
        // consulta dentro de una. Misma carrera aceptada que en rúbricas —
        // el próximo `setDefault` la sana.
        const hermanos = await getDocs(query(
            this.collectionRef(),
            where('ownerId', '==', ownerId),
            where('isDefault', '==', true),
        ));
        const otros = hermanos.docs.map(d => d.id).filter(id => id !== profileId);

        await runTransaction(db, async (tx) => {
            const snap = await tx.get(this.docRef(profileId));
            if (!snap.exists()) throw new Error(`Work profile ${profileId} not found`);
            if (snap.data().ownerId !== ownerId) {
                throw new Error(`Work profile ${profileId} not owned by ${ownerId}`);
            }
            const now = new Date();
            tx.update(this.docRef(profileId), { isDefault: true, updatedAt: now });
            for (const id of otros) tx.update(this.docRef(id), { isDefault: false, updatedAt: now });
        });
    }

    private async requireOwned(ownerId: string, profileId: string): Promise<void> {
        const perfil = await this.getProfile(ownerId, profileId);
        if (!perfil) throw new Error(`Work profile ${profileId} not found or not owned by ${ownerId}`);
    }
}

function serialize(profile: WorkProfile): DocumentData {
    const { id: _id, ...rest } = profile;
    return {
        ...rest,
        ...(profile.course ? { course: profile.course } : {}),
        ...(profile.cover ? { cover: profile.cover } : {}),
    };
}

function deserialize(id: string, data: DocumentData): WorkProfile {
    return {
        id,
        ownerId: data.ownerId,
        displayName: data.displayName ?? '',
        ...(data.course ? { course: data.course } : {}),
        rubricTemplateId: data.rubricTemplateId ?? null,
        briefTemplateId: data.briefTemplateId ?? null,
        styleGuideId: data.styleGuideId ?? null,
        exegeticalStrategy: data.exegeticalStrategy === 'free' ? 'free' : 'dialectical',
        cover: data.cover ?? null,
        isDefault: !!data.isDefault,
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
    };
}

function toDate(value: any): Date {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    if (typeof value.toDate === 'function') return value.toDate();
    return new Date(value);
}
