import type { FeedbackPattern } from '@dosfilos/domain';
import type { PdfFeedbackNote } from '@/lib/pdf/readPdfAnnotations';
import type { FeedbackChoice } from './FeedbackKindChoice';
import { NUEVO, nextRowKey, type CorrectionRow } from './feedbackRows';
import { matchPattern, proposeFeedbackKind, suggestPatternName, type FeedbackKindProposal } from './pdfFeedback';

/** Un comentario leído del PDF, mientras el estudiante lo clasifica. */
export interface PdfImportRow {
    key: string;
    note: PdfFeedbackNote;
    /** Lo que propuso el texto (se muestra; la elección es `choice`). */
    proposal: FeedbackKindProposal;
    choice: FeedbackChoice;
    /** El nombre del patrón: sigue al comentario hasta que el estudiante lo toca. */
    name: string;
    nameTouched: boolean;
    /** La nota: el comentario del profesor, editable. */
    comment: string;
    /** Sumar a un patrón existente de la misma clase (ofrecido, no impuesto). */
    reuseId: string | null;
}

export function importRowFromNote(note: PdfFeedbackNote): PdfImportRow {
    const proposal = proposeFeedbackKind(note.text);
    return {
        key: nextRowKey('pdf'), note, proposal, choice: proposal.kind,
        name: suggestPatternName(note.text), nameTouched: false, comment: note.text, reuseId: null,
    };
}

/** Editar el comentario mueve el nombre propuesto mientras el estudiante no lo haya escrito. */
export function withComment(row: PdfImportRow, comment: string): PdfImportRow {
    return { ...row, comment, ...(row.nameTouched ? {} : { name: suggestPatternName(comment) }) };
}

/** El patrón al que se suma: el elegido, o el que ya tiene ese mismo nombre y clase. */
export function importTarget(row: PdfImportRow, patterns: ReadonlyArray<FeedbackPattern>): FeedbackPattern | null {
    if (row.choice === 'ignore') return null;
    const elegido = row.reuseId ? patterns.find(p => p.id === row.reuseId) ?? null : null;
    return elegido ?? matchPattern(patterns, row.name, row.choice).same;
}

/** Qué le falta a una fila para agregarse: el comentario (una marca sin texto) o el nombre. */
export function importRowProblem(row: PdfImportRow, patterns: ReadonlyArray<FeedbackPattern>): 'comment' | 'name' | 'clash' | null {
    if (row.choice === 'ignore') return null;
    if (!row.comment.trim()) return 'comment';
    if (importTarget(row, patterns)) return null;
    if (!row.name.trim()) return 'name';
    return matchPattern(patterns, row.name, row.choice).clash ? 'clash' : null;
}

/** La fila del registro: con su clase, su patrón (existente o nuevo por nombre) y su ancla. */
export function importRowToCorrection(row: PdfImportRow, patterns: ReadonlyArray<FeedbackPattern>): CorrectionRow | null {
    if (row.choice === 'ignore' || importRowProblem(row, patterns)) return null;
    const destino = importTarget(row, patterns);
    return {
        key: nextRowKey(), kind: row.choice, patternId: destino?.id ?? NUEVO, patternName: destino ? '' : row.name.trim(),
        note: row.comment.trim(), page: row.note.page, quote: row.note.quote ?? '', saved: false,
    };
}

/** Una marca sin texto todavía sin escribir (un trazo, un resaltado sin comentario). */
export const isBlankMark = (row: PdfImportRow) => row.choice !== 'ignore' && row.proposal.reason === 'empty' && !row.comment.trim();

/**
 * Lo que «Agregar al registro» puede pasar ya y lo que queda en el panel:
 * las completas pasan; las incompletas se quedan con su aviso (un PDF con
 * muchos trazos sin texto no bloquea las demás); las ignoradas se van.
 */
export function splitReady(rows: ReadonlyArray<PdfImportRow>, patterns: ReadonlyArray<FeedbackPattern>): { ready: CorrectionRow[]; rest: PdfImportRow[] } {
    const ready: CorrectionRow[] = [];
    const rest: PdfImportRow[] = [];
    for (const r of rows) {
        if (r.choice === 'ignore') continue;
        const c = importRowToCorrection(r, patterns);
        if (c) ready.push(c); else rest.push(r);
    }
    return { ready, rest };
}
