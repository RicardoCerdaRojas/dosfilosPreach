import type { MatchRange } from '@dosfilos/domain';

import { BibleReference } from '../entities/BibleEntities';

export interface BibleSearchResult {
    reference: string;
    text: string;
    bookId: string;
    chapter: number;
    verse: number;
    /** Dónde cae cada término, para resaltarlo en la lista. */
    ranges: MatchRange[];
}

/**
 * Port (Interface) for Bible version repository access
 */
export interface IBibleVersionRepository {
    getVersionId(): string;
    getLanguage(): string;
    parseReference(reference: string): BibleReference | null;
    getVerses(reference: string): string | null;
    isValidBook(bookName: string): boolean;
    /**
     * Id real del libro a partir de un id o de un nombre.
     *
     * Está en el puerto porque quien consume necesita lo mismo que el
     * repositorio: los nombres de libro de una referencia escrita ("Jonás") y
     * los ids del juego de datos (`jn`) no coinciden, y adivinar la traducción
     * afuera es cómo terminamos mostrando Juan bajo el título "Jonás".
     */
    resolveBookId(bookNameOrId: string): string;
    /**
     * Id canónico (`JON`) del libro, para poder hablar entre versiones.
     *
     * Cada juego de datos numera a su manera —la RVR usa `jn` y la ASV usa
     * `32`— así que un id de una versión no significa nada en la otra. El
     * canónico es el único vocabulario común.
     */
    getCanonicalBookId(bookNameOrId: string): string;
    /** El id propio que corresponde a un canónico, o `null` si no lo tiene. */
    getBookIdForCanonical(canonicalId: string): string | null;
    getBooks(): { id: string; name: string; chapters: number }[];
    getChapterCount(bookNameOrId: string): number;
    getChapterContent(bookNameOrId: string, chapter: number): string[] | null;
    /**
     * Busca una frase. `bookIds` acota el ámbito; sin él, los 66 libros.
     *
     * El resultado trae la DIRECCIÓN además del texto: sin ella, abrir un
     * resultado obligaba a re-interpretar la referencia escrita, que es de
     * donde salió el bug de caer siempre en Génesis.
     */
    search(query: string, limit?: number, bookIds?: string[]): BibleSearchResult[];
    /** Arma el índice de búsqueda por adelantado (al abrir la hoja), no en la primera tecla. */
    warmSearch(): void;
}
