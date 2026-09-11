/**
 * Cuántas páginas pedir por llamada, medido del propio documento.
 *
 * EL PROBLEMA QUE RESUELVE. `CHUNK_SIZE_PAGES` era una constante: 60 páginas
 * para todos los libros. Medido sobre tres obras reales, 60 excede el techo de
 * las tres. En treinta días de registros, ninguna extracción batcheada terminó
 * un libro: once arrancadas, una llegó a su segundo bloque, cero completadas.
 *
 * Un número fijo no puede servir a los dos extremos, porque la densidad varía
 * casi un 50% entre obras. Medido con el prompt de producción, sin razonamiento:
 *
 *     Sasson, comentario de Jonás          1 510 tokens/página  → caben 43
 *     Manual del Consejero, prosa           1 328 tokens/página  → caben 49
 *     Barrick, gramática hebrea             1 090 tokens/página  → caben 60, falló por 15 tokens
 *
 * Contraintuitivo y por eso hay que medirlo en vez de deducirlo del tipo de
 * obra: la gramática hebrea es la MENOS densa por página de las tres. Elegir el
 * tamaño por «esto tiene hebreo, será pesado» habría dado justo al revés.
 *
 * POR QUÉ ESTO SÓLO FUNCIONA CON EL RAZONAMIENTO APAGADO. El razonamiento sale
 * del mismo `maxOutputTokens` que el contenido. Medido sobre Barrick en cuatro
 * tamaños, se llevó 1 190, 15 259, 32 584 y 3 657 tokens — entre el 3% y el 50%
 * del presupuesto, sin relación con el tamaño de la tanda ni con la escritura.
 * Contra un presupuesto que comparte con una variable aleatoria de ese tamaño,
 * NINGÚN número calibrado significa nada: la misma tanda del mismo libro entra
 * o no entra según cuánto decida pensar el modelo. Apagado, el contenido resulta
 * estable —Barrick midió entre 1 031 y 1 119 tokens/página en seis llamadas— y
 * recién ahí calibrar tiene sentido.
 */

/** Tope de salida que pide la extracción en cada llamada. */
export const PRESUPUESTO_SALIDA = 65536;

/**
 * Fracción del presupuesto que se deja usar.
 *
 * El contenido por página es estable dentro de un libro (±4% medido en Barrick),
 * pero no uniforme: una página de tablas o de aparato crítico pesa más que una
 * de prosa corrida, y la muestra sale de un solo tramo. El resguardo cubre esa
 * variación más el envoltorio JSON. Sin él, Barrick calibraría en 60 — que es
 * exactamente el número que falló por 15 tokens.
 */
export const RESGUARDO = 0.75;

/**
 * Tamaño de la primera tanda, antes de conocer la densidad.
 *
 * Se elige conservador a propósito: con la densidad más alta que medimos
 * (1 510 tokens/página) son 36 240 tokens, poco más de la mitad del
 * presupuesto. Una primera tanda que falla cuesta el doble —la llamada perdida
 * y el partido— y además deja sin muestra para calibrar el resto.
 */
export const TANDA_INICIAL = 24;

/** Por debajo de esto el sobrecosto de subir el recorte domina la llamada. */
export const MIN_TANDA = 8;

/**
 * Páginas que cada tanda repite de la anterior.
 *
 * Cubre que el modelo trunque la última página de una tanda, que es donde más
 * probable es que lo haga. La copia que vale es la de la tanda SIGUIENTE, donde
 * esa página cae al principio de la ventana en vez de al final.
 */
export const OVERLAP_PAGES = 3;

/**
 * Techo duro. Ninguna obra medida tolera más, y una muestra engañosamente
 * liviana —un tramo de páginas casi vacías, un índice, láminas— no debe
 * autorizar una tanda que el cuerpo del libro no va a sostener.
 */
export const MAX_TANDA = 48;

/**
 * Páginas por tanda a partir de lo que produjo una lectura ya hecha.
 *
 * Devuelve `null` cuando la muestra no sirve para decidir —cero páginas, cifras
 * no finitas, tokens no positivos—. El llamador conserva entonces el tamaño que
 * traía: una calibración inventada sobre una muestra mala es peor que no
 * calibrar, porque se aplica al resto del libro con cara de medida.
 */
export function calibrarPaginasPorTanda(
    tokensDeSalida: number,
    paginasLeidas: number,
): number | null {
    if (!Number.isFinite(tokensDeSalida) || !Number.isFinite(paginasLeidas)) return null;
    if (tokensDeSalida <= 0 || paginasLeidas <= 0) return null;

    const tokensPorPagina = tokensDeSalida / paginasLeidas;
    const caben = Math.floor((PRESUPUESTO_SALIDA * RESGUARDO) / tokensPorPagina);
    if (!Number.isFinite(caben) || caben < 1) return MIN_TANDA;

    return Math.min(MAX_TANDA, Math.max(MIN_TANDA, caben));
}
