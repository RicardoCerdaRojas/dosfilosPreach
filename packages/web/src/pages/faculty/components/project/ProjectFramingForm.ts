import {
    formatPassageForReader,
    formatPassageReference,
    getBookById,
    getPreachingNotes,
    isStorableFramingPassage,
    parsePassageReference,
    passageToReader,
    readerPassageToOriginal,
    scopeFitsBooks,
    BIBLE_CANON,
    FRAMING_MAX_SUNDAYS,
    FRAMING_TEXT_MAX,
    type AIProject,
    type BibleBookId,
    type FramingFrequency,
    type FramingGenre,
    type FramingPurpose,
    type PassageReference,
    type PreachingNote,
    type ProjectFraming,
} from '@dosfilos/domain';
import { igualesCanonicos } from '@/utils/canonico';

/**
 * El formulario del encuadre, sin React: de lo guardado al formulario y del
 * formulario al cambio que se guarda (fase «Encuadre de la serie», §2 paso 1).
 *
 * Regla de numeración: los pasajes se guardan en la numeración del ORIGINAL y
 * se muestran y escriben en la del lector (`formatForReader.ts`). El pastor
 * escribe «1:17» pensando en su Biblia; se guarda lo que eso es en el original.
 */

/** Las preguntas guía de cada género: claves bajo `framing.genre.questions.<género>.`. */
export const GENRE_QUESTIONS: Readonly<Record<FramingGenre, ReadonlyArray<string>>> = {
    // Mathewson, *The Art of Preaching OT Narrative*; las tres últimas, para
    // libros como Esdras-Nehemías (documentos, listas, memorias en primera persona).
    'historical-narrative': ['conflict', 'turn', 'resolution', 'narrator', 'god', 'protagonist', 'sources'],
    law: ['covenant', 'character', 'fulfillment', 'principle'],
    poetry: ['parallelism', 'images', 'tone', 'shift'],
    wisdom: ['observation', 'promise', 'contrast', 'dialogue'],
    prophecy: ['situation', 'form', 'covenant', 'fulfillment'],
    gospel: ['jesus', 'response', 'placement', 'parallels'],
    epistle: ['occasion', 'argument', 'indicative', 'whole'],
    apocalyptic: ['symbols', 'comfort', 'sovereignty', 'restraint'],
};

export interface MovementRow {
    /** Solo para React: identifica la fila mientras se edita. */
    key: string;
    /** El tramo en la numeración del lector: «1-6», «4:6-23» o «Neh 1-7». */
    range: string;
    title: string;
}

export interface FramingForm {
    books: BibleBookId[];
    purpose: FramingPurpose;
    scopeMode: 'whole' | 'range';
    /** El tramo dentro del único libro, en la numeración del lector. */
    scopeRange: string;
    /** Por libro y capítulo del lector; conserva los de libros desmarcados hasta guardar (por si se vuelven a marcar). */
    chapterTitles: ChapterTitlesByBook;
    repetitions: string;
    genre: FramingGenre | '';
    genreReading: string;
    genreEvidence: string;
    occasion: string;
    occasionEvidence: string;
    structure: MovementRow[];
    centralIdea: string;
    centralIdeaEvidence: string;
    christTrajectory: string;
    christTrajectoryEvidence: string;
    audience: string;
    need: string;
    needEvidence: string;
    desiredChange: string;
    sundays: string;
    startDate: string;
    frequency: FramingFrequency | '';
}

export type ChapterTitlesByBook = Partial<Record<BibleBookId, Record<number, string>>>;

let filas = 0;
export const newMovementRow = (range = '', title = ''): MovementRow => ({ key: `m${++filas}`, range, title });

/** Los libros en el orden del canon, sin repetir. */
export function canonicalOrder(books: ReadonlyArray<BibleBookId>): BibleBookId[] {
    const orden = new Map(BIBLE_CANON.map(b => [b.id, b.canonicalOrder]));
    return [...new Set(books)].sort((a, b) => (orden.get(a) ?? 0) - (orden.get(b) ?? 0));
}

/** El libro de referencia para los capítulos y para un tramo escrito sin libro: el primero del canon. */
export function primaryBook(books: ReadonlyArray<BibleBookId>): BibleBookId | null {
    return canonicalOrder(books)[0] ?? null;
}

