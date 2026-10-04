import type { ReadingBlock } from './sermonReading';

/**
 * Qué bloques NO se pueden separar entre páginas.
 *
 * La paginación por bloques sueltos corta donde no debe: una proposición
 * homilética con sus puntos es UNA unidad de lectura, y partirla entre dos
 * pantallas obliga al predicador a pasar página en medio de la idea. Es la
 * versión de bloque de la misma regla que ya gobierna la oración: la página
 * termina donde termina un pensamiento.
 *
 * REGLAS, en orden de aplicación:
 *
 *  1. Un subtítulo NUNCA cierra página. Un encabezado sin su texto debajo es
 *     un cartel colgado: se pega al bloque que le sigue. (Es la regla clásica
 *     de viudas y huérfanas de la tipografía de libro.)
 *  2. Las viñetas consecutivas van juntas, y arrastran el bloque que las
 *     introduce — "Puntos del Sermón:" y sus puntos son una sola cosa.
 *
 * El resultado son GRUPOS. La paginación los trata como átomos preferidos,
 * pero si un grupo no entra en una página vacía tiene que poder partirlo: es
 * mejor cortar donde no queríamos que perder texto.
 */
export function groupUnbreakableBlocks(blocks: ReadingBlock[]): number[][] {
    const groups: number[][] = [];
    let index = 0;

    while (index < blocks.length) {
        const group = [index];
        let cursor = index;

        // (1) Un subtítulo arrastra lo que sigue hasta incluir contenido real.
        while (cursor < blocks.length - 1 && blocks[cursor]!.kind === 'subheading') {
            cursor += 1;
            group.push(cursor);
        }

        // (2) Las viñetas que vienen a continuación entran al mismo grupo,
        // junto con el bloque que las introduce (ya está en `group`).
        while (cursor < blocks.length - 1 && blocks[cursor + 1]!.kind === 'listitem') {
            cursor += 1;
            group.push(cursor);
        }

        groups.push(group);
        index = cursor + 1;
    }

    return groups;
}
