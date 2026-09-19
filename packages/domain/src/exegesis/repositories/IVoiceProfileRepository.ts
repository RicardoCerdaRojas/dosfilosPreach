/**
 * Qué texto enseña cómo escribe este autor.
 *
 * Es del usuario y no del trabajo: su registro es el mismo en todas sus
 * entregas. Guarda un puntero al recurso —su ensayo, su trabajo anterior—
 * y no una copia: si lo vuelve a subir corregido, la voz se actualiza
 * sola.
 */
export interface AcademicVoiceProfile {
    ownerId: string;
    /** Recurso de la biblioteca que el autor DECLARA escrito por él. */
    resourceId: string | null;
    /** Cómo se llamaba al elegirlo, para poder nombrarlo sin ir a buscarlo. */
    resourceTitle?: string;
    updatedAt: Date;
}

export interface IVoiceProfileRepository {
    getProfile(ownerId: string): Promise<AcademicVoiceProfile | null>;
    setResource(ownerId: string, resourceId: string | null, resourceTitle?: string): Promise<AcademicVoiceProfile>;
}