/** «4:6-23», «1-6», «9:1-10:44»: el tramo sin el nombre del libro, como lo escribe el lector. */
export function rangeText(p: PassageReference): string {
    if (p.verseStart === null || p.verseEnd === null) {
        return p.chapterEnd > p.chapterStart ? `${p.chapterStart}-${p.chapterEnd}` : `${p.chapterStart}`;
    }
    if (p.chapterStart === p.chapterEnd) {
        return p.verseStart === p.verseEnd ? `${p.chapterStart}:${p.verseStart}` : `${p.chapterStart}:${p.verseStart}-${p.verseEnd}`;
    }
    return `${p.chapterStart}:${p.verseStart}-${p.chapterEnd}:${p.verseEnd}`;
}

/** Un pasaje guardado (original), escrito para editarlo en la numeración del lector. */
function editableText(p: PassageReference, defaultBook: BibleBookId | null, lang: 'es' | 'en'): string {
    const lector = passageToReader(p).passage;
    return p.bookId === defaultBook ? rangeText(lector) : formatPassageReference(lector, lang);
}

/**
 * `unrecognized`: no se entiende o no existe en la Biblia del lector.
 * `needs-verses`: cruza un cambio de numeración y la tabla del lector no conoce su capítulo final (hoy, inalcanzable desde el formulario: el parseo ya rechaza capítulos inexistentes).
 * `not-storable`: la limpieza del dominio lo descartaría (no se guarda en silencio).
 */
export type RangeError = 'unrecognized' | 'needs-verses' | 'not-storable';
export type RangeResult = { ok: true; passage: PassageReference } | { ok: false; reason: RangeError } | { ok: true; passage: null };

/** Lo que el pastor escribió, en la numeración del LECTOR (validado contra su Biblia). */
function parseReaderText(text: string, defaultBook: BibleBookId | null): PassageReference | null | 'invalid' {
    const limpio = text.trim();
    if (!limpio) return null;
    const conLibro = parsePassageReference(limpio);
    const book = defaultBook ? getBookById(defaultBook) : null;
    const res = conLibro.ok ? conLibro : book ? parsePassageReference(`${book.nameEs} ${limpio}`) : conLibro;
    return res.ok ? res.ref : 'invalid';
}

/**
 * Lo que el pastor escribió (numeración del lector), en la del original.
 * Acepta el tramo solo («4:6-23», usa `defaultBook`) o con libro («Neh 1-7»).
 * Un capítulo entero que cruza la numeración («Joel 3») se expande a sus
 * versos antes de convertir (`readerPassageToOriginal`).
 * Vacío: `{ ok: true, passage: null }`.
 */
export function parseReaderRange(text: string, defaultBook: BibleBookId | null): RangeResult {
    const lector = parseReaderText(text, defaultBook);
    if (lector === null) return { ok: true, passage: null };
    if (lector === 'invalid') return { ok: false, reason: 'unrecognized' };
    const original = readerPassageToOriginal(lector);
    if (!original.ok) return { ok: false, reason: original.reason };
    if (!isStorableFramingPassage(original.passage)) return { ok: false, reason: 'not-storable' };
    return { ok: true, passage: original.passage };
}

/** Del proyecto guardado al formulario. */
export function formFromProject(project: Pick<AIProject, 'framing' | 'bibliographyCriteria'>, lang: 'es' | 'en' = 'es'): FramingForm {
    const f: ProjectFraming = project.framing ?? {};
    const books = canonicalOrder(project.bibliographyCriteria?.bibleBooks ?? []);
    const principal = primaryBook(books);
    const alcance = f.scope && scopeFitsBooks(f.scope, books) ? f.scope : null;
    return {
        books,
        purpose: f.purpose ?? 'preach',
        scopeMode: alcance ? 'range' : 'whole',
        scopeRange: alcance ? rangeText(passageToReader(alcance.passage).passage) : '',
        chapterTitles: storedChapterTitles(f.reading?.chapterTitles),
        repetitions: f.reading?.repetitions ?? '',
        genre: f.genre ?? '',
        genreReading: f.genreReading ?? '',
        genreEvidence: f.genreEvidence ?? '',
        occasion: f.occasion ?? '',
        occasionEvidence: f.occasionEvidence ?? '',
        structure: (f.structure ?? []).map(m => newMovementRow(editableText(m.passage, principal, lang), m.title)),
        centralIdea: f.centralIdea ?? '',
        centralIdeaEvidence: f.centralIdeaEvidence ?? '',
        christTrajectory: f.christTrajectory ?? '',
        christTrajectoryEvidence: f.christTrajectoryEvidence ?? '',
        audience: f.audience ?? '',
        need: f.need ?? '',
        needEvidence: f.needEvidence ?? '',
        desiredChange: f.desiredChange ?? '',
        sundays: f.rhythm?.sundays ? String(f.rhythm.sundays) : '',
        startDate: f.rhythm?.startDate ?? '',
        frequency: f.rhythm?.frequency ?? '',
    };
}

