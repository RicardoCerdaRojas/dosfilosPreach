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

/**
 * Arma las páginas del atril con las alturas ya medidas.
 *
 * Empaqueta GRUPOS (`groupUnbreakableBlocks`), nunca parte uno que entra en
 * una página vacía, y si un grupo no entra ni así lo reparte por bloques.
 *
 * `firstPageCapacity`: la primera página lleva arriba el título del sermón y
 * el del movimiento, y antes no se descontaban — la primera página de cada
 * movimiento se pasaba del alto y había que scrollear (A7). Si el primer
 * grupo no entra debajo de los títulos pero sí en una página entera, la
 * primera página queda sólo con los títulos: mejor eso que cortar la idea.
 *
 * Sin bloques no hay páginas; el que llama muestra el movimiento con su
 * título igual.
 */
export function packPages(
    groups: readonly number[][],
    heights: readonly number[],
    capacity: number,
    firstPageCapacity: number = capacity,
): number[][] {
    if (capacity <= 0) return [];
    const pages: number[][] = [];
    let current: number[] = [];
    let used = 0;
    const room = () => (pages.length === 0 ? firstPageCapacity : capacity);
    const flush = () => {
        pages.push(current);
        current = [];
        used = 0;
    };

    for (const group of groups) {
        const groupHeight = group.reduce((sum, i) => sum + (heights[i] ?? 0), 0);
        if (used + groupHeight <= room()) {
            current.push(...group);
            used += groupHeight;
            continue;
        }
        if (groupHeight <= capacity) {
            flush();
            current.push(...group);
            used = groupHeight;
            continue;
        }
        // Ni en una página vacía: se reparte por bloques.
        for (const index of group) {
            const height = heights[index] ?? 0;
            if (used + height > room() && current.length > 0) flush();
            current.push(index);
            used += height;
        }
    }
    if (current.length) pages.push(current);
    return pages;
}
