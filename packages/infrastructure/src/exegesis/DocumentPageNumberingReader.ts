import type { IPageNumberingReader, PageNumbering } from '@dosfilos/domain';
import { FirebaseLibraryRepository } from '../firebase/FirebaseLibraryRepository';

/**
 * Lee la numeración impresa de un recurso, y sólo la que una persona confirmó
 * contra el ejemplar.
 *
 * Un recurso sin calibrar devuelve `null`, y sus citas dicen «hoja N». Es
 * deliberadamente conservador: perder la conversión es molesto y visible;
 * inventarla es el defecto que este módulo existe para impedir.
 */
export class DocumentPageNumberingReader implements IPageNumberingReader {
    private readonly cache = new Map<string, Promise<PageNumbering | null>>();

    constructor(private readonly library = new FirebaseLibraryRepository()) {}

    async numberingFor(resourceId: string): Promise<PageNumbering | null> {
        const cached = this.cache.get(resourceId);
        if (cached) return cached;

        const pending = this.resolve(resourceId);
        this.cache.set(resourceId, pending);
        try {
            return await pending;
        } catch (err) {
            // Un fallo no se cachea: el próximo intento tiene que volver a
            // probar. Y devuelve `null`, que hace citar «hoja N» — perder la
            // conversión es molesto; inventarla es el defecto.
            this.cache.delete(resourceId);
            console.warn('[DocumentPageNumbering] no se pudo leer la numeración de', resourceId, err);
            return null;
        }
    }

    private async resolve(resourceId: string): Promise<PageNumbering | null> {
        const stored = (await this.library.findById(resourceId)) as { pageNumbering?: PageNumbering | null } | null;
        const numbering = stored?.pageNumbering;
        if (!numbering?.segments?.length) return null;

        // Sólo cita por página impresa lo que una persona confirmó contra el
        // ejemplar. Una propuesta del detector alcanza para prellenar la
        // pantalla de calibración, no para afirmar un número en un trabajo.
        //
        // La diferencia no es teórica. El detector acierta en los libros
        // verificados —Adamson −4, Mayor −278, Kittel 0, Metzger −40— y a la
        // vez propone tramos que son ruido: en «Teología Sistemática I»
        // encuentra −11 en catorce hojas y −47 en otras cincuenta, con el
        // resto del libro sin numerar. Desde afuera los dos casos se ven
        // iguales, y una cita equivocada que parece verificada es peor que
        // una cita que admite no saber.
        return numbering.origin === 'confirmed' ? numbering : null;
    }
}
