import type { BibliographicData, IBibliographyReader } from '@dosfilos/domain';
import { FirebaseLibraryRepository } from '../firebase/FirebaseLibraryRepository';

/**
 * Lee los datos de portada que una persona escribió sobre el recurso.
 *
 * Mismo criterio que `DocumentPageNumberingReader`, y por la misma razón:
 * lo que no está escrito vuelve como `null` y el compositor cita con lo
 * que tiene. Un fallo de lectura también devuelve `null` —citar de menos
 * es recuperable; citar una editorial inventada llega al trabajo
 * entregado y no se nota hasta que alguien busca el libro.
 */
export class DocumentBibliographyReader implements IBibliographyReader {
    private readonly cache = new Map<string, Promise<BibliographicData | null>>();

    constructor(private readonly library = new FirebaseLibraryRepository()) {}

    async bibliographyFor(resourceId: string): Promise<BibliographicData | null> {
        const cached = this.cache.get(resourceId);
        if (cached) return cached;

        const pending = this.resolve(resourceId);
        this.cache.set(resourceId, pending);
        try {
            return await pending;
        } catch (err) {
            this.cache.delete(resourceId);
            console.warn('[DocumentBibliography] no se pudieron leer los datos de', resourceId, err);
            return null;
        }
    }

    private async resolve(resourceId: string): Promise<BibliographicData | null> {
        const stored = (await this.library.findById(resourceId)) as { bibliography?: BibliographicData | null } | null;
        const data = stored?.bibliography;
        if (!data) return null;
        // Un objeto con todos los campos en blanco es lo mismo que no tener
        // datos: que la interfaz haya guardado el formulario vacío no es una
        // ficha bibliográfica.
        return Object.values(data).some(v => (v ?? '').toString().trim().length > 0) ? data : null;
    }
}
