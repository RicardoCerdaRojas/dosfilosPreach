/**
 * Las entradas de un trabajo (procedimiento académico, etapa 0; fase «Asistente
 * del corpus», diseño §2.2, A5).
 *
 * Antes de redactar se reúne lo que el curso dio: el plazo primero, después el
 * enunciado, la rúbrica, la guía, la devolución de la entrega anterior, ese
 * trabajo, las lecturas del sílabo, la gramática del curso y lo dicho en clase.
 * Casi todo ya vive en la app (el encuadre, la rúbrica, la guía, el calendario
 * del curso, la memoria de entregas); aquí NO se copia: se lee y se dice en qué
 * estado está. Lo único que se guarda es lo que el autor marca («no aplica»,
 * «leída») y la nota de clase, que no tenía dónde vivir.
 *
 * Medido en los cuatro trabajos de noviembre: el TP #11 corrió con la devolución
 * del TP #10 sin leer y repitió el «genitivo de producción» que el curso veta; el
 * TI #3 empezó sin el plazo a la vista (procedimiento §4d).
 */
import type { AIProject } from '../../entities/AIProject';
import type { RubricProvenance } from '../entities/PaperRubric';
import { briefGaps } from './preachingBriefTemplate';
import { PAPER_PROFILES, type PaperProfileKind } from './paperProfile';

export type PaperInputKind =
    | 'plazo'
    | 'enunciado'
    | 'rubrica'
    | 'guia'
    | 'devolucion'
    | 'trabajo-anterior'
    | 'lectura-asignada'
    | 'gramatica-del-curso'
    | 'clase';

/** En el orden del procedimiento: el plazo primero. */
export const PAPER_INPUT_KINDS: ReadonlyArray<PaperInputKind> = [
    'plazo', 'enunciado', 'rubrica', 'guia', 'devolucion', 'trabajo-anterior', 'lectura-asignada', 'gramatica-del-curso', 'clase',
];

/**
 * - `listo`: está y no pide nada.
 * - `revisar`: está, pero algo hay que mirar (plantilla sin llenar, guía con
 *   versión nueva, patrones de la devolución sin decidir).
 * - `falta`: el trabajo la necesita y no está.
 * - `no-aplica`: el autor dijo que este curso no la da, o el tipo no la usa.
 */
export type PaperInputState = 'listo' | 'revisar' | 'falta' | 'no-aplica';

/** Lo que el autor marca de una entrada. Lo demás se deduce. */
export interface PaperInputMark {
    /** `no-aplica`: el curso no la da. `leida`: la leyó (la devolución, la clase). */
    mark: 'no-aplica' | 'leida';
    /** Una nota corta: qué dijo el profesor en clase, por qué no aplica. */
    note?: string | null;
    /** ISO. */
    at: string;
}

export type PaperInputMarks = Partial<Record<PaperInputKind, PaperInputMark>>;

export const PAPER_INPUT_NOTE_MAX = 4000;

/** Lo que la app ya sabe de cada entrada; lo arma quien llama (la pantalla). */
export interface PaperInputsContext {
    profileKind: PaperProfileKind;
    assignmentBrief: string | null | undefined;
    rubric: { provenance: RubricProvenance } | null | undefined;
    /** El tipo de trabajo del proyecto dice «el curso no da rúbrica». */
    rubricConfirmedByCourse?: boolean;
    styleGuide: { id: string | null | undefined; liveDiffers?: boolean };
    /**
     * La entrada del calendario del curso. `undefined`: el trabajo no es de un
     * curso con calendario. `null`: es de un curso, pero no está en el calendario.
     */
    scheduleEntry?: { dueDate: string | null | undefined } | null;
    /**
     * La entrega anterior del mismo tipo en el calendario y su devolución.
     * `undefined`: no se puede saber (fuera de un curso). `null`: es la primera.
     */
    previousEntry?: { delivered: boolean; feedback: 'recorded' | 'none' | 'awaiting'; pendingPatterns: number } | null;
    /** La entrega anterior que encuentra la memoria de fuentes (mismo proyecto o tipo). */
    previousDeliveryFound?: boolean;
    /** Lecturas del sílabo: las de la rúbrica más las del proyecto con origen sílabo. */
    assignedReadings: number;
    /** Gramáticas del corpus y categorías que el curso no acepta como final («IGNORA»). */
    courseGrammar: { grammarSources: number; ignoredCategories: number };
    marks?: PaperInputMarks | null;
}

