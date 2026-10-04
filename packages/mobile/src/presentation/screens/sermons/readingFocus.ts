import type { ReadingBlockKind } from '@dosfilos/domain';

/**
 * Foco de lectura (L-3 de la fase «Atril: tinta y lectura»).
 *
 * Leer en público es leer una frase, levantar la vista y decirla, y volver. Lo
 * que cuesta es VOLVER: encontrar dónde se iba. Con el foco encendido el
 * párrafo en curso queda a pleno contraste y el resto atenuado, y avanzar
 * mueve el foco por idea antes de pasar la página.
 *
 * Un subtítulo no es una parada: va con el párrafo que encabeza.
 */

/** Los bloques donde el foco se detiene. */
export function focusTargets(kinds: readonly ReadingBlockKind[]): number[] {
    return kinds.flatMap((kind, i) => (kind === 'subheading' ? [] : [i]));
}

/**
 * Un paso del foco. `turn` dice si hay que pasar de página (y hacia dónde);
 * en ese caso el foco de la página nueva lo decide quien llama: el primero
 * al avanzar, el último al retroceder.
 */
export function stepFocus(
    kinds: readonly ReadingBlockKind[],
    focus: number | null,
    delta: 1 | -1,
): { focus: number | null; turn: -1 | 0 | 1 } {
    const targets = focusTargets(kinds);
    if (!targets.length) return { focus: null, turn: delta };
    const at = focus === null ? -1 : targets.indexOf(focus);
    // Sin foco todavía: avanzar lo pone en el primero; retroceder pasa de página.
    if (at === -1) return delta > 0 ? { focus: targets[0]!, turn: 0 } : { focus: null, turn: -1 };
    const next = at + delta;
    if (next < 0 || next >= targets.length) return { focus, turn: delta };
    return { focus: targets[next]!, turn: 0 };
}

/** Dónde queda el foco al llegar a una página: arriba al avanzar, abajo al retroceder. */
export function focusOnArrival(kinds: readonly ReadingBlockKind[], from: 1 | -1): number | null {
    const targets = focusTargets(kinds);
    if (!targets.length) return null;
    return from > 0 ? targets[0]! : targets[targets.length - 1]!;
}

/** ¿Este bloque va atenuado? El subtítulo del párrafo en foco, no. */
export function isDimmed(kinds: readonly ReadingBlockKind[], focus: number | null, index: number): boolean {
    if (focus === null || index === focus) return false;
    if (kinds[index] === 'subheading') {
        const next = focusTargets(kinds).find((t) => t > index);
        return next !== focus;
    }
    return true;
}
