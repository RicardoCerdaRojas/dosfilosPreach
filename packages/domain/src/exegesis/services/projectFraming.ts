import { findBooksByAlias, getBookById, type BibleBookId } from '../../bible/canon/BibleCanon';
import { buildPassageReference, type PassageReference } from '../../bible/canon/passage-reference';
import { formatPassageForReader } from '../../bible/versification/formatForReader';
import type { AIProject } from '../../entities/AIProject';
import type { PlannedSermon } from '../../entities/SermonSeries';

/**
 * El encuadre del proyecto: la fase 1 del Exegético
 * (`docs/FASE_ENCUADRE_SERIE_2026-10.md`, §3).
 *
 * Lo escribe el pastor ANTES de ver el panorama, y se contrasta después con
 * el texto (Osborne, *The Hermeneutical Spiral*). Por eso la hipótesis no
 * entra a ningún prompt mientras sea provisoria: solo la idea revisada y
 * vigente (`currentRevisedIdea`) llega al sermón, y solo para el arco.
 *
 * No guarda libros: la única fuente es `bibliographyCriteria.bibleBooks`.
 * Las fechas van como texto ISO, no `Date`: el repositorio solo convierte
 * los Timestamp del primer nivel, y uno anidado volvería como objeto.
 */

export type FramingPurpose = 'preach' | 'teach' | 'personal';
export const FRAMING_PURPOSES: ReadonlyArray<FramingPurpose> = ['preach', 'teach', 'personal'];

export type FramingGenre =
    | 'historical-narrative' | 'law' | 'poetry' | 'wisdom'
    | 'prophecy' | 'gospel' | 'epistle' | 'apocalyptic';
export const FRAMING_GENRES: ReadonlyArray<FramingGenre> = [
    'historical-narrative', 'law', 'poetry', 'wisdom', 'prophecy', 'gospel', 'epistle', 'apocalyptic',
];

export type FramingFrequency = 'weekly' | 'biweekly' | 'monthly' | 'flexible';
export const FRAMING_FREQUENCIES: ReadonlyArray<FramingFrequency> = ['weekly', 'biweekly', 'monthly', 'flexible'];

export type HypothesisVerdict = 'confirms' | 'nuances' | 'contradicts';
export const HYPOTHESIS_VERDICTS: ReadonlyArray<HypothesisVerdict> = ['confirms', 'nuances', 'contradicts'];

export type RevisionVerdict = 'confirmed' | 'nuanced' | 'corrected';
export const REVISION_VERDICTS: ReadonlyArray<RevisionVerdict> = ['confirmed', 'nuanced', 'corrected'];

/** El alcance, en la numeración del ORIGINAL. Ausente: el libro entero. */
export interface FramingScope {
    bookId: BibleBookId;
    passage: PassageReference;
}

/** El «survey» del libro (Traina; Jensen): un título por capítulo y lo que se repite. */
export interface FramingReading {
    chapterTitles?: Record<number, string>;
    repetitions?: string;
}

/** Un movimiento del libro según el pastor: desde–hasta y un título. */
export interface FramingMovement {
    passage: PassageReference;
    title: string;
}

/** El calendario: da fechas y un aviso, nunca una meta para el planificador. */
export interface FramingRhythm {
    sundays?: number;
    /** `YYYY-MM-DD`, fecha local. */
    startDate?: string;
    frequency?: FramingFrequency;
}

/** Una anotación del registro de la hipótesis: tras el panorama o tras un estudio. */
export interface HypothesisEntry {
    id: string;
    /** ISO. */
    at: string;
    source: 'panorama' | 'study';
    studyId?: string;
    verdict: HypothesisVerdict;
    note: string;
}

/**
 * La idea consolidada. `ofIdea` guarda la idea original que se revisó: si
 * después se edita la original, la revisión queda desactualizada.
 */
export interface FramingRevision {
    centralIdea: string;
    verdict: RevisionVerdict;
    why: string;
    ofIdea: string;
    /** ISO. */
    revisedAt: string;
}

