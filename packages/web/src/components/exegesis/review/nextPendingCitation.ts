/**
 * La cita que sigue para revisar, después de la que se acaba de revisar.
 *
 * La que sigue en la lista y todavía sin revisar; al llegar al final vuelve
 * al principio. `null` cuando no queda ninguna. La recién revisada se excluye
 * aunque la lista de revisiones todavía no la traiga: se actualiza un instante
 * después de guardar.
 */
export function nextPendingCitation(
    listed: ReadonlyArray<string>,
    reviewed: ReadonlySet<string>,
    current: string,
): string | null {
    const desde = listed.indexOf(current);
    const orden = desde < 0 ? listed : [...listed.slice(desde + 1), ...listed.slice(0, desde)];
    return orden.find(p => p !== current && !reviewed.has(p)) ?? null;
}

/**
 * Qué cita queda abierta después de guardar una revisión.
 *
 * Se avanza sólo la PRIMERA vez que se revisa (actualizar una nota no es
 * terminar con la cita) y sólo si el autor sigue en ella: si mientras se
 * guardaba ya abrió otra, no se lo saca de ahí.
 */
export function selectionAfterReview(args: {
    listed: ReadonlyArray<string>;
    reviewed: ReadonlySet<string>;
    path: string;
    wasNew: boolean;
    note: string;
}): (actual: string | null) => string | null {
    const { listed, reviewed, path, wasNew, note } = args;
    if (!note.trim() || !wasNew) return actual => actual;
    const siguiente = nextPendingCitation(listed, reviewed, path);
    return actual => (actual === path ? siguiente : actual);
}
