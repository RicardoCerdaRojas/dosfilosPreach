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
    /**
     * Recurso de la biblioteca que el autor DECLARA escrito por él.
     *
     * `null` cuando no eligió ninguno —o cuando prefiere aprender de sus
     * sermones—.
     */
    resourceId: string | null;

    /**
     * Aprender de sus sermones armados en el taller.
     *
     * Son prosa suya con certeza —el taller los arma desde sus decisiones,
     * y los generados quedan fuera por regla—, pero el registro es otro:
     * predicar no es escribir un trabajo académico. Por eso es una opción
     * y no el valor por defecto, y la interfaz dice la diferencia.
     */
    useSermons?: boolean;
    /** Cómo se llamaba al elegirlo, para poder nombrarlo sin ir a buscarlo. */
    resourceTitle?: string;
    updatedAt: Date;
}

export interface IVoiceProfileRepository {
    getProfile(ownerId: string): Promise<AcademicVoiceProfile | null>;
    setResource(ownerId: string, resourceId: string | null, resourceTitle?: string): Promise<AcademicVoiceProfile>;
    setUseSermons(ownerId: string, useSermons: boolean): Promise<AcademicVoiceProfile>;
}
