/**
 * Cuándo la explicación del paper, adaptada por el pastor, puede pasar a su
 * estudio de palabra (#28 del ejercicio de Jonás 4:5-11).
 *
 * El fundador: «que levante un modal para que el pastor adapte el texto y
 * sólo vaya su descubrimiento. La idea de tomar el texto del estudio es
 * reutilizar partes». La explicación llega entera; lo que no puede pasar es
 * el texto del paper tal cual, porque entonces el estudio no es del pastor.
 * Cambiar sólo espacios o saltos de línea tampoco lo hace suyo.
 */
export type AdaptedDiscoveryState = 'ready' | 'unchanged' | 'too-short';

/**
 * Cuánto tiene que cambiar para ser suyo. Quitar un punto bastaba, y el texto
 * del paper entraba al borrador como voz del pastor (revisión adversarial de
 * F1). Cuenta como adaptado si escribió algo propio —al menos
 * `MIN_OWN_WORDS` palabras que el paper no tenía— o si se quedó con partes:
 * a lo sumo `MAX_KEPT_SHARE` de las palabras del original.
 */
export const MIN_OWN_WORDS = 3;
export const MAX_KEPT_SHARE = 0.7;

const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

export function adaptedDiscoveryState(original: string, edited: string, minChars: number): AdaptedDiscoveryState {
    const antes = words(original);
    const despues = words(edited);
    const delPaper = new Set(antes);
    const propias = despues.filter(w => !delPaper.has(w)).length;
    const seQuedoConPartes = despues.length <= antes.length * MAX_KEPT_SHARE;
    if (propias < MIN_OWN_WORDS && !seQuedoConPartes) return 'unchanged';
    if (edited.trim().length < minChars) return 'too-short';
    return 'ready';
}
