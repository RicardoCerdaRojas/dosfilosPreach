import { getAllBooks, getBookById, type BibleBookId } from '../../bible/canon/BibleCanon';
import type { PassageReference } from '../../bible/canon/passage-reference';
import type { SheetRange } from '../entities/ProjectSource';
import type { SourceType } from '../entities/SourceType';
import { normalizeSheetRanges, type PageIndexEntry } from './documentPageIndex';

/**
 * Las hojas de una EDICIÓN DEL TEXTO (NA28, UBS, una LXX) que traen el pasaje.
 *
 * TP #9 (Santiago 4:11-17, 2026-10-28, B26): la sugerencia para el NA28 fueron
 * 40 hojas de Lucas, Hechos, Romanos… y ni una de Santiago. El texto griego no
 * nombra «Santiago 4:11» en ningún lado —sólo «**11**»—, así que la búsqueda
 * por referencia no halló nada, y la de parecido de contenido devolvió las
 * hojas de otros libros que «se parecen» al pasaje. En una edición del texto
 * eso nunca sirve: la hoja del pasaje es la del LIBRO del pasaje.
 *
 * Y la edición lo dice en cada hoja, en el encabezado corrido: «4,3–12 |
 * ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ» (h. 803, p. 692), «ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ | 4,13–5,3» (h. 804).
 * Una hoja cuenta sólo si su encabezado nombra el libro del pasaje y su tramo
 * de versículos se pisa con él. Las referencias cruzadas del margen («Jc
 * 4,11») no cuentan: nombran Santiago desde la hoja de otro libro.
 */

/** Los tipos de fuente que son el texto bíblico mismo (o su aparato). */
const TEXT_EDITION_TYPES: ReadonlySet<SourceType> = new Set<SourceType>(['biblical-text-edition', 'critical-apparatus']);

export function isTextEditionSourceType(sourceType: SourceType | null | undefined): boolean {
    return !!sourceType && TEXT_EDITION_TYPES.has(sourceType);
}

/**
 * Los títulos griegos del encabezado corrido del NA28 (y del UBS, que usa los
 * mismos), ya plegados (`foldHeader`). Medido sobre el NA28 de la biblioteca:
 * «ΠΡΟΣ ΚΟΡΙΝΘΙΟΥΣ Αʹ», «ΙΩΑΝΝΟΥ ΕΠΙΣΤΟΛΗ ΠΡΩΤΗ», «KATA ΛΟΥΚΑΝ» con letras
 * latinas que se parecen a las griegas.
 */
