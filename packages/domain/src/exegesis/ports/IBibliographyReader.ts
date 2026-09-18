import type { BibliographicData } from '../services/bibliography';

/**
 * Los datos de portada de un recurso de la biblioteca.
 *
 * Existe para que el compositor cite con lo que dice el libro en vez de
 * con lo que deduce del nombre del archivo. Devuelve `null` cuando nadie
 * los ha escrito: el compositor debe entonces citar con lo que tiene
 * —autor y título— y no rellenar el resto, que es justo el defecto que
 * este puerto viene a cerrar.
 */
export interface IBibliographyReader {
    bibliographyFor(resourceId: string): Promise<BibliographicData | null>;
}
