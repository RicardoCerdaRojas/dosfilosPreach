import { foldForSearch, matchRanges, searchTerms } from '@dosfilos/domain';

import {
    IBibleVersionRepository,
    BibleSearchResult,
} from '@/domain/bible/ports/IBibleVersionRepository';
import { BibleReference } from '@/domain/bible/entities/BibleEntities';
import { getCanonicalId, BOOK_METADATA } from '@/domain/bible/utils/BibleMetadata';

interface SearchEntry {
    bookId: string;
    bookName: string;
    c: number;
    v: number;
    text: string;
    folded: string;
}

export interface BibleJSONData {
    id: string;
    chapters: string[][];
}

/**
 * Base Repository for JSON-based Bible versions
 */
export abstract class BaseJSONRepository implements IBibleVersionRepository {
    protected abstract readonly versionId: string;
    protected abstract readonly language: string;
    /**
     * El texto de la versión, cargado la PRIMERA VEZ que se pide (C1).
     *
     * Los JSON pesan 4 MB (RVR) y 6 MB (ASV) y se evaluaban al arrancar la
     * app —el inicio importa la fábrica de versiones—, aunque el pastor no
     * abriera la Biblia; la ASV además se transformaba entera en el
     * constructor. Con `require` dentro de la función, Metro los sigue
     * empaquetando pero no los evalúa hasta que hacen falta.
     */
    protected abstract loadBibleData(): BibleJSONData[];
    private bibleDataCache: BibleJSONData[] | null = null;
    protected get bibleData(): BibleJSONData[] {
        if (!this.bibleDataCache) this.bibleDataCache = this.loadBibleData();
        return this.bibleDataCache;
    }
    protected abstract readonly bookMapping: Record<string, string>;

    private booksCache: { id: string; name: string; chapters: number }[] | null = null;

    /**
     * Índice de búsqueda: cada versículo ya limpio y ya plegado (sin acentos,
     * en minúsculas), en el orden canónico de los libros. Se arma la primera
     * vez que se busca y queda en memoria.
     *
     * Antes cada búsqueda limpiaba y plegaba los 31.000 versículos de nuevo —
     * carácter por carácter, en cada tecla—: ~200 ms por tecla en Node con
     * JIT y bastante más en Hermes, que no tiene (C1). Ahora se filtra con
     * `includes` sobre el texto ya plegado y los rangos para resaltar se
     * calculan sólo en los que coinciden.
     */
    private searchIndex: SearchEntry[] | null = null;

    private buildSearchIndex() {
        if (this.searchIndex) return this.searchIndex;
        const index: SearchEntry[] = [];
        for (const bInfo of this.getBooks()) {
            const book = this.bibleData.find((b) => b.id === bInfo.id);
            if (!book) continue;
            book.chapters.forEach((chapter, c) =>
                chapter.forEach((raw, v) => {
                    const text = this.cleanVerse(raw);
                    index.push({ bookId: bInfo.id, bookName: bInfo.name, c, v, text, folded: foldForSearch(text) });
                }),
            );
        }
        this.searchIndex = index;
        return index;
    }

