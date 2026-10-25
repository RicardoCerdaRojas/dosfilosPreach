import type { BibleBookId } from './canon/BibleCanon';
import type { PassageReference } from './canon/passage-reference';

/**
 * Los tramos del AT escritos en arameo, en versículos enteros.
 *
 * No salen de memoria: son exactamente los versículos que traen algún código
 * arameo en morphhb (prueba en infrastructure, `aramaicSpans.morphhb.test.ts`,
 * que los compara en los dos sentidos). Esdras tiene un hueco hebreo,
 * 6:19–7:11, y por eso son dos tramos.
 *
 * Numeración: la del original. En estos cuatro tramos coincide con la del
 * lector — Daniel cambia de capítulo en 3:31 y 6:1 del TM, pero los extremos
 * 2:4 y 7:28 son los mismos en las dos —, así que el rango sirve con
 * cualquiera de las dos.
 */
export interface AramaicSpan {
    bookId: BibleBookId;
    fromChapter: number;
    fromVerse: number;
    toChapter: number;
    toVerse: number;
}

export const ARAMAIC_SPANS: ReadonlyArray<AramaicSpan> = [
    { bookId: 'GEN', fromChapter: 31, fromVerse: 47, toChapter: 31, toVerse: 47 },
    { bookId: 'JER', fromChapter: 10, fromVerse: 11, toChapter: 10, toVerse: 11 },
    { bookId: 'EZR', fromChapter: 4, fromVerse: 8, toChapter: 6, toVerse: 18 },
    { bookId: 'EZR', fromChapter: 7, fromVerse: 12, toChapter: 7, toVerse: 26 },
    { bookId: 'DAN', fromChapter: 2, fromVerse: 4, toChapter: 7, toVerse: 28 },
];

/** Capítulo y versículo como un solo número ordenable. */
function punto(chapter: number, verse: number): number {
    return chapter * 1000 + verse;
}

/**
 * ¿El pasaje toca arameo? Basta con un versículo: Esd 4:6-24 empieza en
 * hebreo y sigue en arameo, y su análisis tiene que saberlo.
 *
 * Sin versículos es el capítulo entero (`verseStart`/`verseEnd` en `null`).
 */
export function passageHasAramaic(passage: PassageReference): boolean {
    const desde = punto(passage.chapterStart, passage.verseStart ?? 0);
    const hasta = punto(passage.chapterEnd, passage.verseEnd ?? 999);
    return ARAMAIC_SPANS.some(s =>
        s.bookId === passage.bookId
        && desde <= punto(s.toChapter, s.toVerse)
        && punto(s.fromChapter, s.fromVerse) <= hasta);
}

/**
 * Los libros con SECCIONES en arameo, no un versículo suelto (Gn 31:47 y
 * Jer 10:11 son dos palabras y una frase). En éstos el planificador avisa del
 * arameo, y por eso su caché lleva una versión propia.
 */
export const BOOKS_WITH_ARAMAIC_SECTIONS: ReadonlySet<BibleBookId> = new Set<BibleBookId>(['EZR', 'DAN']);
