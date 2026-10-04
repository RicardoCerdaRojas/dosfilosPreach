import type { InkStroke } from '@dosfilos/domain';
import { sameStroke, toScreenSpace } from '@dosfilos/domain';

/** Lo mínimo que la goma necesita de una nota: su id y sus trazos. */
export interface ErasableNote {
    id: string;
    strokes: InkStroke[];
}

export interface Rect {
    x: number;
    y: number;
    height: number;
}

/** Hasta dónde llega la goma desde el dedo, en puntos de pantalla. */
export const ERASER_RADIUS = 28;

/**
 * El trazo más cercano al punto, si hay alguno al alcance de la goma.
 *
 * Devuelve el TRAZO mismo y no su número: al borrar se corren los números,
 * y un mismo toque repetido mientras la pantalla todavía no se redibujó
 * borraba el trazo vecino (revisión de la fase «Atril: tinta y lectura»).
 * `skip` son los trazos que este gesto ya borró.
 */
export function nearestStroke(
    notes: ErasableNote[],
    rectFor: (note: ErasableNote) => Rect | null,
    bodySize: number,
    x: number,
    y: number,
    skip: ReadonlySet<InkStroke> = new Set(),
): { noteId: string; stroke: InkStroke } | null {
    let best: { noteId: string; stroke: InkStroke } | null = null;
    let bestDistance = ERASER_RADIUS;
    for (const note of notes) {
        const rect = rectFor(note);
        if (!rect) continue;
        for (const stroke of note.strokes) {
            if (skip.has(stroke)) continue;
            for (const point of stroke.points) {
                const screen = toScreenSpace(point, rect, bodySize);
                const distance = Math.hypot(screen.x - x, screen.y - y);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    best = { noteId: note.id, stroke };
                }
            }
        }
    }
    return best;
}

/**
 * La lista de notas sin ese trazo; una nota que se queda sin trazos se va.
 * El trazo se reconoce aunque sea otro objeto (releído de Firestore).
 */
export function withoutStroke<T extends ErasableNote>(notes: T[], noteId: string, stroke: InkStroke): T[] {
    return notes
        .map((note) =>
            note.id === noteId ? { ...note, strokes: note.strokes.filter((s) => !sameStroke(s, stroke)) } : note,
        )
        .filter((note) => note.strokes.length > 0);
}

/** La nota que tiene ese trazo, si alguna. */
export function noteWithStroke<T extends ErasableNote>(notes: readonly T[], stroke: InkStroke): T | null {
    return notes.find((note) => note.strokes.some((s) => sameStroke(s, stroke))) ?? null;
}

/** Vuelve a poner un trazo en su nota, en el lugar que tenía; o la nota entera si ya no estaba. */
export function withStrokeRestored<T extends ErasableNote>(notes: T[], snapshot: T, stroke: InkStroke, index: number): T[] {
    const current = notes.find((n) => n.id === snapshot.id);
    if (!current) return [...notes, { ...snapshot, strokes: [stroke] }];
    if (current.strokes.some((s) => sameStroke(s, stroke))) return notes;
    const strokes = [...current.strokes];
    strokes.splice(Math.min(index, strokes.length), 0, stroke);
    return notes.map((n) => (n.id === snapshot.id ? { ...n, strokes } : n));
}

/** Firma de lo que hay dibujado: qué notas y cuántos trazos. */
export function inkSignature(notes: ErasableNote[]): string {
    return notes.map((note) => `${note.id}:${note.strokes.length}`).join('|');
}

/**
 * ¿Se sigue mostrando el trazo puente?
 *
 * El puente tapa el cuadro vacío entre soltar el dedo y que llegue la nota
 * guardada. Se muestra mientras lo dibujado sea EXACTAMENTE lo que había al
 * soltar. Antes bastaba con «no más trazos que al soltar», y al borrar con
 * la goma el total bajaba y el puente volvía: un trazo fantasma que la goma
 * no podía borrar porque no era una nota (el defecto que vio el fundador).
 */
export function showsBridge(bridgeSignature: string | null, current: string): boolean {
    return bridgeSignature !== null && bridgeSignature === current;
}
