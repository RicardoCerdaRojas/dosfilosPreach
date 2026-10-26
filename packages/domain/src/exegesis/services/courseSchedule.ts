import type { PassageReference } from '../../bible/canon/passage-reference';
import { projectWorkTypes, type AIProject } from '../../entities/AIProject';
import { isStorableFramingPassage } from './projectFraming';

/**
 * El calendario de entregas de un Curso y el ciclo de la devolución del
 * profesor (`docs/FASE_ESCRITORIO_PROYECTO_2026-10.md` §9.1).
 *
 * En un curso lo que forma no es una idea central: es lo que corrige el
 * profesor y cómo cambia el trabajo siguiente. Por eso cada entrega guarda
 * su devolución, y las correcciones que se repiten (los patrones) se
 * deciden: pasan a la guía del tipo de trabajo o se descartan.
 *
 * Todo vive en el proyecto (un solo documento, una sola lectura) y se
 * escribe por campo con rutas con punto, como el encuadre. Las fechas de
 * calendario son `YYYY-MM-DD` locales; los instantes, texto ISO (el
 * repositorio solo convierte los Timestamp del primer nivel).
 */

/** Una entrega esperada del curso: «TP #9 · Stg 4:11-17 · vence 31 oct». */
export interface CourseScheduleEntry {
    id: string;
    /** El tipo de trabajo del proyecto (`ProjectWorkType.id`). */
    workTypeId: string;
    /** Cómo la llama el curso: «TP #9», «Ensayo», «Paper final». */
    label: string;
    /** El pasaje, si la entrega lo tiene (numeración del ORIGINAL). */
    passage?: PassageReference | null;
    /** Fecha de entrega, `YYYY-MM-DD` local. Sin fecha: «sin plazo». */
    dueDate?: string | null;
    /** El trabajo (estudio) que la cumple, cuando ya existe. */
    paperId?: string | null;
    /** Cuándo el estudiante la marcó entregada (ISO). Lo marca él: exportar no deja rastro. */
    deliveredAt?: string | null;
    /** Lo que devolvió el profesor. */
    feedback?: ProfessorFeedback | null;
    /**
     * Traída de antes (un TP suelto que se vinculó al curso): conserva sus
     * reglas; un trabajo entregado no cambia de encargo.
     */
    imported?: boolean;
}

/** La devolución del profesor sobre una entrega. */
export interface ProfessorFeedback {
    /** Cuándo llegó (ISO). */
    receivedAt: string;
    /** Lo que escribió el profesor, pegado o tipeado por el estudiante. */
    text: string;
    /** La nota, tal como la da el curso («6,5», «A-»). Opcional. */
    grade?: string | null;
    /** Cada corrección, con el patrón al que pertenece. */
    corrections: FeedbackCorrection[];
    /** «Sin devolución», marcado a propósito: la fase 5 no la espera. */
    none?: boolean;
}

/** Una corrección del profesor, clasificada por el estudiante. */
export interface FeedbackCorrection {
    id: string;
    /** El patrón (`FeedbackPattern.id`). */
    patternId: string;
    /** El detalle de esta corrección («v. 14: cierre doble en la conclusión»). */
    note?: string | null;
}

/** Qué hizo el estudiante con un patrón. */
export type FeedbackPatternDecision = 'pending' | 'guide' | 'discarded';

/**
 * Un patrón de corrección del curso: «cierre doble», «categoría ≠
 * traducción». Lo nombra el estudiante; se repite entre entregas.
 */
export interface FeedbackPattern {
    id: string;
    name: string;
    description?: string | null;
    decision: FeedbackPatternDecision;
    /** Con `guide`: la guía donde quedó la regla y el texto que confirmó. */
    guideId?: string | null;
    ruleText?: string | null;
    /** Cuándo se decidió (ISO). */
    decidedAt?: string | null;
}

/**
 * Cómo trabaja el curso: con calendario de entregas, o semana a semana sin
 * calendario (salida explícita, como la del Exegético para enseñar).
 */
export type CourseScheduleMode = 'calendar' | 'free';

// ── Topes ────────────────────────────────────────────────────────────────
// El proyecto es UN documento (límite de 1 MiB): 200 devoluciones de 20 000
// caracteres ya son unos 4 MB en el peor caso teórico, pero un curso real
// tiene 10-20 entregas; los topes impiden que un pegado enorme lo rompa.

