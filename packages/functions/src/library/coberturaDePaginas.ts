/**
 * ¿Las páginas que volvieron cubren el documento?
 *
 * Vivía dentro de `geminiExtraction`, que ya estaba muy por encima del límite
 * de tamaño del repo; sale aquí al agregarle a ese módulo la calibración de
 * tanda. La lógica no cambia.
 */

/**
 * Proporción mínima de páginas que debe volver para dar la extracción por
 * buena.
 *
 * Estaba en 0,80 y dejó pasar un caso real: la gramática hebrea de Barrick, de
 * 170 páginas, volvió con 138 —81%, cortada en la 138 y sin las últimas 32— y
 * el libro entró al corpus como completo. Se citó 32 veces en un trabajo
 * entregado. Nadie se enteró, porque un 81% supera un piso de 80.
 *
 * Perder una de cada cinco páginas no es una extracción aceptable con un
 * defecto menor: es un libro distinto. El piso sube a 0,95 y, sobre todo, ya no
 * es lo único que se mira —ver `verificarCobertura`, que detecta el corte al
 * final aunque el total alcance—.
 */
export const MIN_PAGE_COVERAGE = 0.95;

/**
 * Verifica que las páginas devueltas cubran el documento, no sólo que sean
 * suficientes.
 *
 * La proporción sola no distingue dos cosas muy distintas: un libro al que le
 * faltan páginas sueltas —recuperable, y el resto sirve— de uno CORTADO, al que
 * le falta todo un final. Barrick fue lo segundo: 138 páginas seguidas y nada
 * después de la 138, con cero huecos internos. Una gramática sin su último
 * quinto es una gramática a la que le faltan los capítulos avanzados, que son
 * justamente los que se citan.
 */
export function verificarCobertura(
    paginas: ReadonlyArray<{ page: number }>,
    esperadas: number,
): { ok: true } | { ok: false; motivo: string } {
    if (esperadas <= 0) return { ok: true };
    if (paginas.length === 0) return { ok: false, motivo: 'no volvió ninguna página' };

    const cobertura = paginas.length / esperadas;
    if (cobertura < MIN_PAGE_COVERAGE) {
        return {
            ok: false,
            motivo: `volvieron ${paginas.length} de ${esperadas} páginas (${Math.round(cobertura * 100)}%)`,
        };
    }

    // Corte al final: la última página con texto queda lejos del final del
    // documento. Se mira aunque la proporción alcance, porque un libro largo
    // puede perder su cierre y seguir pasando el porcentaje.
    const ultima = Math.max(...paginas.map(p => p.page));
    if (esperadas - ultima > Math.max(2, Math.ceil(esperadas * 0.02))) {
        return {
            ok: false,
            motivo: `cortada en la página ${ultima} de ${esperadas}: faltan las últimas ${esperadas - ultima}`,
        };
    }
    return { ok: true };
}
