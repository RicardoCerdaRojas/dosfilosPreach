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
    return salidaCortada(err) && paginasEnLaTanda >= MIN_PAGINAS_POR_TANDA * 2;
}

/**
 * ¿La respuesta del modelo se cortó por falta de salida?
 *
 * Es la señal de que las páginas pedidas no ENTRAN en una respuesta, no de que
 * el libro sea ilegible. Quien la recibe tiene que achicar lo que pide —partir
 * la tanda, o mandar el libro a la cola— y no caer a la capa de texto, que es
 * justo lo que la visión venía a evitar.
 */
export function salidaCortada(err: unknown): boolean {
    return /MAX_TOKENS|truncated/i.test(String((err as Error)?.message ?? err));
}