/**
 * Los títulos guardados, por libro, sin lo que no tiene esa forma. Un encuadre
 * viejo los guardaba sin libro (`{ 1: 'El decreto' }`): copiar eso con
 * `{ ...caps }` desarmaba el texto en letras. Solo pasan los ids de libro
 * válidos con un objeto de títulos, y de cada uno solo los textos.
 */
function storedChapterTitles(stored: unknown): ChapterTitlesByBook {
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
    const out: ChapterTitlesByBook = {};
    for (const [b, caps] of Object.entries(stored)) {
        if (!getBookById(b as BibleBookId) || !caps || typeof caps !== 'object' || Array.isArray(caps)) continue;
        const titulos: Record<number, string> = {};
        for (const [c, t] of Object.entries(caps as Record<string, unknown>)) if (typeof t === 'string') titulos[Number(c)] = t;
        out[b as BibleBookId] = titulos;
    }
    return out;
}

/** Si el alcance desde–hasta se puede elegir: solo con un libro. */
export const scopeAllowed = (form: Pick<FramingForm, 'books'>) => new Set(form.books).size === 1;

/** El alcance que vale, en la numeración del original, o `null` (libro completo). */
function scopePassage(form: FramingForm): RangeResult {
    if (!scopeAllowed(form) || form.scopeMode !== 'range') return { ok: true, passage: null };
    const r = parseReaderRange(form.scopeRange, form.books[0]!);
    if (r.ok && r.passage && r.passage.bookId !== form.books[0]) return { ok: false, reason: 'unrecognized' };
    return r;
}

export interface ChaptersOfBook {
    book: BibleBookId;
    chapters: number[];
}

/**
 * Los capítulos que piden título, por libro: con un libro y un tramo, los
 * del tramo; si no, todos los de cada libro marcado (Esdras y Nehemías: 23).
 * En la numeración del lector, que es la que el pastor tiene abierta.
 */
export function chaptersToTitle(form: FramingForm): ChaptersOfBook[] {
    const libros = canonicalOrder(form.books);
    const alcance = scopePassage(form);
    if (libros.length === 1 && alcance.ok && alcance.passage) {
        // El tramo escrito por el pastor ya está en la numeración del lector.
        const lector = parseReaderText(form.scopeRange, libros[0]!);
        const p = lector && lector !== 'invalid' ? lector : passageToReader(alcance.passage).passage;
        return [{ book: libros[0]!, chapters: rango(p.chapterStart, p.chapterEnd) }];
    }
    return libros.map(book => ({ book, chapters: rango(1, getBookById(book)?.chapterCount ?? 0) }));
}

const rango = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

/** Con más de esto en total, se muestran los primeros `CHAPTERS_PREVIEW` y «Mostrar todos». */
export const CHAPTERS_COLLAPSE_OVER = 30;
export const CHAPTERS_PREVIEW = 12;

/** Los títulos escritos para un libro (sin los vacíos). */
const titulosDe = (form: Pick<FramingForm, 'chapterTitles'>, b: BibleBookId) =>
    Object.entries(form.chapterTitles[b] ?? {}).filter(([, t]) => t.trim());

/** Los libros desmarcados que tienen títulos escritos: al guardar se pierden, y el diálogo lo avisa. */
export function droppedTitleBooks(form: Pick<FramingForm, 'books' | 'chapterTitles'>): BibleBookId[] {
    return canonicalOrder((Object.keys(form.chapterTitles) as BibleBookId[]).filter(b => !form.books.includes(b) && titulosDe(form, b).length > 0));
}

export type FramingFormError = 'noBooks' | 'scope' | 'scopeVerses' | 'movementRange' | 'movementVerses' | 'sundays';

export interface FramingSave {
    framingPatch: Partial<Record<keyof ProjectFraming, unknown>>;
    bibleBooks: BibleBookId[];
}

