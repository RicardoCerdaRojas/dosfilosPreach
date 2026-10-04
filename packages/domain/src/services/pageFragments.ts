import { groupUnbreakableBlocks } from './pageGrouping';
import type { ReadingBlock } from './sermonReading';

/**
 * Paginación por ORACIÓN (fase «Atril: tinta y lectura», L-1).
 *
 * El atril paginaba por párrafo entero: si un párrafo largo no entraba en lo
 * que quedaba de la página, pasaba completo a la siguiente y dejaba 1/3 o 2/3
 * en blanco (lo vio el fundador en su iPad). La regla del atril nunca fue
 * «no partir un párrafo» sino «no partir una ORACIÓN»: la página termina
 * donde termina un pensamiento, y una oración lo es.
 *
 * Una página es una lista de FRAGMENTOS: un bloque entero, o un tramo de sus
 * oraciones `[from, to)`.
 *
 * DE DÓNDE SALEN LAS ALTURAS. La medición fuera de pantalla da, por bloque,
 * su alto y —si se puede partir— dónde empieza y termina el renglón de cada
 * oración. Con eso:
 * - la cabeza de un párrafo partido mide exacto: son los mismos renglones;
 * - la cola mide A LO SUMO lo que quedaba desde el renglón donde arranca su
 *   primera oración. Al quedar sola esa oración arranca en el margen y los
 *   renglones sólo pueden acortarse. Es una cota por arriba: la página nunca
 *   se pasa del alto, a lo sumo sobra un poco.
 */

/** Renglones de una oración dentro de su bloque, medidos desde el borde de arriba del bloque. */
export interface UnitMetric {
    top: number;
    bottom: number;
}

export interface BlockMetrics {
    height: number;
    /** Sólo si el bloque se puede partir y ya se midió. */
    units?: UnitMetric[];
}

export interface PageFragment {
    block: number;
    /** Primera oración (incluida). */
    from: number;
    /** Última oración (excluida). */
    to: number;
}

/** Sólo la prosa y las viñetas se parten entre oraciones; un subtítulo o una cita colapsada, no. */
export function isSplittable(block: ReadingBlock): boolean {
    return (block.kind === 'paragraph' || block.kind === 'listitem') && block.units.length >= 2;
}

const whole = (blocks: readonly ReadingBlock[], index: number): PageFragment => ({
    block: index,
    from: 0,
    to: blocks[index]!.units.length,
});

export function fragmentHeight(
    blocks: readonly ReadingBlock[],
    metrics: readonly BlockMetrics[],
    fragment: PageFragment,
): number {
    const block = blocks[fragment.block]!;
    const m = metrics[fragment.block];
    if (!m) return 0;
    const n = block.units.length;
    const units = m.units;
    if ((fragment.from === 0 && fragment.to === n) || !units || units.length !== n) return m.height;
    // Lo que el bloque deja arriba del primer renglón y debajo del último (márgenes).
    const lead = units[0]!.top;
    const trail = m.height - units[n - 1]!.bottom;
    const top = fragment.from === 0 ? 0 : units[fragment.from]!.top - lead;
    const bottom = fragment.to === n ? m.height : units[fragment.to - 1]!.bottom + trail;
    // Una cola que arranca en el PRIMER renglón del bloque: ese renglón tenía
    // más ancho (la sangría francesa lo saca al margen) y la cola, que ya no
    // es comienzo de párrafo, no lo tiene. Puede necesitar un renglón más.
    const startsOnFirstLine = fragment.from > 0 && units[fragment.from]!.top === units[0]!.top;
    const slack = startsOnFirstLine ? units[0]!.bottom - units[0]!.top : 0;
    return Math.max(0, bottom - top + slack);
}

/** El bloque de un fragmento, listo para dibujar. `continued`: no es el comienzo del bloque. */
export function fragmentBlock(block: ReadingBlock, fragment: PageFragment): ReadingBlock & { continued: boolean } {
    if (fragment.from === 0 && fragment.to === block.units.length) return { ...block, continued: false };
    const units = block.units.slice(fragment.from, fragment.to);
    return { ...block, units, text: units.map((u) => u.text).join(' '), continued: fragment.from > 0 };
}