export const COURSE_SCHEDULE_MAX_ENTRIES = 200;
export const COURSE_FEEDBACK_TEXT_MAX = 20_000;
export const COURSE_FEEDBACK_MAX_CORRECTIONS = 100;
export const FEEDBACK_PATTERNS_MAX = 200;
export const COURSE_LABEL_MAX = 120;
export const COURSE_NOTE_MAX = 2_000;
export const COURSE_GRADE_MAX = 40;
export const FEEDBACK_PATTERN_NAME_MAX = 120;
/**
 * Topes de «Pasar a tu guía». El manifiesto no tenía tope propio: cada regla
 * entra entera al prompt del analizador y del revisor de prosa, así que una
 * guía sin tope crece sin aviso.
 */
export const GUIDE_RULE_TEXT_MAX = 1_000;
export const GUIDE_MAX_ADDITIONAL_RULES = 200;
const ID_MAX = 128;

// ── Utilidades de limpieza ───────────────────────────────────────────────

function asRecord(v: unknown): Record<string, unknown> | null {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function texto(v: unknown, max: number): string | undefined {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t ? t.slice(0, max) : undefined;
}

function idValido(v: unknown): string | undefined {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t && t.length <= ID_MAX && !t.includes('/') ? t : undefined;
}

/** `YYYY-MM-DD` que existe en el calendario («2026-02-30» no). */
export function isCalendarDate(v: unknown): v is string {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const [y, m, d] = v.split('-').map(Number) as [number, number, number];
    const f = new Date(Date.UTC(y, m - 1, d));
    return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

/** Un instante válido, normalizado a ISO; si no lo es, `undefined`. */
function instante(v: unknown): string | undefined {
    if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.toISOString() : undefined;
    if (typeof v !== 'string' || !v.trim()) return undefined;
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
}

function toIso(at: Date | string | undefined, now: () => Date): string {
    return instante(at) ?? now().toISOString();
}

/** Un pasaje guardable (numeración del original), en la forma de `buildPassageReference`. */
function pasaje(v: unknown): PassageReference | undefined {
    const r = asRecord(v);
    if (!r) return undefined;
    const p = {
        bookId: r.bookId,
        chapterStart: r.chapterStart,
        chapterEnd: r.chapterEnd ?? r.chapterStart,
        verseStart: r.verseStart ?? null,
        verseEnd: r.verseEnd ?? null,
    } as PassageReference;
    return isStorableFramingPassage(p) ? p : undefined;
}

/**
 * El nombre de un patrón para compararlo: «Cierre doble», «cierre  doble.» y
 * «CIERRE DOBLE» son el mismo patrón. Sin tildes, sin comillas ni puntuación
 * final, con los espacios colapsados.
 */
export function normalizePatternName(name: string): string {
    return name
        // Solo las tildes de las letras: «≠» también se descompone (= + U+0338)
        // y no puede volverse «=».
        .normalize('NFD').replace(/([A-Za-z])[\u0300-\u036f]+/g, '$1').normalize('NFC')
        .replace(/[«»"“”'‘’]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[.,;:!?¡¿]+$/u, '')
        .trim()
        .toLowerCase();
}

/** Igual que el nombre de un patrón: para no duplicar una regla en la guía. */
export const normalizeGuideRule = normalizePatternName;

// ── Limpieza profunda ────────────────────────────────────────────────────

function cleanCorrection(v: unknown): FeedbackCorrection | null {
    const r = asRecord(v);
    const id = idValido(r?.id);
    const patternId = idValido(r?.patternId);
    if (!r || !id || !patternId) return null;
    const note = texto(r.note, COURSE_NOTE_MAX);
    return { id, patternId, ...(note ? { note } : {}) };
}

function cleanFeedback(v: unknown): ProfessorFeedback | undefined {
    const r = asRecord(v);
    const receivedAt = instante(r?.receivedAt);
    if (!r || !receivedAt) return undefined;
    // «Sin devolución» es una marca: no lleva texto ni correcciones.
    if (r.none === true) return { receivedAt, text: '', corrections: [], none: true };
    const vistos = new Set<string>();
    const corrections: FeedbackCorrection[] = [];
    for (const c of Array.isArray(r.corrections) ? r.corrections : []) {
        const limpia = cleanCorrection(c);
        if (!limpia || vistos.has(limpia.id)) continue;
        vistos.add(limpia.id);
        corrections.push(limpia);
        if (corrections.length >= COURSE_FEEDBACK_MAX_CORRECTIONS) break;
    }
    const grade = texto(r.grade, COURSE_GRADE_MAX);
    const text = typeof r.text === 'string' ? r.text.trim().slice(0, COURSE_FEEDBACK_TEXT_MAX) : '';
    return { receivedAt, text, ...(grade ? { grade } : {}), corrections };
}

function cleanEntry(v: unknown): CourseScheduleEntry | null {
    const r = asRecord(v);
    const id = idValido(r?.id);
    if (!r || !id) return null;
    // Sin tipo queda '' (la fase 3 lo muestra «en curso»: entrega sin tipo).
    const workTypeId = idValido(r.workTypeId) ?? '';
    const label = texto(r.label, COURSE_LABEL_MAX) ?? '';
    const paperId = idValido(r.paperId);
    // Una entrada sin tipo, sin rótulo y sin trabajo no dice nada.
    if (!workTypeId && !label && !paperId) return null;
    const passage = pasaje(r.passage);
    const dueDate = isCalendarDate(r.dueDate) ? r.dueDate : undefined;
    const deliveredAt = instante(r.deliveredAt);
    const feedback = cleanFeedback(r.feedback);
    return {
        id, workTypeId, label,
        ...(passage ? { passage } : {}),
        ...(dueDate ? { dueDate } : {}),
        ...(paperId ? { paperId } : {}),
        ...(deliveredAt ? { deliveredAt } : {}),
        ...(feedback ? { feedback } : {}),
        ...(r.imported === true ? { imported: true } : {}),
    };
}

/**
 * El calendario listo para guardar: sin `undefined` en ningún nivel (Firestore
 * los rechaza anidados), ids únicos, fechas válidas, topes aplicados. Un
 * trabajo cumple a lo sumo UNA entrada: si se repite, queda en la primera.
 */
export function cleanCourseSchedule(input: unknown): CourseScheduleEntry[] {
    const out: CourseScheduleEntry[] = [];
    const ids = new Set<string>();
    const papers = new Set<string>();
    for (const v of Array.isArray(input) ? input : []) {
        const e = cleanEntry(v);
        if (!e || ids.has(e.id)) continue;
        ids.add(e.id);
        if (e.paperId) {
            if (papers.has(e.paperId)) delete e.paperId;
            else papers.add(e.paperId);
        }
        out.push(e);
        if (out.length >= COURSE_SCHEDULE_MAX_ENTRIES) break;
    }
    return out;
}

const DECISIONES: ReadonlySet<FeedbackPatternDecision> = new Set(['pending', 'guide', 'discarded']);

function cleanPattern(v: unknown): FeedbackPattern | null {
    const r = asRecord(v);
    const id = idValido(r?.id);
    const name = texto(r?.name, FEEDBACK_PATTERN_NAME_MAX);
    if (!r || !id || !name || !normalizePatternName(name)) return null;
    const description = texto(r.description, COURSE_NOTE_MAX);
    let decision: FeedbackPatternDecision = DECISIONES.has(r.decision as FeedbackPatternDecision) ? r.decision as FeedbackPatternDecision : 'pending';
    const guideId = idValido(r.guideId);
    const ruleText = texto(r.ruleText, GUIDE_RULE_TEXT_MAX);
    // «Pasado a la guía» sin la guía ni el texto no dice dónde quedó: vuelve a pendiente.
    if (decision === 'guide' && (!guideId || !ruleText)) decision = 'pending';
    const decidedAt = decision === 'pending' ? undefined : instante(r.decidedAt);
    return {
        id, name,
        ...(description ? { description } : {}),
        decision,
        ...(decision === 'guide' ? { guideId, ruleText } : {}),
        ...(decidedAt ? { decidedAt } : {}),
    };
}

/**
 * Los patrones listos para guardar: ids únicos y nombres únicos (normalizados:
 * «Cierre doble» y «cierre doble» son uno; queda el primero). Topes aplicados.
 */
export function cleanFeedbackPatterns(input: unknown): FeedbackPattern[] {
    const out: FeedbackPattern[] = [];
    const ids = new Set<string>();
    const nombres = new Set<string>();
    for (const v of Array.isArray(input) ? input : []) {
        const p = cleanPattern(v);
        if (!p) continue;
        const n = normalizePatternName(p.name);
        if (ids.has(p.id) || nombres.has(n)) continue;
        ids.add(p.id);
        nombres.add(n);
        out.push(p);
        if (out.length >= FEEDBACK_PATTERNS_MAX) break;
    }
    return out;
}

/** El modo guardable: `'calendar'`, `'free'` o `null` (sin elegir). */
export function cleanCourseScheduleMode(v: unknown): CourseScheduleMode | null {
    return v === 'calendar' || v === 'free' ? v : null;
}

// ── Ids ──────────────────────────────────────────────────────────────────

export function newCourseEntryId(): string {
    return `cs_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
export function newFeedbackPatternId(): string {
    return `fp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
export function newFeedbackCorrectionId(): string {
    return `fc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ── Operaciones sobre el calendario (puras: devuelven el arreglo nuevo) ──
// Una operación sobre una entrada que ya no existe (otra pestaña la quitó)
// no hace nada: no hay nada sobre qué aplicarla.

/**
 * Lo que se manda para crear o editar una entrada. Las claves presentes
 * reemplazan; `null` borra ese campo; las ausentes quedan como estaban (editar
 * el rótulo no borra la devolución).
 */
export type CourseEntryInput = { id?: string | null } & {
    [K in Exclude<keyof CourseScheduleEntry, 'id'>]?: CourseScheduleEntry[K] | null;
};

function sinNulos<T extends object>(o: T): T {
    return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as T;
}

/** Crea (sin id o con uno nuevo) o edita una entrada. Devuelve el calendario limpio. */
export function upsertEntry(
    schedule: ReadonlyArray<CourseScheduleEntry>,
    entry: CourseEntryInput,
    newId: () => string = newCourseEntryId,
): CourseScheduleEntry[] {
    const id = idValido(entry.id) ?? newId();
    const { id: _id, ...campos } = entry;
    const i = schedule.findIndex(e => e.id === id);
    const base: Record<string, unknown> = i >= 0 ? { ...schedule[i] } : { id, workTypeId: '', label: '' };
    for (const [k, v] of Object.entries(campos)) {
        if (v === undefined) continue;
        if (v === null) delete base[k];
        else base[k] = v;
    }
    const nuevo = sinNulos({ ...base, id }) as unknown as CourseScheduleEntry;
    // El trabajo que se le asigna deja la entrada que lo tenía antes.
    const resto = nuevo.paperId ? schedule.map(e => (e.id !== id && e.paperId === nuevo.paperId ? sinPaper(e) : e)) : [...schedule];
    if (i >= 0) resto[i] = nuevo;
    else resto.push(nuevo);
    return cleanCourseSchedule(resto);
}

function sinPaper(e: CourseScheduleEntry): CourseScheduleEntry {
    const { paperId: _p, ...resto } = e;
    return resto;
}

export function removeEntry(schedule: ReadonlyArray<CourseScheduleEntry>, entryId: string): CourseScheduleEntry[] {
    return schedule.filter(e => e.id !== entryId);
}

function editar(
    schedule: ReadonlyArray<CourseScheduleEntry>,
    entryId: string,
    fn: (e: CourseScheduleEntry) => CourseScheduleEntry,
): CourseScheduleEntry[] {
    if (!schedule.some(e => e.id === entryId)) return [...schedule];
    return cleanCourseSchedule(schedule.map(e => (e.id === entryId ? fn(e) : e)));
}

/** El trabajo que cumple la entrada (`null` lo suelta). Un trabajo cumple una sola entrada. */
export function linkEntryToPaper(
    schedule: ReadonlyArray<CourseScheduleEntry>,
    entryId: string,
    paperId: string | null,
): CourseScheduleEntry[] {
    if (!schedule.some(e => e.id === entryId)) return [...schedule];
    return upsertEntry(schedule, { id: entryId, paperId: idValido(paperId) ?? null });
}

/**
 * «Marcar como entregado»: lo marca el estudiante; exportar el Word no deja
 * rastro. No toca la devolución ni el avance del trabajo (ninguna acción de
 * una fase completa otra).
 */
export function markDelivered(
    schedule: ReadonlyArray<CourseScheduleEntry>,
    entryId: string,
    at: Date | string = new Date(),
): CourseScheduleEntry[] {
    const deliveredAt = instante(at);
    if (!deliveredAt) return [...schedule];
    return editar(schedule, entryId, e => ({ ...e, deliveredAt }));
}

export function unmarkDelivered(schedule: ReadonlyArray<CourseScheduleEntry>, entryId: string): CourseScheduleEntry[] {
    return editar(schedule, entryId, e => {
        const { deliveredAt: _d, ...resto } = e;
        return resto;
    });
}

/** Una corrección tal como la clasifica el estudiante: con un patrón existente o con el nombre de uno. */
export interface FeedbackCorrectionInput {
    id?: string | null;
    /** El patrón existente. Si no existe (o falta), se usa `patternName`. */
    patternId?: string | null;
    /** El nombre del patrón: si ya hay uno con ese nombre (normalizado), se reutiliza; si no, se crea. */
    patternName?: string | null;
    note?: string | null;
}

export interface ProfessorFeedbackInput {
    text: string;
    grade?: string | null;
    /** Cuándo llegó. Sin ella, ahora. */
    receivedAt?: Date | string | null;
    corrections?: ReadonlyArray<FeedbackCorrectionInput>;
}

/** El calendario y los patrones juntos: registrar una devolución puede crear patrones. */
export interface CourseRecord {
    schedule: CourseScheduleEntry[];
    patterns: FeedbackPattern[];
}

export interface CourseOpOptions {
    now?: () => Date;
    newEntryId?: () => string;
    newPatternId?: () => string;
    newCorrectionId?: () => string;
}

/**
 * Registra (o reemplaza) la devolución del profesor de una entrada. Cada
 * corrección queda con su patrón: el elegido, o uno por nombre (reutiliza el
 * que ya existe con ese nombre normalizado, o lo crea pendiente). Una
 * corrección sin patrón válido se descarta. No marca la entrada entregada.
 */
export function recordFeedback(
    record: CourseRecord,
    entryId: string,
    feedback: ProfessorFeedbackInput,
    opts: CourseOpOptions = {},
): CourseRecord {
    if (!record.schedule.some(e => e.id === entryId)) return { schedule: [...record.schedule], patterns: [...record.patterns] };
    const now = opts.now ?? (() => new Date());
    const patterns = [...record.patterns];
    const corrections: FeedbackCorrection[] = [];
    for (const c of feedback.corrections ?? []) {
        let patternId = idValido(c.patternId);
        if (!patternId || !patterns.some(p => p.id === patternId)) {
            const name = texto(c.patternName, FEEDBACK_PATTERN_NAME_MAX);
            const n = name ? normalizePatternName(name) : '';
            if (!name || !n) continue;
            const existente = patterns.find(p => normalizePatternName(p.name) === n);
            if (existente) patternId = existente.id;
            else {
                if (patterns.length >= FEEDBACK_PATTERNS_MAX) continue;
                patternId = (opts.newPatternId ?? newFeedbackPatternId)();
                patterns.push({ id: patternId, name, decision: 'pending' });
            }
        }
        const note = texto(c.note, COURSE_NOTE_MAX);
        corrections.push({ id: idValido(c.id) ?? (opts.newCorrectionId ?? newFeedbackCorrectionId)(), patternId, ...(note ? { note } : {}) });
    }
    const grade = texto(feedback.grade, COURSE_GRADE_MAX);
    const nueva: ProfessorFeedback = {
        receivedAt: toIso(feedback.receivedAt ?? undefined, now),
        text: (feedback.text ?? '').trim().slice(0, COURSE_FEEDBACK_TEXT_MAX),
        ...(grade ? { grade } : {}),
        corrections,
    };
    return {
        schedule: editar(record.schedule, entryId, e => ({ ...e, feedback: nueva })),
        patterns: cleanFeedbackPatterns(patterns),
    };
}

/**
 * «Sin devolución», marcado a propósito: la fase 5 no la espera. No pisa una
 * devolución con contenido (texto o correcciones): para eso, `clearFeedback`
 * primero. Así un clic de más no borra lo que escribió el profesor.
 */
export function markNoFeedback(
    schedule: ReadonlyArray<CourseScheduleEntry>,
    entryId: string,
    at: Date | string = new Date(),
): CourseScheduleEntry[] {
    const receivedAt = instante(at);
    const e = schedule.find(x => x.id === entryId);
    if (!receivedAt || !e) return [...schedule];
    const conContenido = !!e.feedback && !e.feedback.none && (!!e.feedback.text || e.feedback.corrections.length > 0 || !!e.feedback.grade);
    if (conContenido) return [...schedule];
    return editar(schedule, entryId, x => ({ ...x, feedback: { receivedAt, text: '', corrections: [], none: true } }));
}

/** Quita la devolución (o la marca «sin devolución») de una entrada. */
export function clearFeedback(schedule: ReadonlyArray<CourseScheduleEntry>, entryId: string): CourseScheduleEntry[] {
    return editar(schedule, entryId, e => {
        const { feedback: _f, ...resto } = e;
        return resto;
    });
}

// ── Operaciones sobre los patrones ───────────────────────────────────────

/**
 * Crea o renombra un patrón. Renombrar a un nombre que ya tiene OTRO patrón no
 * hace nada (serían dos patrones con el mismo nombre). Crear con un nombre que
 * ya existe devuelve los patrones tal cual: el existente sirve.
 */
export function upsertPattern(
    patterns: ReadonlyArray<FeedbackPattern>,
    input: { id?: string | null; name: string; description?: string | null },
    newId: () => string = newFeedbackPatternId,
): FeedbackPattern[] {
    const name = texto(input.name, FEEDBACK_PATTERN_NAME_MAX);
    const n = name ? normalizePatternName(name) : '';
    if (!name || !n) return [...patterns];
    const id = idValido(input.id);
    const i = id ? patterns.findIndex(p => p.id === id) : -1;
    if (patterns.some((p, j) => j !== i && normalizePatternName(p.name) === n)) return [...patterns];
    const description = input.description === undefined ? patterns[i]?.description : texto(input.description, COURSE_NOTE_MAX);
    if (i >= 0) {
        const { description: _d, ...resto } = patterns[i]!;
        const out = [...patterns];
        out[i] = { ...resto, name, ...(description ? { description } : {}) };
        return cleanFeedbackPatterns(out);
    }
    return cleanFeedbackPatterns([...patterns, { id: id ?? newId(), name, decision: 'pending', ...(description ? { description } : {}) }]);
}

/**
 * Decide un patrón. `guide` pide la guía y el texto de la regla (sin ellos no
 * hace nada: «pasado a la guía» tiene que decir dónde quedó); `pending` borra
 * la decisión anterior. Escribir la regla en la guía es otro paso
 * (`AddRuleToStyleGuideUseCase`): esto solo la registra en el proyecto.
 */
export function decidePattern(
    patterns: ReadonlyArray<FeedbackPattern>,
    patternId: string,
    decision: FeedbackPatternDecision,
    detail: { guideId?: string | null; ruleText?: string | null } = {},
    at: Date | string = new Date(),
): FeedbackPattern[] {
    const i = patterns.findIndex(p => p.id === patternId);
    if (i < 0 || !DECISIONES.has(decision)) return [...patterns];
    const { guideId: _g, ruleText: _r, decidedAt: _a, decision: _d, ...base } = patterns[i]!;
    let nuevo: FeedbackPattern;
    if (decision === 'pending') nuevo = { ...base, decision };
    else {
        const decidedAt = instante(at) ?? new Date().toISOString();
        if (decision === 'guide') {
            const guideId = idValido(detail.guideId);
            const ruleText = texto(detail.ruleText, GUIDE_RULE_TEXT_MAX);
            if (!guideId || !ruleText) return [...patterns];
            nuevo = { ...base, decision, guideId, ruleText, decidedAt };
        } else nuevo = { ...base, decision, decidedAt };
    }
    const out = [...patterns];
    out[i] = nuevo;
    return cleanFeedbackPatterns(out);
}

// ── Lecturas ─────────────────────────────────────────────────────────────

export interface PatternRecurrence {
    patternId: string;
    name: string;
    decision: FeedbackPatternDecision;
    /** Cuántas correcciones lo usan, en todas las entregas. */
    corrections: number;
    /** En cuántas entregas distintas aparece. */
    entries: number;
    /** Las entregas donde aparece, en el orden del calendario. */
    entryIds: string[];
    /** Los tipos de trabajo de esas entregas (para ofrecer su guía). */
    workTypeIds: string[];
    /** Se repite: aparece en dos entregas o más. Es lo que la fase 5 pide decidir. */
    recurring: boolean;
}

/**
 * El registro de devoluciones: por patrón, cuántas correcciones y en cuántas
 * entregas. Los patrones sin correcciones también salen (con 0). Orden: más
 * entregas primero, luego más correcciones, luego por nombre.
 */
export function patternRecurrence(
    schedule: ReadonlyArray<CourseScheduleEntry>,
    patterns: ReadonlyArray<FeedbackPattern>,
): PatternRecurrence[] {
    const por = new Map<string, PatternRecurrence>();
    for (const p of patterns) {
        por.set(p.id, { patternId: p.id, name: p.name, decision: p.decision, corrections: 0, entries: 0, entryIds: [], workTypeIds: [], recurring: false });
    }
    for (const e of schedule) {
        if (!e.feedback || e.feedback.none) continue;
        for (const c of e.feedback.corrections) {
            const r = por.get(c.patternId);
            if (!r) continue;
            r.corrections += 1;
            if (!r.entryIds.includes(e.id)) { r.entryIds.push(e.id); r.entries += 1; }
            if (e.workTypeId && !r.workTypeIds.includes(e.workTypeId)) r.workTypeIds.push(e.workTypeId);
        }
    }
    const out = [...por.values()];
    for (const r of out) r.recurring = r.entries >= 2;
    return out.sort((a, b) => b.entries - a.entries || b.corrections - a.corrections || a.name.localeCompare(b.name));
}

/**
 * El rótulo sugerido para la próxima entrega de un tipo: «TP #9» → «TP #10».
 * Toma el rótulo con el número más alto de ese tipo y le suma uno al número
 * (el que sigue a «#», o el último del rótulo). Sin rótulos con número, `null`:
 * el estudiante lo escribe.
 */
export function nextLabelFor(workTypeId: string, schedule: ReadonlyArray<CourseScheduleEntry>): string | null {
    let mejor: { n: number; label: string; start: number; len: number } | null = null;
    for (const e of schedule) {
        if (e.workTypeId !== workTypeId || !e.label) continue;
        const m = /#\s*(\d+)/.exec(e.label) ?? lastNumber(e.label);
        if (!m) continue;
        const digits = m[1]!;
        const start = m.index + m[0].length - digits.length;
        const n = Number(digits);
        if (!mejor || n > mejor.n) mejor = { n, label: e.label, start, len: digits.length };
    }
    if (!mejor) return null;
    return mejor.label.slice(0, mejor.start) + String(mejor.n + 1) + mejor.label.slice(mejor.start + mejor.len);
}

function lastNumber(s: string): RegExpExecArray | null {
    let ultimo: RegExpExecArray | null = null;
    const re = /(\d+)/g;
    for (let m = re.exec(s); m; m = re.exec(s)) ultimo = m;
    return ultimo;
}

/** Una guía que se puede ofrecer para «Pasar a tu guía». */
export interface CourseGuideCandidate {
    guideId: string;
    /** `'workType'`: la de uno o más tipos de trabajo; `'course'`: la del curso. */
    source: 'workType' | 'course';
    /** Los tipos de trabajo que la usan (la del curso vale para los que no tienen una propia). */
    workTypeIds: string[];
}

/**
 * Las guías del curso, para elegir dónde pasar una regla: las de los tipos de
 * trabajo primero (la de un tipo gana sobre la del curso, como al crear un
 * trabajo) y la del curso al final. Con `workTypeIds` (los de un patrón), solo
 * las que rigen esos tipos.
 */
export function courseGuideCandidates(
    project: Pick<AIProject, 'workTypes' | 'charge' | 'courseInfo'>,
    workTypeIds?: ReadonlyArray<string>,
): CourseGuideCandidate[] {
    const tipos = projectWorkTypes(project).filter(t => !workTypeIds?.length || workTypeIds.includes(t.id));
    const delCurso = project.courseInfo?.styleGuideId?.trim() || project.charge?.styleGuideId?.trim() || null;
    const out: CourseGuideCandidate[] = [];
    const sinPropia: string[] = [];
    for (const t of tipos) {
        const g = t.styleGuideId?.trim();
        if (!g) { sinPropia.push(t.id); continue; }
        const ya = out.find(c => c.guideId === g);
        if (ya) ya.workTypeIds.push(t.id);
        else out.push({ guideId: g, source: 'workType', workTypeIds: [t.id] });
    }
    if (delCurso && !out.some(c => c.guideId === delCurso) && (sinPropia.length || !workTypeIds?.length)) {
        out.push({ guideId: delCurso, source: 'course', workTypeIds: sinPropia });
    }
    return out;
}

// ── Operaciones en lote (lo que manda la página) ─────────────────────────

/**
 * Una operación del escritorio sobre el calendario o los patrones. La página
 * manda la lista y el caso de uso la aplica sobre el proyecto RELEÍDO: dos
 * pestañas no se pisan a ciegas (cada una aplica sus operaciones sobre lo
 * último guardado; entre la lectura y la escritura gana la última).
 */
export type CourseOp =
    | { op: 'upsertEntry'; entry: CourseEntryInput }
    | { op: 'removeEntry'; entryId: string }
    | { op: 'linkPaper'; entryId: string; paperId: string | null }
    | { op: 'markDelivered'; entryId: string; at?: string | null }
    | { op: 'unmarkDelivered'; entryId: string }
    | { op: 'recordFeedback'; entryId: string; feedback: ProfessorFeedbackInput }
    | { op: 'markNoFeedback'; entryId: string; at?: string | null }
    | { op: 'clearFeedback'; entryId: string }
    | { op: 'upsertPattern'; pattern: { id?: string | null; name: string; description?: string | null } }
    | { op: 'decidePattern'; patternId: string; decision: FeedbackPatternDecision; guideId?: string | null; ruleText?: string | null; at?: string | null };

export interface ApplyCourseOpsOptions extends CourseOpOptions {
    /**
     * Los tipos de trabajo que tiene el proyecto guardado. Con ellos, una
     * entrada que llega con un tipo que ya no existe (otra pestaña lo borró)
     * queda sin tipo, que la fase 3 muestra como pendiente.
     */
    workTypeIds?: ReadonlyArray<string>;
}

/** Aplica las operaciones en orden y devuelve el calendario y los patrones limpios. */
export function applyCourseOps(
    record: Partial<CourseRecord> | null | undefined,
    ops: ReadonlyArray<CourseOp>,
    opts: ApplyCourseOpsOptions = {},
): CourseRecord {
    const now = opts.now ?? (() => new Date());
    let schedule = cleanCourseSchedule(record?.schedule ?? []);
    let patterns = cleanFeedbackPatterns(record?.patterns ?? []);
    for (const o of ops) {
        switch (o.op) {
            case 'upsertEntry': {
                const entry = { ...o.entry };
                const wt = typeof entry.workTypeId === 'string' ? entry.workTypeId.trim() : entry.workTypeId;
                if (wt && opts.workTypeIds && !opts.workTypeIds.includes(wt)) entry.workTypeId = '';
                schedule = upsertEntry(schedule, entry, opts.newEntryId);
                break;
            }
            case 'removeEntry': schedule = removeEntry(schedule, o.entryId); break;
            case 'linkPaper': schedule = linkEntryToPaper(schedule, o.entryId, o.paperId); break;
            case 'markDelivered': schedule = markDelivered(schedule, o.entryId, o.at ?? now()); break;
            case 'unmarkDelivered': schedule = unmarkDelivered(schedule, o.entryId); break;
            case 'recordFeedback': ({ schedule, patterns } = recordFeedback({ schedule, patterns }, o.entryId, o.feedback, { ...opts, now })); break;
            case 'markNoFeedback': schedule = markNoFeedback(schedule, o.entryId, o.at ?? now()); break;
            case 'clearFeedback': schedule = clearFeedback(schedule, o.entryId); break;
            case 'upsertPattern': patterns = upsertPattern(patterns, o.pattern, opts.newPatternId); break;
            case 'decidePattern': patterns = decidePattern(patterns, o.patternId, o.decision, o, o.at ?? now()); break;
        }
    }
    return { schedule: cleanCourseSchedule(schedule), patterns: cleanFeedbackPatterns(patterns) };
}