/**
 * Lo que impide guardar. Ningún campo es obligatorio salvo un libro; un
 * tramo mal escrito sí detiene, y también uno que la limpieza descartaría:
 * nada se pierde en silencio al guardar.
 */
export function formErrors(form: FramingForm): FramingFormError[] {
    const errores: FramingFormError[] = [];
    if (form.books.length === 0) errores.push('noBooks');
    const alcance = scopePassage(form);
    if (!alcance.ok) errores.push(alcance.reason === 'needs-verses' ? 'scopeVerses' : 'scope');
    for (const m of movementErrors(form)) errores.push(m.error);
    if (form.purpose !== 'personal' && form.sundays.trim() && sundaysValue(form.sundays) === null) errores.push('sundays');
    return [...new Set(errores)];
}

export type MovementError = Extract<FramingFormError, 'movementRange' | 'movementVerses'>;

/**
 * Las filas de movimientos que impiden guardar, con su índice en
 * `form.structure`: el diálogo marca solo esas (`aria-invalid`), no todas las
 * escritas. Una fila vacía no cuenta; una con título y sin tramo, sí.
 */
export function movementErrors(form: Pick<FramingForm, 'books' | 'structure'>): Array<{ index: number; error: MovementError }> {
    const principal = primaryBook(form.books);
    return form.structure.flatMap((m, index) => {
        if (!m.range.trim() && !m.title.trim()) return [];
        const r = parseReaderRange(m.range, principal);
        if (r.ok && r.passage) return [];
        return [{ index, error: !r.ok && r.reason === 'needs-verses' ? 'movementVerses' as const : 'movementRange' as const }];
    });
}

/** Los domingos escritos, si son un entero de 1 al tope; si no, `null`. */
function sundaysValue(s: string): number | null {
    const t = s.trim();
    if (!/^\d+$/.test(t)) return null;
    const n = Number(t);
    return n >= 1 && n <= FRAMING_MAX_SUNDAYS ? n : null;
}

/** Si el formulario cambió frente al de partida: las claves de React de las filas no cuentan. */
export function formChanged(initial: FramingForm, current: FramingForm): boolean {
    const sinClaves = (f: FramingForm) => ({ ...f, structure: f.structure.map(({ range, title }) => ({ range, title })) });
    return !igualesCanonicos(sinClaves(initial), sinClaves(current));
}

const texto = (s: string) => s.trim() || null;

/**
 * El cambio que guarda el formulario: UNA llamada con `framingPatch` y
 * `bibleBooks`. Solo los campos del formulario: nunca el registro de la
 * hipótesis ni la revisión, que tienen su propio camino. Lo vacío viaja
 * como `null` (el pastor lo vació: se borra).
 */
export function saveFromForm(form: FramingForm): FramingSave {
    const principal = primaryBook(form.books);
    const alcance = scopePassage(form);
    // Por libro marcado, todos sus títulos: también los de capítulos fuera del
    // tramo (cambiar el tramo no borra lo escrito). Solo se descartan los de
    // libros desmarcados, y el diálogo lo avisa antes.
    const titulos = Object.fromEntries(form.books.flatMap(b => {
        const caps = titulosDe(form, b);
        return caps.length ? [[b, Object.fromEntries(caps.map(([c, t]) => [c, t.trim()]))]] : [];
    }));
    const reading = Object.keys(titulos).length || form.repetitions.trim()
        ? { ...(Object.keys(titulos).length ? { chapterTitles: titulos } : {}), ...(form.repetitions.trim() ? { repetitions: form.repetitions.trim() } : {}) }
        : null;
    const structure = form.structure.flatMap(m => {
        const r = parseReaderRange(m.range, principal);
        return r.ok && r.passage ? [{ passage: r.passage, title: m.title.trim() }] : [];
    });
    const personal = form.purpose === 'personal';
    const n = sundaysValue(form.sundays);
    const rhythm = !personal && (n || form.startDate || form.frequency)
        ? { ...(n ? { sundays: n } : {}), ...(form.startDate ? { startDate: form.startDate } : {}), ...(form.frequency ? { frequency: form.frequency } : {}) }
        : null;
    const pastoral = (s: string) => (personal ? null : texto(s));
    return {
        bibleBooks: [...form.books],
        framingPatch: {
            purpose: form.purpose,
            scope: alcance.ok && alcance.passage ? { bookId: alcance.passage.bookId, passage: alcance.passage } : null,
            reading,
            genre: form.genre || null,
            genreReading: texto(form.genreReading),
            genreEvidence: texto(form.genreEvidence),
            occasion: texto(form.occasion),
            occasionEvidence: texto(form.occasionEvidence),
            structure: structure.length ? structure : null,
            centralIdea: texto(form.centralIdea),
            centralIdeaEvidence: texto(form.centralIdeaEvidence),
            christTrajectory: texto(form.christTrajectory),
            christTrajectoryEvidence: texto(form.christTrajectoryEvidence),
            audience: pastoral(form.audience),
            need: pastoral(form.need),
            needEvidence: pastoral(form.needEvidence),
            desiredChange: pastoral(form.desiredChange),
            rhythm,
        },
    };
}