/**
 * Arma las páginas, con las reglas de la paginación por párrafo —grupos que no se separan,
 * primera página con menos lugar por los títulos, que puede quedar con los
 * títulos solos (A7)— más una: si un grupo
 * no entra en lo que queda, se corta su ÚLTIMO bloque entre oraciones para
 * llenar la página, en vez de mandarlo entero a la siguiente.
 *
 * Por qué sólo el último bloque del grupo. Un subtítulo con su párrafo se
 * puede cortar dentro del párrafo (el subtítulo nunca queda solo al pie).
 * Una introducción con sus viñetas («Puntos del sermón: I, II, III») es una
 * unidad de lectura: no se reparte para rellenar, se pasa entera. Sólo si
 * no entra ni en una página vacía se corta donde haga falta.
 */
export function packFragments(
    blocks: readonly ReadingBlock[],
    metrics: readonly BlockMetrics[],
    capacity: number,
    firstPageCapacity: number = capacity,
): PageFragment[][] {
    if (capacity <= 0 || blocks.length === 0) return [];
    const height = (fragments: PageFragment[]) =>
        fragments.reduce((sum, f) => sum + fragmentHeight(blocks, metrics, f), 0);

    /**
     * La parte de `group` que entra en `space`, cortada entre oraciones.
     * `anywhere`: el grupo no entra ni en una página vacía, se puede cortar
     * en cualquier bloque.
     */
    const splitToFit = (group: PageFragment[], space: number, anywhere: boolean) => {
        let used = 0;
        for (let j = 0; j < group.length; j += 1) {
            const f = group[j]!;
            const fh = fragmentHeight(blocks, metrics, f);
            if (used + fh <= space) {
                used += fh;
                continue;
            }
            // Para rellenar sólo se corta un párrafo, solo o con su subtítulo.
            // Una introducción con sus viñetas no se reparte.
            const onlyTitlesBefore = group.slice(0, j).every((g) => blocks[g.block]!.kind === 'subheading');
            const canCut =
                (anywhere || (j === group.length - 1 && onlyTitlesBefore)) &&
                isSplittable(blocks[f.block]!) &&
                f.to - f.from >= 2;
            if (canCut) {
                for (let k = f.to - 1; k > f.from; k -= 1) {
                    const head = { ...f, to: k };
                    if (used + fragmentHeight(blocks, metrics, head) <= space) {
                        return {
                            head: [...group.slice(0, j), head],
                            tail: [{ ...f, from: k }, ...group.slice(j + 1)],
                        };
                    }
                }
            }
            // Sin métricas de oraciones, `fragmentHeight` da el bloque entero
            // para cualquier tramo y ningún corte entra: el bloque no se parte.
            if (anywhere && j > 0) return { head: group.slice(0, j), tail: group.slice(j) };
            return null;
        }
        return null;
    };

    const pages: PageFragment[][] = [];
    let current: PageFragment[] = [];
    let used = 0;
    const room = () => (pages.length === 0 ? firstPageCapacity : capacity);
    const flush = () => {
        pages.push(current);
        current = [];
        used = 0;
    };

    const queue: PageFragment[][] = groupUnbreakableBlocks([...blocks]).map((g) => g.map((i) => whole(blocks, i)));
    while (queue.length) {
        const group = queue.shift()!;
        const groupHeight = height(group);
        if (used + groupHeight <= room()) {
            current.push(...group);
            used += groupHeight;
            continue;
        }
        // Llenar lo que queda con la cabeza del grupo, cortada entre oraciones.
        const cut = splitToFit(group, room() - used, false);
        if (cut) {
            current.push(...cut.head);
            flush();
            queue.unshift(cut.tail);
            continue;
        }
        if (current.length > 0) {
            flush();
            queue.unshift(group);
            continue;
        }
        // Página vacía. La primera puede quedar sólo con los títulos si ni una
        // oración entra debajo y el grupo sí entra en una página entera.
        if (pages.length === 0 && room() < capacity && groupHeight <= capacity) {
            flush();
            queue.unshift(group);
            continue;
        }
        const forced = splitToFit(group, room(), true);
        if (forced) {
            current.push(...forced.head);
            flush();
            queue.unshift(forced.tail);
            continue;
        }
        // Debajo de los títulos no entra ni una oración: la primera página
        // queda con los títulos solos y el texto va a páginas enteras. Sin
        // esto, un bloque que no se puede partir terminaba montado encima de
        // los títulos (la regla A7, que sólo cubría `packPages`).
        if (pages.length === 0 && room() < capacity) {
            flush();
            queue.unshift(group);
            continue;
        }
        // Ni una oración entra en una página vacía: va sola y esa página se
        // desplaza. Es preferible a perder texto (y en prosa de sermón es raro).
        current.push(group[0]!);
        flush();
        if (group.length > 1) queue.unshift(group.slice(1));
    }
    if (current.length) pages.push(current);
    return pages;
}