const GREEK_TITLES: Readonly<Partial<Record<BibleBookId, string[]>>> = {
    MAT: ['ΚΑΤΑ ΜΑΘΘΑΙΟΝ'],
    MRK: ['ΚΑΤΑ ΜΑΡΚΟΝ'],
    LUK: ['ΚΑΤΑ ΛΟΥΚΑΝ'],
    JHN: ['ΚΑΤΑ ΙΩΑΝΝΗΝ'],
    ACT: ['ΠΡΑΞΕΙΣ ΑΠΟΣΤΟΛΩΝ', 'ΠΡΑΞΕΙΣ'],
    ROM: ['ΠΡΟΣ ΡΩΜΑΙΟΥΣ'],
    '1CO': ['ΠΡΟΣ ΚΟΡΙΝΘΙΟΥΣ Α', 'ΠΡΟΣ ΚΟΡΙΝΘΙΟΥΣ ΠΡΩΤΗ'],
    '2CO': ['ΠΡΟΣ ΚΟΡΙΝΘΙΟΥΣ Β', 'ΠΡΟΣ ΚΟΡΙΝΘΙΟΥΣ ΔΕΥΤΕΡΑ'],
    GAL: ['ΠΡΟΣ ΓΑΛΑΤΑΣ'],
    EPH: ['ΠΡΟΣ ΕΦΕΣΙΟΥΣ'],
    PHP: ['ΠΡΟΣ ΦΙΛΙΠΠΗΣΙΟΥΣ'],
    COL: ['ΠΡΟΣ ΚΟΛΟΣΣΑΕΙΣ'],
    '1TH': ['ΠΡΟΣ ΘΕΣΣΑΛΟΝΙΚΕΙΣ Α', 'ΠΡΟΣ ΘΕΣΣΑΛΟΝΙΚΕΙΣ ΠΡΩΤΗ'],
    '2TH': ['ΠΡΟΣ ΘΕΣΣΑΛΟΝΙΚΕΙΣ Β', 'ΠΡΟΣ ΘΕΣΣΑΛΟΝΙΚΕΙΣ ΔΕΥΤΕΡΑ'],
    '1TI': ['ΠΡΟΣ ΤΙΜΟΘΕΟΝ Α', 'ΠΡΟΣ ΤΙΜΟΘΕΟΝ ΠΡΩΤΗ'],
    '2TI': ['ΠΡΟΣ ΤΙΜΟΘΕΟΝ Β', 'ΠΡΟΣ ΤΙΜΟΘΕΟΝ ΔΕΥΤΕΡΑ'],
    TIT: ['ΠΡΟΣ ΤΙΤΟΝ'],
    PHM: ['ΠΡΟΣ ΦΙΛΗΜΟΝΑ'],
    HEB: ['ΠΡΟΣ ΕΒΡΑΙΟΥΣ'],
    JAS: ['ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ', 'ΙΑΚΩΒΟΥ'],
    '1PE': ['ΠΕΤΡΟΥ ΕΠΙΣΤΟΛΗ ΠΡΩΤΗ', 'ΠΕΤΡΟΥ Α'],
    '2PE': ['ΠΕΤΡΟΥ ΕΠΙΣΤΟΛΗ ΔΕΥΤΕΡΑ', 'ΠΕΤΡΟΥ Β'],
    '1JN': ['ΙΩΑΝΝΟΥ ΕΠΙΣΤΟΛΗ ΠΡΩΤΗ', 'ΙΩΑΝΝΟΥ Α'],
    '2JN': ['ΙΩΑΝΝΟΥ ΕΠΙΣΤΟΛΗ ΔΕΥΤΕΡΑ', 'ΙΩΑΝΝΟΥ Β'],
    '3JN': ['ΙΩΑΝΝΟΥ ΕΠΙΣΤΟΛΗ ΤΡΙΤΗ', 'ΙΩΑΝΝΟΥ Γ'],
    JUD: ['ΙΟΥΔΑ ΕΠΙΣΤΟΛΗ', 'ΙΟΥΔΑ'],
    REV: ['ΑΠΟΚΑΛΥΨΙΣ ΙΩΑΝΝΟΥ', 'ΑΠΟΚΑΛΥΨΙΣ'],
};

/** Letras latinas que el extractor pone en lugar de su gemela griega («KATA ΛΟΥΚΑΝ»). */
const LATIN_LOOKALIKES: Readonly<Record<string, string>> = {
    A: 'Α', B: 'Β', E: 'Ε', Z: 'Ζ', H: 'Η', I: 'Ι', K: 'Κ', M: 'Μ', N: 'Ν', O: 'Ο', P: 'Ρ', T: 'Τ', X: 'Χ', Y: 'Υ',
};

/**
 * Un encabezado en su forma comparable: sin acentos, en mayúscula, sin la
 * keraia de los numerales («Αʹ», «Α′», «Α΄» son «Α») y con las letras latinas
 * gemelas pasadas a griego. Se pliega igual el encabezado y cada título, así
 * que «JAMES» sigue encontrando a «JAMES».
 */