// ── La nota de antes ───────────────────────────────────────────────────

/**
 * «Pasar tu nota al encuadre»: la nota de antes (la de contexto o una nota
 * del material) se copia TAL CUAL en la idea central, si está vacía; el
 * pastor la corrige y confirma al guardar. Nunca pisa lo que ya escribió:
 * con la idea escrita, la nota solo se muestra para que copie lo que sirva.
 */
export function formWithNote(form: FramingForm, note: string | null | undefined): { form: FramingForm; placed: boolean; truncated: boolean } {
    const texto = note?.trim() ?? '';
    if (!texto || form.centralIdea.trim()) return { form, placed: false, truncated: false };
    return { form: { ...form, centralIdea: texto.slice(0, FRAMING_TEXT_MAX) }, placed: true, truncated: texto.length > FRAMING_TEXT_MAX };
}

// ── Estudios ───────────────────────────────────────────────────────────

export interface FramingStudy {
    id: string;
    title?: string | null;
    passage: PassageReference;
}

/** El nombre de un estudio para el pastor: su título o su pasaje en la numeración del lector. */
export function studyLabel(s: FramingStudy, lang: 'es' | 'en'): string {
    return s.title?.trim() || formatPassageForReader(s.passage, lang);
}

// ── Notas «Para predicar…» ─────────────────────────────────────────────

/** Las notas de los libros elegidos, sin repetir (Esdras y Nehemías comparten las suyas). */
export function notesForBooks(books: ReadonlyArray<BibleBookId>): PreachingNote[] {
    const vistas = new Set<string>();
    const out: PreachingNote[] = [];
    for (const b of canonicalOrder(books)) {
        for (const n of getPreachingNotes(b)) {
            if (vistas.has(n.id)) continue;
            vistas.add(n.id);
            out.push(n);
        }
    }
    return out;
}

const punto = (c: number, v: number | null, fin: boolean) => c * 1000 + (v ?? (fin ? 999 : 0));

/** Si dos pasajes (ambos en la numeración del original) se tocan. */
export function passagesOverlap(a: PassageReference, b: PassageReference): boolean {
    if (a.bookId !== b.bookId) return false;
    return punto(a.chapterStart, a.verseStart, false) <= punto(b.chapterEnd, b.verseEnd, true)
        && punto(b.chapterStart, b.verseStart, false) <= punto(a.chapterEnd, a.verseEnd, true);
}

/**
 * Las notas que toca el alcance, para resaltarlas. Con el libro completo no
 * se resalta ninguna: todas lo tocan y resaltar todo no orienta.
 */
export function highlightedNoteIds(notes: ReadonlyArray<PreachingNote>, scope: PassageReference | null): Set<string> {
    if (!scope) return new Set();
    return new Set(notes.filter(n => n.passage && passagesOverlap(n.passage, scope)).map(n => n.id));
}

/** El alcance que el formulario tiene escrito ahora, si es válido. */
export function formScope(form: FramingForm): PassageReference | null {
    const r = scopePassage(form);
    return r.ok ? r.passage : null;
}

/** El pasaje del proyecto para mostrar: el alcance en la numeración del lector, o los libros. */
export function framingPassageLabel(project: Pick<AIProject, 'framing' | 'bibliographyCriteria'>, lang: 'es' | 'en'): string | null {
    const books = canonicalOrder(project.bibliographyCriteria?.bibleBooks ?? []);
    const alcance = project.framing?.scope;
    if (alcance && scopeFitsBooks(alcance, books)) return formatPassageForReader(alcance.passage, lang);
    if (!books.length) return null;
    return books.map(b => (lang === 'en' ? getBookById(b)?.nameEn : getBookById(b)?.nameEs) ?? b).join(lang === 'en' ? ' and ' : ' y ');
}
