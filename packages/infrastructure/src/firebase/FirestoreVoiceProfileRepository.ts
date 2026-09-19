import { deleteField, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { AcademicVoiceProfile, IVoiceProfileRepository } from '@dosfilos/domain';

/**
 * El perfil de voz en `academicVoiceProfiles/{ownerId}`.
 *
 * Mismo patrón que el glosario: el id del documento ES el del dueño, así
 * la regla de acceso se escribe sobre la ruta.
 */
export class FirestoreVoiceProfileRepository implements IVoiceProfileRepository {
    private docRef(ownerId: string) {
        return doc(db, 'academicVoiceProfiles', ownerId);
    }

    async getProfile(ownerId: string): Promise<AcademicVoiceProfile | null> {
        const snap = await getDoc(this.docRef(ownerId));
        if (!snap.exists()) return null;
        const data = snap.data();
        return {
            ownerId,
            resourceId: data.resourceId ?? null,
            ...(data.resourceTitle ? { resourceTitle: data.resourceTitle } : {}),
            updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
        };
    }

    async setResource(ownerId: string, resourceId: string | null, resourceTitle?: string): Promise<AcademicVoiceProfile> {
        const updatedAt = new Date();
        await setDoc(this.docRef(ownerId), {
            ownerId,
            resourceId,
            // Quitar la referencia también quita el nombre: dejarlo haría
            // creer que la voz sigue puesta.
            resourceTitle: resourceId && resourceTitle ? resourceTitle : deleteField(),
            updatedAt,
        }, { merge: true });
        return {
            ownerId,
            resourceId,
            ...(resourceId && resourceTitle ? { resourceTitle } : {}),
            updatedAt,
        };
    }
}