export interface PaperInputStatus {
    kind: PaperInputKind;
    state: PaperInputState;
    /** La razón, como clave corta para la pantalla (`brief-template`, `no-entry`…). */
    reason: string;
    /** Un número que acompaña la razón (patrones pendientes, lecturas). */
    count?: number;
    /** Un dato que acompaña la razón: la fecha del plazo (`YYYY-MM-DD`). */
    detail?: string;
    /** La entrada la pide el tipo de trabajo (las demás son opcionales). */
    required: boolean;
    mark?: PaperInputMark;
}

/** Qué entradas pide cada tipo. La clase solo la exige la investigación; la devolución, todo lo que se entrega en serie. */
function requiredFor(kind: PaperProfileKind, input: PaperInputKind): boolean {
    if (input === 'clase') return kind === 'investigacion-tematica';
    if (input === 'gramatica-del-curso') return PAPER_PROFILES[kind].unitKind === 'pregunta';
    return true;
}

export function paperInputStatuses(ctx: PaperInputsContext): PaperInputStatus[] {
    return PAPER_INPUT_KINDS.map(kind => {
        const mark = ctx.marks?.[kind];
        const base = derive(kind, ctx);
        const required = requiredFor(ctx.profileKind, kind);
        // Lo que el autor dijo gana sobre lo deducido, salvo que la entrada esté y pida algo.
        if (mark?.mark === 'no-aplica' && base.state !== 'listo') return { kind, state: 'no-aplica', reason: 'marked', required, mark };
        if (mark?.mark === 'leida' && base.state === 'revisar') return { kind, state: 'listo', reason: 'marked-read', required, mark };
        if (!required && base.state === 'falta') return { kind, ...base, state: 'no-aplica', required, ...(mark ? { mark } : {}) };
        return { kind, ...base, required, ...(mark ? { mark } : {}) };
    });
}

function derive(kind: PaperInputKind, ctx: PaperInputsContext): Pick<PaperInputStatus, 'state' | 'reason' | 'count' | 'detail'> {
    switch (kind) {
        case 'plazo':
            if (ctx.scheduleEntry === undefined) return { state: 'falta', reason: 'not-in-course' };
            if (ctx.scheduleEntry === null) return { state: 'falta', reason: 'no-entry' };
            return ctx.scheduleEntry.dueDate ? { state: 'listo', reason: 'due', detail: ctx.scheduleEntry.dueDate } : { state: 'falta', reason: 'no-date' };
        case 'enunciado': {
            const gaps = briefGaps(ctx.assignmentBrief);
            if (gaps.includes('empty')) return { state: 'falta', reason: 'empty' };
            if (gaps.includes('template-unfilled')) return { state: 'revisar', reason: 'template-unfilled' };
            return { state: 'listo', reason: 'present' };
        }
        case 'rubrica':
            if (!ctx.rubric) return { state: 'falta', reason: 'none' };
            if (ctx.rubric.provenance !== 'system-default') return { state: 'listo', reason: 'course' };
            return ctx.rubricConfirmedByCourse ? { state: 'listo', reason: 'course-gives-none' } : { state: 'revisar', reason: 'system-default' };
        case 'guia':
            if (!ctx.styleGuide.id) return { state: 'falta', reason: 'none' };
            return ctx.styleGuide.liveDiffers ? { state: 'revisar', reason: 'newer-version' } : { state: 'listo', reason: 'present' };
        case 'devolucion': {
            const prev = ctx.previousEntry;
            // Mismo motivo que el plazo: un trabajo del curso que no está en el
            // calendario no tiene «la entrega anterior», y la pantalla lo dice igual.
            if (prev === undefined) return { state: 'falta', reason: ctx.scheduleEntry === null ? 'not-in-calendar' : 'not-in-course' };
            if (prev === null) return { state: 'no-aplica', reason: 'first-delivery' };
            if (prev.feedback === 'none') return { state: 'no-aplica', reason: 'none-given' };
            if (prev.feedback === 'awaiting') return { state: 'falta', reason: prev.delivered ? 'awaiting' : 'not-delivered' };
            return prev.pendingPatterns > 0
                ? { state: 'revisar', reason: 'pending-patterns', count: prev.pendingPatterns }
                : { state: 'listo', reason: 'recorded' };
        }
        case 'trabajo-anterior':
            if (ctx.previousEntry === null) return { state: 'no-aplica', reason: 'first-delivery' };
            return ctx.previousDeliveryFound ? { state: 'listo', reason: 'found' } : { state: 'falta', reason: 'not-found' };
        case 'lectura-asignada':
            return ctx.assignedReadings > 0 ? { state: 'listo', reason: 'present', count: ctx.assignedReadings } : { state: 'falta', reason: 'none' };
        case 'gramatica-del-curso': {
            const g = ctx.courseGrammar;
            if (g.grammarSources === 0) return { state: 'falta', reason: 'no-grammar' };
            return g.ignoredCategories > 0
                ? { state: 'listo', reason: 'with-ignored', count: g.ignoredCategories }
                : { state: 'revisar', reason: 'no-ignored-list' };
        }
        case 'clase':
            // La nota de clase vive en la marca: escribirla es haberla traído.
            return ctx.marks?.clase?.note?.trim() ? { state: 'listo', reason: 'note' } : { state: 'falta', reason: 'none' };
    }
}

