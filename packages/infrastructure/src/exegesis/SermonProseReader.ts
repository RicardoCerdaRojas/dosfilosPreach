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

        return (encontrados ?? []).map(sermon => ({
            id: sermon.id,
            title: sermon.title ?? '',
            content: (sermon as { content?: string }).content ?? '',
            assembledFrom: (sermon as { assembledFrom?: 'workshop' | 'generated' }).assembledFrom,
            publishedAt: (sermon as { publishedAt?: Date }).publishedAt,
        }));
    }
}