export function foldHeader(text: string): string {
    return text
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toUpperCase()
        .replace(/[ʹ′΄'`´]/g, '')
        .replace(/[ABEZHIKMNOPTXY]/g, l => LATIN_LOOKALIKES[l] ?? l);
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Cuánto del arranque de la hoja se lee como encabezado. El del NA28 cabe en 35. */
const HEADER_ZONE_CHARS = 60;

/**
 * Grafías de menos letras que esto no sirven de título: un encabezado corrido
 * lleva el nombre del libro, y «Jas 4,11» en el arranque de una hoja es una
 * referencia cruzada del margen, no el encabezado.
 */
const MIN_TITLE_LETTERS = 4;

/** El encabezado abre la hoja: como mucho, un folio delante («692 4,3–12 | …»). */
const MAX_HEADER_OFFSET = 12;

let titleIndex: { byTitle: Map<string, BibleBookId>; alternation: string } | null = null;

/** Todos los títulos, de todos los libros: gana el más largo («ΑΠΟΚΑΛΥΨΙΣ ΙΩΑΝΝΟΥ» antes que «ΙΩΑΝΝΟΥ Α»). */
function titles(): { byTitle: Map<string, BibleBookId>; alternation: string } {
    if (titleIndex) return titleIndex;
    const byTitle = new Map<string, BibleBookId>();
    const ambiguous = new Set<string>();
    const add = (title: string, id: BibleBookId) => {
        const folded = foldHeader(title).replace(/\s+/g, ' ').trim();
        if (folded.replace(/[^\p{L}]/gu, '').length < MIN_TITLE_LETTERS) return;
        const prev = byTitle.get(folded);
        if (prev && prev !== id) ambiguous.add(folded);
        else byTitle.set(folded, id);
    };
    for (const [id, list] of Object.entries(GREEK_TITLES) as Array<[BibleBookId, string[]]>) {
        for (const t of list) add(t, id);
    }
    for (const book of getAllBooks()) {
        for (const name of [book.nameEs, book.nameEn, ...book.aliases]) add(name, book.id);
    }
    // Una grafía de dos libros («jud») no decide nada en un encabezado.
    for (const t of ambiguous) byTitle.delete(t);
    const alternation = [...byTitle.keys()]
        .sort((a, b) => b.length - a.length)
        .map(t => t.split(' ').map(escapeRegExp).join('\\s+'))
        .join('|');
    titleIndex = { byTitle, alternation };
    return titleIndex;
}

/** «4,3–12», «4,13–5,3», «9–13» (libro de un capítulo). */
const RANGE = '(\\d{1,3})(?:\\s*[,:.]\\s*(\\d{1,3}))?(?:\\s*[–—-]\\s*(\\d{1,3})(?:\\s*[,:.]\\s*(\\d{1,3}))?)?';
/** El tramo no puede empezar pegado a otra cifra o a un guion: «11–15. 1–2» no es 15:1–2. */
const BEFORE_RANGE = '(?<![\\d–—\\-,.:])';

let headerPatterns: { rangeFirst: RegExp; titleFirst: RegExp } | null = null;

function patterns(): { rangeFirst: RegExp; titleFirst: RegExp } {
    if (headerPatterns) return headerPatterns;
    const t = titles().alternation;
    headerPatterns = {
        // «4,3–12 | ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ»
        rangeFirst: new RegExp(`${BEFORE_RANGE}${RANGE}\\s*\\|?\\s*(?<![\\p{L}])(${t})(?![\\p{L}])`, 'u'),
        // «ΙΑΚΩΒΟΥ ΕΠΙΣΤΟΛΗ | 4,13–5,3»
        titleFirst: new RegExp(`(?<![\\p{L}])(${t})\\s*\\|?\\s*${BEFORE_RANGE}${RANGE}(?![\\d])`, 'u'),
    };
    return headerPatterns;
}

/** Un versículo como número ordenable dentro del libro. */
const pos = (chapter: number, verse: number) => chapter * 1000 + verse;

export interface RunningHeader {
    bookId: BibleBookId;
    /** Primer y último versículo que trae la hoja, como `capítulo * 1000 + versículo`. */
    start: number;
    end: number;
    /** La hoja empieza a mitad de un versículo que viene de la anterior («λεμεῖτε, …»). */
    continues: boolean;
}

/**
 * Lee el encabezado corrido de una hoja: el libro y su tramo de versículos.
 * `null` si el arranque de la hoja no es un encabezado de edición del texto.
 */
export function parseRunningHeader(firstLine: string): RunningHeader | null {
    const zone = foldHeader(firstLine.slice(0, HEADER_ZONE_CHARS));
    const { rangeFirst, titleFirst } = patterns();
    const a = zone.match(rangeFirst);
    const b = zone.match(titleFirst);
    // Gana el que empieza antes: el encabezado abre la hoja.
    const m = a && (!b || (a.index ?? 0) <= (b.index ?? 0)) ? a : b;
    if (!m || (m.index ?? 0) > MAX_HEADER_OFFSET) return null;
    const title = (m === a ? m[5] : m[1])!.replace(/\s+/g, ' ');
    const [c1, v1, c2, v2] = (m === a ? m.slice(1, 5) : m.slice(2, 6)).map(x => (x === undefined ? undefined : Number(x)));
    const bookId = titles().byTitle.get(title);
    if (!bookId || c1 === undefined) return null;
    const chapters = getBookById(bookId)?.chapterCount ?? 0;

    let start: number;
    let end: number;
    if (v1 !== undefined) {
        start = pos(c1, v1);
        end = v2 !== undefined && c2 !== undefined ? pos(c2, v2) : c2 !== undefined ? pos(c1, c2) : start;
    } else {
        // Sólo cifras sin capítulo: vale únicamente en un libro de un capítulo.
        if (chapters !== 1 || v2 !== undefined) return null;
        start = pos(1, c1);
        end = pos(1, c2 ?? c1);
    }
    // «ΙΩΑΝΝΟΥ ΕΠΙΣΤΟΛΗ ΠΡΩΤΗ 3,16–1,2»: la hoja abre con el final del libro
    // anterior; del libro nombrado trae desde 1:1 hasta 1:2.
    if (end < start) start = pos(Math.floor(end / 1000), 1);
    if (Math.floor(end / 1000) > chapters) return null;

    const rest = zone.slice((m.index ?? 0) + m[0].length).replace(/^[\s|]+/, '');
    const continues = rest.length > 0 && !/^[\d*¶]/.test(rest);
    return { bookId, start, end, continues };
}

/**
 * Las hojas de la edición que traen el pasaje, por su encabezado corrido.
 *
 * Además de las hojas cuyo tramo se pisa con el pasaje:
 *   - la siguiente, si empieza a mitad del último versículo del pasaje (su
 *     encabezado arranca en el versículo que sigue);
 *   - las hojas sin encabezado legible metidas entre dos hojas del libro, y la
 *     que abre el libro (en el NA28, la h. 796 de Santiago 1:1-13 no trae
 *     encabezado: es la portadilla del libro).
 *
 * Vacío si ninguna hoja nombra el libro: entonces no se propone nada, y menos
 * hojas de otros libros.
 */
export function textEditionSheetsForPassage(
    pageIndex: ReadonlyArray<PageIndexEntry>,
    passage: PassageReference,
): SheetRange[] {
    const pStart = pos(passage.chapterStart, passage.verseStart ?? 1);
    const pEnd = pos(passage.chapterEnd, passage.verseEnd ?? 999);
    const sheets = [...pageIndex].sort((a, b) => a.sheet - b.sheet);
    const headers = sheets.map(e => parseRunningHeader(e.firstLine ?? ''));

    const chosen = new Set<number>();
    const overlaps = (start: number, end: number) => start <= pEnd && pStart <= end;
    let firstOfBook = -1;
    for (let i = 0; i < sheets.length; i++) {
        const h = headers[i];
        if (!h || h.bookId !== passage.bookId) continue;
        if (firstOfBook < 0) firstOfBook = i;
        const prev = i > 0 ? headers[i - 1] : null;
        const prevIsBook = !!prev && prev.bookId === passage.bookId && sheets[i - 1]!.sheet === sheets[i]!.sheet - 1;
        // Una hoja que arranca a mitad de versículo trae también el final del
        // anterior: el último de la hoja previa o, sin ella, el que precede.
        const start = !h.continues ? h.start : prevIsBook ? prev!.end : h.start % 1000 > 1 ? h.start - 1 : h.start;
        if (overlaps(start, h.end)) chosen.add(sheets[i]!.sheet);
    }
    if (firstOfBook < 0) return [];

    // Huecos: hojas sin encabezado entre dos del libro, si el pasaje cae entre ellas.
    let lastBook = -1;
    for (let i = firstOfBook; i < sheets.length; i++) {
        const h = headers[i];
        if (h && h.bookId !== passage.bookId) break;
        if (!h) continue;
        if (lastBook >= 0 && i - lastBook > 1 && overlaps(headers[lastBook]!.end, h.start)) {
            for (let j = lastBook + 1; j < i; j++) chosen.add(sheets[j]!.sheet);
        }
        lastBook = i;
    }
    // La portadilla: la hoja sin encabezado justo antes de la primera del libro.
    const opening = firstOfBook - 1;
    if (opening >= 0 && !headers[opening] && pStart < headers[firstOfBook]!.start) {
        chosen.add(sheets[opening]!.sheet);
    }
    return normalizeSheetRanges([...chosen].map(sheet => ({ start: sheet, end: sheet })));
}
