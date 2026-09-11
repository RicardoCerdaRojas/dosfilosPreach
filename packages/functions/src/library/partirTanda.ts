/**
 * Cuándo vale la pena partir al medio una tanda que no entró.
 *
 * Vivía dentro de `geminiExtraction`, que ya estaba muy por encima del límite
 * de tamaño del repo; sale aquí al agregarle a ese módulo la calibración de
 * tanda. La lógica no cambia.
 *
 * Con la calibración andando esto pasa a ser una red, no el mecanismo
 * principal: el tamaño ya viene medido del documento, y partir es lo que queda
 * para el tramo atípico que la muestra no representó.
 */

/**
 * Mínimo de páginas por tanda al subdividir.
 *
 * Por debajo de esto ya no es un problema de tamaño: si tres páginas de un
 * libro no entran en una respuesta, el problema es otro y seguir partiendo sólo
 * gasta llamadas.
 */
export const MIN_PAGINAS_POR_TANDA = 4;

/**
 * Si un fallo de lectura se arregla partiendo la tanda al medio.
 *
 * Sólo cuando la respuesta NO ENTRÓ. Otros fallos —un PDF corrupto, la API
 * caída, el JSON irrecuperable— no mejoran con tandas más chicas, y reintentar
 * con la mitad gasta páginas del usuario para volver a fallar.
 *
 * Y sólo mientras quede algo que partir: si cuatro páginas no entran, el
 * problema es otro.
 */
export function convieneParir(err: unknown, paginasEnLaTanda: number): boolean {
    const msg = String((err as Error)?.message ?? err);
    const noEntro = /MAX_TOKENS|truncated/i.test(msg);
    return noEntro && paginasEnLaTanda >= MIN_PAGINAS_POR_TANDA * 2;
}