export interface ProjectFraming {
    /** Ausente cuenta como «predicar»: un registro puede guardarse antes que el formulario. */
    purpose?: FramingPurpose;
    scope?: FramingScope | null;
    reading?: FramingReading;
    genre?: FramingGenre;
    occasion?: string;
    occasionEvidence?: string;
    structure?: FramingMovement[];
    centralIdea?: string;
    centralIdeaEvidence?: string;
    christTrajectory?: string;
    christTrajectoryEvidence?: string;
    audience?: string;
    need?: string;
    needEvidence?: string;
    desiredChange?: string;
    rhythm?: FramingRhythm;
    hypothesisLog?: HypothesisEntry[];
    revision?: FramingRevision;
    /** ISO. Lo escribe el repositorio con cada cambio. */
    updatedAt?: string;
}

/** Los campos que se escriben por ruta con punto (`framing.<campo>`). */
export type FramingPatchKey = Exclude<keyof ProjectFraming, 'updatedAt'>;

/** Un cambio por campo, ya limpio: `null` borra el campo. */
export type ProjectFramingPatch = { [K in FramingPatchKey]?: NonNullable<ProjectFraming[K]> | null };

// ── Topes ──────────────────────────────────────────────────────────────

export const FRAMING_TEXT_MAX = 2000;
export const FRAMING_TITLE_MAX = 300;
export const FRAMING_MAX_MOVEMENTS = 20;
export const FRAMING_MAX_LOG_ENTRIES = 200;
export const FRAMING_MAX_SUNDAYS = 200;
const MAX_CHAPTER = 150;
const MAX_ID = 100;

/** Lo que pierde «estudio personal»: no hay congregación ni calendario. La trayectoria se queda. */
const PASTORAL_KEYS = ['audience', 'need', 'needEvidence', 'desiredChange', 'rhythm'] as const satisfies ReadonlyArray<FramingPatchKey>;

const PATCH_KEYS: ReadonlyArray<FramingPatchKey> = [
    'purpose', 'scope', 'reading', 'genre', 'occasion', 'occasionEvidence', 'structure',
    'centralIdea', 'centralIdeaEvidence', 'christTrajectory', 'christTrajectoryEvidence',
    'audience', 'need', 'needEvidence', 'desiredChange', 'rhythm', 'hypothesisLog', 'revision',
];

const TEXT_KEYS = new Set<FramingPatchKey>([
    'occasion', 'occasionEvidence', 'centralIdea', 'centralIdeaEvidence', 'christTrajectory',
    'christTrajectoryEvidence', 'audience', 'need', 'needEvidence', 'desiredChange',
]);

export interface FramingCleanOptions {
    /** Los libros del proyecto: el alcance solo vale con exactamente uno, y ese. */
    bibleBooks: ReadonlyArray<BibleBookId>;
}

// ── Limpieza ───────────────────────────────────────────────────────────

/**
 * El encuadre listo para Firestore: sin `undefined` en ningún nivel (el
 * cliente se inicia sin `ignoreUndefinedProperties`, `config/firebase.ts`),
 * sin claves ajenas, sin texto vacío y con topes. Se arma campo a campo, así
 * que nada que no esté en la lista blanca llega a guardarse.
 */
export function cleanProjectFraming(input: unknown, opts: FramingCleanOptions): ProjectFraming {
    const src = asRecord(input) ?? {};
    const out: Record<string, unknown> = {};
    for (const key of PATCH_KEYS) {
        const v = cleanFramingField(key, src[key], opts);
        if (v !== undefined) out[key] = v;
    }
    if (out.purpose === 'personal') for (const k of PASTORAL_KEYS) delete out[k];
    const updatedAt = isoOrUndefined(src.updatedAt);
    if (updatedAt) out.updatedAt = updatedAt;
    return out as ProjectFraming;
}

/**
 * Un cambio por campo, limpio. Solo toca las claves presentes; lo que queda
 * vacío tras limpiar pasa a `null` (borrar), no a «no tocar»: el pastor vació
 * el campo. Con «estudio personal» —en el cambio o, si no viene, el guardado
 * (`savedPurpose`)— los campos pastorales se borran.
 */
