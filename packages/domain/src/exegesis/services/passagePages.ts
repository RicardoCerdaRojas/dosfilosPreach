import { getBookById } from '../../bible/canon/BibleCanon';
import type { PassageReference } from '../../bible/canon/passage-reference';

/**
 * Dónde nombra un libro al pasaje del trabajo.
 *
 * Nace del defecto más caro de la semana del 2026-09-23. Wallace comenta
 * Santiago 2:9 POR SU NOMBRE en dos hojas —la 515, donde discute el
 * participio adverbial y dice «otra opción posible es la de resultado», y la
 * 578, donde trata la condicional con εἰ— y ninguna de las dos entró al
 * corpus. El trabajo salió con el argumento del participio invertido, y no lo
 * atrapó ninguna compuerta: lo encontró el autor leyendo.
 *
 * La causa no es que la recuperación semántica sea mala; es que se le hace a
 * TODOS los libros la misma pregunta. A un comentario verso por verso,
 * «Santiago 2:1-13» es la pregunta correcta y contesta bien: Mayor devolvió 30
 * fragmentos. A una gramática temática es la pregunta equivocada, porque su
 * índice está organizado por categorías y no por pasajes — pero esa gramática
 * SÍ cita el versículo, como ejemplo, y ese nombre es literal y buscable.
 *
 * Medido sobre el corpus de Santiago 2:1-13, páginas que nombran el pasaje
 * contra fragmentos que el corpus tenía:
 *
 *     Tuggy    (léxico)      0 fragmentos → 65 páginas
 *     Wallace  (gramática)  13 fragmentos → 21 páginas
 *     Porter   (gramática)   0 fragmentos →  7 páginas
 *     Adamson  (comentario) 11 fragmentos → 12 páginas
 *     Mayor    (comentario) 30 fragmentos →  0 páginas
 *
 * Los comentarios dan CERO y eso es correcto: no nombran el pasaje porque la
 * página entera es el pasaje. Los dos caminos no se pisan — cada uno alcanza
 * la forma de libro que el otro no puede.
 */

/**
 * Grafías de un libro que hay que buscar dentro del texto.
 *
 * Salen de los alias del canon, que ya guardan cómo se escribe el libro en
 * los dos idiomas y abreviado. Se descartan las de menos de tres letras: «he»
 * por Hebreos o «sg» por Santiago caen dentro de cualquier palabra y el
 * pasaje que devuelven es ruido.
 */
const MIN_LARGO_DE_GRAFIA = 3;

export interface PassageReferenceQuery {
    /** Cómo puede estar escrito el libro. Sin repetir y en minúsculas. */
    names: string[];
    /** Capítulos del pasaje, inclusive. */
    chapterStart: number;
    chapterEnd: number;
    /**
     * Versículos, acotados al capítulo de inicio y de fin.
     *
     * `null` en los dos cuando la referencia es de capítulo entero, y
     * entonces cualquier versículo de esos capítulos cuenta.
     */
    verseStart: number | null;
    verseEnd: number | null;
}

export function passageReferenceQuery(passage: PassageReference): PassageReferenceQuery | null {
    const book = getBookById(passage.bookId);
    if (!book) return null;
    const names = [...new Set([book.nameEs, book.nameEn, ...book.aliases]
        .map(n => n.trim().toLowerCase())
        .filter(n => n.length >= MIN_LARGO_DE_GRAFIA))];
    if (names.length === 0) return null;
    return {
        names,
        chapterStart: passage.chapterStart,
        chapterEnd: passage.chapterEnd,
        verseStart: passage.verseStart,
        verseEnd: passage.verseEnd,
    };
}

/**
 * Si un versículo citado cae dentro del pasaje del trabajo.
 *
 * Con un pasaje de varios capítulos sólo se acotan los extremos: en «Juan
 * 9:13-23» el capítulo 9 va del 13 al 23, y en «Juan 9:13—10:5» el 9 va del 13
 * en adelante y el 10 hasta el 5. Los capítulos del medio entran enteros.
 */
export function verseInPassage(q: PassageReferenceQuery, chapter: number, verse: number): boolean {
    if (chapter < q.chapterStart || chapter > q.chapterEnd) return false;
    if (chapter === q.chapterStart && q.verseStart !== null && verse < q.verseStart) return false;
    if (chapter === q.chapterEnd && q.verseEnd !== null && verse > q.verseEnd) return false;
    return true;
}

export interface PassagePageHit {
    sheet: number;
    /** Cuántas veces nombra el pasaje esa hoja. */
    count: number;
    /** Versículos que nombra, ordenados. Para rotular la propuesta. */
    verses: number[];
    /** Renglón de la primera aparición, para reconocerla sin abrir el libro. */
    snippet: string;
    section: string | null;
}

/**
 * Cuántas hojas se proponen. Más allá de esto la revisión deja de hacerse.
 *
 * Tiene una hermana del otro lado: el callable corta en 80 hojas antes de
 * responder, por transporte. Mientras este número sea el menor, manda éste y
 * la lista que se ve es la que se decidió acá; subirlo por encima de 80 lo
 * dejaría callado, recortado por la otra punta sin que nada lo diga. El
 * léxico del caso medido nombra el pasaje en 65 hojas, así que las dos cotas
 * muerden de verdad y no son decorativas.
 */
export const MAX_PASSAGE_SHEETS = 40;

/**
 * Ordena las hojas candidatas.
 *
 * Manda cuántos VERSÍCULOS DISTINTOS del pasaje nombra la hoja, y no cuántas
 * veces: una hoja que discute 2:2 y 2:4 juntos habla del pasaje, mientras que
 * una que repite «Stg. 2:8» cinco veces en una lista de apariciones lo usa de
 * ejemplo. A igualdad manda la cantidad, y al final la hoja más temprana, que
 * hace la lista estable entre dos llamadas iguales.
 */
export function rankPassageSheets(hits: ReadonlyArray<PassagePageHit>): PassagePageHit[] {
    return [...hits]
        .sort((a, b) =>
            b.verses.length - a.verses.length
            || b.count - a.count
            || a.sheet - b.sheet)
        .slice(0, MAX_PASSAGE_SHEETS);
}
