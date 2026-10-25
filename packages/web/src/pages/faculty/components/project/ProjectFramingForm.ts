import {
    formatPassageForReader,
    formatPassageReference,
    getBookById,
    getPreachingNotes,
    parsePassageReference,
    passageToOriginal,
    passageToReader,
    scopeFitsBooks,
    BIBLE_CANON,
    type AIProject,
    type BibleBookId,
    type FramingFrequency,
    type FramingGenre,
    type FramingPurpose,
    type PassageReference,
    type PreachingNote,
    type ProjectFraming,
} from '@dosfilos/domain';

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
    // Mathewson, *The Art of Preaching OT Narrative*.
    'historical-narrative': ['conflict', 'turn', 'resolution', 'narrator'],
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
    /** Desde–hasta en la numeración del lector: «1-6», «4:6-23» o «Neh 1-7». */
    range: string;
    title: string;
}

export interface FramingForm {
    books: BibleBookId[];
    purpose: FramingPurpose;
    scopeMode: 'whole' | 'range';
    /** Desde–hasta dentro del único libro, en la numeración del lector. */
    scopeRange: string;
    chapterTitles: Record<number, string>;
    repetitions: string;
    genre: FramingGenre | '';
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

export type RangeResult = { ok: true; passage: PassageReference } | { ok: false } | { ok: true; passage: null };

/**
 * Lo que el pastor escribió (numeración del lector), en la del original.
 * Acepta el tramo solo («4:6-23», usa `defaultBook`) o con libro («Neh 1-7»).
 * Vacío: `{ ok: true, passage: null }`.
 */
export function parseReaderRange(text: string, defaultBook: BibleBookId | null): RangeResult {
    const limpio = text.trim();
    if (!limpio) return { ok: true, passage: null };
    const conLibro = parsePassageReference(limpio);
    const book = defaultBook ? getBookById(defaultBook) : null;
    const res = conLibro.ok ? conLibro : book ? parsePassageReference(`${book.nameEs} ${limpio}`) : conLibro;
    if (!res.ok) return { ok: false };
    return { ok: true, passage: passageToOriginal(res.ref).passage };
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
        chapterTitles: { ...(f.reading?.chapterTitles ?? {}) },
        repetitions: f.reading?.repetitions ?? '',
        genre: f.genre ?? '',
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

/** Si el alcance desde–hasta se puede elegir: solo con un libro. */
export const scopeAllowed = (form: Pick<FramingForm, 'books'>) => new Set(form.books).size === 1;

/** El alcance que vale, en la numeración del original, o `null` (libro completo). */
function scopePassage(form: FramingForm): RangeResult {
    if (!scopeAllowed(form) || form.scopeMode !== 'range') return { ok: true, passage: null };
    const r = parseReaderRange(form.scopeRange, form.books[0]!);
    if (r.ok && r.passage && r.passage.bookId !== form.books[0]) return { ok: false };
    return r;
}

/**
 * Los capítulos que piden título: los del alcance, si hay; si no, los del
 * primer libro. En la numeración del lector, que es la que el pastor tiene
 * abierta.
 */
export function chaptersToTitle(form: FramingForm): { book: BibleBookId; chapters: number[] } | null {
    const principal = primaryBook(form.books);
    if (!principal) return null;
    const alcance = scopePassage(form);
    if (alcance.ok && alcance.passage) {
        const lector = passageToReader(alcance.passage).passage;
        return { book: principal, chapters: rango(lector.chapterStart, lector.chapterEnd) };
    }
    return { book: principal, chapters: rango(1, getBookById(principal)?.chapterCount ?? 0) };
}

const rango = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

export type FramingFormError = 'noBooks' | 'scope' | 'movementRange' | 'sundays';

export interface FramingSave {
    framingPatch: Partial<Record<keyof ProjectFraming, unknown>>;
    bibleBooks: BibleBookId[];
}

/** Lo que impide guardar. Ningún campo es obligatorio salvo un libro; un tramo mal escrito sí detiene. */
export function formErrors(form: FramingForm): FramingFormError[] {
    const errores: FramingFormError[] = [];
    if (form.books.length === 0) errores.push('noBooks');
    if (!scopePassage(form).ok) errores.push('scope');
    const principal = primaryBook(form.books);
    if (form.structure.some(m => (m.range.trim() || m.title.trim()) && !parseReaderRange(m.range, principal).ok)) errores.push('movementRange');
    if (form.structure.some(m => m.title.trim() && !m.range.trim())) errores.push('movementRange');
    if (form.purpose !== 'personal' && form.sundays.trim() && !/^\d+$/.test(form.sundays.trim())) errores.push('sundays');
    return [...new Set(errores)];
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
    const capitulos = new Set(chaptersToTitle(form)?.chapters ?? []);
    // Solo los títulos de los capítulos que se ven: lo que se guarda es lo que el pastor ve.
    const titulos = Object.fromEntries(
        Object.entries(form.chapterTitles).filter(([c, t]) => capitulos.has(Number(c)) && t.trim()).map(([c, t]) => [c, t.trim()]),
    );
    const reading = Object.keys(titulos).length || form.repetitions.trim()
        ? { ...(Object.keys(titulos).length ? { chapterTitles: titulos } : {}), ...(form.repetitions.trim() ? { repetitions: form.repetitions.trim() } : {}) }
        : null;
    const structure = form.structure.flatMap(m => {
        const r = parseReaderRange(m.range, principal);
        return r.ok && r.passage ? [{ passage: r.passage, title: m.title.trim() }] : [];
    });
    const personal = form.purpose === 'personal';
    const n = /^\d+$/.test(form.sundays.trim()) ? Number(form.sundays.trim()) : null;
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
