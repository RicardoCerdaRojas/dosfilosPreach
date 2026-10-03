/**
 * Las observaciones del paso Insight como casillas (#30 del ejercicio de
 * Jonás 4:5-11).
 *
 * El paso pedía 3 observaciones y mostraba sólo un botón «Agregar» al lado de
 * la etiqueta: el fundador escribió en la caja de la «Pregunta abierta»
 * creyendo que era la de las observaciones. Ahora las 3 casillas que pide el
 * mínimo están siempre a la vista; las que no se escribieron no existen en el
 * documento hasta que el pastor escribe en ellas.
 */

/** Lo que se muestra: lo escrito, completado con casillas vacías hasta el mínimo. */
export function observationSlots(observations: ReadonlyArray<string>, min: number): string[] {
    const slots = [...observations];
    while (slots.length < min) slots.push('');
    return slots;
}

/** Escribir en la casilla `i`; las vacías de antes se crean para que el número se mantenga. */
export function writeObservation(observations: ReadonlyArray<string>, i: number, value: string): string[] {
    const next = [...observations];
    while (next.length <= i) next.push('');
    next[i] = value;
    return next;
}

/**
 * Se puede quitar una casilla sólo si sobra: por debajo del mínimo la
 * papelera dejaría al pastor con menos cajas de las que el paso le pide.
 */
export function canRemoveObservation(observations: ReadonlyArray<string>, min: number): boolean {
    return observations.length > min;
}

/** Cuántas ya cumplen el largo mínimo: el «N de 3» del encabezado. */
export function readyObservations(observations: ReadonlyArray<string>, minChars: number): number {
    return observations.filter(o => o.trim().length >= minChars).length;
}
