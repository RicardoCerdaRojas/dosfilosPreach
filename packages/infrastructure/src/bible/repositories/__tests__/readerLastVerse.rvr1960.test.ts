import { describe, expect, it } from 'vitest';
import {
    BOOKS_WITH_VERSIFICATION_DIFFERENCES,
    READER_LAST_VERSE,
    VERSIFICATION_SPANS,
    getBookById,
    readerLastVerse,
    resolveBibleBook,
    type BibleBookId,
} from '@dosfilos/domain';
import rvrBible from '../../data/rvr1960.json';

/**
 * `READER_LAST_VERSE` (domain) contra la Biblia del lector: para cada libro
 * donde la numeración difiere, el último versículo de cada capítulo tiene que
 * ser el largo del capítulo en rvr1960.json. Vive aquí y no en domain porque
 * el archivo es de infrastructure. Si falla: node scripts/generar-ultimo-verso-lector.mjs
 */
type LibroRvr = { id: string; chapters: string[][] };
const biblia = rvrBible as LibroRvr[];

/** El libro del canon en rvr1960.json, por su nombre castellano (la misma tabla que usa el repositorio). */
function capitulosRvr(book: BibleBookId): string[][] {
    const nombre = getBookById(book)?.nameEs;
    const rvrId = nombre ? resolveBibleBook(nombre)?.id : undefined;
    const libro = biblia.find(b => b.id === rvrId);
    if (!libro) throw new Error(`libro sin datos en rvr1960.json: ${book}`);
    return libro.chapters;
}

describe('READER_LAST_VERSE contra rvr1960.json', () => {
    it('cubre exactamente los libros donde la numeración difiere', () => {
        expect(Object.keys(READER_LAST_VERSE).sort()).toEqual([...BOOKS_WITH_VERSIFICATION_DIFFERENCES].sort());
    });

    it('el último versículo de cada capítulo es el largo del capítulo en la RVR1960', () => {
        const distintos: string[] = [];
        for (const book of BOOKS_WITH_VERSIFICATION_DIFFERENCES) {
            const esperado = capitulosRvr(book).map(c => c.length);
            if (JSON.stringify(READER_LAST_VERSE[book]) !== JSON.stringify(esperado)) distintos.push(book);
        }
        expect(distintos).toEqual([]);
    });

    it('todo tramo de la versificación cabe en su capítulo del lector', () => {
        const fuera = VERSIFICATION_SPANS
            .filter(s => s.to > (readerLastVerse(s.book, s.chapter) ?? 0))
            .map(s => `${s.book} ${s.chapter}:${s.from}-${s.to}`);
        expect(fuera).toEqual([]);
    });

    it('los medidos: Jonás 1 tiene 17, Nehemías 4 tiene 23, Malaquías 4 tiene 6; un libro sin diferencias no está', () => {
        expect(readerLastVerse('JON', 1)).toBe(17);
        expect(readerLastVerse('NEH', 4)).toBe(23);
        expect(readerLastVerse('MAL', 4)).toBe(6);
        expect(readerLastVerse('JON', 5)).toBeNull();
        expect(readerLastVerse('EZR', 1)).toBeNull();
    });
});