export function cleanFramingPatch(
    patch: Partial<Record<keyof ProjectFraming, unknown>>,
    opts: FramingCleanOptions & { savedPurpose?: FramingPurpose | null },
): ProjectFramingPatch {
    const out: Record<string, unknown> = {};
    for (const key of PATCH_KEYS) {
        if (!(key in patch) || patch[key] === undefined) continue;
        out[key] = cleanFramingField(key, patch[key], opts) ?? null;
    }
    const purpose = 'purpose' in out ? out.purpose : opts.savedPurpose;
    if (purpose === 'personal') {
        if ('purpose' in out) for (const k of PASTORAL_KEYS) out[k] = null;
        else for (const k of PASTORAL_KEYS) if (k in out) out[k] = null;
    }
    return out as ProjectFramingPatch;
}

function cleanFramingField(key: FramingPatchKey, v: unknown, opts: FramingCleanOptions): unknown {
    if (v === null || v === undefined) return undefined;
    if (TEXT_KEYS.has(key)) return text(v, FRAMING_TEXT_MAX);
    switch (key) {
        case 'purpose': return oneOf(v, FRAMING_PURPOSES);
        case 'genre': return oneOf(v, FRAMING_GENRES);
        case 'scope': return cleanScope(v, opts.bibleBooks);
        case 'reading': return cleanReading(v);
        case 'structure': return cleanStructure(v);
        case 'rhythm': return cleanRhythm(v);
        case 'hypothesisLog': return cleanHypothesisLog(v);
        case 'revision': return cleanRevision(v);
        default: return undefined;
    }
}

/** Si el alcance sigue valiendo para estos libros: exactamente uno, y el suyo. */
export function scopeFitsBooks(scope: Pick<FramingScope, 'bookId'> | null | undefined, bibleBooks: ReadonlyArray<BibleBookId>): boolean {
    const libros = [...new Set(bibleBooks)];
    return !!scope && libros.length === 1 && libros[0] === scope.bookId;
}

function cleanScope(v: unknown, bibleBooks: ReadonlyArray<BibleBookId>): FramingScope | undefined {
    const r = asRecord(v);
    if (!r || typeof r.bookId !== 'string') return undefined;
    const bookId = r.bookId as BibleBookId;
    if (!scopeFitsBooks({ bookId }, bibleBooks)) return undefined;
    const passage = cleanPassage(r.passage);
    if (!passage || passage.bookId !== bookId) return undefined;
    return { bookId, passage };
}

function cleanPassage(v: unknown): PassageReference | undefined {
    const r = asRecord(v);
    if (!r || typeof r.bookId !== 'string' || !getBookById(r.bookId as BibleBookId)) return undefined;
    const res = buildPassageReference({
        bookId: r.bookId as BibleBookId,
        chapterStart: r.chapterStart as number,
        chapterEnd: r.chapterEnd as number,
        verseStart: (r.verseStart ?? null) as number | null,
        verseEnd: (r.verseEnd ?? null) as number | null,
    });
    return res.ok ? res.ref : undefined;
}

function cleanReading(v: unknown): FramingReading | undefined {
    const r = asRecord(v);
    if (!r) return undefined;
    const out: FramingReading = {};
    const titles = asRecord(r.chapterTitles);
    if (titles) {
        const limpios: Record<number, string> = {};
        for (const [k, t] of Object.entries(titles)) {
            const cap = /^\d+$/.test(k) ? Number(k) : NaN;
            const tt = text(t, FRAMING_TITLE_MAX);
            if (cap >= 1 && cap <= MAX_CHAPTER && tt) limpios[cap] = tt;
        }
        if (Object.keys(limpios).length) out.chapterTitles = limpios;
    }
    const rep = text(r.repetitions, FRAMING_TEXT_MAX);
    if (rep) out.repetitions = rep;
    return Object.keys(out).length ? out : undefined;
}

function cleanStructure(v: unknown): FramingMovement[] | undefined {
    if (!Array.isArray(v)) return undefined;
    const out: FramingMovement[] = [];
    for (const m of v) {
        const r = asRecord(m);
        const passage = r ? cleanPassage(r.passage) : undefined;
        if (!passage) continue;
        // El título puede faltar mientras se escribe; el tramo, no.
        out.push({ passage, title: text(r!.title, FRAMING_TITLE_MAX) ?? '' });
        if (out.length >= FRAMING_MAX_MOVEMENTS) break;
    }
    return out.length ? out : undefined;
}

