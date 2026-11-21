/**
 * La bandeja de revisión de un PDF (fase «Asistente del corpus», A7).
 *
 * Medido en la etapa 0 (docs/FASE_ASISTENTE_CORPUS_ETAPA0_2026-11.md §6): de
 * las obras conseguidas para los trabajos de noviembre, un archivo subido como
 * «ZECNT Santiago» era Gardner, *1 Corintios*; tres eran libros electrónicos
 * sin páginas impresas (Moo, Davids, Vlachos); los desfases hoja → página iban
 * de −7 a −111 (Martin WBC 48: −111); la edición citada no era la de la copia
 * en cinco obras, y el único BDAG legible era una copia no oficial. Todo se
 * supo después, a mano, con `pdftotext`.
 *
 * Aquí se mira al SUBIR, sobre MUESTRAS (decisión 4 del fundador): las
 * primeras hojas (portada, créditos, índice) y tres hojas del cuerpo. Sin el
 * asistente: lo que se informa es lo que está escrito en esas hojas, con la
 * línea que lo prueba, para que la persona lo compare con el ejemplar.
 */
import type { BibleBookId } from '../bible/canon/BibleCanon';
import { foldForSearch } from '../bible/searchMatching';
import { inferBibleBooksFromTitle } from './inferBibleBooksFromTitle';
import { creditsRegionOf, frontMatterOf, proposeIsbn } from '../exegesis/services/bibliographyFromText';
import { compareEdition, type EditionMatch } from '../exegesis/services/corpusNeeds';
import { parseRomanNumeral, type NumberingSegment, type PageNumbering } from '../exegesis/outline/pageNumbering';

/** Una hoja leída del PDF: sus líneas, y el folio de la banda de arriba o de abajo si lo hay. */
export interface ReviewSheet {
    sheet: number;
    lines: ReadonlyArray<string>;
    /** El número impreso que se leyó en la banda (o la etiqueta del PDF), tal cual. */
    folio?: string | null;
}

export interface PdfReviewInput {
    /** Lo que dice el registro de la biblioteca. */
    declared: {
        title: string;
        author?: string | null;
        books: ReadonlyArray<BibleBookId>;
        bibliographyYear?: string | null;
        isbn?: string | null;
        /** La numeración guardada, como desfase de un tramo, para compararla. */
        storedOffset?: number | null;
        storedConfirmed?: boolean;
    };
    /** La edición que cita el catálogo para esta obra, si el catálogo la tiene. */
    cited?: { year: number | null; publisher: string | null; isbn: string | null; title: string } | null;
    /** Las primeras hojas, en orden. */
    front: ReadonlyArray<ReviewSheet>;
    /** Las hojas del cuerpo, con su folio (la muestra y, si no tenía, la siguiente). */
    samples: ReadonlyArray<ReviewSheet>;
    /** Metadatos del archivo y si tiene capa de texto. */
    file: { numPages: number; producer?: string | null; creator?: string | null; hasText: boolean; isEbook?: boolean };
}

export type IdentityVerdict = 'coincide' | 'otro-libro' | 'sin-dato' | 'no-aplica';

export interface PdfReviewIdentity {
    verdict: IdentityVerdict;
    /** Los libros bíblicos que nombran la portada y los encabezados. */
    found: BibleBookId[];
    /** Una línea que lo muestra (para que la persona la compare). */
    evidence: string | null;
}

export interface PdfReviewEdition {
    /** El año del copyright (o, sin ©, el último año de la página de créditos). */
    year: number | null;
    yearsSeen: number[];
    isbn: string | null;
    /** La línea del copyright, tal cual. */
    evidence: string | null;
    /** Contra la edición que cita el catálogo. */
    vsCited: EditionMatch | null;
    /** Contra el año guardado en la ficha. */
    vsBibliography: EditionMatch | null;
}

export type PaginationVerdict = 'una' | 'varias' | 'parcial' | 'sin-folios' | 'sin-texto';