    /**
     * Limpia el texto de un versículo.
     *
     * EL DATO TRAE "/n" —barra ene, no salto de línea— como marca de renglón
     * poético, en 4.738 versículos de la Reina Valera: uno de cada siete. La
     * limpieza que había buscaba `\n` con barra invertida, así que no encontró
     * NUNCA nada y el "/n" se venía leyendo en pantalla desde siempre. En Job
     * se veía como "con tempestad, /nY ha aumentado mis heridas".
     *
     * Se reemplaza por un espacio porque acá el texto corre como prosa; el
     * renglón poético lo pondría el diseño, no el dato.
     */
    protected cleanVerse(text: string): string {
        return (text ?? '')
            .replace(/\s*\/n\s*/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    getVersionId(): string {
        return this.versionId;
    }

    getLanguage(): string {
        return this.language;
    }

    abstract parseReference(reference: string): BibleReference | null;

    getVerses(reference: string): string | null {
        const ref = this.parseReference(reference);
        if (!ref) return null;

        const canonicalBookId = this.bookMapping[ref.book];
        if (!canonicalBookId) return null;

        const book = this.bibleData.find(b => b.id.toLowerCase() === canonicalBookId.toLowerCase());
        if (!book) return null;

        const chapterIdx = ref.chapter - 1;
        if (chapterIdx < 0 || chapterIdx >= book.chapters.length) return null;

        const chapter = book.chapters[chapterIdx];
        const verses = chapter.slice(ref.verseStart - 1, ref.verseEnd ? ref.verseEnd : ref.verseStart);

        return this.cleanVerse(verses.join(' '));
    }

    isValidBook(bookName: string): boolean {
        const normalized = bookName.trim().toLowerCase();
        return Object.keys(this.bookMapping).some(key => key.toLowerCase() === normalized);
    }

    getBooks(): { id: string; name: string; chapters: number }[] {
        if (this.booksCache) return this.booksCache;

        const sortedData = [...this.bibleData].sort((a, b) => {
            const idA = getCanonicalId(a.id, this.versionId);
            const idB = getCanonicalId(b.id, this.versionId);
            const numA = BOOK_METADATA[idA]?.num || 999;
            const numB = BOOK_METADATA[idB]?.num || 999;
            return numA - numB;
        });

        this.booksCache = sortedData.map(b => {
            // El nombre sale de la tabla de alias: se elige el MÁS LARGO que
            // empiece en mayúscula. Pedir más de tres letras dejaba a Rut y a
            // Job sin nombre —se veían como "RT" y "JOB"— porque su nombre
            // completo tiene exactamente tres.
            let name = b.id.toUpperCase();
            let best = '';
            for (const [key, val] of Object.entries(this.bookMapping)) {
                if (val !== b.id) continue;
                if (key[0] !== key[0].toUpperCase()) continue;
                if (key.length > best.length) best = key;
            }
            if (best) name = best;
            return { id: b.id, name, chapters: b.chapters.length };
        });

        return this.booksCache;
    }

    /**
     * Traduce lo que llegue —id del propio dato o nombre del libro— al id real.
     *
     * EL ID SE PRUEBA PRIMERO, Y NO ES UN DETALLE. Antes se buscaba por NOMBRE
     * antes que por id, y en este juego de datos Jonás es `jn` mientras que
     * `Jn` es un alias de Juan. Pedir el capítulo de `jn` devolvía Juan 1: la
     * cabecera decía "Jonás 1" —esa sí resuelve por id— y el cuerpo mostraba
     * "En el principio era el Verbo". Un id nunca debe caer en la tabla de
     * alias de otro libro.
     */
    resolveBookId(bookNameOrId: string): string {
        // 1. El id del dato, EXACTO (respetando mayúsculas): los ids van en
        //    minúscula y los alias empiezan con mayúscula. `jn` es Jonás.
        const exact = this.bibleData.find((b) => b.id === bookNameOrId);
        if (exact) return exact.id;

        // 2. El alias. Antes el id se probaba sin mirar mayúsculas y le ganaba
        //    al alias: «Jud 1:3» —Judas en español— abría Jueces, cuyo id en
        //    este dato es `jud` (C1, medido con el parser del dominio).
        const searchName = bookNameOrId.toLowerCase();
        for (const [key, val] of Object.entries(this.bookMapping)) {
            if (key.toLowerCase() === searchName) return val;
        }

        // 3. El id sin mirar mayúsculas, por compatibilidad.
        const loose = this.bibleData.find((b) => b.id.toLowerCase() === searchName);
        return loose ? loose.id : bookNameOrId;
    }

    getCanonicalBookId(bookNameOrId: string): string {
        return getCanonicalId(this.resolveBookId(bookNameOrId), this.versionId);
    }

    getBookIdForCanonical(canonicalId: string): string | null {
        const found = this.bibleData.find(
            (b) => getCanonicalId(b.id, this.versionId) === canonicalId,
        );
        return found ? found.id : null;
    }

    getChapterCount(bookNameOrId: string): number {
        const bookId = this.resolveBookId(bookNameOrId);
        const book = this.bibleData.find(b => b.id.toLowerCase() === bookId.toLowerCase());
        return book ? book.chapters.length : 0;
    }

    getChapterContent(bookNameOrId: string, chapter: number): string[] | null {
        const bookId = this.resolveBookId(bookNameOrId);
        const book = this.bibleData.find(b => b.id.toLowerCase() === bookId.toLowerCase());
        if (!book) return null;

        const chapterIdx = chapter - 1;
        if (chapterIdx < 0 || chapterIdx >= book.chapters.length) return null;

        return book.chapters[chapterIdx].map(verse => this.cleanVerse(verse));
    }

    warmSearch(): void {
        this.buildSearchIndex();
    }

    search(query: string, limit = 20, bookIds?: string[]): BibleSearchResult[] {
        const q = query.trim();
        if (!q || q.length < 3) return [];
        const terms = searchTerms(q);
        if (!terms.length) return [];

        // El ámbito se filtra ACÁ y no sobre los resultados: buscar en los 66
        // libros para después descartar 65 es recorrer de más en cada tecla.
        const scope = bookIds ? new Set(bookIds.map((id) => id.toLowerCase())) : null;
        const results: BibleSearchResult[] = [];
        for (const entry of this.buildSearchIndex()) {
            if (scope && !scope.has(entry.bookId.toLowerCase())) continue;
            // Coincide sin acentos y por términos sueltos: el que escribe en
            // una tablet pone "ninive", y "Jonás Nínive" tiene que encontrar
            // el versículo que dice las dos cosas.
            if (!terms.every((term) => entry.folded.includes(term))) continue;
            results.push({
                reference: `${entry.bookName} ${entry.c + 1}:${entry.v + 1}`,
                text: entry.text,
                bookId: entry.bookId,
                chapter: entry.c + 1,
                verse: entry.v + 1,
                ranges: matchRanges(entry.text, q),
            });
            if (results.length >= limit) break;
        }
        return results;
    }
}
