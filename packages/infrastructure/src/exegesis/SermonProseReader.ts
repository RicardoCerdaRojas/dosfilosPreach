import type { IUserProseReader, VoiceCandidate } from '@dosfilos/domain';
import { FirebaseSermonRepository } from '../firebase/FirebaseSermonRepository';

/**
 * Los sermones del usuario, como prosa suya.
 *
 * Devuelve los publicados más recientes SIN filtrar por autoría: el
 * filtro es `selectVoiceSamples`, que exige `assembledFrom: 'workshop'`.
 * Se deja ahí a propósito —es una regla de dominio, no de acceso a
 * datos— y así un segundo lector no puede olvidarla.
 */
export class SermonProseReader implements IUserProseReader {
    constructor(private readonly sermons = new FirebaseSermonRepository()) {}

    async workshopSermons(ownerId: string, limit: number): Promise<VoiceCandidate[]> {
        const encontrados = await this.sermons.findByUserId(ownerId, {
            status: 'published',
            orderBy: 'publishedAt',
            order: 'desc',
            limit,
        } as never);

        return (encontrados ?? []).map(candidatoDeSermon);
    }
}

/**
 * Un sermón guardado, como candidato a enseñar la voz del autor.
 *
 * Vive fuera de la clase para poder probarlo sin Firestore, que es la
 * única forma de que el error de abajo no vuelva: leer un campo que no
 * existe no falla, devuelve `undefined`, y el filtro de dominio descarta
 * en silencio todos los sermones.
 */
export function candidatoDeSermon(sermon: unknown): VoiceCandidate {
    const s = (sermon ?? {}) as Record<string, unknown>;
    return ({
        id: String(s.id ?? ''),
        title: typeof s.title === 'string' ? s.title : '',
        content: typeof s.content === 'string' ? s.content : '',
        // `assembledFrom` vive en el BORRADOR, no en el sermón guardado. Lo
        // que sobrevive a la publicación es `authorshipSnapshot`, y de ahí lo
        // deriva el cargador de voz de los sermones desde que existe. Leer el
        // campo directo devolvía siempre `undefined`, y como
        // `selectVoiceSamples` exige `workshop`, se descartaban TODOS: la
        // función entera era un no-op silencioso.
        assembledFrom: s.authorshipSnapshot ? ('workshop' as const) : undefined,
        publishedAt: s.publishedAt instanceof Date ? s.publishedAt : undefined,
    });
}