export interface PdfReviewPagination {
    verdict: PaginationVerdict;
    /** Lo que se leyó en cada muestra, y el desfase (página impresa − hoja). */
    points: Array<{ sheet: number; folio: string | null; offset: number | null }>;
    /** Con `una`: el desfase común. */
    offset: number | null;
    /** La numeración guardada no coincide con lo que dicen las hojas. */
    storedDisagrees: boolean;
    /** La numeración guardada dice lo mismo que las hojas. */
    storedAgrees: boolean;
}

export type UnofficialSignal =
    | { kind: 'marca-de-agua'; detail: string }
    | { kind: 'conversion'; detail: string };

export interface PdfReview {
    identity: PdfReviewIdentity;
    edition: PdfReviewEdition;
    pagination: PdfReviewPagination;
    signals: UnofficialSignal[];
    /** Hay algo que la persona debe mirar antes de citar esta obra. */
    needsAttention: boolean;
}

/** Más de tantos libros en una hoja es una lista (la serie, un índice general), no una portada. */
const LIBROS_DE_UNA_LISTA = 4;
/** Una línea de portada o encabezado; más larga es un párrafo. */
const LARGO_DE_ENCABEZADO = 80;

/**
 * Lo que dejan las bibliotecas no oficiales en las hojas o en el productor.
 * Una lista corta y verificable: una coincidencia se muestra con la palabra
 * encontrada, nunca como sospecha sin pruebas.
 */
const MARCAS_DE_AGUA = [
    'z-library', 'z-lib.', 'zlibrary', '1lib.', 'b-ok.', 'libgen', 'library genesis', 'oceanofpdf', 'dokumen.pub',
    'ebin.pub', 'vdoc.pub', 'epdf.pub', 'pdfdrive', 'pdf drive', 'annas-archive', "anna's archive", 'ebookee', 'it-ebooks',
];
/** Un PDF hecho desde un libro electrónico: no tiene las páginas del impreso. */
const CONVERSORES = ['calibre', 'ebook-convert', 'abc amber', 'epub', 'mobi', 'kindle'];

export function reviewPdf(input: PdfReviewInput): PdfReview {
    const identity = reviewIdentity(input);
    const edition = reviewEdition(input);
    const pagination = reviewPagination(input);
    const signals = unofficialSignals(input);
    const needsAttention = identity.verdict === 'otro-libro'
        || edition.vsCited === 'distinta'
        || pagination.verdict !== 'una'
        || pagination.storedDisagrees
        || signals.length > 0;
    return { identity, edition, pagination, signals, needsAttention };
}

function reviewIdentity(input: PdfReviewInput): PdfReviewIdentity {
    if (input.declared.books.length === 0) return { verdict: 'no-aplica', found: [], evidence: null };
    // El nombre del autor no cuenta: «James D. G. Dunn» no es Santiago.
    const apellidos = foldForSearch(input.declared.author ?? '').split(/[^a-z]+/).filter(p => p.length >= 3);
    const delAutor = (linea: string) => apellidos.some(a => foldForSearch(linea).split(/[^a-z]+/).includes(a));
    const encontrados = new Map<BibleBookId, string>();
    for (const hoja of [...input.front, ...input.samples]) {
        const deLaHoja = new Map<BibleBookId, string>();
        for (const linea of hoja.lines) {
            const l = linea.trim();
            if (!l || l.length > LARGO_DE_ENCABEZADO || delAutor(l)) continue;
            for (const libro of inferBibleBooksFromTitle(l).books) if (!deLaHoja.has(libro)) deLaHoja.set(libro, l);
        }
        // La página de la serie nombra veinte libros: no dice cuál es éste.
        if (deLaHoja.size >= LIBROS_DE_UNA_LISTA) continue;
        for (const [libro, l] of deLaHoja) if (!encontrados.has(libro)) encontrados.set(libro, l);
    }
    const found = [...encontrados.keys()];
    const propio = input.declared.books.find(b => encontrados.has(b));
    if (propio) return { verdict: 'coincide', found, evidence: encontrados.get(propio)! };
    if (found.length === 0) return { verdict: 'sin-dato', found, evidence: null };
    return { verdict: 'otro-libro', found, evidence: encontrados.get(found[0]!)! };
}