/** Cuántas entradas exigidas faltan: la línea de estado del trabajo («Faltan 2 entradas»). */
export function missingRequiredInputs(statuses: ReadonlyArray<PaperInputStatus>): PaperInputStatus[] {
    return statuses.filter(s => s.required && s.state === 'falta');
}

/** Las marcas listas para guardar: solo tipos conocidos, nota recortada. */
export function cleanPaperInputMarks(value: unknown): PaperInputMarks {
    if (!value || typeof value !== 'object') return {};
    const out: PaperInputMarks = {};
    for (const kind of PAPER_INPUT_KINDS) {
        const m = (value as Record<string, unknown>)[kind] as Partial<PaperInputMark> | undefined;
        if (!m || (m.mark !== 'no-aplica' && m.mark !== 'leida')) continue;
        const note = typeof m.note === 'string' ? m.note.trim().slice(0, PAPER_INPUT_NOTE_MAX) : '';
        out[kind] = { mark: m.mark, ...(note ? { note } : {}), at: typeof m.at === 'string' ? m.at : new Date(0).toISOString() };
    }
    return out;
}

/**
 * El plazo y la devolución anterior, leídos del calendario del curso (el
 * proyecto). `undefined` en los dos si el trabajo no es de un curso con
 * calendario: la pantalla lo dice, no inventa una fecha.
 */
export function courseInputsOf(
    project: Pick<AIProject, 'courseSchedule' | 'feedbackPatterns'> | null | undefined,
    paperId: string,
): Pick<PaperInputsContext, 'scheduleEntry' | 'previousEntry'> {
    const entradas = project?.courseSchedule ?? [];
    if (!project || entradas.length === 0) return {};
    const propia = entradas.find(e => e.paperId === paperId) ?? null;
    if (!propia) return { scheduleEntry: null };
    const delTipo = entradas
        .map((e, i) => ({ e, i }))
        .filter(x => x.e.workTypeId === propia.workTypeId)
        // Por fecha; sin fecha, en el orden del calendario.
        .sort((a, b) => (a.e.dueDate ?? '￿').localeCompare(b.e.dueDate ?? '￿') || a.i - b.i)
        .map(x => x.e);
    const anterior = delTipo[delTipo.indexOf(propia) - 1] ?? null;
    const scheduleEntry = { dueDate: propia.dueDate ?? null };
    if (!anterior) return { scheduleEntry, previousEntry: null };
    const fb = anterior.feedback;
    const pendientes = new Set(
        (project.feedbackPatterns ?? []).filter(p => p.decision === 'pending' && p.kind !== 'strength').map(p => p.id),
    );
    const pendingPatterns = new Set((fb?.corrections ?? []).map(c => c.patternId).filter(id => pendientes.has(id))).size;
    return {
        scheduleEntry,
        previousEntry: {
            delivered: !!anterior.deliveredAt || !!fb,
            feedback: fb?.none ? 'none' : fb ? 'recorded' : 'awaiting',
            pendingPatterns,
        },
    };
}
