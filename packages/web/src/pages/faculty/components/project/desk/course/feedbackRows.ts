import {
    FEEDBACK_ANCHOR_PAGE_MAX,
    FEEDBACK_ANCHOR_QUOTE_MAX,
    type FeedbackAnchor,
    type FeedbackCorrection,
    type FeedbackCorrectionInput,
    type FeedbackPattern,
    type FeedbackPatternKind,
} from '@dosfilos/domain';
import { matchPattern, patternKindOf } from './pdfFeedback';

/**
 * Las filas de observaciones del diálogo de la devolución: las que se
 * agregan a mano y las que llegan del PDF, con la misma forma. Nada se
 * guarda hasta «Guardar la devolución».
 */

/** El valor del selector que pide escribir el nombre de un patrón nuevo. */
export const NUEVO = '__new';

export interface CorrectionRow {
    key: string;
    /** Corrección o fortaleza: filtra los patrones que se ofrecen y es la clase de uno nuevo. */
    kind: FeedbackPatternKind;
    /** Un patrón existente o `NUEVO`. */
    patternId: string;
    patternName: string;
    note: string;
    /** Dónde: la página impresa y la frase (opcionales). */
    page: string;
    quote: string;
    /** Ya estaba guardada: conserva su id y editar no la duplica. */
    saved: boolean;
}

let seq = 0;
export const nextRowKey = (prefijo = 'nueva') => `${prefijo}-${++seq}`;

/** Los patrones del curso de una clase. */
export const patternsOfKind = (patterns: ReadonlyArray<FeedbackPattern>, kind: FeedbackPatternKind) =>
    patterns.filter(p => patternKindOf(p) === kind);

/** Una fila nueva a mano: el primer patrón de esa clase, o uno nuevo si no hay. */
export function newRow(patterns: ReadonlyArray<FeedbackPattern>, kind: FeedbackPatternKind = 'correction', patch: Partial<CorrectionRow> = {}): CorrectionRow {
    return {
        key: nextRowKey(), kind, patternId: patternsOfKind(patterns, kind)[0]?.id ?? NUEVO,
        patternName: '', note: '', page: '', quote: '', saved: false, ...patch,
    };
}

/** Una corrección guardada como fila: la clase es la de su patrón. */
export function savedRow(c: FeedbackCorrection, patterns: ReadonlyArray<FeedbackPattern>): CorrectionRow {
    const p = patterns.find(x => x.id === c.patternId);
    return {
        key: c.id, kind: p ? patternKindOf(p) : 'correction', patternId: c.patternId, patternName: '',
        note: c.note ?? '', page: c.anchor?.page ?? '', quote: c.anchor?.quote ?? '', saved: true,
    };
}

/**
 * Cambiar la clase de una fila: si el patrón elegido es de la otra clase,
 * una fila nueva pasa al primero de la nueva (o a uno nuevo). Una fila YA
 * GUARDADA pasa a un patrón nuevo por nombre: moverla en silencio al primer
 * patrón de la otra clase la sumaría a uno que el estudiante no eligió. Un
 * patrón nuevo conserva el nombre escrito.
 */
export function withKind(row: CorrectionRow, kind: FeedbackPatternKind, patterns: ReadonlyArray<FeedbackPattern>): CorrectionRow {
    if (row.kind === kind) return row;
    const actual = patterns.find(p => p.id === row.patternId);
    const sigue = row.patternId === NUEVO || (actual && patternKindOf(actual) === kind);
    if (sigue) return { ...row, kind };
    if (row.saved) return { ...row, kind, patternId: NUEVO, patternName: '' };
    return { ...row, kind, patternId: patternsOfKind(patterns, kind)[0]?.id ?? NUEVO };
}

/** El nombre de un patrón nuevo ya lo usa uno de la otra clase: guardarlo así lo sumaría a ese. */
export const nameClash = (row: CorrectionRow, patterns: ReadonlyArray<FeedbackPattern>) =>
    row.patternId === NUEVO ? matchPattern(patterns, row.patternName, row.kind).clash : null;

export function rowIsValid(row: CorrectionRow, patterns: ReadonlyArray<FeedbackPattern>): boolean {
    if (row.patternId !== NUEVO) return patterns.some(p => p.id === row.patternId);
    return !!row.patternName.trim() && !nameClash(row, patterns);
}

/** El ancla de la fila, o nada (Firestore no acepta `undefined`: solo van las claves con valor). */
export function rowAnchor(row: Pick<CorrectionRow, 'page' | 'quote'>): FeedbackAnchor | null {
    const page = row.page.trim().slice(0, FEEDBACK_ANCHOR_PAGE_MAX);
    const quote = row.quote.trim().slice(0, FEEDBACK_ANCHOR_QUOTE_MAX);
    if (!page && !quote) return null;
    return { ...(page ? { page } : {}), ...(quote ? { quote } : {}) };
}

/** Lo que va a `recordFeedback`: con el patrón elegido, o con el nombre y la clase de uno nuevo. */
export function rowToInput(row: CorrectionRow): FeedbackCorrectionInput {
    const anchor = rowAnchor(row);
    return {
        ...(row.saved ? { id: row.key } : {}),
        ...(row.patternId === NUEVO ? { patternName: row.patternName.trim(), patternKind: row.kind } : { patternId: row.patternId }),
        ...(row.note.trim() ? { note: row.note.trim() } : {}),
        ...(anchor ? { anchor } : {}),
    };
}

/** Para saber si hay cambios sin guardar. */
export const rowSnapshot = (r: CorrectionRow) => [r.key, r.kind, r.patternId, r.patternName, r.note, r.page, r.quote];