const ANIO = /\b(1[5-9]\d\d|20\d\d)\b/g;
/** Una línea del escaneo, no del libro. */
const DIGITALIZACION = /digiti[sz]ed|internet archive|scanned by|digitalizado|google books/i;
/** Una línea que habla de la edición o la impresión. */
const EDICION = /edition|reprint|published|printing|edici[oó]n|reimpres|impreso|publicado/i;

function reviewEdition(input: PdfReviewInput): PdfReviewEdition {
    const texto = input.front.map(h => h.lines.join('\n')).join('\n');
    const creditos = creditsRegionOf(frontMatterOf(texto));
    const hoy = new Date().getFullYear() + 1;
    const anios = (s: string) => [...s.matchAll(ANIO)].map(m => Number(m[1])).filter(y => y <= hoy);
    // El año del copyright manda; una reimpresión posterior no cambia la paginación.
    // «Digitized by the Internet Archive in 2022» no es un año del libro
    // (medido en el Mayor de la biblioteca: daba 2022 en vez de 1978).
    // La frase ocupa dos líneas en el escaneo («…Internet Archive» / «in 2022 with…»): se mira también la anterior.
    const todas = creditos.split('\n');
    const lineas = todas.filter((l, i) => !DIGITALIZACION.test(l) && !DIGITALIZACION.test(todas[i - 1] ?? ''));
    const lineasCopyright = lineas.filter(l => /©|copyright|\(c\)\s*\d{4}/i.test(l));
    const lineasDeEdicion = lineas.filter(l => EDICION.test(l));
    const delCopyright = lineasCopyright.flatMap(anios);
    const deEdicion = lineasDeEdicion.flatMap(anios);
    const yearsSeen = [...new Set(lineas.flatMap(anios))].sort((a, b) => a - b);
    const year = delCopyright.length ? Math.max(...delCopyright)
        : deEdicion.length ? Math.max(...deEdicion)
        : yearsSeen.at(-1) ?? null;
    const evidencia = [...lineasCopyright, ...lineasDeEdicion].find(l => anios(l).includes(year ?? -1))?.trim() ?? null;
    const isbn = proposeIsbn(texto);
    const vsCited = input.cited ? compareEditionOrIsbn(input.cited.year, year, input.cited.isbn, isbn) : null;
    const vsBibliography = input.declared.bibliographyYear ? compareEdition(year, input.declared.bibliographyYear) : null;
    return { year, yearsSeen, isbn, evidence: evidencia ? evidencia.slice(0, 200) : null, vsCited, vsBibliography };
}

/** El ISBN dice más que el año: si los dos están y coinciden, es la misma edición aunque el año difiera. */
function compareEditionOrIsbn(citedYear: number | null, copyYear: number | null, citedIsbn: string | null, copyIsbn: string | null): EditionMatch {
    if (citedIsbn && copyIsbn) return citedIsbn === copyIsbn ? 'misma' : compareEdition(citedYear, copyYear);
    return compareEdition(citedYear, copyYear);
}

function reviewPagination(input: PdfReviewInput): PdfReviewPagination {
    const points = input.samples.map(s => {
        const folio = s.folio?.trim() || romanInRunningHead(s.lines);
        const n = folio && /^\d+$/.test(folio) ? Number(folio) : null;
        return { sheet: s.sheet, folio: folio || null, offset: n === null ? null : n - s.sheet };
    });
    const leidos = points.filter(p => p.folio);
    const conDesfase = points.filter(p => p.offset !== null);
    const desfases = [...new Set(conDesfase.map(p => p.offset!))];
    let verdict: PaginationVerdict;
    if (!input.file.hasText) verdict = 'sin-texto';
    else if (leidos.length === 0) verdict = 'sin-folios';
    // Romanos y arábigos (la introducción de Mayor), o dos desfases: más de una regla.
    else if (desfases.length !== 1 || leidos.length > conDesfase.length) verdict = 'varias';
    else verdict = conDesfase.length === points.length ? 'una' : 'parcial';
    const offset = verdict === 'una' || verdict === 'parcial' ? desfases[0] ?? null : null;
    const guardado = input.declared.storedOffset;
    const comparable = guardado !== undefined && guardado !== null && offset !== null;
    return { verdict, points, offset, storedDisagrees: comparable && guardado !== offset, storedAgrees: comparable && guardado === offset };
}

