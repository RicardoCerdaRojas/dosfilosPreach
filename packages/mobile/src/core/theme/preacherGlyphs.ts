import type { PreacherGlyph } from '@dosfilos/domain';

/**
 * Cómo se dibuja cada marca de predicador (C7). Símbolos y no íconos: van
 * DENTRO del texto, sobre la palabra, como el lápiz en el papel, y se leen
 * igual en tinta electrónica.
 *
 * - pausa ‖: las dos rayas del atril de siempre;
 * - énfasis ▲ y bajar la voz ▼: subir y bajar, un par que se lee solo;
 * - mirar a la congregación ◉: el ojo;
 * - ilustración ✦: «aquí va la historia».
 */
export const GLYPH_SYMBOL: Record<PreacherGlyph, string> = {
    pause: '‖',
    emphasis: '▲',
    soft: '▼',
    look: '◉',
    illustration: '✦',
};
