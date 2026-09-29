import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * A qué documento, además de los contadores del día y del mes, se le carga el
 * consumo de las llamadas al modelo que ocurren DENTRO de un trabajo.
 *
 * Existe para la ficha de extracción: el gasto de un libro se reparte en
 * decenas de llamadas —tandas, rangos, reintentos, partidas— que viven cinco
 * funciones más abajo de quien sabe qué corrida es. Pasar un parámetro nuevo por
 * toda esa cadena, que ya pasa `userId` en posición, era tocar cada firma por un
 * dato que ninguna de ellas usa. El contexto asíncrono lo lleva solo, a través
 * de cada `await`, y lo lee sólo quien registra.
 *
 * Genérico a propósito: no sabe qué es una extracción. Cualquier trabajo que
 * quiera su propio costo puede abrir un ámbito con la ruta de su documento.
 */

export interface AtribucionDeConsumo {
    /** Ruta del documento que acumula el consumo, p. ej. `extraction_runs/{id}`. */
    ruta: string;
}

const ambito = new AsyncLocalStorage<AtribucionDeConsumo>();

/** Corre `trabajo` con su consumo cargado también a `ruta`. */
export function conAtribucion<T>(ruta: string, trabajo: () => Promise<T>): Promise<T> {
    return ambito.run({ ruta }, trabajo);
}

/** El ámbito vigente, si lo hay. Lo lee el medidor al registrar cada llamada. */
export function atribucionActual(): AtribucionDeConsumo | undefined {
    return ambito.getStore();
}