function cleanRhythm(v: unknown): FramingRhythm | undefined {
    const r = asRecord(v);
    if (!r) return undefined;
    const out: FramingRhythm = {};
    const n = typeof r.sundays === 'string' && /^\d+$/.test(r.sundays.trim()) ? Number(r.sundays.trim()) : r.sundays;
    if (typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= FRAMING_MAX_SUNDAYS) out.sundays = n;
    if (isLocalDate(r.startDate)) out.startDate = r.startDate;
    const f = oneOf(r.frequency, FRAMING_FREQUENCIES);
    if (f) out.frequency = f;
    return Object.keys(out).length ? out : undefined;
}

function cleanHypothesisLog(v: unknown): HypothesisEntry[] | undefined {
    if (!Array.isArray(v)) return undefined;
    const vistos = new Set<string>();
    const out: HypothesisEntry[] = [];
    for (const e of v) {
        const c = cleanHypothesisEntry(e);
        if (!c || vistos.has(c.id)) continue;
        vistos.add(c.id);
        out.push(c);
    }
    // Con el tope se pierden las más viejas: la consolidación lee las recientes.
    return out.length ? out.slice(-FRAMING_MAX_LOG_ENTRIES) : undefined;
}

function cleanHypothesisEntry(v: unknown): HypothesisEntry | undefined {
    const r = asRecord(v);
    if (!r) return undefined;
    const id = text(r.id, MAX_ID);
    const at = isoOrUndefined(r.at);
    const source = oneOf(r.source, ['panorama', 'study'] as const);
    const verdict = oneOf(r.verdict, HYPOTHESIS_VERDICTS);
    if (!id || !at || !source || !verdict) return undefined;
    const studyId = text(r.studyId, MAX_ID);
    return { id, at, source, ...(studyId ? { studyId } : {}), verdict, note: text(r.note, FRAMING_TEXT_MAX) ?? '' };
}

function cleanRevision(v: unknown): FramingRevision | undefined {
    const r = asRecord(v);
    if (!r) return undefined;
    const centralIdea = text(r.centralIdea, FRAMING_TEXT_MAX);
    const verdict = oneOf(r.verdict, REVISION_VERDICTS);
    const revisedAt = isoOrUndefined(r.revisedAt);
    if (!centralIdea || !verdict || !revisedAt) return undefined;
    return {
        centralIdea,
        verdict,
        why: text(r.why, FRAMING_TEXT_MAX) ?? '',
        ofIdea: text(r.ofIdea, FRAMING_TEXT_MAX) ?? '',
        revisedAt,
    };
}

// ── Estado ─────────────────────────────────────────────────────────────

/** Los campos del formulario, en su orden. Lo que falta se muestra, no bloquea. */
export type FramingField =
    | 'bibleBooks' | 'purpose' | 'chapterTitles' | 'repetitions' | 'genre'
    | 'occasion' | 'occasionEvidence' | 'structure' | 'centralIdea' | 'centralIdeaEvidence'
    | 'christTrajectory' | 'christTrajectoryEvidence'
    | 'audience' | 'need' | 'needEvidence' | 'desiredChange' | 'rhythm';

export const FRAMING_FIELDS: ReadonlyArray<FramingField> = [
    'bibleBooks', 'purpose', 'chapterTitles', 'repetitions', 'genre',
    'occasion', 'occasionEvidence', 'structure', 'centralIdea', 'centralIdeaEvidence',
    'christTrajectory', 'christTrajectoryEvidence',
    'audience', 'need', 'needEvidence', 'desiredChange', 'rhythm',
];

const PASTORAL_FIELDS = new Set<FramingField>(['audience', 'need', 'needEvidence', 'desiredChange', 'rhythm']);

export type FramingStatus = 'missing' | 'partial' | 'complete';

export interface FramingStatusResult {
    status: FramingStatus;
    /** Los campos vacíos, en el orden del formulario. Sin los pastorales en «estudio personal». */
    missing: FramingField[];
}

/**
 * Completo con un libro y la idea central: lo mínimo para que el resto del
 * recorrido tenga de qué partir. No hay puntaje: `missing` invita, no exige.
 */
