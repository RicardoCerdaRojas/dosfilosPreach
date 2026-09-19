import type { WorkProfile, WorkProfileDraft } from '../entities/WorkProfile';

/**
 * Perfiles de trabajo del usuario.
 *
 * Mismo patrón que las rúbricas y los encuadres reusables: colección de
 * primer nivel con `ownerId`, acceso sólo del dueño.
 */
export interface IWorkProfileRepository {
    listProfiles(ownerId: string): Promise<WorkProfile[]>;

    /** El perfil marcado por defecto, o `null` mientras no haya ninguno. */
    getDefaultProfile(ownerId: string): Promise<WorkProfile | null>;

    getProfile(ownerId: string, profileId: string): Promise<WorkProfile | null>;

    createProfile(draft: WorkProfileDraft): Promise<WorkProfile>;

    updateProfile(
        ownerId: string,
        profileId: string,
        patch: Partial<Omit<WorkProfile, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>>,
    ): Promise<WorkProfile>;

    deleteProfile(ownerId: string, profileId: string): Promise<void>;

    /**
     * Marca uno como predeterminado y desmarca el anterior en la misma
     * transacción: dos perfiles por defecto harían que el trabajo nuevo
     * salga configurado de una forma u otra según el orden de lectura.
     */
    setDefault(ownerId: string, profileId: string): Promise<void>;
}
