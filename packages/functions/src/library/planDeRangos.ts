/**
 * En qué rangos de páginas se parte un libro, y cuál viene después de cuál.
 *
 * POR QUÉ ES UN MÓDULO PROPIO. La extracción en cola recorre el libro como una
 * CADENA: cada tarea lee un rango y encola la siguiente. Ninguna tarea ve el
 * plan completo —nace sabiendo sólo dónde empieza y dónde termina lo suyo—, así
 * que «cuál sigue» tiene que ser una función pura del rango anterior y del
 * tamaño, calculable sin leer nada.
 *
 * POR QUÉ CADENA Y NO ABANICO. El tamaño de tanda se MIDE del primer rango
 * (ver `calibrarTanda`). Un abanico tendría que encolar todos los rangos antes
 * de conocer ese número, es decir adivinándolo — que es exactamente lo que se
 * eliminó al medirlo. La cadena paga reloj de pared y a cambio cada rango se
 * dimensiona con lo aprendido del anterior.
 */

import { OVERLAP_PAGES } from './calibrarTanda';

export interface Rango {
    /** Primera página del rango, 1-indexada e inclusive. */
    desde: number;
    /** Última página del rango, inclusive. */
    hasta: number;
}

/**
 * El rango que sigue a uno que acaba de terminar.
 *
 * Devuelve `null` cuando el anterior ya tocó el final del libro: eso es lo que
 * le dice a la cadena que pare y ensamble, y por eso no puede depender de que
 * alguien más lleve la cuenta.
 *
 * El solapamiento hace que el siguiente arranque ANTES de donde terminó el
 * anterior. Es a propósito: el modelo trunca la última página de una respuesta
 * más que ninguna otra, y esas páginas vuelven a leerse al principio de la
 * ventana siguiente, que es donde mejor lee. El dedup del ensamblado se queda
 * con la segunda copia.
 */
export function siguienteRango(
    hastaAnterior: number,
    tamano: number,
    totalPaginas: number,
): Rango | null {
    if (!Number.isFinite(hastaAnterior) || !Number.isFinite(tamano) || !Number.isFinite(totalPaginas)) return null;
    if (tamano < 1 || totalPaginas < 1) return null;
    if (hastaAnterior >= totalPaginas) return null;

    const desde = Math.max(1, hastaAnterior - OVERLAP_PAGES + 1);
    // Un solapamiento mayor que el tamaño haría que el rango siguiente empezara
    // antes que el anterior y la cadena no avanzaría nunca. No puede pasar con
    // los valores actuales, pero una cadena que no avanza es un bucle infinito
    // pagado, así que se corta acá y no en producción.
    if (desde + tamano - 1 <= hastaAnterior) return null;

    return { desde, hasta: Math.min(desde + tamano - 1, totalPaginas) };
}

/** El primer rango de un libro. */
export function primerRango(tamano: number, totalPaginas: number): Rango | null {
    if (!Number.isFinite(tamano) || !Number.isFinite(totalPaginas)) return null;
    if (tamano < 1 || totalPaginas < 1) return null;
    return { desde: 1, hasta: Math.min(tamano, totalPaginas) };
}

/**
 * El plan completo, para estimar cuánto falta y para comprobar el ensamblado.
 *
 * La cadena NO lo usa para avanzar —cada tarea calcula sólo su sucesor—, pero
 * el plan sirve para dos cosas que sí necesitan la vista entera: mostrarle al
 * usuario «rango 3 de 9» y verificar al final que no quedó ninguno sin traer.
 *
 * Ojo: el tamaño puede cambiar tras calibrar el primer rango, así que un plan
 * calculado antes de esa medición es una ESTIMACIÓN. Se usa como tal.
 */
export function planDeRangos(totalPaginas: number, tamano: number): Rango[] {
    const primero = primerRango(tamano, totalPaginas);
    if (!primero) return [];

    const rangos: Rango[] = [primero];
    // Tope defensivo: una página por rango es el peor plan legítimo posible, así
    // que más rangos que páginas significa que el avance se rompió.
    while (rangos.length <= totalPaginas) {
        const ultimo = rangos[rangos.length - 1]!;
        const siguiente = siguienteRango(ultimo.hasta, tamano, totalPaginas);
        if (!siguiente) break;
        rangos.push(siguiente);
    }
    return rangos;
}

/** Nombre del archivo donde se guarda el resultado de un rango. */
export function nombreDeRango(rango: Rango): string {
    return `${rango.desde}-${rango.hasta}.json`;
}