export function framingStatus(project: Pick<AIProject, 'framing' | 'bibliographyCriteria'> | null | undefined): FramingStatusResult {
    const f = project?.framing ?? null;
    const books = project?.bibliographyCriteria?.bibleBooks ?? [];
    const personal = f?.purpose === 'personal';
    const missing: FramingField[] = [];
    for (const field of FRAMING_FIELDS) {
        if (personal && PASTORAL_FIELDS.has(field)) continue;
        if (!fieldFilled(field, f, books)) missing.push(field);
    }
    const filled = FRAMING_FIELDS.some(field => fieldFilled(field, f, books));
    const status: FramingStatus = books.length > 0 && hasText(f?.centralIdea) ? 'complete' : filled ? 'partial' : 'missing';
    return { status, missing };
}

function fieldFilled(field: FramingField, f: ProjectFraming | null, books: ReadonlyArray<BibleBookId>): boolean {
    switch (field) {
        case 'bibleBooks': return books.length > 0;
        case 'purpose': return !!f?.purpose;
        case 'chapterTitles': return Object.values(f?.reading?.chapterTitles ?? {}).some(hasText);
        case 'repetitions': return hasText(f?.reading?.repetitions);
        case 'genre': return !!f?.genre;
        case 'structure': return (f?.structure?.length ?? 0) > 0;
        case 'rhythm': return !!(f?.rhythm?.sundays || f?.rhythm?.startDate || f?.rhythm?.frequency);
        default: return hasText(f?.[field]);
    }
}

// ── Revisión de la idea ────────────────────────────────────────────────

/** Desactualizada: hay revisión pero la idea original ya no es la que se revisó. */
export function isRevisionStale(framing: Pick<ProjectFraming, 'centralIdea' | 'revision'> | null | undefined): boolean {
    const rev = framing?.revision;
    if (!rev) return false;
    const idea = (framing?.centralIdea ?? '').trim();
    return !idea || idea !== (rev.ofIdea ?? '').trim();
}

/**
 * La idea revisada que puede llegar al sermón, o `null`. Desactualizada no
 * llega: el pastor cambió su lectura y todavía no la consolidó de nuevo.
 */
export function currentRevisedIdea(framing: Pick<ProjectFraming, 'centralIdea' | 'revision'> | null | undefined): string | null {
    if (!framing?.revision || isRevisionStale(framing)) return null;
    return framing.revision.centralIdea?.trim() || null;
}

export type NewHypothesisEntry = Pick<HypothesisEntry, 'source' | 'verdict' | 'note'> & { studyId?: string | null };

/**
 * El cambio que agrega una anotación al registro. Firestore no tiene «append»
 * para un arreglo de objetos sin duplicar por valor, así que se reescribe
 * `framing.hypothesisLog` entero partiendo del GUARDADO: el caso de uso lo
 * lee justo antes. Hay un solo autor por proyecto, así que la carrera entre
 * leer y escribir es aceptable.
 */
