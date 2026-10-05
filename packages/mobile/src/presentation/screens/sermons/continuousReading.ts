import type { ReadingBlockKind } from '@dosfilos/domain';

import { stepFocus } from './readingFocus';

/**
 * El sermón continuo (fase «Atril continuo»): el sermón entero como un solo
 * documento que se desplaza, en vez de páginas. Es una OPCIÓN: las páginas
 * tienen a favor que el texto no se mueve y el ojo que vuelve del público lo
 * encuentra donde lo dejó; hay predicadores que prefieren igual lo continuo.
 *
 * Todo en coordenadas del CONTENIDO desplazable: 0 es el comienzo del
 * documento, no el borde de la pantalla.
 */

/** Dónde se lee dentro de la pantalla: a un tercio. Ahí se decide «en qué movimiento estoy». */
export const READING_LINE_RATIO = 0.3;

/**
 * El movimiento que se está leyendo: el último cuyo comienzo ya pasó la línea
 * de lectura. Antes del primero, `-1` (la Lectura, si la hay).
 */
export function sectionAtLine(tops: readonly number[], line: number): number {
    // Corre en el hilo de la interfaz, mientras se desplaza.
    'worklet';
    let at = -1;
    for (let i = 0; i < tops.length; i++) {
        if (tops[i]! <= line) at = i;
    }
    return at;
}

/**
 * Cuánto del movimiento quedó atrás (0 a 1): alimenta el «vas bien / vas
 * atrasado» del reloj, que en páginas sale de la página en curso.
 */
export function progressInSection(tops: readonly number[], index: number, line: number, contentEnd: number): number {
    'worklet';
    const top = tops[index];
    if (top === undefined) return 0;
    const end = tops[index + 1] ?? contentEnd;
    if (end <= top) return 0;
    return Math.min(1, Math.max(0, (line - top) / (end - top)));
}

/** Hasta dónde se puede desplazar: el final del documento al pie de la pantalla. */
export function maxScroll(contentHeight: number, viewport: number): number {
    'worklet';
    return Math.max(0, contentHeight - viewport);
}

/**
 * Dónde se está leyendo: el movimiento y cuánto de él (en `steps` tramos).
 *
 * Con el documento bajado hasta el final, el que se lee es el ÚLTIMO, aunque
 * su comienzo no llegue a la línea de lectura: una conclusión de menos de dos
 * tercios de pantalla no la cruzaba nunca, y el reloj le cargaba su tiempo al
 * movimiento anterior (revisión adversarial).
 */
export function trackedPlace(
    tops: readonly number[],
    scroll: number,
    viewport: number,
    contentHeight: number,
    steps: number,
): { at: number; step: number } | null {
    'worklet';
    if (!tops.length) return null;
    const atEnd = contentHeight > viewport && scroll >= maxScroll(contentHeight, viewport) - 1;
    const line = scroll + viewport * READING_LINE_RATIO;
    const at = atEnd ? tops.length - 1 : sectionAtLine(tops, line);
    const progress = atEnd ? 1 : at < 0 ? 0 : progressInSection(tops, at, line, contentHeight);
    return { at, step: Math.min(steps - 1, Math.floor(progress * steps)) };
}

/**
 * A dónde lleva un toque en el costado: casi una pantalla, dejando a la vista
 * `overlap` de lo que ya se veía (dos renglones). Así el ojo encuentra arriba
 * lo último que leyó abajo, en vez de saltar a ciegas.
 */
export function screenStep(
    scroll: number,
    viewport: number,
    contentHeight: number,
    overlap: number,
    towards: 1 | -1,
): number {
    const stride = Math.max(viewport * 0.5, viewport - overlap);
    return Math.min(maxScroll(contentHeight, viewport), Math.max(0, scroll + towards * stride));
}

/** Arriba y abajo de un bloque en el documento; `null` si todavía no se midió. */
export type BlockBox = { top: number; bottom: number } | null;

/**
 * Un paso del foco de lectura (L-3) en el sermón continuo.
 *
 * Igual que en páginas, avanzar recorre las ideas una por una. Lo que en
 * páginas era «pasar la página» acá es desplazar: sólo cuando la idea
 * siguiente no entra entera en la pantalla, y entonces queda ARRIBA, con un
 * renglón de aire (`lead`). Un párrafo más alto que la pantalla se recorre
 * de a pantallas antes de soltar el foco: si no, su final se saltaba.
 *
 * Sin foco todavía, avanzar lo pone en la primera idea a la vista;
 * retroceder sube una pantalla.
 */
export function continuousFocusStep(
    kinds: readonly ReadingBlockKind[],
    boxes: readonly BlockBox[],
    focus: number | null,
    towards: 1 | -1,
    view: { scroll: number; height: number; contentHeight: number },
    lead: number,
    overlap: number,
): { focus: number | null; scrollTo: number | null } {
    const viewTop = view.scroll;
    const viewBottom = view.scroll + view.height;
    const clamp = (y: number) => Math.min(maxScroll(view.contentHeight, view.height), Math.max(0, y));
    const screen = () => screenStep(view.scroll, view.height, view.contentHeight, overlap, towards);

    if (focus === null) {
        if (towards < 0) return { focus: null, scrollTo: screen() };
        const firstVisible = kinds.findIndex((kind, i) => {
            const box = boxes[i];
            return kind !== 'subheading' && !!box && box.bottom > viewTop + 1;
        });
        if (firstVisible === -1) return { focus: null, scrollTo: screen() };
        return { focus: firstVisible, scrollTo: null };
    }

    // Un bloque que no entra en la pantalla se termina de recorrer primero.
    const current = boxes[focus];
    if (current && towards > 0 && current.bottom > viewBottom + 1) return { focus, scrollTo: screen() };
    if (current && towards < 0 && current.top < viewTop - 1) return { focus, scrollTo: screen() };

    // La idea siguiente que se pueda ubicar. Una sin medir (una cita plegada
    // es un renglón que se toca, no un párrafo) se salta: el foco caía fuera
    // de la pantalla sin desplazar, y todo lo visible quedaba atenuado.
    let moved = stepFocus(kinds, focus, towards);
    while (moved.turn === 0 && moved.focus !== null && !boxes[moved.focus]) {
        moved = stepFocus(kinds, moved.focus, towards);
    }
    // En el borde del sermón el foco se queda donde está.
    if (moved.turn !== 0 || moved.focus === null) return { focus, scrollTo: null };
    const box = boxes[moved.focus]!;
    if (box.top >= viewTop - 1 && box.bottom <= viewBottom + 1) return { focus: moved.focus, scrollTo: null };
    if (towards > 0) return { focus: moved.focus, scrollTo: clamp(box.top - lead) };
    // Volviendo: la idea anterior queda ABAJO, que es donde estaba al leerla.
    const tall = box.bottom - box.top > view.height - lead;
    return { focus: moved.focus, scrollTo: clamp(tall ? box.top - lead : box.bottom - view.height + lead) };
}
