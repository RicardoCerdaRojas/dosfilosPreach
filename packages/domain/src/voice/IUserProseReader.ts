import type { VoiceCandidate } from './selectVoiceSamples';

/**
 * De dónde sale la prosa que el usuario escribió.
 *
 * Existe para que el compositor de exégesis pueda aprender el registro
 * del autor sin conocer sermones: pide «prosa suya» y la infraestructura
 * decide de qué colección sale. La regla de qué califica —sólo lo armado
 * en el taller, nunca lo generado— vive en `selectVoiceSamples` y se
 * aplica sobre lo que este lector devuelva.
 */
export interface IUserProseReader {
    /** Sermones del usuario, los más recientes primero. */
    workshopSermons(ownerId: string, limit: number): Promise<VoiceCandidate[]>;
}