export function appendHypothesisEntry(
    framing: Pick<ProjectFraming, 'hypothesisLog'> | null | undefined,
    entry: NewHypothesisEntry,
    now: Date = new Date(),
): Pick<ProjectFramingPatch, 'hypothesisLog'> {
    const nueva = {
        id: `hl_${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        at: now.toISOString(),
        source: entry.source,
        ...(entry.studyId ? { studyId: entry.studyId } : {}),
        verdict: entry.verdict,
        note: entry.note,
    };
    return { hypothesisLog: cleanHypothesisLog([...(framing?.hypothesisLog ?? []), nueva]) ?? null };
}

/**
 * El cambio que consolida la idea. `ofIdea` es la idea original vigente: si
 * después se edita, `isRevisionStale` la marca y deja de llegar al sermón.
 */
export function consolidateIdea(
    framing: Pick<ProjectFraming, 'centralIdea'> | null | undefined,
    input: Pick<FramingRevision, 'centralIdea' | 'verdict' | 'why'>,
    now: Date = new Date(),
): Pick<ProjectFramingPatch, 'revision'> {
    return {
        revision: cleanRevision({
            centralIdea: input.centralIdea,
            verdict: input.verdict,
            why: input.why,
            ofIdea: framing?.centralIdea ?? '',
            revisedAt: now.toISOString(),
        }) ?? null,
    };
}

// ── Lugar en el libro ──────────────────────────────────────────────────

type PlannedRow = Pick<PlannedSermon, 'id' | 'title' | 'passage'> & Partial<Pick<PlannedSermon, 'paperId' | 'syntacticUnit'>>;

/**
 * La línea de contexto literario que va en el encargo de cada estudio:
 * «Perícopa 3 de 12 de la serie. Antes: Esdras 3:1-13 («…»). Después: …».
 * No es agenda pastoral: solo dice dónde está la perícopa.
 *
 * Cuenta UNIDADES, no filas: una unidad predicada en varios domingos ocupa
 * varias filas. Dos filas son la misma unidad si comparten estudio
 * (`paperId`) o el mismo pasaje. Los pasajes se muestran en la numeración
 * del lector: `passage` ya viene así del planificador, y el `syntacticUnit`
 * (numeración del original) se traduce.
 */
export function placeInBook(
    series: { metadata?: { plannedSermons?: ReadonlyArray<PlannedRow> } | null | undefined } | null | undefined,
    pericopeId: string,
): string | null {
    const units = plannedUnits(series?.metadata?.plannedSermons ?? []);
    const idx = units.findIndex(u => u.some(r => r.id === pericopeId));
    if (idx < 0) return null;
    const partes = [`Perícopa ${idx + 1} de ${units.length} de la serie.`];
    const antes = idx > 0 ? describeRow(units[idx - 1]![0]!) : null;
    const despues = idx < units.length - 1 ? describeRow(units[idx + 1]![0]!) : null;
    if (antes) partes.push(`Antes: ${antes}.`);
    if (despues) partes.push(`Después: ${despues}.`);
    return partes.join(' ');
}

/** Las filas del plan agrupadas en unidades, en el orden del plan. */
export function plannedUnits<R extends PlannedRow>(rows: ReadonlyArray<R>): R[][] {
    const parent = rows.map((_, i) => i);
    const raiz = (i: number): number => (parent[i] === i ? i : (parent[i] = raiz(parent[i]!)));
    const porClave = new Map<string, number>();
    rows.forEach((r, i) => {
        const claves = [
            r.paperId ? `p:${r.paperId}` : null,
            r.passage?.trim() ? `t:${r.passage.trim().toLowerCase().replace(/\s+/g, ' ')}` : null,
        ];
        for (const c of claves) {
            if (!c) continue;
            const j = porClave.get(c);
            if (j === undefined) porClave.set(c, i);
            else parent[raiz(i)] = raiz(j);
        }
    });
    const grupos = new Map<number, R[]>();
    rows.forEach((r, i) => {
        const k = raiz(i);
        const g = grupos.get(k);
        if (g) g.push(r);
        else grupos.set(k, [r]);
    });
    // El Map conserva el orden de inserción: el de la primera fila de cada unidad.
    return [...grupos.values()];
}

function describeRow(r: PlannedRow): string | null {
    const pasaje = r.passage?.trim() || unitForReader(r.syntacticUnit);
    const titulo = r.title?.trim();
    if (pasaje && titulo) return `${pasaje} («${titulo}»)`;
    if (pasaje) return pasaje;
    return titulo ? `«${titulo}»` : null;
}

function unitForReader(u: PlannedRow['syntacticUnit']): string | null {
    if (!u) return null;
    const book = findBooksByAlias(u.book.toLowerCase().trim())[0];
    if (!book) return null;
    return formatPassageForReader({
        bookId: book.id, chapterStart: u.chapterStart, chapterEnd: u.chapterEnd, verseStart: u.verseStart, verseEnd: u.verseEnd,
    });
}

// ── Utilidades ─────────────────────────────────────────────────────────

function asRecord(v: unknown): Record<string, unknown> | null {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function text(v: unknown, max: number): string | undefined {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t ? t.slice(0, max) : undefined;
}

function hasText(v: unknown): boolean {
    return typeof v === 'string' && v.trim().length > 0;
}

function oneOf<T extends string>(v: unknown, allowed: ReadonlyArray<T>): T | undefined {
    return typeof v === 'string' && (allowed as ReadonlyArray<string>).includes(v) ? (v as T) : undefined;
}

/** `YYYY-MM-DD` que existe en el calendario (sin 2026-02-30). */
function isLocalDate(v: unknown): v is string {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const [y, m, d] = v.split('-').map(Number) as [number, number, number];
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isoOrUndefined(v: unknown): string | undefined {
    if (typeof v !== 'string' || !v.trim()) return undefined;
    return Number.isNaN(Date.parse(v)) ? undefined : v.trim();
}
