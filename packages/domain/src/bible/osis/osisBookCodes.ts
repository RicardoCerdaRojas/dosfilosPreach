import type { BibleBookId } from '../canon/BibleCanon';

/**
 * Códigos de libro OSIS ↔ identificadores del canon de la app.
 *
 * OSIS es el estándar con el que vienen anotadas casi todas las fuentes
 * bíblicas abiertas: los módulos de CCEL, morphhb, SWORD. Sus códigos
 * (`Gen`, `1Sam`, `Jonah`, `Phlm`) no coinciden con los de Paratext que usa
 * la app (`GEN`, `1SA`, `JON`, `PHM`), y la tabla de alias del canon
 * —pensada para texto libre en castellano— sólo resuelve 27 de los 72
 * códigos que aparecen en un comentario típico. Sin este mapa, ingerir
 * cualquier obra anotada en OSIS pierde el anclaje al pasaje.
 *
 * **La tabla se derivó, no se transcribió.** Se recorrieron las divisiones de
 * libro del comentario Jamieson-Fausset-Brown en ThML y, para cada una, se
 * tomó el código OSIS MÁS FRECUENTE dentro de esa división. La frecuencia es
 * robusta a las citas cruzadas —la primera referencia dentro de «Job» es a
 * Ezequiel— y el título de cada división confirma el libro. Salieron los 66
 * en orden canónico.
 *
 * Los deuterocanónicos que aparecen en las fuentes (`Sir`, `Tob`, `Wis`,
 * `1Macc`, `2Macc`, `3Macc`) NO están acá: quedan fuera del canon de la app,
 * y `bookIdFromOsis` devuelve `null` para ellos. Un `null` no es un error de
 * lectura sino una referencia legítima a algo que la app no indexa.
 */
export const OSIS_TO_BOOK_ID: Readonly<Record<string, BibleBookId>> = {
    'Gen': 'GEN',
    'Exod': 'EXO',
    'Lev': 'LEV',
    'Num': 'NUM',
    'Deut': 'DEU',
    'Josh': 'JOS',
    'Judg': 'JDG',
    'Ruth': 'RUT',
    '1Sam': '1SA',
    '2Sam': '2SA',
    '1Kgs': '1KI',
    '2Kgs': '2KI',
    '1Chr': '1CH',
    '2Chr': '2CH',
    'Ezra': 'EZR',
    'Neh': 'NEH',
    'Esth': 'EST',
    'Job': 'JOB',
    'Ps': 'PSA',
    'Prov': 'PRO',
    'Eccl': 'ECC',
    'Song': 'SNG',
    'Isa': 'ISA',
    'Jer': 'JER',
    'Lam': 'LAM',
    'Ezek': 'EZK',
    'Dan': 'DAN',
    'Hos': 'HOS',
    'Joel': 'JOL',
    'Amos': 'AMO',
    'Obad': 'OBA',
    'Jonah': 'JON',
    'Mic': 'MIC',
    'Nah': 'NAM',
    'Hab': 'HAB',
    'Zeph': 'ZEP',
    'Hag': 'HAG',
    'Zech': 'ZEC',
    'Mal': 'MAL',
    'Matt': 'MAT',
    'Mark': 'MRK',
    'Luke': 'LUK',
    'John': 'JHN',
    'Acts': 'ACT',
    'Rom': 'ROM',
    '1Cor': '1CO',
    '2Cor': '2CO',
    'Gal': 'GAL',
    'Eph': 'EPH',
    'Phil': 'PHP',
    'Col': 'COL',
    '1Thess': '1TH',
    '2Thess': '2TH',
    '1Tim': '1TI',
    '2Tim': '2TI',
    'Titus': 'TIT',
    'Phlm': 'PHM',
    'Heb': 'HEB',
    'Jas': 'JAS',
    '1Pet': '1PE',
    '2Pet': '2PE',
    '1John': '1JN',
    '2John': '2JN',
    '3John': '3JN',
    'Jude': 'JUD',
    'Rev': 'REV',
};

const BOOK_ID_TO_OSIS: Readonly<Record<string, string>> = Object.fromEntries(
    Object.entries(OSIS_TO_BOOK_ID).map(([osis, id]) => [id, osis]),
);

/**
 * Traduce un código OSIS al id del canon. Devuelve `null` cuando el código no
 * pertenece al canon protestante (deuterocanónicos) o no se reconoce — nunca
 * adivina.
 */
export function bookIdFromOsis(osisCode: string): BibleBookId | null {
    return OSIS_TO_BOOK_ID[osisCode] ?? null;
}

/** La vuelta, para emitir referencias OSIS desde el canon de la app. */
export function osisFromBookId(bookId: BibleBookId): string | null {
    return BOOK_ID_TO_OSIS[bookId] ?? null;
}

/**
 * Interpreta un `osisRef` completo como los que trae CCEL:
 * `"Bible:Jonah.1.17"`, `"Bible:Jonah.1"`, `"Bible:Jonah.1.1-Jonah.1.17"`.
 *
 * Devuelve `null` cuando el libro no está en el canon o el formato no se
 * reconoce. El capítulo y el versículo quedan opcionales porque una
 * referencia a un capítulo entero es válida y frecuente.
 */
export function parseOsisRef(
    raw: string,
): { bookId: BibleBookId; chapter: number | null; verse: number | null } | null {
    const sinPrefijo = raw.replace(/^Bible:/, '').trim();
    // De un rango sólo interesa el extremo inicial: es el ancla del bloque.
    const primero = sinPrefijo.split('-')[0] ?? '';
    const partes = primero.split('.');
    const bookId = bookIdFromOsis(partes[0] ?? '');
    if (!bookId) return null;
    const chapter = partes[1] ? Number(partes[1]) : null;
    const verse = partes[2] ? Number(partes[2]) : null;
    return {
        bookId,
        chapter: Number.isFinite(chapter) ? chapter : null,
        verse: Number.isFinite(verse) ? verse : null,
    };
}
