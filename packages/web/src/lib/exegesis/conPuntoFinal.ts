/**
 * Un rótulo que cierra con punto, salvo que ya traiga uno: «…legislador y
 * juez.» salía «…legislador y juez..» en la vista del análisis (TP #9, B34).
 */
export function conPuntoFinal(texto: string): string {
    const t = (texto ?? '').trimEnd();
    return !t || /[.!?…:;]$/u.test(t) ? t : `${t}.`;
}
