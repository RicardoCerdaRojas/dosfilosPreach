import { BIBLE_BOOKS_ES, SINGLE_CHAPTER_BOOK_IDS, normalizeBookName, resolveBibleBook, type HebrewBook } from '@dosfilos/domain';

/**
 * «Ir a versículo» del tutor de hebreo: de lo que escribe la persona a las sugerencias.
 *
 * ANTES sólo buscaba el libro por el comienzo de su nombre del catálogo, con tildes exactas: «Gn 2:17»,
 * «Rt 1:7» o «1 S 3:4» no encontraban nada, y el campo no decía nada (prueba del fundador en
 * producción, 2026-10-10). Ahora el libro se reconoce también por las abreviaturas de la tabla común
 * de la aplicación (`BIBLE_BOOKS_ES`, la misma de la página de Biblia y del asistente) y sin tildes.
 */

export interface VerseSuggestion {
    bookKey: string;
    bookName: string;
    nameHebrew: string;
    chapter: number;
    verse: number;
}

/** Sin tildes, en minúsculas y sin espacios: «1 S», «1s» y «1S» son lo mismo. */
const plano = (s: string) => normalizeBookName(s).replace(/\s+/g, '');

/** Cada libro del catálogo con todos los nombres por los que se lo puede escribir. */
function nombresDe(books: readonly HebrewBook[]): { book: HebrewBook; id?: string; nombres: string[] }[] {
    return books.map(book => {
        const id = resolveBibleBook(book.nameSpanish)?.id;
        const alias = id ? Object.entries(BIBLE_BOOKS_ES).filter(([, i]) => i === id).map(([k]) => k) : [];
        return { book, id, nombres: [...new Set([book.nameSpanish, book.nameEnglish, book.abbreviation, book.morphhbKey, ...alias].map(plano))] };
    });
}

const cache = new WeakMap<readonly HebrewBook[], ReturnType<typeof nombresDe>>();

/**
 * Las sugerencias para lo escrito: los libros con un nombre o abreviatura que empieza así, en el orden
 * del catálogo. Que cada abreviatura exacta dé su propio libro primero lo prueba `irAVersiculo.test`
 * sobre todos los alias. Un capítulo que el libro no tiene lo deja fuera: mejor «no se encontró» que
 * llevar a otro capítulo sin avisar.
 */
export function verseSuggestions(input: string, books: readonly HebrewBook[]): VerseSuggestion[] {
    // Lo que se escribe a medias o de más no estorba: «Gn 2:» (falta el versículo), «Gn 2:17-18» (rango:
    // va al primero), «Gn 2:17a», «Gn. 2:17», «Gn 2;17».
    const limpio = input.trim().replace(/[:.,;\s]+$/, '');
    if (limpio.length < 2) return [];
    const m = limpio.match(/^(.*?)\.?(?:\s*(\d+)(?:\s*[:.,;]\s*|\s+)(\d+)(?:\s*[-–]\s*\d+)?[a-c]?|\s+(\d+))?$/i);
    if (!m) return [];
    const escrito = m[1] ?? '';
    const q = plano(escrito);
    if (!q) return [];
    // Una abreviatura de la tabla común que es de un libro fuera del AT («Jud» = Judas, «Jn» = Juan) no
    // lleva a otro libro del catálogo que empiece igual (Jueces, «Judges»).
    const exacto = resolveBibleBook(escrito);
    let libros = cache.get(books);
    if (!libros) cache.set(books, (libros = nombresDe(books)));
    if (exacto && !libros.some(l => l.id === exacto.id)) return [];

    const n1 = m[2] ?? m[4];
    const n2 = m[3];
    return libros
        .filter(l => l.nombres.some(n => n.startsWith(q)))
        .flatMap(({ book: b, id }) => {
            // En un libro de un solo capítulo el número suelto es el versículo: «Abd 5» (la regla de la tabla común).
            const unSolo = id !== undefined && SINGLE_CHAPTER_BOOK_IDS.has(id) && n2 === undefined && n1 !== undefined;
            const chapter = unSolo ? 1 : n1 !== undefined ? parseInt(n1, 10) : 1;
            const verse = unSolo ? parseInt(n1!, 10) : n2 !== undefined ? parseInt(n2, 10) : 1;
            if (chapter < 1 || chapter > b.chapterCount) return [];
            return [{ bookKey: b.morphhbKey, bookName: b.nameSpanish, nameHebrew: b.nameHebrew, chapter, verse: verse >= 1 ? verse : 1 }];
        })
        .slice(0, 6);
}
