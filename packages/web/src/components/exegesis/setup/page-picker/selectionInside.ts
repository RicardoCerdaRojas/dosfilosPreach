/**
 * ¿La selección empieza Y termina dentro de la hoja? (TP #8, #38; fase 8b,
 * D6). Se miraba sólo el comienzo (`anchorNode`): una selección que empezaba
 * en la hoja y terminaba en el panel de al lado se aceptaba, y «Citar» pegaba
 * texto de la interfaz junto con el del libro.
 */
export function selectionInside(sel: Selection | null, el: HTMLElement | null): boolean {
    if (!sel || sel.isCollapsed || !el) return false;
    if (!sel.anchorNode || !sel.focusNode) return false;
    return el.contains(sel.anchorNode) && el.contains(sel.focusNode);
}