/**
 * Un folio romano en el encabezado corrido de un escaneo con OCR: «TO WHOM
 * THE EPISTLE IS ADDRESSED exix», «ecliv INTRODUCTION» (Mayor, Internet
 * Archive). El OCR lee la «c» como «e»; se corrige solo ahí, en la primera o
 * la última palabra de la primera o la última línea, y solo si da un romano.
 */
export function romanInRunningHead(lines: ReadonlyArray<string>): string | null {
    const candidatas = [lines[0], lines[lines.length - 1]].filter((l): l is string => !!l);
    for (const linea of candidatas) {
        const palabras = linea.trim().split(/\s+/);
        for (const p of [palabras[0], palabras[palabras.length - 1]]) {
            const t = (p ?? '').toLowerCase().replace(/[^a-z]/g, '');
            if (t.length < 2 || !/^[ivxlcdme]+$/.test(t)) continue;
            const corregido = t.replace(/e/g, 'c');
            if (parseRomanNumeral(corregido) !== null) return corregido;
        }
    }
    return null;
}

/**
 * La numeración que se puede guardar desde la bandeja: un desfase leído en
 * al menos dos hojas. Las hojas de antes de la página 1 quedan SIN número
 * (se citan por hoja): la bandeja no leyó los preliminares, y extender el
 * desfase hacia atrás inventaría páginas que no existen.
 */
export function numberingFromReview(p: PdfReviewPagination, lastSheet: number): PageNumbering | null {
    const leidas = p.points.filter(x => x.offset !== null).length;
    if ((p.verdict !== 'una' && p.verdict !== 'parcial') || p.offset === null || leidas < 2) return null;
    const desde = Math.max(1, 1 - p.offset);
    if (desde > lastSheet) return null;
    const segments: NumberingSegment[] = [];
    if (desde > 1) segments.push({ fromSheet: 1, toSheet: desde - 1, offset: null });
    segments.push({ fromSheet: desde, toSheet: lastSheet, offset: p.offset });
    return { segments, origin: 'confirmed' };
}

function unofficialSignals(input: PdfReviewInput): UnofficialSignal[] {
    const out: UnofficialSignal[] = [];
    const texto = foldForSearch([...input.front, ...input.samples].flatMap(h => h.lines).join('\n'));
    const productor = foldForSearch(`${input.file.producer ?? ''} ${input.file.creator ?? ''}`);
    const marca = MARCAS_DE_AGUA.find(m => texto.includes(m) || productor.includes(m));
    if (marca) out.push({ kind: 'marca-de-agua', detail: marca });
    const conversor = CONVERSORES.find(c => productor.includes(c));
    if (conversor || input.file.isEbook) out.push({ kind: 'conversion', detail: conversor ?? 'epub' });
    return out;
}

/** Qué hojas leer: las primeras (portada, créditos, índice) y tres del cuerpo, al 25, 50 y 75 %. */
export function reviewSheets(numPages: number, frontCount = 14): { front: number[]; samples: number[] } {
    const front = Array.from({ length: Math.min(frontCount, numPages) }, (_, i) => i + 1);
    const samples = [0.25, 0.5, 0.75]
        .map(f => Math.max(1, Math.round(numPages * f)))
        .filter((s, i, a) => s > front.length && a.indexOf(s) === i);
    return { front, samples };
}
